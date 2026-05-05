"""
Document Ingestion Pipeline
============================
Converts HTML/Markdown/text files into parent-child chunks with contextual headers,
embeds them, and stores in Pinecone.

Strategy (inspired by the Reddit approach you shared):
1. Convert HTML → Markdown (preserves structure)
2. Split into PARENT chunks (1500 chars) using markdown-aware splitting
3. Split parents into CHILD chunks (250 chars) with contextual header
4. Embed children → store in Pinecone with parent_id reference
5. At query time: retrieve children → rerank → fetch parents → rerank again → LLM

The contextual header (breadcrumb from file path + section heading) is prepended
to each chunk before embedding — this massively improves retrieval accuracy.
"""
import os
import re
import hashlib
from typing import Optional
from pathlib import Path

import html2text
from config import (
    CHILD_CHUNK_SIZE, CHILD_CHUNK_OVERLAP,
    PARENT_CHUNK_SIZE, PARENT_CHUNK_OVERLAP,
    CONTEXT_HEADER_MAX, GCP_DOCS_DIR, BEST_PRACTICES_DIR,
)


# ─── HTML → Markdown ────────────────────────────────────────────

_h2t = html2text.HTML2Text()
_h2t.ignore_links = False
_h2t.ignore_images = True
_h2t.body_width = 0  # no wrapping

def html_to_markdown(html_content: str) -> str:
    """Convert HTML to clean Markdown."""
    return _h2t.handle(html_content)


def read_file(path: str) -> str:
    """Read a file and convert to markdown if HTML."""
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    if path.endswith((".html", ".htm")):
        return html_to_markdown(content)
    return content


# ─── Contextual Header ──────────────────────────────────────────

def build_context_header(file_path: str, base_dir: str, section_heading: Optional[str] = None) -> str:
    """
    Build a breadcrumb-style contextual header from the file path.
    e.g., "GCP > Compute Engine > Machine Types > General Purpose"

    This is prepended to every chunk before embedding — the Reddit user
    noted this is THE most impactful thing for retrieval quality.
    """
    rel_path = os.path.relpath(file_path, base_dir)
    parts = Path(rel_path).parts

    # Clean up: remove extensions, replace hyphens/underscores
    breadcrumbs = []
    for p in parts:
        name = os.path.splitext(p)[0]
        name = name.replace("-", " ").replace("_", " ").title()
        if name.lower() not in ("index", "readme", "docs"):
            breadcrumbs.append(name)

    header = "GCP Docs > " + " > ".join(breadcrumbs)

    if section_heading:
        header += f" > {section_heading}"

    # Truncate to max length
    if len(header) > CONTEXT_HEADER_MAX:
        header = header[:CONTEXT_HEADER_MAX - 3] + "..."

    return header


# ─── Markdown-Aware Chunking ────────────────────────────────────

def extract_sections(markdown: str) -> list[dict]:
    """
    Split markdown by headings into semantic sections.
    Returns list of {heading, content, level}.
    """
    # Split on markdown headings
    pattern = r'^(#{1,4})\s+(.+)$'
    sections = []
    current_heading = None
    current_level = 0
    current_lines: list[str] = []

    for line in markdown.split("\n"):
        match = re.match(pattern, line)
        if match:
            # Save previous section
            if current_lines:
                sections.append({
                    "heading": current_heading,
                    "level": current_level,
                    "content": "\n".join(current_lines).strip(),
                })
            current_heading = match.group(2).strip()
            current_level = len(match.group(1))
            current_lines = []
        else:
            current_lines.append(line)

    # Don't forget last section
    if current_lines:
        sections.append({
            "heading": current_heading,
            "level": current_level,
            "content": "\n".join(current_lines).strip(),
        })

    return sections


def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    """Split text into overlapping chunks, trying to break at sentence boundaries."""
    if len(text) <= chunk_size:
        return [text] if text.strip() else []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size

        # Try to break at a sentence boundary
        if end < len(text):
            # Look for sentence end in the last 20% of the chunk
            search_start = max(start + int(chunk_size * 0.8), start)
            last_period = text.rfind(". ", search_start, end)
            last_newline = text.rfind("\n", search_start, end)
            break_point = max(last_period, last_newline)
            if break_point > search_start:
                end = break_point + 1

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        start = end - overlap

    return chunks


# ─── Parent-Child Chunk Generation ───────────────────────────────

def generate_chunks(file_path: str, base_dir: str) -> tuple[list[dict], list[dict]]:
    """
    Generate parent and child chunks from a single file.

    Returns:
        (parent_chunks, child_chunks) where each chunk is a dict with:
        - id: unique hash
        - text: the chunk content (with context header for children)
        - raw_text: original text without header
        - metadata: {source, heading, parent_id, chunk_type, context_header}
    """
    content = read_file(file_path)
    if not content.strip():
        return [], []

    sections = extract_sections(content)
    if not sections:
        # No headings found — treat whole file as one section
        sections = [{"heading": None, "level": 0, "content": content}]

    parent_chunks = []
    child_chunks = []

    for section in sections:
        if not section["content"].strip():
            continue

        context_header = build_context_header(file_path, base_dir, section["heading"])

        # Create parent chunks from this section
        parents = chunk_text(section["content"], PARENT_CHUNK_SIZE, PARENT_CHUNK_OVERLAP)

        for pi, parent_text in enumerate(parents):
            parent_id = hashlib.md5(f"{file_path}:{section['heading']}:{pi}".encode()).hexdigest()

            parent_chunks.append({
                "id": f"parent-{parent_id}",
                "text": f"[{context_header}]\n\n{parent_text}",
                "raw_text": parent_text,
                "metadata": {
                    "source": file_path,
                    "heading": section["heading"] or "",
                    "chunk_type": "parent",
                    "context_header": context_header,
                },
            })

            # Create child chunks from this parent
            children = chunk_text(parent_text, CHILD_CHUNK_SIZE, CHILD_CHUNK_OVERLAP)

            for ci, child_text in enumerate(children):
                child_id = hashlib.md5(f"{parent_id}:{ci}".encode()).hexdigest()

                # Prepend context header to child (crucial for retrieval!)
                child_with_header = f"[{context_header}] {child_text}"

                child_chunks.append({
                    "id": f"child-{child_id}",
                    "text": child_with_header,
                    "raw_text": child_text,
                    "metadata": {
                        "source": file_path,
                        "heading": section["heading"] or "",
                        "parent_id": f"parent-{parent_id}",
                        "chunk_type": "child",
                        "context_header": context_header,
                    },
                })

    return parent_chunks, child_chunks


def ingest_directory(directory: str) -> tuple[list[dict], list[dict]]:
    """Process all files in a directory into parent-child chunks."""
    all_parents = []
    all_children = []

    supported_ext = (".html", ".htm", ".md", ".txt", ".text")

    for root, _, files in os.walk(directory):
        for fname in files:
            if not fname.lower().endswith(supported_ext):
                continue
            fpath = os.path.join(root, fname)
            parents, children = generate_chunks(fpath, directory)
            all_parents.extend(parents)
            all_children.extend(children)
            print(f"  ✓ {os.path.relpath(fpath, directory)}: {len(parents)} parents, {len(children)} children")

    return all_parents, all_children

"""
Document Ingestion Pipeline v2 — with HTML Cleaning
=====================================================
The v1 pipeline was ingesting GCP HTML pages including ALL the sidebar
navigation, breadcrumbs, and footer links.  This caused:
  - Citations pointing to nav elements ("* [IAM roles and permissions]...")
  - Low-quality chunks that are just lists of links
  - Wasted vector space on junk content

v2 fixes:
  1. Strip <nav>, <header>, <footer>, <aside>, role="navigation" from HTML
  2. Remove link-only sections (lines that are just markdown links)
  3. Filter out chunks that are too short or too link-heavy
  4. Track already-ingested files for incremental ingestion
"""
import os
import re
import json
import hashlib
from typing import Optional
from pathlib import Path
from datetime import datetime, timezone

import html2text
from bs4 import BeautifulSoup
from config import (
    CHILD_CHUNK_SIZE, CHILD_CHUNK_OVERLAP,
    PARENT_CHUNK_SIZE, PARENT_CHUNK_OVERLAP,
    CONTEXT_HEADER_MAX, GCP_DOCS_DIR, BEST_PRACTICES_DIR,
)


# ─── HTML Cleaning (THE FIX for bad citations) ──────────────────

def clean_html(raw_html: str) -> str:
    """
    Strip navigation, sidebar, footer, and other non-content elements
    from GCP doc HTML pages BEFORE converting to markdown.

    This is the #1 fix for the citation quality problem.
    """
    soup = BeautifulSoup(raw_html, "html.parser")

    # Remove elements that are pure navigation / chrome
    selectors_to_remove = [
        "nav", "header", "footer", "aside",
        "[role='navigation']", "[role='banner']", "[role='contentinfo']",
        "[class*='nav']", "[class*='sidebar']", "[class*='footer']",
        "[class*='header']", "[class*='breadcrumb']", "[class*='toc']",
        "[class*='menu']", "[class*='dropdown']",
        "[id*='nav']", "[id*='sidebar']", "[id*='footer']",
        "[id*='header']", "[id*='toc']",
        "script", "style", "noscript", "iframe",
        # GCP-specific: the doc page has a left nav, top bar, feedback widget
        "[class*='devsite-nav']", "[class*='devsite-header']",
        "[class*='devsite-footer']", "[class*='devsite-toc']",
        "[class*='devsite-banner']", "[class*='devsite-feedback']",
        "[class*='cta-banner']",
    ]

    for selector in selectors_to_remove:
        try:
            for element in soup.select(selector):
                element.decompose()
        except Exception:
            pass  # Some selectors may not match, that's fine

    # Try to find the main content area
    main_content = (
        soup.find("main") or
        soup.find("article") or
        soup.find(attrs={"role": "main"}) or
        soup.find(class_=re.compile(r"devsite-article-body|article-body|content")) or
        soup.find("body") or
        soup
    )

    return str(main_content)


# ─── HTML → Markdown ────────────────────────────────────────────

_h2t = html2text.HTML2Text()
_h2t.ignore_links = False
_h2t.ignore_images = True
_h2t.body_width = 0

def html_to_markdown(html_content: str) -> str:
    """Convert cleaned HTML to Markdown."""
    cleaned = clean_html(html_content)
    return _h2t.handle(cleaned)


def read_file(path: str) -> str:
    """Read a file and convert to markdown if HTML."""
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    if path.endswith((".html", ".htm")):
        return html_to_markdown(content)
    return content


# ─── Content Quality Filter ─────────────────────────────────────

def is_quality_content(text: str, min_length: int = 40) -> bool:
    """
    Filter out junk chunks:
    - Too short
    - Mostly links (> 60% of lines are markdown links)
    - Mostly whitespace
    """
    stripped = text.strip()
    if len(stripped) < min_length:
        return False

    lines = [l.strip() for l in stripped.split("\n") if l.strip()]
    if not lines:
        return False

    # Count lines that are just markdown links
    link_pattern = re.compile(r'^\s*\*?\s*\[.*\]\(.*\)\s*$')
    link_lines = sum(1 for l in lines if link_pattern.match(l))
    link_ratio = link_lines / len(lines) if lines else 0

    if link_ratio > 0.6:
        return False

    # Check if there's actual prose (at least some words)
    word_count = len(re.findall(r'\b\w+\b', stripped))
    if word_count < 10:
        return False

    return True


# ─── Contextual Header ──────────────────────────────────────────

def build_context_header(file_path: str, base_dir: str, section_heading: Optional[str] = None) -> str:
    """
    Build a breadcrumb-style contextual header from the file path.
    e.g., "GCP > Compute Engine > Machine Types > General Purpose"
    """
    rel_path = os.path.relpath(file_path, base_dir)
    parts = Path(rel_path).parts

    breadcrumbs = []
    for p in parts:
        name = os.path.splitext(p)[0]
        name = name.replace("-", " ").replace("_", " ").title()
        if name.lower() not in ("index", "readme", "docs"):
            breadcrumbs.append(name)

    header = "GCP Docs > " + " > ".join(breadcrumbs)

    if section_heading:
        header += f" > {section_heading}"

    if len(header) > CONTEXT_HEADER_MAX:
        header = header[:CONTEXT_HEADER_MAX - 3] + "..."

    return header


# ─── Markdown-Aware Chunking ────────────────────────────────────

def extract_sections(markdown: str) -> list[dict]:
    """Split markdown by headings into semantic sections."""
    pattern = r'^(#{1,4})\s+(.+)$'
    sections = []
    current_heading = None
    current_level = 0
    current_lines: list[str] = []

    for line in markdown.split("\n"):
        match = re.match(pattern, line)
        if match:
            if current_lines:
                content = "\n".join(current_lines).strip()
                if content:
                    sections.append({
                        "heading": current_heading,
                        "level": current_level,
                        "content": content,
                    })
            current_heading = match.group(2).strip()
            current_level = len(match.group(1))
            current_lines = []
        else:
            current_lines.append(line)

    if current_lines:
        content = "\n".join(current_lines).strip()
        if content:
            sections.append({
                "heading": current_heading,
                "level": current_level,
                "content": content,
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

        if end < len(text):
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
    """Generate parent and child chunks from a single file with quality filtering."""
    content = read_file(file_path)
    if not content.strip():
        return [], []

    sections = extract_sections(content)
    if not sections:
        sections = [{"heading": None, "level": 0, "content": content}]

    parent_chunks = []
    child_chunks = []
    skipped = 0

    for section in sections:
        if not section["content"].strip():
            continue

        # Skip sections that are mostly navigation links
        if not is_quality_content(section["content"]):
            skipped += 1
            continue

        context_header = build_context_header(file_path, base_dir, section["heading"])

        parents = chunk_text(section["content"], PARENT_CHUNK_SIZE, PARENT_CHUNK_OVERLAP)

        for pi, parent_text in enumerate(parents):
            # Quality filter on parent level too
            if not is_quality_content(parent_text, min_length=50):
                skipped += 1
                continue

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

            children = chunk_text(parent_text, CHILD_CHUNK_SIZE, CHILD_CHUNK_OVERLAP)

            for ci, child_text in enumerate(children):
                if not is_quality_content(child_text, min_length=30):
                    continue

                child_id = hashlib.md5(f"{parent_id}:{ci}".encode()).hexdigest()
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

    if skipped > 0:
        print(f"    ⊘ Filtered out {skipped} low-quality sections/chunks")

    return parent_chunks, child_chunks


# ─── Incremental Ingestion Tracking ──────────────────────────────

INGEST_LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".ingest_log.json")

def _load_ingest_log() -> dict:
    if os.path.exists(INGEST_LOG):
        with open(INGEST_LOG, "r") as f:
            return json.load(f)
    return {"ingested_files": {}}


def _save_ingest_log(log: dict):
    with open(INGEST_LOG, "w") as f:
        json.dump(log, f, indent=2)


def is_already_ingested(file_path: str) -> bool:
    """Check if a file has already been ingested (by hash)."""
    log = _load_ingest_log()
    with open(file_path, "rb") as f:
        file_hash = hashlib.md5(f.read()).hexdigest()
    prev_hash = log["ingested_files"].get(file_path)
    return prev_hash == file_hash


def mark_ingested(file_path: str):
    """Mark a file as ingested."""
    log = _load_ingest_log()
    with open(file_path, "rb") as f:
        file_hash = hashlib.md5(f.read()).hexdigest()
    log["ingested_files"][file_path] = file_hash
    log["last_ingestion"] = datetime.now(timezone.utc).isoformat()
    _save_ingest_log(log)


# ─── Directory Ingestion ─────────────────────────────────────────

def ingest_directory(directory: str, incremental: bool = True) -> tuple[list[dict], list[dict]]:
    """
    Process all files in a directory into parent-child chunks.
    With incremental=True, skips files that haven't changed since last ingestion.
    """
    all_parents = []
    all_children = []
    skipped_files = 0

    supported_ext = (".html", ".htm", ".md", ".txt", ".text")

    for root, _, files in os.walk(directory):
        for fname in files:
            if not fname.lower().endswith(supported_ext):
                continue
            fpath = os.path.join(root, fname)

            # Incremental: skip if already processed
            if incremental and is_already_ingested(fpath):
                skipped_files += 1
                continue

            parents, children = generate_chunks(fpath, directory)
            all_parents.extend(parents)
            all_children.extend(children)

            # Mark as ingested
            mark_ingested(fpath)

            print(f"  ✓ {os.path.relpath(fpath, directory)}: {len(parents)} parents, {len(children)} children")

    if skipped_files > 0:
        print(f"  ⏭ Skipped {skipped_files} already-ingested files (use --force to re-ingest)")

    return all_parents, all_children

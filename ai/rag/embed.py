"""
Embedding + Pinecone Storage
==============================
Embeds child chunks using local HuggingFace model (free, no API cost)
and stores in Pinecone with parent references.
"""
import os
import sys

# Add parent dir so we can import config
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from sentence_transformers import SentenceTransformer
# pyrefly: ignore [missing-import]
from pinecone import Pinecone, ServerlessSpec
from config import (
    PINECONE_API_KEY, PINECONE_INDEX_NAME, PINECONE_DIMENSION,
    EMBEDDING_MODEL, NS_GCP_DOCS, NS_BEST_PRACTICES,
    GCP_DOCS_DIR, BEST_PRACTICES_DIR,
)
from rag.ingest import ingest_directory


# ─── Embedding Model (local, free) ──────────────────────────────

_embed_model = None

def get_embed_model() -> SentenceTransformer:
    global _embed_model
    if _embed_model is None:
        print(f"Loading embedding model: {EMBEDDING_MODEL}")
        _embed_model = SentenceTransformer(EMBEDDING_MODEL)
    return _embed_model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts using the local model."""
    model = get_embed_model()
    embeddings = model.encode(texts, show_progress_bar=True, normalize_embeddings=True)
    return embeddings.tolist()


def embed_single(text: str) -> list[float]:
    """Embed a single text."""
    model = get_embed_model()
    return model.encode(text, normalize_embeddings=True).tolist()


# ─── Pinecone Client ────────────────────────────────────────────

_pc = None
_index = None

def get_pinecone_index():
    global _pc, _index
    if _index is None:
        _pc = Pinecone(api_key=PINECONE_API_KEY)

        # Create index if it doesn't exist
        existing = [idx.name for idx in _pc.list_indexes()]
        if PINECONE_INDEX_NAME not in existing:
            print(f"Creating Pinecone index: {PINECONE_INDEX_NAME}")
            _pc.create_index(
                name=PINECONE_INDEX_NAME,
                dimension=PINECONE_DIMENSION,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )

        _index = _pc.Index(PINECONE_INDEX_NAME)
    return _index


# ─── Upsert to Pinecone ─────────────────────────────────────────

def upsert_chunks(child_chunks: list[dict], parent_chunks: list[dict], namespace: str, batch_size: int = 50):
    """
    Embed child chunks and upsert to Pinecone.
    Also adds chunks to the BM25 keyword search index.
    Parent chunk text is stored in metadata for retrieval.
    """
    index = get_pinecone_index()

    # Build parent lookup
    parent_map = {p["id"]: p for p in parent_chunks}

    # Embed all child texts
    texts = [c["text"] for c in child_chunks]
    print(f"Embedding {len(texts)} child chunks...")
    embeddings = embed_texts(texts)

    # Prepare vectors and BM25 chunks
    vectors = []
    bm25_chunks = []
    for chunk, embedding in zip(child_chunks, embeddings):
        parent_id = chunk["metadata"].get("parent_id", "")
        parent = parent_map.get(parent_id, {})

        metadata = {
            "text": chunk["raw_text"][:800],  # Pinecone metadata limit
            "context_header": chunk["metadata"]["context_header"],
            "source": chunk["metadata"]["source"],
            "heading": chunk["metadata"]["heading"],
            "parent_id": parent_id,
            "parent_text": parent.get("raw_text", "")[:3500],
            "chunk_type": "child",
        }

        vectors.append({
            "id": chunk["id"],
            "values": embedding,
            "metadata": metadata,
        })

        # Also collect for BM25 index
        bm25_chunks.append({
            "id": chunk["id"],
            "text": chunk["raw_text"][:800],
            "context_header": chunk["metadata"]["context_header"],
            "source": chunk["metadata"]["source"],
            "heading": chunk["metadata"]["heading"],
            "parent_id": parent_id,
            "parent_text": parent.get("raw_text", "")[:3500],
            "namespace": namespace,
        })

    # Batch upsert to Pinecone
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i + batch_size]
        index.upsert(vectors=batch, namespace=namespace)
        print(f"  Upserted batch {i // batch_size + 1}/{(len(vectors) + batch_size - 1) // batch_size}")

    print(f"✓ Stored {len(vectors)} vectors in namespace '{namespace}'")

    # Add to BM25 index
    try:
        from rag.bm25_search import get_bm25_index
        from config import BM25_INDEX_PATH
        bm25_index = get_bm25_index()
        if bm25_index.corpus:
            bm25_index.add_chunks(bm25_chunks)
        else:
            bm25_index.build_from_chunks(bm25_chunks)
        bm25_index.save(BM25_INDEX_PATH)
        print(f"✓ BM25 index updated: {len(bm25_index.corpus)} total chunks")
    except Exception as e:
        print(f"⚠ BM25 index update failed (non-critical): {e}")


# ─── Full Ingestion Pipeline ────────────────────────────────────

def ingest_gcp_docs(force: bool = False):
    """Ingest all GCP documentation files."""
    if not os.path.exists(GCP_DOCS_DIR) or not os.listdir(GCP_DOCS_DIR):
        print(f"⚠ No files found in {GCP_DOCS_DIR}")
        print("  Place your GCP doc HTML/MD files there first.")
        return

    print(f"\n═══ Ingesting GCP Docs from {GCP_DOCS_DIR} ═══")
    parents, children = ingest_directory(GCP_DOCS_DIR, incremental=not force)
    print(f"\nTotal: {len(parents)} parents, {len(children)} children")

    if children:
        upsert_chunks(children, parents, NS_GCP_DOCS)


def ingest_best_practices(force: bool = False):
    """Ingest cloud architecture best practices."""
    if not os.path.exists(BEST_PRACTICES_DIR) or not os.listdir(BEST_PRACTICES_DIR):
        print(f"⚠ No files found in {BEST_PRACTICES_DIR}")
        return

    print(f"\n═══ Ingesting Best Practices from {BEST_PRACTICES_DIR} ═══")
    parents, children = ingest_directory(BEST_PRACTICES_DIR, incremental=not force)
    print(f"\nTotal: {len(parents)} parents, {len(children)} children")

    if children:
        upsert_chunks(children, parents, NS_BEST_PRACTICES)


def ingest_all(force: bool = False):
    """Run the full ingestion pipeline."""
    ingest_gcp_docs(force)
    ingest_best_practices(force)


# ─── CLI ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Ingest documents into Pinecone")
    parser.add_argument("--source", choices=["gcp", "practices", "all"], default="all")
    parser.add_argument("--force", action="store_true", help="Re-ingest all files (ignore cache)")
    args = parser.parse_args()

    if args.force:
        print("⚡ Force mode: re-ingesting all files\n")

    if args.source == "gcp":
        ingest_gcp_docs(args.force)
    elif args.source == "practices":
        ingest_best_practices(args.force)
    else:
        ingest_all(args.force)


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
    Parent chunk text is stored in metadata for retrieval.
    """
    index = get_pinecone_index()

    # Build parent lookup
    parent_map = {p["id"]: p for p in parent_chunks}

    # Embed all child texts
    texts = [c["text"] for c in child_chunks]
    print(f"Embedding {len(texts)} child chunks...")
    embeddings = embed_texts(texts)

    # Upsert in batches
    vectors = []
    for chunk, embedding in zip(child_chunks, embeddings):
        parent_id = chunk["metadata"].get("parent_id", "")
        parent = parent_map.get(parent_id, {})

        vectors.append({
            "id": chunk["id"],
            "values": embedding,
            "metadata": {
                "text": chunk["raw_text"][:800],  # Pinecone metadata limit
                "context_header": chunk["metadata"]["context_header"],
                "source": chunk["metadata"]["source"],
                "heading": chunk["metadata"]["heading"],
                "parent_id": parent_id,
                "parent_text": parent.get("raw_text", "")[:3500],
                "chunk_type": "child",
            },
        })

    # Batch upsert
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i + batch_size]
        index.upsert(vectors=batch, namespace=namespace)
        print(f"  Upserted batch {i // batch_size + 1}/{(len(vectors) + batch_size - 1) // batch_size}")

    print(f"✓ Stored {len(vectors)} vectors in namespace '{namespace}'")


# ─── Full Ingestion Pipeline ────────────────────────────────────

def ingest_gcp_docs():
    """Ingest all GCP documentation files."""
    if not os.path.exists(GCP_DOCS_DIR) or not os.listdir(GCP_DOCS_DIR):
        print(f"⚠ No files found in {GCP_DOCS_DIR}")
        print("  Place your GCP doc HTML/MD files there first.")
        return

    print(f"\n═══ Ingesting GCP Docs from {GCP_DOCS_DIR} ═══")
    parents, children = ingest_directory(GCP_DOCS_DIR)
    print(f"\nTotal: {len(parents)} parents, {len(children)} children")

    if children:
        upsert_chunks(children, parents, NS_GCP_DOCS)


def ingest_best_practices():
    """Ingest cloud architecture best practices."""
    if not os.path.exists(BEST_PRACTICES_DIR) or not os.listdir(BEST_PRACTICES_DIR):
        print(f"⚠ No files found in {BEST_PRACTICES_DIR}")
        return

    print(f"\n═══ Ingesting Best Practices from {BEST_PRACTICES_DIR} ═══")
    parents, children = ingest_directory(BEST_PRACTICES_DIR)
    print(f"\nTotal: {len(parents)} parents, {len(children)} children")

    if children:
        upsert_chunks(children, parents, NS_BEST_PRACTICES)


def ingest_all():
    """Run the full ingestion pipeline."""
    ingest_gcp_docs()
    ingest_best_practices()


# ─── CLI ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Ingest documents into Pinecone")
    parser.add_argument("--source", choices=["gcp", "practices", "all"], default="all")
    args = parser.parse_args()

    if args.source == "gcp":
        ingest_gcp_docs()
    elif args.source == "practices":
        ingest_best_practices()
    else:
        ingest_all()

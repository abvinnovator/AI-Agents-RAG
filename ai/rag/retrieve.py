"""
Retrieval Engine
=================
Multi-step retrieval pipeline inspired by the Reddit approach:

1. Embed query
2. Multi-query: generate an alternative phrasing of the question
3. Retrieve TOP_K children from Pinecone (for both queries)
4. Rerank children using FlashRank, keep best ones above threshold
5. Deduplicate and fetch parent chunks
6. Rerank parents against original query
7. Return final context for LLM

This avoids full agentic complexity while getting 90%+ of the benefit.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from typing import Optional
from flashrank import Ranker, RerankRequest

from config import (
    TOP_K_CHILDREN, RERANK_KEEP_CHILDREN, MIN_RELEVANCE_SCORE,
    TOP_K_PARENTS, FINAL_RERANK_KEEP, RERANKER_MODEL,
    NS_GCP_DOCS, NS_BEST_PRACTICES,
)
from rag.embed import embed_single, get_pinecone_index


# ─── Reranker (local, free) ─────────────────────────────────────

_ranker = None

def get_ranker() -> Ranker:
    global _ranker
    if _ranker is None:
        _ranker = Ranker(model_name=RERANKER_MODEL)
    return _ranker


def rerank(query: str, passages: list[dict], top_k: int, min_score: float = 0.0) -> list[dict]:
    """
    Rerank passages against query using FlashRank (local, free cross-encoder).
    Each passage dict must have a 'text' key.
    """
    if not passages:
        return []

    ranker = get_ranker()
    request = RerankRequest(
        query=query,
        passages=[{"id": str(i), "text": p["text"]} for i, p in enumerate(passages)],
    )
    results = ranker.rerank(request)

    reranked = []
    for r in results[:top_k]:
        idx = int(r["id"])
        score = r["score"]
        if score >= min_score:
            passage = passages[idx].copy()
            passage["rerank_score"] = score
            reranked.append(passage)

    return reranked


# ─── Multi-Query Generation ─────────────────────────────────────

def generate_alt_query(original_query: str) -> str:
    """
    Generate an alternative phrasing of the query for multi-query retrieval.
    Uses simple heuristics — we'll use LLM for this when connected.
    """
    # Simple transformations for now
    # In production, we use Gemini to rephrase
    alt = original_query

    # Add "GCP" context if not present
    gcp_terms = ["gcp", "google cloud", "cloud platform"]
    if not any(t in original_query.lower() for t in gcp_terms):
        alt = f"Google Cloud Platform: {original_query}"

    return alt


# ─── Core Retrieval Pipeline ────────────────────────────────────

def retrieve(
    query: str,
    namespaces: Optional[list[str]] = None,
    top_k_final: int = FINAL_RERANK_KEEP,
) -> list[dict]:
    """
    Multi-step retrieval pipeline:
    1. Embed query + alt query
    2. Retrieve children from Pinecone
    3. Rerank children
    4. Fetch parent chunks
    5. Rerank parents
    6. Return final context

    Returns list of dicts with: text, source, heading, context_header, rerank_score
    """
    if namespaces is None:
        namespaces = [NS_GCP_DOCS, NS_BEST_PRACTICES]

    index = get_pinecone_index()

    # Step 1: Embed both queries
    q_embedding = embed_single(query)
    alt_query = generate_alt_query(query)
    alt_embedding = embed_single(alt_query) if alt_query != query else q_embedding

    # Step 2: Retrieve children from all namespaces
    all_children = []
    for ns in namespaces:
        # Original query
        results = index.query(
            vector=q_embedding,
            top_k=TOP_K_CHILDREN,
            namespace=ns,
            include_metadata=True,
        )
        for match in results.matches:
            all_children.append({
                "id": match.id,
                "text": match.metadata.get("text", ""),
                "context_header": match.metadata.get("context_header", ""),
                "source": match.metadata.get("source", ""),
                "heading": match.metadata.get("heading", ""),
                "parent_id": match.metadata.get("parent_id", ""),
                "parent_text": match.metadata.get("parent_text", ""),
                "vector_score": match.score,
                "namespace": ns,
            })

        # Alt query (only if different)
        if alt_query != query:
            results2 = index.query(
                vector=alt_embedding,
                top_k=TOP_K_CHILDREN // 2,
                namespace=ns,
                include_metadata=True,
            )
            for match in results2.matches:
                if not any(c["id"] == match.id for c in all_children):
                    all_children.append({
                        "id": match.id,
                        "text": match.metadata.get("text", ""),
                        "context_header": match.metadata.get("context_header", ""),
                        "source": match.metadata.get("source", ""),
                        "heading": match.metadata.get("heading", ""),
                        "parent_id": match.metadata.get("parent_id", ""),
                        "parent_text": match.metadata.get("parent_text", ""),
                        "vector_score": match.score,
                        "namespace": ns,
                    })

    if not all_children:
        return []

    # Step 3: Rerank children
    reranked_children = rerank(
        query,
        all_children,
        top_k=RERANK_KEEP_CHILDREN,
        min_score=MIN_RELEVANCE_SCORE,
    )

    # Step 4: Fetch unique parent chunks
    seen_parents = set()
    parent_chunks = []
    for child in reranked_children:
        pid = child.get("parent_id", "")
        if pid and pid not in seen_parents and child.get("parent_text"):
            seen_parents.add(pid)
            parent_chunks.append({
                "id": pid,
                "text": child["parent_text"],
                "context_header": child["context_header"],
                "source": child["source"],
                "heading": child["heading"],
                "namespace": child["namespace"],
            })

    if not parent_chunks:
        # Fallback: use children directly if no parents
        return reranked_children[:top_k_final]

    # Step 5: Rerank parents against original query
    final_chunks = rerank(
        query,
        parent_chunks,
        top_k=top_k_final,
        min_score=MIN_RELEVANCE_SCORE,
    )

    return final_chunks


# ─── Convenience Functions ───────────────────────────────────────

def retrieve_for_ticket(
    ticket_description: str,
    category: str,
) -> list[dict]:
    """Retrieve relevant GCP docs for a support ticket."""
    enriched_query = f"[{category}] {ticket_description}"
    return retrieve(enriched_query)


def retrieve_for_billing(query: str) -> list[dict]:
    """Retrieve billing-specific documentation."""
    enriched_query = f"GCP billing cost optimization: {query}"
    return retrieve(enriched_query)


# ─── CLI Test ────────────────────────────────────────────────────

if __name__ == "__main__":
    query = input("Enter query: ").strip()
    if query:
        results = retrieve(query)
        print(f"\n{'='*60}")
        print(f"Found {len(results)} relevant chunks:")
        for i, r in enumerate(results):
            print(f"\n--- Chunk {i+1} (score: {r.get('rerank_score', 'N/A'):.3f}) ---")
            print(f"Source: {r.get('context_header', 'N/A')}")
            print(r["text"][:300] + "...")

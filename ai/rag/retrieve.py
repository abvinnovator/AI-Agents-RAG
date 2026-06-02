"""
Retrieval Engine v3 — Hybrid Search + CRAG + Web Search
=========================================================
Multi-step retrieval with hybrid search (vector + BM25) and corrective RAG:

1. Embed query + alt query (multi-query)
2. Retrieve children from Pinecone (semantic vector search)
3. BM25 keyword search on local index
4. Merge via Reciprocal Rank Fusion (RRF)
5. Rerank merged results → fetch parents → rerank parents
6. CRAG EVALUATE: Is the retrieval CORRECT / AMBIGUOUS / INCORRECT?
7. If INCORRECT → DuckDuckGo web search fallback
8. If AMBIGUOUS → combine vector DB + web search
9. Return final context with confidence + source metadata

v3 Changes:
  ✓ Hybrid search: vector + BM25 merged via RRF
  ✓ Cleaner web search query construction
  ✓ Post-filtering of web results

Level-wise Namespace Strategy:
  L1 → basic docs only (gcp-docs-l1)
  L2 → L1 + advanced docs (gcp-docs-l2)
  L3 → L1 + L2 + all docs (gcp-docs)
  L4 → everything + best practices + all agent data (master)
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import logging
from typing import Optional
# pyrefly: ignore [missing-import]
from flashrank import Ranker, RerankRequest

from config import (
    TOP_K_CHILDREN, RERANK_KEEP_CHILDREN, MIN_RELEVANCE_SCORE,
    TOP_K_PARENTS, FINAL_RERANK_KEEP, RERANKER_MODEL,
    NS_GCP_DOCS, NS_BEST_PRACTICES, BM25_TOP_K,
)
from rag.embed import embed_single, get_pinecone_index
from rag.evaluator import evaluate_retrieval
from rag.web_search import web_search, web_search_for_support
from rag.bm25_search import get_bm25_index, reciprocal_rank_fusion
from rag.monitor import PipelineEvent, StageTimer

logger = logging.getLogger("cloudops.retrieve")


# ─── Level-wise Namespace Mapping ────────────────────────────────

LEVEL_NAMESPACES = {
    "L1": [NS_GCP_DOCS],                              # Basic docs only
    "L2": [NS_GCP_DOCS, NS_BEST_PRACTICES],           # + best practices
    "L3": [NS_GCP_DOCS, NS_BEST_PRACTICES],           # + all docs
    "L4": [NS_GCP_DOCS, NS_BEST_PRACTICES],           # Master: everything
    "TSE": [NS_GCP_DOCS, NS_BEST_PRACTICES],          # Technical Support
    "super_admin": [NS_GCP_DOCS, NS_BEST_PRACTICES],  # Admin sees all
}


def get_namespaces_for_level(level: str) -> list[str]:
    """Get the appropriate Pinecone namespaces for a support level."""
    return LEVEL_NAMESPACES.get(level, [NS_GCP_DOCS, NS_BEST_PRACTICES])


# ─── Reranker (local, free) ─────────────────────────────────────

_ranker = None

def get_ranker() -> Ranker:
    global _ranker
    if _ranker is None:
        _ranker = Ranker(model_name=RERANKER_MODEL)
    return _ranker


def rerank(query: str, passages: list[dict], top_k: int, min_score: float = 0.0) -> list[dict]:
    """Rerank passages against query using FlashRank (local, free cross-encoder)."""
    if not passages:
        return []

    ranker = get_ranker()
    request = RerankRequest(
        query=query,
        passages=[{"id": str(i), "text": p["text"][:512]} for i, p in enumerate(passages)],
    )
    results = ranker.rerank(request)

    reranked = []
    for r in results[:top_k]:
        idx = int(r["id"])
        score = float(r["score"])  # FlashRank returns numpy float32 — cast to native float
        if score >= min_score:
            passage = passages[idx].copy()
            passage["rerank_score"] = score
            reranked.append(passage)

    return reranked


# ─── Multi-Query Generation ─────────────────────────────────────

def generate_alt_query(original_query: str) -> str:
    """Generate an alternative phrasing for multi-query retrieval."""
    alt = original_query
    gcp_terms = ["gcp", "google cloud", "cloud platform"]
    if not any(t in original_query.lower() for t in gcp_terms):
        alt = f"Google Cloud Platform: {original_query}"
    return alt


# ─── Core Hybrid CRAG Retrieval Pipeline ─────────────────────────

def retrieve(
    query: str,
    namespaces: Optional[list[str]] = None,
    top_k_final: int = FINAL_RERANK_KEEP,
    support_level: Optional[str] = None,
    ticket_category: Optional[str] = None,
    enable_crag: bool = True,
    enable_web_search: bool = True,
    enable_bm25: bool = True,
) -> dict:
    """
    Full Hybrid CRAG retrieval pipeline:
    1. Vector search (semantic) + BM25 search (keyword)
    2. Merge via Reciprocal Rank Fusion (RRF)
    3. Rerank → parent retrieval → rerank
    4. CRAG evaluate confidence
    5. If needed, web search fallback
    6. Return {chunks, confidence, source, evaluation, web_results}

    Returns dict (not just list!) with full metadata for monitoring.
    """
    event = PipelineEvent("retrieve", query)

    # Determine namespaces based on support level
    if namespaces is None:
        if support_level:
            namespaces = get_namespaces_for_level(support_level)
        else:
            namespaces = [NS_GCP_DOCS, NS_BEST_PRACTICES]

    index = get_pinecone_index()

    # ── Step 1: Embed queries ────────────────────────────────────
    with StageTimer(event, "embed") as timer:
        q_embedding = embed_single(query)
        alt_query = generate_alt_query(query)
        alt_embedding = embed_single(alt_query) if alt_query != query else q_embedding
        timer.set(alt_query_generated=alt_query != query)

    # ── Step 2: Vector search (semantic) ─────────────────────────
    all_children = []
    with StageTimer(event, "vector_search") as timer:
        for ns in namespaces:
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

            # Alt query
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

        timer.set(children_found=len(all_children))

    # ── Step 3: BM25 keyword search ──────────────────────────────
    bm25_results = []
    if enable_bm25:
        with StageTimer(event, "bm25_search") as timer:
            bm25_index = get_bm25_index()
            if bm25_index.is_ready:
                bm25_results = bm25_index.search(query, top_k=BM25_TOP_K)
                timer.set(bm25_hits=len(bm25_results))
            else:
                timer.set(bm25_hits=0, status="index_not_ready")

    # ── Step 4: Merge via RRF ────────────────────────────────────
    if bm25_results:
        with StageTimer(event, "rrf_merge") as timer:
            merged = reciprocal_rank_fusion(all_children, bm25_results)
            timer.set(
                vector_count=len(all_children),
                bm25_count=len(bm25_results),
                merged_count=len(merged),
            )
            all_children = merged

    # ── Step 5: Rerank children ──────────────────────────────────
    with StageTimer(event, "rerank_children") as timer:
        reranked_children = rerank(query, all_children, top_k=RERANK_KEEP_CHILDREN, min_score=MIN_RELEVANCE_SCORE)
        timer.set(kept=len(reranked_children), from_total=len(all_children))

    # ── Step 6: Fetch parent chunks ──────────────────────────────
    with StageTimer(event, "parent_retrieval") as timer:
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
                    "namespace": child.get("namespace", ""),
                })
        timer.set(parents_found=len(parent_chunks))

    # Use parents if available, otherwise fall back to children
    internal_chunks = parent_chunks if parent_chunks else reranked_children

    # ── Step 7: Rerank parents ───────────────────────────────────
    with StageTimer(event, "rerank_final") as timer:
        final_chunks = rerank(query, internal_chunks, top_k=top_k_final, min_score=MIN_RELEVANCE_SCORE)
        timer.set(final_count=len(final_chunks))

    # ── Step 8: CRAG Evaluate ────────────────────────────────────
    evaluation = {"confidence": "CORRECT", "missing_topics": []}
    web_results = []

    if enable_crag and final_chunks:
        with StageTimer(event, "crag_evaluate") as timer:
            evaluation = evaluate_retrieval(query, final_chunks)
            confidence = evaluation.get("confidence", "CORRECT")
            timer.set(confidence=confidence, avg_score=evaluation.get("average_score", 0))
            logger.info(f"  CRAG verdict: {confidence} (avg={evaluation.get('average_score', 0):.1f}/5)")
    elif not final_chunks:
        evaluation = {"confidence": "INCORRECT", "missing_topics": [query]}

    confidence = evaluation.get("confidence", "CORRECT")

    # ── Step 9: Web search fallback if needed ────────────────────
    if enable_web_search and confidence in ("INCORRECT", "AMBIGUOUS"):
        with StageTimer(event, "web_search") as timer:
            missing = evaluation.get("missing_topics", [])
            if ticket_category:
                web_results = web_search_for_support(query, ticket_category, missing)
            else:
                web_results = web_search(query, max_results=5)
            timer.set(results_found=len(web_results))

    # ── Determine final source ───────────────────────────────────
    if confidence == "CORRECT":
        source = "vector_db"
        all_context = final_chunks
    elif confidence == "AMBIGUOUS":
        source = "vector_db+web"
        # Combine: vector DB chunks + web results
        all_context = final_chunks + web_results
    else:  # INCORRECT
        if web_results:
            source = "web_search"
            all_context = web_results
        else:
            source = "none"
            all_context = []

    # ── Log and return ───────────────────────────────────────────
    event.set_result(
        confidence=confidence,
        source=source,
        chunks_returned=len(all_context),
        web_results_count=len(web_results),
        bm25_used=bool(bm25_results),
    )
    event.finish()

    return {
        "chunks": all_context,
        "confidence": confidence,
        "source": source,
        "evaluation": evaluation,
        "web_results": web_results,
        "query": query,
    }


# ─── Convenience Functions ───────────────────────────────────────

def retrieve_for_ticket(
    ticket_description: str,
    category: str,
    support_level: str = "L1",
) -> dict:
    """Retrieve relevant docs for a support ticket with CRAG."""
    enriched_query = f"[{category}] {ticket_description}"
    return retrieve(
        enriched_query,
        support_level=support_level,
        ticket_category=category,
    )


def retrieve_for_billing(query: str) -> dict:
    """Retrieve billing-specific documentation with CRAG."""
    enriched_query = f"GCP billing cost optimization: {query}"
    return retrieve(enriched_query)


# ─── CLI Test ────────────────────────────────────────────────────

if __name__ == "__main__":
    query = input("Enter query: ").strip()
    level = input("Support level (L1/L2/L3/L4) [L1]: ").strip() or "L1"
    if query:
        result = retrieve(query, support_level=level)
        print(f"\n{'='*60}")
        print(f"Confidence: {result['confidence']}")
        print(f"Source: {result['source']}")
        print(f"Chunks: {len(result['chunks'])}")
        if result['web_results']:
            print(f"Web results: {len(result['web_results'])}")
        print(f"\nEvaluation: {result['evaluation'].get('reasoning', 'N/A')}")
        for i, c in enumerate(result['chunks'][:3]):
            print(f"\n--- Chunk {i+1} ---")
            print(f"Source: {c.get('context_header', c.get('title', 'N/A'))}")
            print(c.get("text", "")[:300])

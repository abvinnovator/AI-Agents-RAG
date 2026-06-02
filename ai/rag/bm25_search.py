"""
BM25 Keyword Search
====================
Hybrid search companion to the Pinecone vector DB.
BM25 catches exact keyword matches that semantic embeddings miss.

Example: For query "SSH port 22 firewall", vector search might find
generic "network troubleshooting" docs, while BM25 finds the exact
chunk containing "port 22" and "SSH" keywords.

Algorithm: Okapi BM25 (via rank_bm25 library)
  - k1=1.5, b=0.75 (standard parameters)
  - Tokenization: lowercase + punctuation removal + stopword filtering
  - Stored in-memory, rebuilt from persisted JSON on startup

Usage:
  index = get_bm25_index()
  results = index.search("SSH port 22 firewall rules", top_k=10)
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import re
import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("cloudops.bm25")

# Try to import rank_bm25, gracefully degrade if not installed
try:
    # pyrefly: ignore [missing-import]
    from rank_bm25 import BM25Okapi
    BM25_AVAILABLE = True
except ImportError:
    BM25_AVAILABLE = False
    logger.warning("rank_bm25 not installed. BM25 keyword search disabled. Install: pip install rank-bm25")


# ─── Stopwords for tokenization ─────────────────────────────────

STOP_WORDS = {
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if',
    'while', 'about', 'that', 'this', 'these', 'those', 'what', 'which',
    'who', 'whom', 'its', 'it', 'i', 'my', 'me', 'we', 'our', 'you',
    'your', 'he', 'she', 'they', 'them', 'his', 'her', 'their',
}


def tokenize(text: str) -> list[str]:
    """
    Tokenize text for BM25:
    - Lowercase
    - Remove punctuation (but keep hyphens in words like 'gcloud')
    - Remove stopwords
    - Keep tokens >= 2 chars
    """
    # Lowercase and extract word tokens
    tokens = re.findall(r'[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?', text.lower())
    # Filter stopwords and short tokens
    return [t for t in tokens if t not in STOP_WORDS and len(t) >= 2]


class BM25Index:
    """
    Local BM25 keyword search index.
    Stores the same chunks that are in Pinecone, but indexed for keyword matching.
    """

    def __init__(self):
        self.corpus: list[dict] = []           # Original chunk dicts
        self.tokenized_corpus: list[list[str]] = []  # Tokenized texts
        self.bm25: Optional[object] = None     # BM25Okapi instance
        self._built = False

    def build_from_chunks(self, chunks: list[dict]):
        """
        Build BM25 index from chunk dicts.
        Each chunk must have at least 'text' and 'id' keys.
        """
        if not BM25_AVAILABLE:
            logger.warning("BM25 not available — skipping index build")
            return

        self.corpus = chunks
        self.tokenized_corpus = []

        for chunk in chunks:
            # Combine text + context_header + heading for richer keyword matching
            combined = " ".join(filter(None, [
                chunk.get("text", ""),
                chunk.get("context_header", ""),
                chunk.get("heading", ""),
            ]))
            self.tokenized_corpus.append(tokenize(combined))

        if self.tokenized_corpus:
            self.bm25 = BM25Okapi(self.tokenized_corpus)
            self._built = True
            logger.info(f"BM25 index built with {len(self.corpus)} chunks")
        else:
            logger.warning("No chunks to build BM25 index from")

    def search(self, query: str, top_k: int = 10) -> list[dict]:
        """
        Keyword search using BM25 scoring.
        Returns chunk dicts sorted by BM25 relevance score.
        """
        if not self._built or not BM25_AVAILABLE:
            return []

        query_tokens = tokenize(query)
        if not query_tokens:
            return []

        scores = self.bm25.get_scores(query_tokens)

        # Get top-k indices sorted by score (descending)
        scored_indices = sorted(
            enumerate(scores),
            key=lambda x: x[1],
            reverse=True
        )[:top_k]

        results = []
        for idx, score in scored_indices:
            if score <= 0:
                continue  # Skip zero-score results
            chunk = self.corpus[idx].copy()
            chunk["bm25_score"] = float(score)
            results.append(chunk)

        logger.info(f"BM25 search for '{query[:60]}': {len(results)} results (top score: {results[0]['bm25_score']:.3f})" if results else f"BM25 search for '{query[:60]}': 0 results")
        return results

    def add_chunks(self, new_chunks: list[dict]):
        """Add chunks to an existing index (incremental build)."""
        if not BM25_AVAILABLE:
            return

        self.corpus.extend(new_chunks)
        for chunk in new_chunks:
            combined = " ".join(filter(None, [
                chunk.get("text", ""),
                chunk.get("context_header", ""),
                chunk.get("heading", ""),
            ]))
            self.tokenized_corpus.append(tokenize(combined))

        # Rebuild BM25 with full corpus
        if self.tokenized_corpus:
            self.bm25 = BM25Okapi(self.tokenized_corpus)
            self._built = True

    def save(self, path: str):
        """Persist index to disk as JSON."""
        data = {
            "chunks": [
                {
                    "id": c.get("id", ""),
                    "text": c.get("text", "")[:2000],  # Limit text size
                    "context_header": c.get("context_header", ""),
                    "heading": c.get("heading", ""),
                    "source": c.get("source", ""),
                    "parent_id": c.get("parent_id", ""),
                    "parent_text": c.get("parent_text", "")[:3500],
                    "namespace": c.get("namespace", ""),
                }
                for c in self.corpus
            ]
        }
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        logger.info(f"BM25 index saved: {len(self.corpus)} chunks → {path}")

    def load(self, path: str) -> bool:
        """Load index from disk. Returns True if loaded successfully."""
        if not os.path.exists(path):
            logger.info(f"No BM25 index file found at {path}")
            return False

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)

            chunks = data.get("chunks", [])
            if chunks:
                self.build_from_chunks(chunks)
                logger.info(f"BM25 index loaded: {len(chunks)} chunks from {path}")
                return True
            else:
                logger.warning(f"BM25 index file empty: {path}")
                return False

        except Exception as e:
            logger.error(f"Failed to load BM25 index: {e}")
            return False

    @property
    def is_ready(self) -> bool:
        return self._built and BM25_AVAILABLE


# ─── Singleton Index ─────────────────────────────────────────────

_bm25_index: Optional[BM25Index] = None


def get_bm25_index() -> BM25Index:
    """Get or create the singleton BM25 index."""
    global _bm25_index
    if _bm25_index is None:
        from config import BM25_INDEX_PATH
        _bm25_index = BM25Index()
        _bm25_index.load(BM25_INDEX_PATH)
    return _bm25_index


def rebuild_bm25_index(chunks: list[dict], save_path: Optional[str] = None):
    """Rebuild the BM25 index from scratch and optionally save."""
    global _bm25_index
    _bm25_index = BM25Index()
    _bm25_index.build_from_chunks(chunks)
    if save_path:
        _bm25_index.save(save_path)
    return _bm25_index


# ─── Reciprocal Rank Fusion ──────────────────────────────────────

def reciprocal_rank_fusion(
    vector_results: list[dict],
    bm25_results: list[dict],
    k: int = 60,
) -> list[dict]:
    """
    Merge two ranked result lists using Reciprocal Rank Fusion (RRF).

    RRF is a simple, parameter-free method to combine rankings:
      score(doc) = Σ 1 / (k + rank_i)

    Where rank_i is the position in each ranking list.
    k=60 is the standard constant (from the original RRF paper).

    Returns merged list sorted by RRF score, with duplicates removed.
    """
    # Build doc lookup by ID
    doc_map = {}
    rrf_scores = {}

    for rank, doc in enumerate(vector_results):
        doc_id = doc.get("id", str(rank))
        doc_map[doc_id] = doc
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + 1.0 / (k + rank + 1)

    for rank, doc in enumerate(bm25_results):
        doc_id = doc.get("id", f"bm25-{rank}")
        if doc_id not in doc_map:
            doc_map[doc_id] = doc
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + 1.0 / (k + rank + 1)

    # Sort by RRF score
    sorted_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)

    merged = []
    for doc_id in sorted_ids:
        doc = doc_map[doc_id].copy()
        doc["rrf_score"] = rrf_scores[doc_id]
        merged.append(doc)

    return merged


# ─── CLI Test ────────────────────────────────────────────────────

if __name__ == "__main__":
    from config import BM25_INDEX_PATH

    idx = BM25Index()
    if idx.load(BM25_INDEX_PATH):
        query = input("Search query: ").strip()
        if query:
            results = idx.search(query, top_k=5)
            print(f"\n{'='*60}")
            print(f"Results: {len(results)}")
            for i, r in enumerate(results):
                print(f"\n--- Result {i+1} (BM25 score: {r['bm25_score']:.3f}) ---")
                print(f"Source: {r.get('context_header', 'N/A')}")
                print(r.get("text", "")[:200])
    else:
        print("No BM25 index found. Run ingestion first.")

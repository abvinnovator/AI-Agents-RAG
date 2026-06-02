"""
CloudOps AI Configuration
===========================
Centralised settings loaded from .env.
Every other module imports constants from here — keeps secrets and
tunables in one place.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# ─── Load .env ───────────────────────────────────────────────────
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path)


# ─── API Keys ────────────────────────────────────────────────────

GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "AQ.Ab8RN6Iv21f01viZiA-sC6YGgXbStqWfPeUsPQv38Gwrr2or0w")
PINECONE_API_KEY: str = os.getenv("PINECONE_API_KEY", "")
MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017/cloudops")


# ─── Pinecone ────────────────────────────────────────────────────

PINECONE_INDEX_NAME: str = os.getenv("PINECONE_INDEX_NAME", "cloudops-rag")
PINECONE_DIMENSION: int = 384  # BAAI/bge-small-en-v1.5 output dimension


# ─── Embedding & Reranker Models ─────────────────────────────────

EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
RERANKER_MODEL: str = os.getenv("RERANKER_MODEL", "ms-marco-MiniLM-L-12-v2")
LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-2.5-flash")


# ─── Pinecone Namespace Names ────────────────────────────────────

NS_GCP_DOCS: str = "gcp-docs"
NS_BEST_PRACTICES: str = "best-practices"
NS_TICKETS: str = "resolved-tickets"
NS_AGENT_PREFIX: str = "agent-"          # per-engineer namespace prefix


# ─── Chunking Parameters ────────────────────────────────────────

PARENT_CHUNK_SIZE: int = 1500            # chars per parent chunk
PARENT_CHUNK_OVERLAP: int = 200
CHILD_CHUNK_SIZE: int = 250              # chars per child chunk
CHILD_CHUNK_OVERLAP: int = 50
CONTEXT_HEADER_MAX: int = 120            # max length for breadcrumb header


# ─── Retrieval Pipeline Tuning ───────────────────────────────────

TOP_K_CHILDREN: int = 20                 # children fetched from Pinecone
RERANK_KEEP_CHILDREN: int = 8            # children kept after first rerank
MIN_RELEVANCE_SCORE: float = 0.15        # floor for rerank scores
TOP_K_PARENTS: int = 5                   # parents fetched
FINAL_RERANK_KEEP: int = 5              # final chunks sent to LLM


# ─── Agent Behaviour ────────────────────────────────────────────

AGENT_TOP_K: int = 10                    # vectors fetched per agent search
AGENT_SIMILARITY_THRESHOLD: float = 0.65 # min rerank score to trust past tickets (raised from 0.35)


# ─── Data Directories ───────────────────────────────────────────

_DATA_ROOT = Path(__file__).resolve().parent / "data"
GCP_DOCS_DIR: str = str(_DATA_ROOT / "gcp_docs")
BEST_PRACTICES_DIR: str = str(_DATA_ROOT / "best_practices")


# ─── BM25 Hybrid Search ────────────────────────────────────────

BM25_INDEX_PATH: str = str(_DATA_ROOT / "bm25_index.json")
BM25_TOP_K: int = 15                     # BM25 results before merge
HYBRID_RRF_K: int = 60                   # RRF constant (standard = 60)


# ─── AI Tracker / Dashboard ────────────────────────────────────

_LOG_ROOT = Path(__file__).resolve().parent / "logs"
AI_TRACKER_LOG: str = str(_LOG_ROOT / "ai_tracker.jsonl")
AI_TRACKER_METRICS: str = str(_LOG_ROOT / "ai_tracker_metrics.json")


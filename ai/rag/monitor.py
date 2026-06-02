"""
RAG Pipeline Monitor
=====================
Structured logging and monitoring for the entire RAG pipeline.
Tracks:
  - Query latency per stage (embed, retrieve, rerank, evaluate, generate)
  - Retrieval quality (confidence scores, source distribution)
  - Agent performance (suggestion acceptance rate)
  - Errors and failures with full context

Logs are written to:
  - Console (human readable)
  - JSON log file (machine parseable, for dashboards)
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import json
import time
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from pathlib import Path

# ─── Log File Setup ──────────────────────────────────────────────

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

PIPELINE_LOG = LOG_DIR / "pipeline.jsonl"   # structured JSON lines
METRICS_LOG = LOG_DIR / "metrics.json"       # aggregated metrics

# ─── Logger Setup ────────────────────────────────────────────────

def setup_logging():
    """Configure logging for the entire AI system."""
    # Console handler — human readable
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(logging.Formatter(
        "%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        datefmt="%H:%M:%S"
    ))

    # File handler — detailed debug
    file_handler = logging.FileHandler(LOG_DIR / "ai_system.log", encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(name)s] %(levelname)s: %(message)s"
    ))

    # Root logger
    root = logging.getLogger("cloudops")
    root.setLevel(logging.DEBUG)
    root.addHandler(console)
    root.addHandler(file_handler)

    return root


logger = setup_logging()


# ─── Pipeline Event Logger ───────────────────────────────────────

class PipelineEvent:
    """Structured event for the pipeline log."""

    def __init__(self, event_type: str, query: str = ""):
        self.event_type = event_type
        self.query = query
        self.start_time = time.time()
        self.stages: list[dict] = []
        self.metadata: dict[str, Any] = {}

    def log_stage(self, stage_name: str, duration_ms: float, details: dict = None):
        """Log a pipeline stage with timing."""
        entry = {
            "stage": stage_name,
            "duration_ms": round(duration_ms, 1),
        }
        if details:
            entry["details"] = details
        self.stages.append(entry)
        logger.info(f"  ⏱ {stage_name}: {duration_ms:.0f}ms")

    def set_result(self, **kwargs):
        """Set the final result metadata."""
        self.metadata.update(kwargs)

    def finish(self):
        """Write the complete event to the log file."""
        total_ms = (time.time() - self.start_time) * 1000
        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": self.event_type,
            "query": self.query[:200],
            "total_ms": round(total_ms, 1),
            "stages": self.stages,
            **self.metadata,
        }

        # Append to JSONL log
        with open(PIPELINE_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(event) + "\n")

        # Update aggregated metrics
        _update_metrics(event)

        level_label = "✓" if self.metadata.get("confidence") != "INCORRECT" else "✗"
        logger.info(
            f"{level_label} Pipeline complete: {total_ms:.0f}ms | "
            f"confidence={self.metadata.get('confidence', 'N/A')} | "
            f"source={self.metadata.get('source', 'N/A')}"
        )

        return event


# ─── Aggregated Metrics ──────────────────────────────────────────

def _update_metrics(event: dict):
    """Update running metrics from a pipeline event."""
    metrics = _load_metrics()

    metrics["total_queries"] = metrics.get("total_queries", 0) + 1

    # Track confidence distribution
    conf = event.get("confidence", "UNKNOWN")
    conf_dist = metrics.get("confidence_distribution", {})
    conf_dist[conf] = conf_dist.get(conf, 0) + 1
    metrics["confidence_distribution"] = conf_dist

    # Track source distribution
    src = event.get("source", "unknown")
    src_dist = metrics.get("source_distribution", {})
    src_dist[src] = src_dist.get(src, 0) + 1
    metrics["source_distribution"] = src_dist

    # Track latency
    latencies = metrics.get("latencies_ms", [])
    latencies.append(event.get("total_ms", 0))
    if len(latencies) > 100:
        latencies = latencies[-100:]  # Keep last 100
    metrics["latencies_ms"] = latencies
    metrics["avg_latency_ms"] = round(sum(latencies) / len(latencies), 1) if latencies else 0

    # Track web search fallback rate
    if src == "web_search":
        metrics["web_search_count"] = metrics.get("web_search_count", 0) + 1
    metrics["web_search_rate"] = round(
        metrics.get("web_search_count", 0) / max(metrics.get("total_queries", 1), 1) * 100, 1
    )

    metrics["last_updated"] = datetime.now(timezone.utc).isoformat()

    _save_metrics(metrics)


def _load_metrics() -> dict:
    if METRICS_LOG.exists():
        with open(METRICS_LOG, "r") as f:
            return json.load(f)
    return {}


def _save_metrics(metrics: dict):
    with open(METRICS_LOG, "w") as f:
        json.dump(metrics, f, indent=2)


def get_metrics() -> dict:
    """Get current pipeline metrics (called by API endpoint)."""
    return _load_metrics()


# ─── Timer Context Manager ───────────────────────────────────────

class StageTimer:
    """Context manager for timing pipeline stages."""

    def __init__(self, event: PipelineEvent, stage_name: str):
        self.event = event
        self.stage_name = stage_name
        self.start = None
        self.details: dict = {}

    def __enter__(self):
        self.start = time.time()
        return self

    def __exit__(self, *args):
        duration_ms = (time.time() - self.start) * 1000
        self.event.log_stage(self.stage_name, duration_ms, self.details)

    def set(self, **kwargs):
        """Set details for this stage."""
        self.details.update(kwargs)


# ─── Agent Decision Logger ───────────────────────────────────────

AGENT_LOG = LOG_DIR / "agent_decisions.jsonl"

def log_agent_decision(
    agent_id: str,
    agent_name: str,
    user_role: str,
    ticket_title: str,
    ticket_category: str,
    decision: dict,
):
    """
    Log every agent decision — whether it used past tickets, shared tickets,
    CRAG docs, web search, or returned nothing.
    This is the TOP-LEVEL log that catches ALL decisions, including the ones
    that never reach the RAG pipeline.
    """
    event = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": "agent_decision",
        "agent_id": agent_id,
        "agent_name": agent_name,
        "user_role": user_role,
        "ticket_title": ticket_title[:200],
        "ticket_category": ticket_category,
        "source": decision.get("source", "unknown"),
        "confidence": decision.get("confidence", 0),
        "has_suggestion": decision.get("suggestion") is not None,
        "similar_tickets_count": len(decision.get("similar_tickets", [])),
        "citations_count": len(decision.get("citations", [])),
    }

    # Write to agent decisions log
    with open(AGENT_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(event) + "\n")

    # Also update metrics
    _update_metrics(event)

    logger.info(
        f"🤖 Agent Decision: {agent_name} | source={event['source']} | "
        f"confidence={event['confidence']:.2f} | ticket={ticket_title[:60]}"
    )


# ─── Log Retrieval ───────────────────────────────────────────────

def get_recent_logs(limit: int = 50) -> list[dict]:
    """Get recent log entries from both pipeline and agent decision logs."""
    logs = []

    # Read pipeline logs
    if PIPELINE_LOG.exists():
        with open(PIPELINE_LOG, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        logs.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass

    # Read agent decision logs
    if AGENT_LOG.exists():
        with open(AGENT_LOG, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        logs.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass

    # Sort by timestamp (most recent first) and limit
    logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return logs[:limit]


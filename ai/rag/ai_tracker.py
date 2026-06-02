"""
AI Suggestion Tracker
======================
Tracks all AI agent suggestions and human feedback for the
AI Monitoring Dashboard.

Every suggestion is logged with:
  - Unique suggestion_id
  - Ticket info (id, title, category, severity)
  - Suggestion text, confidence, source, citations
  - Agent info (who asked)
  - Human feedback (approved / rejected / edited)
  - Timing data

Storage: JSONL file for durability + in-memory aggregation for fast queries.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import json
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from config import AI_TRACKER_LOG, AI_TRACKER_METRICS

logger = logging.getLogger("cloudops.tracker")


class AITracker:
    """
    Central tracker for AI suggestions and human feedback.
    Persists to JSONL, serves aggregated metrics via API.
    """

    def __init__(self):
        self._log_path = Path(AI_TRACKER_LOG)
        self._metrics_path = Path(AI_TRACKER_METRICS)
        self._log_path.parent.mkdir(parents=True, exist_ok=True)
        self._entries: list[dict] = []
        self._load_entries()

    def _load_entries(self):
        """Load existing entries from JSONL file."""
        if not self._log_path.exists():
            return
        try:
            with open(self._log_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            self._entries.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass
            logger.info(f"Loaded {len(self._entries)} tracker entries")
        except Exception as e:
            logger.error(f"Failed to load tracker entries: {e}")

    def _append_to_log(self, entry: dict):
        """Append an entry to the JSONL log."""
        try:
            with open(self._log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, default=str) + "\n")
        except Exception as e:
            logger.error(f"Failed to write tracker entry: {e}")

    def _save_all(self):
        """Rewrite the entire JSONL log (for updates)."""
        try:
            with open(self._log_path, "w", encoding="utf-8") as f:
                for entry in self._entries:
                    f.write(json.dumps(entry, default=str) + "\n")
        except Exception as e:
            logger.error(f"Failed to save tracker entries: {e}")

    def log_suggestion(
        self,
        ticket_id: str,
        ticket_number: str,
        ticket_title: str,
        ticket_category: str,
        ticket_severity: str,
        agent_id: str,
        agent_name: str,
        user_role: str,
        suggestion: Optional[str],
        confidence: float,
        source: str,
        citations: list[dict],
    ) -> str:
        """
        Log a new AI suggestion. Called when the AI generates a reply.
        Returns the suggestion_id for tracking feedback.
        """
        suggestion_id = str(uuid.uuid4())[:12]

        entry = {
            "suggestion_id": suggestion_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": "suggestion",

            # Ticket info
            "ticket_id": ticket_id,
            "ticket_number": ticket_number,
            "ticket_title": ticket_title[:200],
            "ticket_category": ticket_category,
            "ticket_severity": ticket_severity,

            # Agent info
            "agent_id": agent_id,
            "agent_name": agent_name,
            "user_role": user_role,

            # Suggestion details
            "suggestion_preview": (suggestion or "")[:300],
            "has_suggestion": suggestion is not None and len(suggestion or "") > 0,
            "confidence": round(confidence, 4),
            "source": source,
            "citations_count": len(citations),
            "citation_types": list(set(c.get("type", "unknown") for c in citations)),

            # Feedback (filled in later)
            "feedback_action": None,       # "approved" | "rejected" | "edited" | None
            "feedback_timestamp": None,
            "time_to_feedback_sec": None,
        }

        self._entries.append(entry)
        self._append_to_log(entry)
        self._update_metrics()

        logger.info(
            f"📊 Tracked suggestion {suggestion_id} | "
            f"confidence={confidence:.2f} | source={source} | "
            f"ticket={ticket_title[:40]}"
        )

        return suggestion_id

    def log_feedback(
        self,
        suggestion_id: str,
        action: str,  # "approved" | "rejected" | "edited"
        edited_text: Optional[str] = None,
    ) -> bool:
        """
        Log human feedback on a suggestion.
        Returns True if the suggestion was found and updated.
        """
        # Find the entry
        entry = None
        for e in reversed(self._entries):  # Search from newest
            if e.get("suggestion_id") == suggestion_id:
                entry = e
                break

        if not entry:
            logger.warning(f"Suggestion {suggestion_id} not found for feedback")
            return False

        now = datetime.now(timezone.utc)
        entry["feedback_action"] = action
        entry["feedback_timestamp"] = now.isoformat()

        # Calculate time to feedback
        try:
            suggestion_time = datetime.fromisoformat(entry["timestamp"])
            entry["time_to_feedback_sec"] = round((now - suggestion_time).total_seconds(), 1)
        except Exception:
            entry["time_to_feedback_sec"] = None

        if edited_text and action == "edited":
            entry["edited_preview"] = edited_text[:300]

        # Rewrite the log file with updated entry
        self._save_all()
        self._update_metrics()

        logger.info(
            f"📊 Feedback recorded: {suggestion_id} → {action} "
            f"(time: {entry.get('time_to_feedback_sec', '?')}s)"
        )

        return True

    def get_dashboard_metrics(self) -> dict:
        """
        Aggregate metrics for the AI Monitoring Dashboard.
        """
        total = len(self._entries)
        if total == 0:
            return self._empty_metrics()

        with_suggestion = [e for e in self._entries if e.get("has_suggestion")]
        approved = [e for e in self._entries if e.get("feedback_action") == "approved"]
        rejected = [e for e in self._entries if e.get("feedback_action") == "rejected"]
        edited = [e for e in self._entries if e.get("feedback_action") == "edited"]
        no_feedback = [e for e in self._entries if e.get("feedback_action") is None and e.get("has_suggestion")]
        no_suggestion = [e for e in self._entries if not e.get("has_suggestion")]

        # Confidence stats
        all_confidences = [e.get("confidence", 0) for e in with_suggestion]
        approved_confidences = [e.get("confidence", 0) for e in approved]
        rejected_confidences = [e.get("confidence", 0) for e in rejected]

        # Time to feedback stats
        feedback_times = [
            e.get("time_to_feedback_sec", 0)
            for e in self._entries
            if e.get("time_to_feedback_sec") is not None
        ]

        # Source distribution
        source_dist = {}
        for e in self._entries:
            src = e.get("source", "unknown")
            source_dist[src] = source_dist.get(src, 0) + 1

        # Category distribution
        category_dist = {}
        for e in self._entries:
            cat = e.get("ticket_category", "unknown")
            category_dist[cat] = category_dist.get(cat, 0) + 1

        # Confidence distribution (buckets)
        conf_buckets = {"0-25%": 0, "25-50%": 0, "50-75%": 0, "75-100%": 0}
        for c in all_confidences:
            pct = c * 100
            if pct < 25:
                conf_buckets["0-25%"] += 1
            elif pct < 50:
                conf_buckets["25-50%"] += 1
            elif pct < 75:
                conf_buckets["50-75%"] += 1
            else:
                conf_buckets["75-100%"] += 1

        # Accuracy over time (daily buckets)
        accuracy_over_time = self._compute_daily_accuracy()

        # High-confidence rejections (potential hallucinations)
        high_conf_rejections = [
            {
                "suggestion_id": e["suggestion_id"],
                "ticket_title": e["ticket_title"],
                "confidence": e["confidence"],
                "source": e["source"],
                "timestamp": e["timestamp"],
            }
            for e in rejected
            if e.get("confidence", 0) >= 0.7
        ]

        total_with_feedback = len(approved) + len(rejected) + len(edited)

        return {
            # Hero stats
            "total_suggestions": total,
            "with_suggestion": len(with_suggestion),
            "no_suggestion": len(no_suggestion),
            "approved_count": len(approved),
            "rejected_count": len(rejected),
            "edited_count": len(edited),
            "pending_feedback": len(no_feedback),
            "approval_rate": round(len(approved) / max(total_with_feedback, 1) * 100, 1),
            "rejection_rate": round(len(rejected) / max(total_with_feedback, 1) * 100, 1),
            "edit_rate": round(len(edited) / max(total_with_feedback, 1) * 100, 1),

            # Confidence stats
            "avg_confidence": round(sum(all_confidences) / max(len(all_confidences), 1), 3),
            "avg_confidence_approved": round(sum(approved_confidences) / max(len(approved_confidences), 1), 3),
            "avg_confidence_rejected": round(sum(rejected_confidences) / max(len(rejected_confidences), 1), 3),

            # Distributions
            "confidence_distribution": conf_buckets,
            "source_distribution": source_dist,
            "category_distribution": category_dist,

            # Time series
            "accuracy_over_time": accuracy_over_time,

            # Alerts
            "high_confidence_rejections": high_conf_rejections[:10],

            # Timing
            "avg_time_to_feedback_sec": round(sum(feedback_times) / max(len(feedback_times), 1), 1),

            "last_updated": datetime.now(timezone.utc).isoformat(),
        }

    def get_suggestions_list(self, page: int = 1, limit: int = 20) -> dict:
        """
        Get paginated list of suggestions with feedback status.
        """
        # Sort by timestamp descending
        sorted_entries = sorted(
            self._entries,
            key=lambda x: x.get("timestamp", ""),
            reverse=True,
        )

        total = len(sorted_entries)
        start = (page - 1) * limit
        end = start + limit
        page_entries = sorted_entries[start:end]

        return {
            "suggestions": page_entries,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": max(1, (total + limit - 1) // limit),
        }

    def _compute_daily_accuracy(self) -> list[dict]:
        """Compute daily approval rate for the last 30 days."""
        now = datetime.now(timezone.utc)
        daily = {}

        for e in self._entries:
            try:
                ts = datetime.fromisoformat(e["timestamp"])
                day = ts.strftime("%Y-%m-%d")
                if (now - ts).days > 30:
                    continue

                if day not in daily:
                    daily[day] = {"approved": 0, "rejected": 0, "edited": 0, "total": 0}

                daily[day]["total"] += 1
                action = e.get("feedback_action")
                if action in ("approved", "rejected", "edited"):
                    daily[day][action] += 1
            except Exception:
                continue

        result = []
        for day in sorted(daily.keys()):
            d = daily[day]
            total_feedback = d["approved"] + d["rejected"] + d["edited"]
            result.append({
                "date": day,
                "total": d["total"],
                "approved": d["approved"],
                "rejected": d["rejected"],
                "edited": d["edited"],
                "approval_rate": round(d["approved"] / max(total_feedback, 1) * 100, 1),
            })

        return result

    def _update_metrics(self):
        """Save aggregated metrics to JSON for quick access."""
        try:
            metrics = self.get_dashboard_metrics()
            with open(self._metrics_path, "w", encoding="utf-8") as f:
                json.dump(metrics, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to update metrics: {e}")

    def _empty_metrics(self) -> dict:
        return {
            "total_suggestions": 0,
            "with_suggestion": 0,
            "no_suggestion": 0,
            "approved_count": 0,
            "rejected_count": 0,
            "edited_count": 0,
            "pending_feedback": 0,
            "approval_rate": 0,
            "rejection_rate": 0,
            "edit_rate": 0,
            "avg_confidence": 0,
            "avg_confidence_approved": 0,
            "avg_confidence_rejected": 0,
            "confidence_distribution": {"0-25%": 0, "25-50%": 0, "50-75%": 0, "75-100%": 0},
            "source_distribution": {},
            "category_distribution": {},
            "accuracy_over_time": [],
            "high_confidence_rejections": [],
            "avg_time_to_feedback_sec": 0,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }


# ─── Singleton ───────────────────────────────────────────────────

_tracker: Optional[AITracker] = None


def get_tracker() -> AITracker:
    """Get the singleton AITracker instance."""
    global _tracker
    if _tracker is None:
        _tracker = AITracker()
    return _tracker

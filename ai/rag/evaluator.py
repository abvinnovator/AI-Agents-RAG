"""
Corrective RAG (CRAG) Evaluator — v2 (Fixed)
=================================================
Implements the CRAG algorithm:

1. Retrieve documents from vector DB
2. EVALUATE retrieval confidence (CORRECT / INCORRECT / AMBIGUOUS)
3. If CORRECT  → use internal knowledge (vector DB docs)
4. If INCORRECT → fall back to web search (DuckDuckGo)
5. If AMBIGUOUS → combine both internal + web search

v2 Fixes:
  ✓ Tightened fallback thresholds — no more blind "CORRECT" on LLM failure
  ✓ Explicit warning logging when using fallback mode
  ✓ Zero-score document detection biases toward AMBIGUOUS
  ✓ Better heuristic scoring with document count consideration
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import re
import json
import logging
from typing import Optional

import google.generativeai as genai
from config import GEMINI_API_KEY, LLM_MODEL

logger = logging.getLogger("cloudops.crag")

# ─── Configure Gemini ────────────────────────────────────────────
genai.configure(api_key=GEMINI_API_KEY)
_eval_model = genai.GenerativeModel(LLM_MODEL)


# ─── Confidence Evaluation ──────────────────────────────────────

EVAL_PROMPT = """You are a retrieval quality evaluator for a GCP cloud support system.

USER QUERY:
{query}

RETRIEVED DOCUMENTS:
{documents}

TASK:
Evaluate whether the retrieved documents are relevant and sufficient to answer the user's query.

Score each document 1-5:
  1 = Completely irrelevant
  2 = Tangentially related but not useful
  3 = Somewhat relevant but missing key information
  4 = Relevant and contains useful information
  5 = Highly relevant, directly answers the query

Then give an overall CONFIDENCE verdict:
  CORRECT   = Documents contain enough information to answer the query accurately (average score >= 3.5)
  AMBIGUOUS = Documents are partially relevant, may need supplementation (average score 2.0-3.4)
  INCORRECT = Documents are not relevant to the query at all (average score < 2.0)

Respond in JSON ONLY:
{{
  "scores": [{{ "doc_index": 1, "score": 4, "reason": "..." }}, ...],
  "average_score": 3.8,
  "confidence": "CORRECT",
  "reasoning": "Brief explanation of the verdict",
  "missing_topics": ["list of topics the docs don't cover but the query asks about"]
}}"""


def evaluate_retrieval(query: str, documents: list[dict]) -> dict:
    """
    Run CRAG evaluation on retrieved documents.

    Returns:
        {
            "confidence": "CORRECT" | "AMBIGUOUS" | "INCORRECT",
            "average_score": float,
            "missing_topics": list[str],
            "reasoning": str,
            "scores": list[dict]
        }
    """
    if not documents:
        return {
            "confidence": "INCORRECT",
            "average_score": 0.0,
            "missing_topics": [query],
            "reasoning": "No documents retrieved from vector database.",
            "scores": [],
        }

    # Format documents for evaluation
    doc_text = ""
    for i, doc in enumerate(documents[:5]):  # Evaluate top 5 only to save tokens
        header = doc.get("context_header", "Unknown source")
        text = doc.get("text", "")[:500]  # Truncate for eval
        doc_text += f"\n--- Document {i+1}: [{header}] ---\n{text}\n"

    prompt = EVAL_PROMPT.format(query=query, documents=doc_text)

    try:
        response = _eval_model.generate_content(prompt)
        raw = response.text.strip()

        # Extract JSON from response (handle markdown code blocks)
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if json_match:
            result = json.loads(json_match.group())
            result["confidence"] = result.get("confidence", "AMBIGUOUS").upper()
            return result
        else:
            logger.warning(f"CRAG evaluator returned non-JSON: {raw[:200]}")
            return _fallback_evaluation(documents)

    except Exception as e:
        logger.error(f"CRAG evaluation failed: {e}")
        # CRITICAL FIX: Use conservative fallback, not optimistic
        return _fallback_evaluation(documents)


def _fallback_evaluation(documents: list[dict]) -> dict:
    """
    If the LLM eval fails, use CONSERVATIVE heuristic scoring.

    v2 FIX: The old version was too generous:
      - avg >= 0.35 → CORRECT (basically everything)
    
    New thresholds are much stricter:
      - avg >= 0.55 → CORRECT (only genuinely good matches)
      - avg >= 0.25 → AMBIGUOUS (supplement with web search)
      - avg < 0.25  → INCORRECT (fall back to web search)
    
    Also considers:
      - Number of zero/near-zero score documents
      - Total number of documents retrieved
    """
    logger.warning(
        "⚠ Using FALLBACK heuristic evaluation (LLM eval failed). "
        "Results may be less accurate — web search supplementation is more likely."
    )

    scores = [d.get("rerank_score", 0) for d in documents]
    avg = sum(scores) / len(scores) if scores else 0

    # Count near-zero scores (< 0.1) — these indicate poor retrieval
    near_zero_count = sum(1 for s in scores if s < 0.1)
    near_zero_ratio = near_zero_count / len(scores) if scores else 1.0

    # If more than half the docs are near-zero, bias toward AMBIGUOUS/INCORRECT
    if near_zero_ratio > 0.5:
        logger.info(f"  High near-zero ratio ({near_zero_ratio:.1%}) — biasing toward AMBIGUOUS")
        if avg >= 0.45:
            confidence = "AMBIGUOUS"  # Downgrade from CORRECT
        elif avg >= 0.15:
            confidence = "AMBIGUOUS"
        else:
            confidence = "INCORRECT"
    else:
        # Standard thresholds (much stricter than v1)
        if avg >= 0.55:
            confidence = "CORRECT"
        elif avg >= 0.25:
            confidence = "AMBIGUOUS"
        else:
            confidence = "INCORRECT"

    logger.info(
        f"  Fallback verdict: {confidence} | avg_rerank={avg:.3f} | "
        f"near_zero={near_zero_count}/{len(scores)} | ratio={near_zero_ratio:.1%}"
    )

    return {
        "confidence": confidence,
        "average_score": avg * 5,  # Scale to 1-5
        "missing_topics": [],
        "reasoning": f"Heuristic evaluation (LLM unavailable). avg_rerank={avg:.3f}, near_zero_ratio={near_zero_ratio:.1%}",
        "scores": [{"doc_index": i, "score": round(s * 5, 1)} for i, s in enumerate(scores)],
    }

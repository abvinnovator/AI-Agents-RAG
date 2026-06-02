"""
CloudOps AI API — v2
======================
FastAPI server connecting the frontend support panel to the AI system.

Endpoints:
  POST /agent/suggest    — Get AI suggestion for a ticket (now with tracking)
  POST /agent/learn      — Store a resolved ticket in agent memory
  GET  /agent/stats      — Get agent knowledge stats
  POST /rag/query        — Direct RAG query (for testing)
  GET  /rag/metrics      — RAG pipeline metrics
  GET  /rag/logs         — Recent pipeline logs

  Dashboard (NEW):
  GET  /dashboard/metrics     — Aggregated AI monitoring metrics
  GET  /dashboard/suggestions — Paginated suggestion history
  POST /dashboard/feedback    — Record human feedback on a suggestion
  GET  /health               — Health check
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(
    title="CloudOps AI API",
    description="AI Agent and RAG service for CloudOps Support Panel",
    version="2.0.0",
)

# CORS — allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request/Response Models ────────────────────────────────────

class SuggestRequest(BaseModel):
    agent_id: str
    agent_name: str
    user_role: str
    ticket_id: str = ""
    ticket_number: str = ""
    ticket_title: str
    ticket_description: str
    ticket_category: str
    ticket_severity: str
    conversation: list[dict] = []

class SuggestResponse(BaseModel):
    suggestion_id: str = ""  # NEW: unique ID for tracking
    suggestion: Optional[str]
    confidence: float
    source: str  # "past_tickets", "shared_tickets", "gcp_docs", "gcp_docs+web", "web_search", "none"
    similar_tickets: list[dict] = []
    citations: list[dict] = []
    requires_approval: bool = True
    message: Optional[str] = None

class LearnRequest(BaseModel):
    agent_id: str
    agent_name: str
    user_role: str
    ticket_id: str
    ticket_number: str
    description: str
    resolution: str
    category: str
    conversation: list[dict] = []

class RAGQueryRequest(BaseModel):
    query: str
    namespaces: Optional[list[str]] = None
    top_k: int = 5

class RAGQueryResponse(BaseModel):
    results: list[dict]
    query: str

class AgentStatsResponse(BaseModel):
    agent_id: str
    agent_name: str
    tickets_learned: int

class FeedbackRequest(BaseModel):
    suggestion_id: str
    action: str  # "approved" | "rejected" | "edited"
    edited_text: Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────

@app.post("/agent/suggest", response_model=SuggestResponse)
async def suggest_reply(req: SuggestRequest):
    """
    Get an AI-suggested reply for a support ticket.
    The agent searches: past tickets → shared tickets → GCP docs → none.
    Now also logs the suggestion to the AI tracker for dashboard monitoring.
    """
    try:
        from agents.ticket_agent import get_agent
        from rag.ai_tracker import get_tracker

        agent = get_agent(req.agent_id, req.agent_name, req.user_role)
        result = agent.suggest_reply(
            ticket_title=req.ticket_title,
            ticket_description=req.ticket_description,
            ticket_category=req.ticket_category,
            ticket_severity=req.ticket_severity,
            conversation_history=req.conversation,
        )

        # Log to AI tracker for dashboard
        tracker = get_tracker()
        suggestion_id = tracker.log_suggestion(
            ticket_id=req.ticket_id or "unknown",
            ticket_number=req.ticket_number or "unknown",
            ticket_title=req.ticket_title,
            ticket_category=req.ticket_category,
            ticket_severity=req.ticket_severity,
            agent_id=req.agent_id,
            agent_name=req.agent_name,
            user_role=req.user_role,
            suggestion=result.get("suggestion"),
            confidence=result.get("confidence", 0),
            source=result.get("source", "none"),
            citations=result.get("citations", []),
        )

        result["suggestion_id"] = suggestion_id
        return SuggestResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agent/learn")
async def learn_from_ticket(req: LearnRequest):
    """
    Store a resolved ticket in the agent's memory.
    Called when a support engineer resolves a ticket.
    """
    try:
        from agents.ticket_agent import get_agent
        agent = get_agent(req.agent_id, req.agent_name, req.user_role)
        agent.learn_from_resolution(
            ticket_id=req.ticket_id,
            ticket_number=req.ticket_number,
            description=req.description,
            resolution=req.resolution,
            category=req.category,
            conversation=req.conversation,
        )
        return {"status": "ok", "message": f"Agent {req.agent_name} learned from ticket {req.ticket_number}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/agent/stats/{agent_id}", response_model=AgentStatsResponse)
async def agent_stats(agent_id: str, agent_name: str = "Agent", user_role: str = "L1"):
    """Get stats about an agent's knowledge base."""
    try:
        from agents.ticket_agent import get_agent
        agent = get_agent(agent_id, agent_name, user_role)
        return AgentStatsResponse(**agent.get_stats())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/query")
async def rag_query(req: RAGQueryRequest):
    """Direct RAG query with CRAG evaluation."""
    try:
        from rag.retrieve import retrieve
        result = retrieve(req.query, top_k_final=req.top_k)
        chunks = result.get("chunks", [])
        return {
            "query": req.query,
            "confidence": result.get("confidence", "UNKNOWN"),
            "source": result.get("source", "unknown"),
            "evaluation": result.get("evaluation", {}),
            "results": [{
                "text": r.get("text", "")[:500],
                "source": r.get("context_header", r.get("title", "")),
                "score": r.get("rerank_score", 0),
                "type": r.get("source", "knowledge_base"),
            } for r in chunks]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/rag/metrics")
async def rag_metrics():
    """Get RAG pipeline monitoring metrics."""
    try:
        from rag.monitor import get_metrics
        return get_metrics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/rag/logs")
async def rag_logs(limit: int = 50):
    """
    Get recent logs from both the agent decision layer and the RAG pipeline.
    """
    try:
        from rag.monitor import get_recent_logs
        return {"logs": get_recent_logs(limit)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Dashboard Endpoints (NEW) ──────────────────────────────────

@app.get("/dashboard/metrics")
async def dashboard_metrics():
    """
    Get aggregated AI monitoring metrics for the dashboard.
    Returns approval rates, confidence distributions, accuracy over time, etc.
    """
    try:
        from rag.ai_tracker import get_tracker
        tracker = get_tracker()
        return tracker.get_dashboard_metrics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dashboard/suggestions")
async def dashboard_suggestions(page: int = 1, limit: int = 20):
    """
    Get paginated list of all AI suggestions with feedback status.
    """
    try:
        from rag.ai_tracker import get_tracker
        tracker = get_tracker()
        return tracker.get_suggestions_list(page=page, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/dashboard/feedback")
async def dashboard_feedback(req: FeedbackRequest):
    """
    Record human feedback on an AI suggestion.
    Called when an engineer approves, rejects, or edits a suggestion.
    """
    try:
        from rag.ai_tracker import get_tracker
        tracker = get_tracker()

        if req.action not in ("approved", "rejected", "edited"):
            raise HTTPException(status_code=400, detail=f"Invalid action: {req.action}. Must be 'approved', 'rejected', or 'edited'.")

        success = tracker.log_feedback(
            suggestion_id=req.suggestion_id,
            action=req.action,
            edited_text=req.edited_text,
        )

        if not success:
            raise HTTPException(status_code=404, detail=f"Suggestion {req.suggestion_id} not found")

        return {"status": "ok", "suggestion_id": req.suggestion_id, "action": req.action}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok", "service": "cloudops-ai", "version": "2.0"}


# ─── Run ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.server:app", host="0.0.0.0", port=8000, reload=True)

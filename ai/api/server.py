"""
CloudOps AI API
================
FastAPI server connecting the frontend support panel to the AI system.

Endpoints:
  POST /agent/suggest    — Get AI suggestion for a ticket
  POST /agent/learn      — Store a resolved ticket in agent memory
  GET  /agent/stats      — Get agent knowledge stats
  POST /rag/query        — Direct RAG query (for testing)
  GET  /health           — Health check
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(
    title="CloudOps AI API",
    description="AI Agent and RAG service for CloudOps Support Panel",
    version="1.0.0",
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
    ticket_title: str
    ticket_description: str
    ticket_category: str
    ticket_severity: str
    conversation: list[dict] = []

class SuggestResponse(BaseModel):
    suggestion: Optional[str]
    confidence: float
    source: str  # "past_tickets", "shared_tickets", "gcp_docs", "none"
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


# ─── Endpoints ───────────────────────────────────────────────────

@app.post("/agent/suggest", response_model=SuggestResponse)
async def suggest_reply(req: SuggestRequest):
    """
    Get an AI-suggested reply for a support ticket.
    The agent searches: past tickets → shared tickets → GCP docs → none.
    """
    try:
        from agents.ticket_agent import get_agent
        agent = get_agent(req.agent_id, req.agent_name, req.user_role)
        result = agent.suggest_reply(
            ticket_title=req.ticket_title,
            ticket_description=req.ticket_description,
            ticket_category=req.ticket_category,
            ticket_severity=req.ticket_severity,
            conversation_history=req.conversation,
        )
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


@app.post("/rag/query", response_model=RAGQueryResponse)
async def rag_query(req: RAGQueryRequest):
    """Direct RAG query — for testing and the GCP simulator billing audit."""
    try:
        from rag.retrieve import retrieve
        results = retrieve(req.query, namespaces=req.namespaces, top_k_final=req.top_k)
        return RAGQueryResponse(
            query=req.query,
            results=[{
                "text": r["text"][:500],
                "source": r.get("context_header", ""),
                "score": r.get("rerank_score", 0),
            } for r in results]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok", "service": "cloudops-ai"}


# ─── Run ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.server:app", host="0.0.0.0", port=8000, reload=True)

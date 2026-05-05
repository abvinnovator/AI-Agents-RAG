"""
Per-Engineer AI Agent
======================
Each support engineer gets a personal agent that:
1. Learns from their resolved tickets (stored in per-agent Pinecone namespace)
2. Suggests replies when similar tickets come in
3. Requires human approval before sending
4. Falls back to RAG (GCP docs) if no similar past ticket found
5. Falls back to "no suggestion" if neither source has an answer

Priority chain: Past tickets → GCP docs → "I don't know"
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import json
import google.generativeai as genai
from typing import Optional

from config import (
    GEMINI_API_KEY, NS_AGENT_PREFIX, NS_TICKETS,
    AGENT_SIMILARITY_THRESHOLD, AGENT_TOP_K, LLM_MODEL,
)
from rag.embed import embed_single, embed_texts, get_pinecone_index
from rag.retrieve import retrieve_for_ticket, rerank


# ─── Configure Gemini ────────────────────────────────────────────

genai.configure(api_key=GEMINI_API_KEY)


# ─── Agent Class ─────────────────────────────────────────────────

class SupportAgent:
    """
    Personal AI agent for a support engineer.
    Each agent has its own Pinecone namespace storing past ticket resolutions.
    """

    def __init__(self, agent_id: str, agent_name: str, user_role: str):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.user_role = user_role
        self.namespace = f"{NS_AGENT_PREFIX}{agent_id}"
        self.index = get_pinecone_index()
        self.model = genai.GenerativeModel(LLM_MODEL)

    def suggest_reply(
        self,
        ticket_title: str,
        ticket_description: str,
        ticket_category: str,
        ticket_severity: str,
        conversation_history: list[dict],
    ) -> dict:
        """
        Generate a reply suggestion for a ticket.

        Returns:
            {
                "suggestion": str | None,
                "confidence": float,
                "source": "past_tickets" | "gcp_docs" | "none",
                "similar_tickets": [...],
                "citations": [...],
                "requires_approval": True
            }
        """
        query = f"[{ticket_category}] [{ticket_severity}] {ticket_title}: {ticket_description}"

        # ─── Step 1: Search this agent's past resolved tickets ────
        past_tickets = self._search_past_tickets(query)

        if past_tickets and past_tickets[0].get("rerank_score", 0) >= AGENT_SIMILARITY_THRESHOLD:
            # Found similar past tickets! Generate suggestion from them.
            return self._suggest_from_past_tickets(
                ticket_description, ticket_category, past_tickets, conversation_history
            )

        # ─── Step 2: Search shared resolved tickets pool ──────────
        shared_tickets = self._search_shared_tickets(query)

        if shared_tickets and shared_tickets[0].get("rerank_score", 0) >= AGENT_SIMILARITY_THRESHOLD:
            return self._suggest_from_past_tickets(
                ticket_description, ticket_category, shared_tickets, conversation_history,
                source="shared_tickets"
            )

        # ─── Step 3: Fall back to GCP docs (RAG) ─────────────────
        doc_chunks = retrieve_for_ticket(ticket_description, ticket_category)

        if doc_chunks:
            return self._suggest_from_docs(
                ticket_description, ticket_category, doc_chunks, conversation_history
            )

        # ─── Step 4: No relevant info found ──────────────────────
        return {
            "suggestion": None,
            "confidence": 0.0,
            "source": "none",
            "similar_tickets": [],
            "citations": [],
            "requires_approval": True,
            "message": "No similar past tickets or relevant documentation found. Manual resolution needed.",
        }

    def _search_past_tickets(self, query: str) -> list[dict]:
        """Search this agent's personal resolved ticket history."""
        q_embedding = embed_single(query)

        results = self.index.query(
            vector=q_embedding,
            top_k=AGENT_TOP_K,
            namespace=self.namespace,
            include_metadata=True,
        )

        if not results.matches:
            return []

        passages = []
        for m in results.matches:
            passages.append({
                "id": m.id,
                "text": m.metadata.get("description", "") + " " + m.metadata.get("resolution", ""),
                "description": m.metadata.get("description", ""),
                "resolution": m.metadata.get("resolution", ""),
                "category": m.metadata.get("category", ""),
                "ticket_number": m.metadata.get("ticket_number", ""),
                "vector_score": m.score,
            })

        return rerank(query, passages, top_k=3)

    def _search_shared_tickets(self, query: str) -> list[dict]:
        """Search the shared pool of all resolved tickets."""
        q_embedding = embed_single(query)

        results = self.index.query(
            vector=q_embedding,
            top_k=AGENT_TOP_K,
            namespace=NS_TICKETS,
            include_metadata=True,
        )

        if not results.matches:
            return []

        passages = []
        for m in results.matches:
            passages.append({
                "id": m.id,
                "text": m.metadata.get("description", "") + " " + m.metadata.get("resolution", ""),
                "description": m.metadata.get("description", ""),
                "resolution": m.metadata.get("resolution", ""),
                "category": m.metadata.get("category", ""),
                "ticket_number": m.metadata.get("ticket_number", ""),
                "resolved_by": m.metadata.get("resolved_by", ""),
                "vector_score": m.score,
            })

        return rerank(query, passages, top_k=3)

    def _suggest_from_past_tickets(
        self, description: str, category: str,
        past_tickets: list[dict], conversation: list[dict],
        source: str = "past_tickets"
    ) -> dict:
        """Generate suggestion based on similar past tickets."""
        # Build context from past resolutions
        past_context = ""
        for i, t in enumerate(past_tickets[:3]):
            past_context += f"\n--- Similar Past Ticket {i+1} (ticket: {t.get('ticket_number', 'N/A')}) ---\n"
            past_context += f"Description: {t.get('description', '')}\n"
            past_context += f"Resolution: {t.get('resolution', '')}\n"

        conv_text = self._format_conversation(conversation)

        prompt = f"""You are {self.agent_name}, a {self.user_role} support agent for Google Cloud Platform.

CURRENT TICKET:
Category: {category}
Issue: {description}

CONVERSATION SO FAR:
{conv_text if conv_text else "No messages yet."}

SIMILAR PAST TICKETS AND THEIR RESOLUTIONS:
{past_context}

INSTRUCTIONS:
- Based ONLY on the past resolutions above, suggest a reply to the customer.
- Adapt the past resolution to fit the current ticket's specific details.
- If the past tickets don't match well enough, say so honestly.
- Be professional, helpful, and concise.
- Do NOT make up information. Only use what's in the past resolutions.
- If you reference a GCP feature, mention it by name.

SUGGESTED REPLY:"""

        response = self.model.generate_content(prompt)

        return {
            "suggestion": response.text.strip(),
            "confidence": past_tickets[0].get("rerank_score", 0.5),
            "source": source,
            "similar_tickets": [
                {"ticket_number": t.get("ticket_number"), "resolution_preview": t.get("resolution", "")[:200]}
                for t in past_tickets[:3]
            ],
            "citations": [],
            "requires_approval": True,
        }

    def _suggest_from_docs(
        self, description: str, category: str,
        doc_chunks: list[dict], conversation: list[dict]
    ) -> dict:
        """Generate suggestion based on GCP documentation."""
        docs_context = ""
        citations = []
        for i, chunk in enumerate(doc_chunks[:5]):
            header = chunk.get("context_header", "Unknown")
            docs_context += f"\n--- Document {i+1}: [{header}] ---\n{chunk['text']}\n"
            citations.append({
                "source": header,
                "text_preview": chunk["text"][:150],
            })

        conv_text = self._format_conversation(conversation)

        prompt = f"""You are {self.agent_name}, a {self.user_role} support agent for Google Cloud Platform.

CURRENT TICKET:
Category: {category}
Issue: {description}

CONVERSATION SO FAR:
{conv_text if conv_text else "No messages yet."}

RELEVANT GCP DOCUMENTATION:
{docs_context}

INSTRUCTIONS:
- Answer the customer's question using ONLY the provided documentation above.
- CITE which document you're referencing (e.g., "According to [Document 1: GCP > Compute > Machine Types]...").
- If the documentation doesn't contain enough information, say "Based on the available documentation, I can tell you..." and be honest about limitations.
- Do NOT make up pricing, features, or capabilities not mentioned in the docs.
- Be professional, helpful, and concise.

SUGGESTED REPLY:"""

        response = self.model.generate_content(prompt)

        return {
            "suggestion": response.text.strip(),
            "confidence": doc_chunks[0].get("rerank_score", 0.3),
            "source": "gcp_docs",
            "similar_tickets": [],
            "citations": citations,
            "requires_approval": True,
        }

    def learn_from_resolution(
        self,
        ticket_id: str,
        ticket_number: str,
        description: str,
        resolution: str,
        category: str,
        conversation: list[dict],
    ):
        """
        Store a resolved ticket in this agent's personal memory AND the shared pool.
        Called when an engineer resolves a ticket (after approval).
        """
        # Build the text to embed
        text = f"[{category}] Ticket: {description}\nResolution: {resolution}"

        # Add key conversation messages for context
        key_messages = [m for m in conversation if m.get("authorRole") != "end_user"][:3]
        if key_messages:
            text += "\nKey support messages: " + " | ".join(m.get("content", "")[:200] for m in key_messages)

        embedding = embed_single(text)

        metadata = {
            "ticket_id": ticket_id,
            "ticket_number": ticket_number,
            "description": description[:1000],
            "resolution": resolution[:1500],
            "category": category,
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "resolved_by": self.agent_id,
        }

        # Store in personal namespace
        self.index.upsert(
            vectors=[{"id": ticket_id, "values": embedding, "metadata": metadata}],
            namespace=self.namespace,
        )

        # Also store in shared pool
        self.index.upsert(
            vectors=[{"id": f"shared-{ticket_id}", "values": embedding, "metadata": metadata}],
            namespace=NS_TICKETS,
        )

        print(f"✓ Agent {self.agent_name}: Learned from ticket {ticket_number}")

    def _format_conversation(self, conversation: list[dict]) -> str:
        """Format conversation history for the prompt."""
        if not conversation:
            return ""
        lines = []
        for msg in conversation[-6:]:  # Last 6 messages max
            role = "Customer" if msg.get("authorRole") == "end_user" else f"Support ({msg.get('authorName', 'Agent')})"
            lines.append(f"{role}: {msg.get('content', '')}")
        return "\n".join(lines)

    def get_stats(self) -> dict:
        """Get stats about this agent's knowledge base."""
        try:
            stats = self.index.describe_index_stats()
            ns_stats = stats.namespaces.get(self.namespace, None)
            return {
                "agent_id": self.agent_id,
                "agent_name": self.agent_name,
                "tickets_learned": ns_stats.vector_count if ns_stats else 0,
            }
        except Exception:
            return {"agent_id": self.agent_id, "agent_name": self.agent_name, "tickets_learned": 0}


# ─── Agent Manager ───────────────────────────────────────────────

_agents: dict[str, SupportAgent] = {}

def get_agent(agent_id: str, agent_name: str, user_role: str) -> SupportAgent:
    """Get or create an agent instance."""
    if agent_id not in _agents:
        _agents[agent_id] = SupportAgent(agent_id, agent_name, user_role)
    return _agents[agent_id]


def clear_agent_cache():
    """Clear the in-memory agent cache."""
    _agents.clear()

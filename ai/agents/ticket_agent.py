"""
Per-Engineer AI Agent v2
=========================
Each support engineer gets a personal agent that:
1. Learns from their resolved tickets (per-agent Pinecone namespace)
2. Suggests replies when similar tickets come in
3. Falls back to CRAG pipeline (GCP docs + web search) if no past ticket match
4. Requires human approval before sending

Priority chain: Past tickets → Shared tickets → GCP docs (CRAG) → Web search → "I don't know"  
Level-wise: Agent inherits the support level of its engineer for namespace routing
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import json
import logging
import google.generativeai as genai
from typing import Optional

from config import (
    GEMINI_API_KEY, NS_AGENT_PREFIX, NS_TICKETS,
    AGENT_SIMILARITY_THRESHOLD, AGENT_TOP_K, LLM_MODEL,
)
from rag.embed import embed_single, embed_texts, get_pinecone_index
from rag.retrieve import retrieve_for_ticket, rerank
from rag.monitor import log_agent_decision

logger = logging.getLogger("cloudops.agent")


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

        logger.info(f"\n{'='*60}")
        logger.info(f"Agent {self.agent_name} ({self.user_role}) processing ticket: {ticket_title[:80]}")
        logger.info(f"Category: {ticket_category} | Severity: {ticket_severity}")

        # ─── Step 1: Search this agent's past resolved tickets ────
        logger.info("Step 1: Searching personal past tickets...")
        past_tickets = self._search_past_tickets(query)

        if past_tickets:
            top_score = past_tickets[0].get("rerank_score", 0)
            top_ticket = past_tickets[0].get("ticket_number", "?")
            top_category = past_tickets[0].get("category", "")
            logger.info(f"  Found {len(past_tickets)} past tickets. Top: {top_ticket} (score: {top_score:.3f}, category: {top_category})")

            # Check: score above threshold AND category should match (or score very high)
            category_match = top_category.lower() == ticket_category.lower()
            score_override = top_score >= 0.80  # Very high score overrides category mismatch

            if top_score >= AGENT_SIMILARITY_THRESHOLD and (category_match or score_override):
                logger.info(f"  ✓ Match accepted (category_match={category_match}, score_override={score_override})")
                result = self._suggest_from_past_tickets(
                    ticket_description, ticket_category, past_tickets, conversation_history
                )
                log_agent_decision(self.agent_id, self.agent_name, self.user_role, ticket_title, ticket_category, result)
                return result
            else:
                logger.info(f"  ✗ Match rejected: score={top_score:.3f} (threshold={AGENT_SIMILARITY_THRESHOLD}), category_match={category_match}")
        else:
            logger.info("  No past tickets found in personal namespace.")

        # ─── Step 2: Search shared resolved tickets pool ──────────
        logger.info("Step 2: Searching shared ticket pool...")
        shared_tickets = self._search_shared_tickets(query)

        if shared_tickets:
            top_score = shared_tickets[0].get("rerank_score", 0)
            top_ticket = shared_tickets[0].get("ticket_number", "?")
            top_category = shared_tickets[0].get("category", "")
            logger.info(f"  Found {len(shared_tickets)} shared tickets. Top: {top_ticket} (score: {top_score:.3f}, category: {top_category})")

            category_match = top_category.lower() == ticket_category.lower()
            score_override = top_score >= 0.80

            if top_score >= AGENT_SIMILARITY_THRESHOLD and (category_match or score_override):
                logger.info(f"  ✓ Match accepted")
                result = self._suggest_from_past_tickets(
                    ticket_description, ticket_category, shared_tickets, conversation_history,
                    source="shared_tickets"
                )
                log_agent_decision(self.agent_id, self.agent_name, self.user_role, ticket_title, ticket_category, result)
                return result
            else:
                logger.info(f"  ✗ Match rejected: score={top_score:.3f}, category_match={category_match}")
        else:
            logger.info("  No shared tickets found.")

        # ─── Step 3: CRAG pipeline (GCP docs + web search) ───────
        logger.info("Step 3: Falling back to CRAG pipeline (GCP docs + web search)...")
        rag_result = retrieve_for_ticket(
            ticket_description, ticket_category,
            support_level=self.user_role,
        )

        chunks = rag_result.get("chunks", [])
        confidence = rag_result.get("confidence", "INCORRECT")
        source = rag_result.get("source", "none")
        web_results = rag_result.get("web_results", [])
        logger.info(f"  CRAG result: {len(chunks)} chunks, confidence={confidence}, source={source}")

        if chunks:
            result = self._suggest_from_docs(
                ticket_description, ticket_category, chunks,
                conversation_history, source, web_results,
                rag_confidence=confidence,
            )
            log_agent_decision(self.agent_id, self.agent_name, self.user_role, ticket_title, ticket_category, result)
            return result

        # ─── Step 4: No relevant info found ──────────────────────
        logger.info("Step 4: No relevant info found. Returning 'manual resolution needed'.")
        result = {
            "suggestion": None,
            "confidence": 0.0,
            "source": "none",
            "similar_tickets": [],
            "citations": [],
            "requires_approval": True,
            "message": "No similar past tickets, documentation, or web results found. Manual resolution needed.",
        }
        log_agent_decision(self.agent_id, self.agent_name, self.user_role, ticket_title, ticket_category, result)
        return result

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
        doc_chunks: list[dict], conversation: list[dict],
        source: str = "gcp_docs", web_results: list[dict] = None,
        rag_confidence: str = "CORRECT",
    ) -> dict:
        """Generate suggestion based on GCP docs and/or web search results."""
        docs_context = ""
        citations = []

        # Add vector DB docs
        db_chunks = [c for c in doc_chunks if c.get("source") != "web_search"]
        for i, chunk in enumerate(db_chunks[:5]):
            header = chunk.get("context_header", "Unknown")
            docs_context += f"\n--- Document {i+1}: [{header}] ---\n{chunk['text']}\n"
            citations.append({
                "source": header,
                "text_preview": chunk["text"][:150],
                "type": "knowledge_base",
            })

        # Add web search results (if CRAG triggered web fallback)
        web_chunks = [c for c in doc_chunks if c.get("source") == "web_search"]
        if not web_chunks and web_results:
            web_chunks = web_results
        for i, wr in enumerate(web_chunks[:3]):
            url = wr.get("url", "")
            title = wr.get("title", wr.get("context_header", "Web Result"))
            text = wr.get("text", "")
            docs_context += f"\n--- Web Source {i+1}: [{title}] ({url}) ---\n{text}\n"
            citations.append({
                "source": f"🌐 {title}",
                "text_preview": text[:150],
                "url": url,
                "type": "web_search",
            })

        conv_text = self._format_conversation(conversation)

        # Adjust instructions based on CRAG confidence
        if rag_confidence == "CORRECT":
            trust_instruction = "The documentation above has been verified as highly relevant. Use it confidently."
        elif rag_confidence == "AMBIGUOUS":
            trust_instruction = "The documentation is partially relevant. Use it carefully and supplement with web search results where available."
        else:
            trust_instruction = "The documentation is from web search as our knowledge base didn't have relevant info. Be cautious and always cite the source URL."

        prompt = f"""You are {self.agent_name}, a {self.user_role} support agent for Google Cloud Platform.

CURRENT TICKET:
Category: {category}
Issue: {description}

CONVERSATION SO FAR:
{conv_text if conv_text else "No messages yet."}

AVAILABLE INFORMATION:
{docs_context}

CONFIDENCE NOTE: {trust_instruction}

RESPONSE FORMAT — You MUST follow this structure exactly:

## Summary
One sentence describing the issue and the recommended approach.

## Step-by-Step Resolution
Provide numbered steps with specific commands or console actions:
1. **Step title** — Detailed explanation with exact command/action
   ```
   gcloud command or console path here (if applicable)
   ```
2. **Next step** — ...

## Key Points
- Bullet point of critical things to check or verify
- Include specific GCP settings, ports, configurations to verify

## References
- List of sources used (document names and URLs if from web search)

STRICT RULES:
- Use ONLY the information from the documents above. Do NOT fabricate steps or commands.
- Every step must be actionable — tell them exactly WHAT to do, not just "check the docs."
- If a GCP console path exists, provide it (e.g., "Navigate to VPC Network > Firewall rules").
- If a gcloud CLI command exists in the docs, include it.
- If the docs don't fully cover the issue, say "Based on available documentation, here are the most likely steps. If these don't resolve the issue, please escalate."
- Do NOT just say "refer to documentation" — extract the key information from the docs and present it.
- Be professional, helpful, and concise.

SUGGESTED REPLY:"""

        response = self.model.generate_content(prompt)

        # Map source label for frontend
        if source == "web_search":
            display_source = "web_search"
        elif web_chunks:
            display_source = "gcp_docs+web"
        else:
            display_source = "gcp_docs"

        return {
            "suggestion": response.text.strip(),
            "confidence": doc_chunks[0].get("rerank_score", 0.3) if db_chunks else 0.2,
            "source": display_source,
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

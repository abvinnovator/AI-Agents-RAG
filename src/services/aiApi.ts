/**
 * AI Agent API Client
 * Connects the frontend support panel to the Python AI service (FastAPI).
 * 
 * When the AI server is not running, all calls gracefully return null/empty
 * so the support panel works without AI too (manual mode).
 */

const AI_API_BASE = 'http://localhost:8000';

interface SuggestRequest {
  agent_id: string;
  agent_name: string;
  user_role: string;
  ticket_title: string;
  ticket_description: string;
  ticket_category: string;
  ticket_severity: string;
  conversation: Array<{
    content: string;
    authorId: string;
    authorName: string;
    authorRole: string;
  }>;
}

export interface AISuggestion {
  suggestion: string | null;
  confidence: number;
  source: 'past_tickets' | 'shared_tickets' | 'gcp_docs' | 'none';
  similar_tickets: Array<{ ticket_number: string; resolution_preview: string }>;
  citations: Array<{ source: string; text_preview: string }>;
  requires_approval: boolean;
  message?: string;
}

interface LearnRequest {
  agent_id: string;
  agent_name: string;
  user_role: string;
  ticket_id: string;
  ticket_number: string;
  description: string;
  resolution: string;
  category: string;
  conversation: Array<{
    content: string;
    authorId: string;
    authorName: string;
    authorRole: string;
  }>;
}

export interface AgentStats {
  agent_id: string;
  agent_name: string;
  tickets_learned: number;
}

/**
 * Check if the AI service is running.
 */
export async function checkAIHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AI_API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get an AI-suggested reply for a support ticket.
 * Returns null if AI service is unavailable.
 */
export async function getAISuggestion(req: SuggestRequest): Promise<AISuggestion | null> {
  try {
    const res = await fetch(`${AI_API_BASE}/agent/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(30000), // 30s — LLM can be slow
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Tell the AI agent to learn from a resolved ticket.
 */
export async function teachAgent(req: LearnRequest): Promise<boolean> {
  try {
    const res = await fetch(`${AI_API_BASE}/agent/learn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get agent knowledge stats.
 */
export async function getAgentStats(agentId: string, agentName: string, userRole: string): Promise<AgentStats | null> {
  try {
    const params = new URLSearchParams({ agent_name: agentName, user_role: userRole });
    const res = await fetch(`${AI_API_BASE}/agent/stats/${agentId}?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Direct RAG query (for testing or billing audit).
 */
export async function queryRAG(query: string, topK: number = 5): Promise<Array<{ text: string; source: string; score: number }>> {
  try {
    const res = await fetch(`${AI_API_BASE}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: topK }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

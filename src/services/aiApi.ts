/**
 * AI Agent API Client — v2
 * Connects the frontend support panel to the Python AI service (FastAPI).
 * 
 * v2 Changes:
 *   ✓ Dashboard API functions (metrics, suggestions, feedback)
 *   ✓ AISuggestion now includes suggestion_id for tracking
 *   ✓ SuggestRequest includes ticket_id and ticket_number
 * 
 * When the AI server is not running, all calls gracefully return null/empty
 * so the support panel works without AI too (manual mode).
 */

const AI_API_BASE = 'http://localhost:8000';

interface SuggestRequest {
  agent_id: string;
  agent_name: string;
  user_role: string;
  ticket_id: string;
  ticket_number: string;
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
  suggestion_id: string;
  suggestion: string | null;
  confidence: number;
  source: 'past_tickets' | 'shared_tickets' | 'gcp_docs' | 'gcp_docs+web' | 'web_search' | 'none';
  similar_tickets: Array<{ ticket_number: string; resolution_preview: string }>;
  citations: Array<{ source: string; text_preview: string; url?: string; type?: string }>;
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

// ─── Dashboard Types ────────────────────────────────────────────

export interface DashboardMetrics {
  total_suggestions: number;
  with_suggestion: number;
  no_suggestion: number;
  approved_count: number;
  rejected_count: number;
  edited_count: number;
  pending_feedback: number;
  approval_rate: number;
  rejection_rate: number;
  edit_rate: number;
  avg_confidence: number;
  avg_confidence_approved: number;
  avg_confidence_rejected: number;
  confidence_distribution: Record<string, number>;
  source_distribution: Record<string, number>;
  category_distribution: Record<string, number>;
  accuracy_over_time: Array<{
    date: string;
    total: number;
    approved: number;
    rejected: number;
    edited: number;
    approval_rate: number;
  }>;
  high_confidence_rejections: Array<{
    suggestion_id: string;
    ticket_title: string;
    confidence: number;
    source: string;
    timestamp: string;
  }>;
  avg_time_to_feedback_sec: number;
  last_updated: string;
}

export interface SuggestionEntry {
  suggestion_id: string;
  timestamp: string;
  ticket_id: string;
  ticket_number: string;
  ticket_title: string;
  ticket_category: string;
  ticket_severity: string;
  agent_id: string;
  agent_name: string;
  user_role: string;
  suggestion_preview: string;
  has_suggestion: boolean;
  confidence: number;
  source: string;
  citations_count: number;
  feedback_action: 'approved' | 'rejected' | 'edited' | null;
  feedback_timestamp: string | null;
  time_to_feedback_sec: number | null;
}

export interface SuggestionListResponse {
  suggestions: SuggestionEntry[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ─── Core API Functions ─────────────────────────────────────────

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
  const doFetch = (timeoutMs: number) =>
    fetch(`${AI_API_BASE}/agent/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(timeoutMs),
    });

  try {
    // First attempt — 120s to handle cold start (model loading + LLM generation)
    const res = await doFetch(120000);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    // If first call timed out (likely cold start), retry once — model is now cached
    try {
      const res = await doFetch(60000);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
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
 * Direct RAG query with CRAG evaluation (for testing or billing audit).
 */
export async function queryRAG(query: string, topK: number = 5) {
  try {
    const res = await fetch(`${AI_API_BASE}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: topK }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Get RAG pipeline monitoring metrics.
 */
export async function getRAGMetrics() {
  try {
    const res = await fetch(`${AI_API_BASE}/rag/metrics`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Dashboard API Functions (NEW) ──────────────────────────────

/**
 * Get aggregated AI monitoring dashboard metrics.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics | null> {
  try {
    const res = await fetch(`${AI_API_BASE}/dashboard/metrics`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Get paginated list of all AI suggestions with feedback status.
 */
export async function getDashboardSuggestions(page: number = 1, limit: number = 20): Promise<SuggestionListResponse | null> {
  try {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const res = await fetch(`${AI_API_BASE}/dashboard/suggestions?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Submit human feedback on an AI suggestion.
 * Called when engineer approves, rejects, or edits a suggestion.
 */
export async function submitFeedback(
  suggestionId: string,
  action: 'approved' | 'rejected' | 'edited',
  editedText?: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${AI_API_BASE}/dashboard/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suggestion_id: suggestionId,
        action,
        edited_text: editedText,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

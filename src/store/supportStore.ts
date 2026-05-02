import { v4 as uuidv4 } from 'uuid';
import type { SupportRole } from './authStore';

// ─── Types ──────────────────────────────────────────────────────

export type TicketSeverity = 'P1' | 'P2' | 'P3' | 'P4';
export type TicketCategory = 'billing' | 'compute' | 'networking' | 'storage' | 'bigquery' | 'security' | 'general';
export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'escalated' | 'waiting_approval' | 'resolved' | 'closed';

export interface Ticket {
  id: string;
  ticketNumber: string;       // e.g., "CASE-000123"
  title: string;
  description: string;
  category: TicketCategory;
  severity: TicketSeverity;
  status: TicketStatus;

  // Linked resource context
  projectId: string;
  projectName: string;
  linkedResourceType?: string; // e.g., "VM", "Bucket", "VPC"
  linkedResourceName?: string;

  // Assignment
  assignedTo: string | null;     // support user id
  assignedRole: SupportRole | null;
  assignedAt: string | null;

  // AI Agent routing (placeholder for future)
  aiRouting: {
    suggestedRole: SupportRole | null;
    suggestedPriority: TicketSeverity | null;
    suggestedCategory: TicketCategory | null;
    suggestedTool: string | null;        // e.g., "billing_analyzer"
    confidence: number | null;
    reasoning: string | null;
    approved: boolean;                   // super admin approved AI decision
    overridden: boolean;                 // super admin changed AI decision
  };

  // Resolution
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;

  // Conversation — both end-user and support exchange messages here
  messages: TicketMessage[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
  createdBy: string;           // "end_user" for simulator
}

export interface TicketMessage {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: SupportRole | 'end_user';
  createdAt: string;
}

// ─── Escalation Matrix ─────────────────────────────────────────

export interface EscalationRule {
  id: string;
  severity: TicketSeverity;
  targetRole: SupportRole;
  responseTimeMinutes: number;
  description: string;
  active: boolean;
}

// Default escalation rules matching the plan
const DEFAULT_ESCALATION_RULES: EscalationRule[] = [
  { id: 'esc-p1', severity: 'P1', targetRole: 'L4', responseTimeMinutes: 15, description: 'Critical — Emergency Response', active: true },
  { id: 'esc-p2', severity: 'P2', targetRole: 'L3', responseTimeMinutes: 240, description: 'High — Senior Engineer', active: true },
  { id: 'esc-p3', severity: 'P3', targetRole: 'L2', responseTimeMinutes: 480, description: 'Medium — Technical Support', active: true },
  { id: 'esc-p4', severity: 'P4', targetRole: 'L1', responseTimeMinutes: 1440, description: 'Low — Basic Support', active: true },
];

// ─── State ──────────────────────────────────────────────────────

export interface SupportState {
  tickets: Ticket[];
  escalationRules: EscalationRule[];
  ticketCounter: number;       // for generating ticket numbers
}

const STORAGE_KEY = 'cloudops_support_state';

function loadState(): SupportState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    tickets: [],
    escalationRules: [...DEFAULT_ESCALATION_RULES],
    ticketCounter: 0,
  };
}

function saveState(state: SupportState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── Store (pub/sub) ────────────────────────────────────────────

type Listener = () => void;
let _state: SupportState = loadState();
const _listeners = new Set<Listener>();

function notify() {
  saveState(_state);
  _listeners.forEach(fn => fn());
}

export function getSupportState(): SupportState {
  return _state;
}

export function subscribeSupport(fn: Listener) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

// ─── Ticket Actions ─────────────────────────────────────────────

export function raiseTicket(data: {
  title: string;
  description: string;
  category: TicketCategory;
  severity: TicketSeverity;
  projectId: string;
  projectName: string;
  linkedResourceType?: string;
  linkedResourceName?: string;
}): Ticket {
  const counter = _state.ticketCounter + 1;
  const ticket: Ticket = {
    id: uuidv4(),
    ticketNumber: `CASE-${String(counter).padStart(6, '0')}`,
    title: data.title,
    description: data.description,
    category: data.category,
    severity: data.severity,
    status: 'open',
    projectId: data.projectId,
    projectName: data.projectName,
    linkedResourceType: data.linkedResourceType,
    linkedResourceName: data.linkedResourceName,
    assignedTo: null,
    assignedRole: null,
    assignedAt: null,
    aiRouting: {
      suggestedRole: null,
      suggestedPriority: null,
      suggestedCategory: null,
      suggestedTool: null,
      confidence: null,
      reasoning: null,
      approved: false,
      overridden: false,
    },
    resolution: null,
    resolvedBy: null,
    resolvedAt: null,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'end_user',
  };

  // Simulate basic AI routing (placeholder — will be replaced by real AI agent)
  const rule = _state.escalationRules.find(r => r.severity === data.severity && r.active);
  if (rule) {
    ticket.aiRouting = {
      suggestedRole: rule.targetRole,
      suggestedPriority: data.severity,
      suggestedCategory: data.category,
      suggestedTool: getSuggestedTool(data.category),
      confidence: 0.75 + Math.random() * 0.2,
      reasoning: `Based on severity ${data.severity} and category "${data.category}", routing to ${rule.targetRole} per escalation matrix.`,
      approved: false,
      overridden: false,
    };
    ticket.status = 'waiting_approval';
  }

  _state = { ..._state, tickets: [..._state.tickets, ticket], ticketCounter: counter };
  notify();
  return ticket;
}

function getSuggestedTool(category: TicketCategory): string {
  const tools: Record<TicketCategory, string> = {
    billing: 'billing_analyzer',
    compute: 'deployment_checker',
    networking: 'network_validator',
    storage: 'storage_optimizer',
    bigquery: 'deployment_checker',
    security: 'network_validator',
    general: 'deployment_checker',
  };
  return tools[category];
}

// Super admin approves AI routing
export function approveTicketRouting(ticketId: string) {
  _state = {
    ..._state,
    tickets: _state.tickets.map(t => {
      if (t.id !== ticketId) return t;
      return {
        ...t,
        status: 'assigned' as TicketStatus,
        assignedRole: t.aiRouting.suggestedRole,
        assignedAt: new Date().toISOString(),
        aiRouting: { ...t.aiRouting, approved: true },
        updatedAt: new Date().toISOString(),
      };
    }),
  };
  notify();
}

// Super admin overrides AI routing
export function overrideTicketRouting(ticketId: string, newRole: SupportRole, newSeverity: TicketSeverity) {
  _state = {
    ..._state,
    tickets: _state.tickets.map(t => {
      if (t.id !== ticketId) return t;
      return {
        ...t,
        status: 'assigned' as TicketStatus,
        severity: newSeverity,
        assignedRole: newRole,
        assignedAt: new Date().toISOString(),
        aiRouting: { ...t.aiRouting, approved: false, overridden: true },
        updatedAt: new Date().toISOString(),
      };
    }),
  };
  notify();
}

// Assign ticket to specific support user
export function assignTicket(ticketId: string, userId: string, role: SupportRole) {
  _state = {
    ..._state,
    tickets: _state.tickets.map(t =>
      t.id === ticketId
        ? { ...t, assignedTo: userId, assignedRole: role, assignedAt: new Date().toISOString(), status: 'assigned' as TicketStatus, updatedAt: new Date().toISOString() }
        : t
    ),
  };
  notify();
}

// Support engineer picks up ticket
export function startWorkingOnTicket(ticketId: string) {
  _state = {
    ..._state,
    tickets: _state.tickets.map(t =>
      t.id === ticketId ? { ...t, status: 'in_progress' as TicketStatus, updatedAt: new Date().toISOString() } : t
    ),
  };
  notify();
}

// Resolve ticket
export function resolveTicket(ticketId: string, resolution: string, resolvedBy: string) {
  _state = {
    ..._state,
    tickets: _state.tickets.map(t =>
      t.id === ticketId
        ? { ...t, status: 'resolved' as TicketStatus, resolution, resolvedBy, resolvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : t
    ),
  };
  notify();
}

// Close ticket
export function closeTicket(ticketId: string) {
  _state = {
    ..._state,
    tickets: _state.tickets.map(t =>
      t.id === ticketId ? { ...t, status: 'closed' as TicketStatus, updatedAt: new Date().toISOString() } : t
    ),
  };
  notify();
}

// Escalate ticket
export function escalateTicket(ticketId: string, newRole: SupportRole) {
  _state = {
    ..._state,
    tickets: _state.tickets.map(t =>
      t.id === ticketId
        ? { ...t, status: 'escalated' as TicketStatus, assignedRole: newRole, assignedTo: null, updatedAt: new Date().toISOString() }
        : t
    ),
  };
  notify();
}

// Add message to ticket conversation (works for both end-user and support)
export function addMessage(ticketId: string, content: string, authorId: string, authorName: string, authorRole: SupportRole | 'end_user') {
  const message: TicketMessage = {
    id: uuidv4(),
    content,
    authorId,
    authorName,
    authorRole,
    createdAt: new Date().toISOString(),
  };
  _state = {
    ..._state,
    tickets: _state.tickets.map(t =>
      t.id === ticketId ? { ...t, messages: [...t.messages, message], updatedAt: new Date().toISOString() } : t
    ),
  };
  notify();
}

// ─── Escalation Matrix Actions ──────────────────────────────────

export function updateEscalationRule(ruleId: string, updates: Partial<Pick<EscalationRule, 'targetRole' | 'responseTimeMinutes' | 'description' | 'active'>>) {
  _state = {
    ..._state,
    escalationRules: _state.escalationRules.map(r =>
      r.id === ruleId ? { ...r, ...updates } : r
    ),
  };
  notify();
}

// ─── Query Helpers ──────────────────────────────────────────────

export function getTicketsByStatus(status: TicketStatus): Ticket[] {
  return _state.tickets.filter(t => t.status === status);
}

export function getTicketsForRole(role: SupportRole): Ticket[] {
  return _state.tickets.filter(t => t.assignedRole === role && ['assigned', 'in_progress', 'escalated'].includes(t.status));
}

export function getTicketsForUser(userId: string): Ticket[] {
  return _state.tickets.filter(t => t.assignedTo === userId);
}

export function getTicketById(ticketId: string): Ticket | undefined {
  return _state.tickets.find(t => t.id === ticketId);
}

export function getTicketStats() {
  const tickets = _state.tickets;
  return {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    waitingApproval: tickets.filter(t => t.status === 'waiting_approval').length,
    assigned: tickets.filter(t => t.status === 'assigned').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    escalated: tickets.filter(t => t.status === 'escalated').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };
}

// ─── Label Helpers ──────────────────────────────────────────────

export function getSeverityLabel(s: TicketSeverity): string {
  const map: Record<TicketSeverity, string> = { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' };
  return map[s];
}

export function getCategoryLabel(c: TicketCategory): string {
  const map: Record<TicketCategory, string> = {
    billing: 'Billing', compute: 'Compute Engine', networking: 'Networking',
    storage: 'Cloud Storage', bigquery: 'BigQuery', security: 'Security', general: 'General',
  };
  return map[c];
}

export const TICKET_CATEGORIES: TicketCategory[] = ['billing', 'compute', 'networking', 'storage', 'bigquery', 'security', 'general'];
export const TICKET_SEVERITIES: TicketSeverity[] = ['P1', 'P2', 'P3', 'P4'];

import { v4 as uuidv4 } from 'uuid';

// ─── Types ──────────────────────────────────────────────────────

export type SupportRole = 'super_admin' | 'L1' | 'L2' | 'L3' | 'L4' | 'TSE';

export interface SupportUser {
  id: string;
  username: string;
  password: string;           // plain text — this is a simulator, not prod
  displayName: string;
  role: SupportRole;
  agentName: string;          // AI agent name — default: username, customizable
  agentConfigured: boolean;   // has user set their agent name yet?
  createdAt: string;
  createdBy: string;          // super_admin id
  active: boolean;
}

export interface AuthSession {
  userId: string;
  username: string;
  role: SupportRole;
  displayName: string;
  agentName: string;
  loggedInAt: string;
}

// ─── State ──────────────────────────────────────────────────────

export interface AuthState {
  supportUsers: SupportUser[];
  session: AuthSession | null;
}

const STORAGE_KEY = 'cloudops_auth_state';

function loadState(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { supportUsers: [], session: null };
}

function saveState(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── Store (pub/sub) ────────────────────────────────────────────

type Listener = () => void;
let _state: AuthState = loadState();
const _listeners = new Set<Listener>();

function notify() {
  saveState(_state);
  _listeners.forEach(fn => fn());
}

export function getAuthState(): AuthState {
  return _state;
}

export function subscribeAuth(fn: Listener) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

// ─── Auth Actions ───────────────────────────────────────────────

export function login(username: string, password: string): { success: boolean; error?: string } {
  // Check super admin from env
  const adminUser = import.meta.env.VITE_ADMIN_USER;
  const adminPass = import.meta.env.VITE_ADMIN_PASS;

  if (username === adminUser && password === adminPass) {
    _state = {
      ..._state,
      session: {
        userId: 'super_admin',
        username: adminUser,
        role: 'super_admin',
        displayName: 'Super Admin',
        agentName: 'CloudOps-Admin',
        loggedInAt: new Date().toISOString(),
      },
    };
    notify();
    return { success: true };
  }

  // Check secondary users
  const user = _state.supportUsers.find(
    u => u.username === username && u.password === password && u.active
  );

  if (user) {
    _state = {
      ..._state,
      session: {
        userId: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        agentName: user.agentName,
        loggedInAt: new Date().toISOString(),
      },
    };
    notify();
    return { success: true };
  }

  return { success: false, error: 'Invalid username or password' };
}

export function logout() {
  _state = { ..._state, session: null };
  notify();
}

export function getSession(): AuthSession | null {
  return _state.session;
}

// ─── User Management (Super Admin) ─────────────────────────────

export function createSupportUser(
  username: string,
  password: string,
  displayName: string,
  role: SupportRole
): { success: boolean; error?: string; user?: SupportUser } {
  // Validate unique username
  const exists = _state.supportUsers.some(u => u.username === username);
  if (exists) return { success: false, error: 'Username already exists' };

  // Can't create another super_admin
  if (role === 'super_admin') return { success: false, error: 'Cannot create super admin accounts' };

  const user: SupportUser = {
    id: uuidv4(),
    username,
    password,
    displayName,
    role,
    agentName: username,           // default agent name = username
    agentConfigured: false,
    createdAt: new Date().toISOString(),
    createdBy: _state.session?.userId || 'super_admin',
    active: true,
  };

  _state = { ..._state, supportUsers: [..._state.supportUsers, user] };
  notify();
  return { success: true, user };
}

export function updateSupportUser(userId: string, updates: Partial<Pick<SupportUser, 'displayName' | 'role' | 'active' | 'password'>>) {
  _state = {
    ..._state,
    supportUsers: _state.supportUsers.map(u =>
      u.id === userId ? { ...u, ...updates } : u
    ),
  };
  notify();
}

export function deleteSupportUser(userId: string) {
  _state = {
    ..._state,
    supportUsers: _state.supportUsers.filter(u => u.id !== userId),
  };
  notify();
}

// ─── Agent Name (Support Engineers) ─────────────────────────────

export function setAgentName(userId: string, agentName: string) {
  _state = {
    ..._state,
    supportUsers: _state.supportUsers.map(u =>
      u.id === userId ? { ...u, agentName, agentConfigured: true } : u
    ),
    // Also update session if it's the current user
    session: _state.session?.userId === userId
      ? { ..._state.session, agentName }
      : _state.session,
  };
  notify();
}

// ─── Helpers ────────────────────────────────────────────────────

export function getSupportUsersByRole(role: SupportRole): SupportUser[] {
  return _state.supportUsers.filter(u => u.role === role && u.active);
}

export function getAllSupportUsers(): SupportUser[] {
  return _state.supportUsers;
}

export function findSupportUser(userId: string): SupportUser | undefined {
  return _state.supportUsers.find(u => u.id === userId);
}

export function getRoleLabel(role: SupportRole): string {
  const labels: Record<SupportRole, string> = {
    super_admin: 'Super Admin',
    L1: 'L1 — Basic Support',
    L2: 'L2 — Technical Support',
    L3: 'L3 — Senior Engineer',
    L4: 'L4 — Emergency Response',
    TSE: 'TSE — Technical Solutions Engineer',
  };
  return labels[role];
}

export const SUPPORT_ROLES: SupportRole[] = ['L1', 'L2', 'L3', 'L4', 'TSE'];

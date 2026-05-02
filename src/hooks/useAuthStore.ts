import { useSyncExternalStore } from 'react';
import { getAuthState, subscribeAuth, type AuthState } from '../store/authStore';

export function useAuthStore(): AuthState {
  return useSyncExternalStore(subscribeAuth, getAuthState);
}

import { useSyncExternalStore } from 'react';
import { getState, subscribe, type GcpState } from '../store/gcpStore'

export function useGcpStore(): GcpState {
  return useSyncExternalStore(subscribe, getState);
}

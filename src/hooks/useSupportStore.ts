import { useSyncExternalStore } from 'react';
import { getSupportState, subscribeSupport, type SupportState } from '../store/supportStore';

export function useSupportStore(): SupportState {
  return useSyncExternalStore(subscribeSupport, getSupportState);
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

export type SubscriptionStatus = 'unknown' | 'none' | 'trial' | 'active' | 'promo';

interface SubscriptionState {
  status: SubscriptionStatus;
  /** ISO expiry for trial/promo/active, when known. */
  expiresAt: string | null;
  productId: string | null;
  /** True when the store SDK is unavailable and a local test entitlement is in use. */
  mock: boolean;
  setStatus: (s: Pick<SubscriptionState, 'status' | 'expiresAt' | 'productId' | 'mock'>) => void;
  grantPromoDays: (days: number) => void;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      status: 'unknown',
      expiresAt: null,
      productId: null,
      mock: false,
      setStatus: (s) => set(s),
      grantPromoDays: (days) => {
        const base = get().expiresAt && new Date(get().expiresAt!) > new Date()
          ? new Date(get().expiresAt!)
          : new Date();
        base.setDate(base.getDate() + days);
        set({ status: get().status === 'active' ? 'active' : 'promo', expiresAt: base.toISOString() });
      },
      reset: () => set({ status: 'unknown', expiresAt: null, productId: null, mock: false }),
    }),
    { name: 'kickiq.subscription', storage: zustandStorage, version: 1 },
  ),
);

/** Entitled = active/trial, or promo that has not expired. */
export function isEntitled(s: Pick<SubscriptionState, 'status' | 'expiresAt'>, now = new Date()): boolean {
  if (s.status === 'active' || s.status === 'trial') return true;
  if (s.status === 'promo' && s.expiresAt) return new Date(s.expiresAt) > now;
  return false;
}

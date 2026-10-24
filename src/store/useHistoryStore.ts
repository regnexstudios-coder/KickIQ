import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { KickType } from '@/constants/kicks';
import type { Analysis } from '@/features/analysis/types';
import { zustandStorage } from '@/lib/storage';

interface HistoryState {
  analyses: Analysis[];
  add: (a: Analysis) => void;
  update: (id: string, patch: Partial<Analysis>) => void;
  remove: (id: string) => void;
  markSynced: (ids: string[]) => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      analyses: [],
      add: (a) => set((s) => ({ analyses: [a, ...s.analyses.filter((x) => x.id !== a.id)] })),
      update: (id, patch) =>
        set((s) => ({ analyses: s.analyses.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      remove: (id) => set((s) => ({ analyses: s.analyses.filter((a) => a.id !== id) })),
      markSynced: (ids) =>
        set((s) => ({
          analyses: s.analyses.map((a) => (ids.includes(a.id) ? { ...a, synced: true } : a)),
        })),
      clear: () => set({ analyses: [] }),
    }),
    { name: 'kickiq.history', storage: zustandStorage, version: 1 },
  ),
);

// ---- selectors (pure, testable) ----

export function latestAnalysis(list: Analysis[]): Analysis | undefined {
  return list[0];
}

export function bestByKick(list: Analysis[]): Partial<Record<KickType, Analysis>> {
  const out: Partial<Record<KickType, Analysis>> = {};
  for (const a of list) {
    const cur = out[a.kickType];
    if (!cur || a.kickRating > cur.kickRating) out[a.kickType] = a;
  }
  return out;
}

export function previousOfType(list: Analysis[], kickType: KickType, excludeId?: string) {
  return list.find((a) => a.kickType === kickType && a.id !== excludeId);
}

export function byKick(list: Analysis[], kickType: KickType | 'all'): Analysis[] {
  return kickType === 'all' ? list : list.filter((a) => a.kickType === kickType);
}

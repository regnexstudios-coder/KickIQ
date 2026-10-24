import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { KickType } from '@/constants/kicks';
import { isoWeekKey } from '@/lib/date';
import { zustandStorage } from '@/lib/storage';

export interface LeaderboardEntry {
  id: string;
  /** "Alex R." style display name: first name + initial only. */
  displayName: string;
  score: number;
  isMe: boolean;
  createdAt: string;
}

interface ChallengeState {
  weekKey: string;
  kickType: KickType;
  entries: LeaderboardEntry[];
  ensureWeek: (now?: Date) => void;
  submit: (entry: Omit<LeaderboardEntry, 'id' | 'createdAt'>) => void;
  reset: () => void;
}

const WEEKLY_ROTATION: KickType[] = ['curler', 'driven', 'knuckleball', 'chip'];

export function kickForWeek(weekKey: string): KickType {
  const n = Number(weekKey.split('-W')[1] ?? '1');
  return WEEKLY_ROTATION[n % WEEKLY_ROTATION.length] ?? 'curler';
}

export function displayNameFor(firstName: string, lastInitial?: string): string {
  const first = firstName.trim().split(/\s+/)[0] ?? '';
  const cap = first ? first[0]!.toUpperCase() + first.slice(1) : 'Player';
  return lastInitial ? `${cap} ${lastInitial[0]!.toUpperCase()}.` : cap;
}

/** Keep only the best score per player, sorted desc, top 10. */
export function rankEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const best = new Map<string, LeaderboardEntry>();
  for (const e of entries) {
    const key = e.isMe ? '__me' : e.displayName;
    const cur = best.get(key);
    if (!cur || e.score > cur.score) best.set(key, e);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 10);
}

export const useChallengeStore = create<ChallengeState>()(
  persist(
    (set, get) => ({
      weekKey: isoWeekKey(),
      kickType: kickForWeek(isoWeekKey()),
      entries: [],
      ensureWeek: (now = new Date()) => {
        const wk = isoWeekKey(now);
        if (wk !== get().weekKey) set({ weekKey: wk, kickType: kickForWeek(wk), entries: [] });
      },
      submit: (entry) =>
        set((s) => ({
          entries: rankEntries([
            ...s.entries,
            { ...entry, id: `${Date.now()}`, createdAt: new Date().toISOString() },
          ]),
        })),
      reset: () => set({ entries: [] }),
    }),
    { name: 'kickiq.challenge', storage: zustandStorage, version: 1 },
  ),
);

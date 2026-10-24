import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { daysBetween } from '@/lib/date';
import { zustandStorage } from '@/lib/storage';

export interface StreakSnapshot {
  current: number;
  best: number;
  lastActive: string | null;
}

interface StreakState extends StreakSnapshot {
  recordActivity: (now?: Date) => StreakSnapshot;
  reset: () => void;
}

/** Pure streak transition: same day → unchanged, next day → +1, gap → reset to 1. */
export function nextStreak(s: StreakSnapshot, now: Date): StreakSnapshot {
  const todayIso = now.toISOString();
  if (!s.lastActive) return { current: 1, best: Math.max(1, s.best), lastActive: todayIso };
  const gap = daysBetween(new Date(s.lastActive), now);
  if (gap <= 0) return { ...s, lastActive: todayIso };
  const current = gap === 1 ? s.current + 1 : 1;
  return { current, best: Math.max(s.best, current), lastActive: todayIso };
}

/** A streak is only "alive" if the last activity was today or yesterday. */
export function liveStreak(s: StreakSnapshot, now: Date = new Date()): number {
  if (!s.lastActive) return 0;
  return daysBetween(new Date(s.lastActive), now) <= 1 ? s.current : 0;
}

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      current: 0,
      best: 0,
      lastActive: null,
      recordActivity: (now = new Date()) => {
        const next = nextStreak(get(), now);
        set(next);
        return next;
      },
      reset: () => set({ current: 0, best: 0, lastActive: null }),
    }),
    { name: 'kickiq.streak', storage: zustandStorage, version: 1 },
  ),
);

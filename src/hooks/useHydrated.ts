import { useSyncExternalStore } from 'react';

import { useChallengeStore } from '@/store/useChallengeStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useStreakStore } from '@/store/useStreakStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';

const stores = [useProfileStore, useHistoryStore, useStreakStore, useSubscriptionStore, useChallengeStore] as const;

const allHydrated = () => stores.every((s) => s.persist.hasHydrated());

function subscribe(onChange: () => void) {
  const unsubs = stores.map((s) => s.persist.onFinishHydration(onChange));
  return () => unsubs.forEach((u) => u());
}

/** True once every persisted store has rehydrated from AsyncStorage. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, allHydrated, allHydrated);
}

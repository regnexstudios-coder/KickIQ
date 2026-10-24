import type { KickType } from '@/constants/kicks';
import { currentUserId, getSupabase } from '@/features/auth/supabase';
import { rankEntries, useChallengeStore, type LeaderboardEntry } from '@/store/useChallengeStore';

/** Local-first leaderboard; merges the Supabase weekly view when available. */
export async function fetchLeaderboard(weekKey: string, kickType: KickType): Promise<LeaderboardEntry[]> {
  const local = useChallengeStore.getState().entries;
  const sb = getSupabase();
  if (!sb) return rankEntries(local);
  const { data, error } = await sb
    .from('weekly_leaderboard')
    .select('display_name, score')
    .eq('week_key', weekKey)
    .eq('kick_type', kickType)
    .order('score', { ascending: false })
    .limit(10);
  if (error || !data) return rankEntries(local);
  const mine = local.find((e) => e.isMe);
  const remote: LeaderboardEntry[] = data.map((r, i) => ({
    id: `r${i}`,
    displayName: r.display_name as string,
    score: r.score as number,
    isMe: mine?.displayName === r.display_name && mine?.score === r.score,
    createdAt: '',
  }));
  return rankEntries([...remote, ...(mine ? [mine] : [])]);
}

export async function submitEntry(weekKey: string, kickType: KickType, displayName: string, score: number): Promise<void> {
  useChallengeStore.getState().submit({ displayName, score, isMe: true });
  const sb = getSupabase();
  if (!sb) return;
  const userId = await currentUserId();
  if (!userId) return;
  await sb
    .from('challenge_entries')
    .upsert({ user_id: userId, week_key: weekKey, kick_type: kickType, display_name: displayName, score }, { onConflict: 'user_id,week_key,kick_type' });
}

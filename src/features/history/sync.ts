import type { Analysis } from '@/features/analysis/types';
import { currentUserId, getSupabase } from '@/features/auth/supabase';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useStreakStore } from '@/store/useStreakStore';

/** Row shape of public.analyses (see supabase/migrations). Raw video is never included. */
export function toAnalysisRow(a: Analysis, userId: string) {
  return {
    id: a.id,
    user_id: userId,
    kick_type: a.kickType,
    kick_rating: a.kickRating,
    sub_scores: a.subScores,
    one_fix: a.oneFix,
    why_it_matters: a.whyItMatters,
    drills: a.drills,
    metrics: a.metrics,
    confidence: a.confidence,
    source: a.source,
    retake_of_id: a.retakeOfId,
    score_card_url: a.scoreCardUri?.startsWith('http') ? a.scoreCardUri : null,
    created_at: a.createdAt,
  };
}

/** Push unsynced local analyses, profile and streak to Supabase. Safe to call often; no-op offline. */
export async function syncToCloud(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const userId = await currentUserId();
  if (!userId) return;

  const profile = useProfileStore.getState();
  await sb.from('profiles').upsert(
    {
      id: userId,
      position: profile.answers.position,
      level: profile.answers.level,
      goal: profile.answers.goal,
      weakness: profile.answers.weakness,
      train_frequency: profile.answers.frequency,
      birth_year: profile.birthYear,
      referral_code: profile.referralCode,
    },
    { onConflict: 'id' },
  );

  const streak = useStreakStore.getState();
  await sb.from('streaks').upsert(
    { user_id: userId, current: streak.current, best: streak.best, last_active: streak.lastActive },
    { onConflict: 'user_id' },
  );

  const pending = useHistoryStore.getState().analyses.filter((a) => !a.synced);
  if (pending.length === 0) return;
  const { error } = await sb.from('analyses').upsert(pending.map((a) => toAnalysisRow(a, userId)), { onConflict: 'id' });
  if (!error) useHistoryStore.getState().markSynced(pending.map((a) => a.id));
}

/** Delete every remote row for this user (GDPR / "Delete my data"). */
export async function deleteCloudData(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const userId = await currentUserId();
  if (!userId) return;
  await sb.from('analyses').delete().eq('user_id', userId);
  await sb.from('streaks').delete().eq('user_id', userId);
  await sb.from('challenge_entries').delete().eq('user_id', userId);
  await sb.from('profiles').delete().eq('id', userId);
  await sb.auth.signOut().catch(() => {});
}

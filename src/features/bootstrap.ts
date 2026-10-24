import { ensureSession } from '@/features/auth/supabase';
import { initBilling } from '@/features/billing/billing';
import { identify } from '@/features/analytics/analytics';
import { syncToCloud } from '@/features/history/sync';
import { generateReferralCode } from '@/features/referral/referral';
import { detectLocale, setLocale } from '@/i18n';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useProfileStore } from '@/store/useProfileStore';

let started = false;

/** One-time startup work after stores hydrate. Idempotent and never throws. */
export async function bootstrap(): Promise<void> {
  if (started) return;
  started = true;
  setLocale(detectLocale());
  useChallengeStore.getState().ensureWeek();

  const profile = useProfileStore.getState();
  const userId = await ensureSession().catch(() => null);
  if (!profile.referralCode) profile.setReferralCode(generateReferralCode(userId ?? undefined));
  if (userId) identify(userId, { level: profile.answers.level, position: profile.answers.position });

  await initBilling(userId ?? undefined).catch(() => {});
  syncToCloud().catch(() => {});
}

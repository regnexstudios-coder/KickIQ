/** Analytics event names (PostHog). Keep in sync with README › Analytics. */
export const Events = {
  onboardingStep: 'onboarding_step',
  paywallView: 'paywall_view',
  trialStart: 'trial_start',
  purchase: 'purchase',
  restore: 'restore_purchases',
  analysisStart: 'analysis_start',
  analysisComplete: 'analysis_complete',
  analysisRetry: 'analysis_retry',
  analysisError: 'analysis_error',
  shareCard: 'share_card',
  challengeShare: 'challenge_share',
  retake: 'retake',
  ageGateBlocked: 'age_gate_blocked',
  referralRedeem: 'referral_redeem',
  weeklyChallengeEnter: 'weekly_challenge_enter',
  deleteData: 'delete_data',
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

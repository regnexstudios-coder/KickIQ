import { Redirect } from 'expo-router';

import { useProfileStore } from '@/store/useProfileStore';
import { isEntitled, useSubscriptionStore } from '@/store/useSubscriptionStore';

/** Routing hub: sends the player to the first gate they have not passed. */
export default function Index() {
  const ageVerified = useProfileStore((s) => s.ageVerified);
  const onboardingComplete = useProfileStore((s) => s.onboardingComplete);
  const entitled = useSubscriptionStore((s) => isEntitled(s));

  if (!ageVerified) return <Redirect href="/age-gate" />;
  if (!onboardingComplete) return <Redirect href="/onboarding/1" />;
  if (!entitled) return <Redirect href="/paywall" />;
  return <Redirect href="/(tabs)" />;
}

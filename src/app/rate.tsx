import { Redirect } from 'expo-router';

import { useProfileStore } from '@/store/useProfileStore';
import { isEntitled, useSubscriptionStore } from '@/store/useSubscriptionStore';

/** Deep link target: kickiq://rate and https://kickiq.app/rate */
export default function RateDeepLink() {
  const ready = useProfileStore((s) => s.ageVerified && s.onboardingComplete);
  const entitled = useSubscriptionStore((s) => isEntitled(s));
  return <Redirect href={ready && entitled ? '/record' : '/'} />;
}

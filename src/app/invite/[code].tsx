import { Redirect, useLocalSearchParams } from 'expo-router';

import { useProfileStore } from '@/store/useProfileStore';
import { isEntitled, useSubscriptionStore } from '@/store/useSubscriptionStore';

/** Deep link target: https://kickiq.app/invite/CODE */
export default function InviteDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const ready = useProfileStore((s) => s.ageVerified && s.onboardingComplete);
  const entitled = useSubscriptionStore((s) => isEntitled(s));
  if (ready && entitled) return <Redirect href={{ pathname: '/referral', params: { code } }} />;
  return <Redirect href="/" />;
}

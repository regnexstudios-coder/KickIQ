import { router } from 'expo-router';

import { EmptyState, Screen } from '@/components/ui';
import { t } from '@/i18n';

export default function NotFound() {
  return (
    <Screen>
      <EmptyState title={t('result.notFound')} ctaLabel={t('analyzing.homeCta')} onCta={() => router.replace('/')} icon="compass-outline" />
    </Screen>
  );
}

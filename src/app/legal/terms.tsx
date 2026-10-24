import { LegalPage } from '@/components/LegalPage';
import { TERMS } from '@/content/legal';
import { t } from '@/i18n';

export default function Terms() {
  return <LegalPage title={t('legal.termsTitle')} sections={TERMS} />;
}

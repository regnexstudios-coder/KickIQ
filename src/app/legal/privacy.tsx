import { LegalPage } from '@/components/LegalPage';
import { PRIVACY } from '@/content/legal';
import { t } from '@/i18n';

export default function Privacy() {
  return <LegalPage title={t('legal.privacyTitle')} sections={PRIVACY} />;
}

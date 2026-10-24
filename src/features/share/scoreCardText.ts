import { config, storeUrl } from '@/lib/config';
import { t } from '@/i18n';

/** Deep link that opens the record flow; falls back to the store when the app is not installed. */
export function shareLink(): string {
  return `${config.links.web}/rate?utm_source=share`;
}

export function challengeText(score: number): string {
  return t('share.challengeText', { score, link: shareLink() });
}

export function referralShareText(code: string): string {
  return t('referral.shareText', { code, link: `${config.links.web}/invite/${code}` });
}

export function storeLinkForPlatform(): string {
  return storeUrl;
}

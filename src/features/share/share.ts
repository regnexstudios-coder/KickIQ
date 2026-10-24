import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { t } from '@/i18n';

import { challengeText } from './scoreCardText';

const CARD_W = 1080;
const CARD_H = 1920;

/** Renders the (off-screen) ScoreCard view to a 1080x1920 PNG in the cache directory. */
export async function renderScoreCard(viewRef: React.RefObject<unknown>, analysisId: string): Promise<string> {
  const tmp = await captureRef(viewRef as never, {
    format: 'png',
    quality: 1,
    width: CARD_W,
    height: CARD_H,
    result: 'tmpfile',
  });
  const dir = new Directory(Paths.cache, 'score-cards');
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `kickiq-${analysisId}.png`);
  if (dest.exists) dest.delete();
  const src = new File(tmp.startsWith('file://') ? tmp : `file://${tmp}`);
  await src.copy(dest);
  return dest.uri;
}

export async function shareScoreCard(uri: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('share.sheetTitle'), UTI: 'public.png' });
  return true;
}

export async function shareChallenge(score: number): Promise<boolean> {
  const res = await Share.share({ message: challengeText(score) });
  return res.action !== Share.dismissedAction;
}

export async function shareText(message: string): Promise<boolean> {
  const res = await Share.share({ message });
  return res.action !== Share.dismissedAction;
}

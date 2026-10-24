import { useVideoPlayer, VideoView } from 'expo-video';
import { router } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';

import { Button, Chip, Header, Screen, T } from '@/components/ui';
import { Events } from '@/features/analytics/events';
import { track } from '@/features/analytics/analytics';
import { t } from '@/i18n';
import { config } from '@/lib/config';
import { useSessionStore } from '@/store/useSessionStore';

export default function Preview() {
  const { width } = useWindowDimensions();
  const { videoUri, durationSec, source, poseFrames, retakeOfId } = useSessionStore();
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const tooShort = durationSec != null && durationSec < config.limits.minClipSeconds;
  const tooLong = durationSec != null && durationSec > config.limits.maxClipSeconds + 1;

  const go = () => {
    track(Events.analysisStart, { source, frames: poseFrames.length, retake: Boolean(retakeOfId) });
    router.replace('/analyzing');
  };

  return (
    <Screen>
      <Header title={t('record.previewTitle')} />
      <View className="flex-1 justify-between py-3">
        <View className="gap-3">
          <View className="overflow-hidden rounded-3xl bg-surface" style={{ width: width - 40, height: (width - 40) * 1.33 }}>
            {videoUri ? <VideoView player={player} style={{ flex: 1 }} contentFit="cover" nativeControls={false} /> : null}
          </View>
          <View className="flex-row flex-wrap gap-2">
            {durationSec != null ? <Chip label={`${durationSec.toFixed(1)}s`} /> : null}
            {source === 'import' ? <Chip label={t('record.importedBadge')} tone="gold" /> : null}
            {poseFrames.length > 0 ? <Chip label={`${t('record.tracking')} · ${poseFrames.length} frames`} tone="accent" /> : null}
          </View>
          {tooShort ? (
            <T variant="caption" className="text-danger">
              {t('record.tooShort', { min: config.limits.minClipSeconds })}
            </T>
          ) : null}
          {tooLong ? (
            <T variant="caption" className="text-danger">
              {t('record.tooLong', { max: config.limits.maxClipSeconds })}
            </T>
          ) : null}
        </View>
        <View className="gap-3">
          <Button label={t('record.analyzeCta')} onPress={go} disabled={!videoUri || tooShort || tooLong} />
          <Button label={t('record.retakeCta')} variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}

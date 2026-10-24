import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Button, ErrorState, Header, Screen, T } from '@/components/ui';
import { KICK_EMOJI } from '@/constants/kicks';
import { Events } from '@/features/analytics/events';
import { track } from '@/features/analytics/analytics';
import { CoachError } from '@/features/analysis/gemini';
import { runAnalysis, type PipelineOutcome } from '@/features/analysis/pipeline';
import { currentUserId } from '@/features/auth/supabase';
import { submitEntry } from '@/features/challenge/leaderboard';
import { syncToCloud } from '@/features/history/sync';
import { persistClip } from '@/features/history/videoStorage';
import { t } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { displayNameFor, useChallengeStore } from '@/store/useChallengeStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useStreakStore } from '@/store/useStreakStore';

export default function Analyzing() {
  const session = useSessionStore();
  const profile = useProfileStore();
  const [outcome, setOutcome] = useState<PipelineOutcome | null>(null);
  const started = useRef(false);
  const progress = session.progress;

  useEffect(() => {
    if (started.current || !session.videoUri) return;
    started.current = true;
    (async () => {
      const userId = await currentUserId();
      const result = await runAnalysis(
        {
          kickType: session.kickType,
          videoUri: session.videoUri!,
          durationSec: session.durationSec,
          source: session.source,
          poseFrames: session.poseFrames,
          heightCm: profile.heightCm,
          level: profile.answers.level,
          weakness: profile.answers.weakness,
          retakeOfId: session.retakeOfId,
          userId,
        },
        session.setProgress,
      );
      if (result.kind === 'analysis') {
        const a = result.analysis;
        // Keep the clip on-device under the analysis id, then save + streak + challenge + cloud sync.
        try {
          a.videoUri = await persistClip(a.videoUri!, a.id);
        } catch {
          // keep original uri
        }
        useHistoryStore.getState().add(a);
        useStreakStore.getState().recordActivity();
        const ch = useChallengeStore.getState();
        if (ch.kickType === a.kickType && profile.firstName) {
          submitEntry(ch.weekKey, ch.kickType, displayNameFor(profile.firstName), a.kickRating).catch(() => {});
          track(Events.weeklyChallengeEnter, { score: a.kickRating });
        }
        track(Events.analysisComplete, {
          kick_type: a.kickType,
          rating: a.kickRating,
          confidence: a.confidence,
          has_metrics: a.metrics != null,
          source: a.source,
          retake: Boolean(a.retakeOfId),
        });
        syncToCloud().catch(() => {});
        haptic.success();
        session.finishClip(a.id);
        router.replace(`/result/${a.id}`);
        return;
      }
      if (result.kind === 'retry') {
        track(Events.analysisRetry, { reason: result.reason.slice(0, 80) });
        haptic.error();
      } else {
        track(Events.analysisError, { message: result.error.message.slice(0, 120) });
        haptic.error();
      }
      setOutcome(result);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session.videoUri && !outcome) {
    return (
      <Screen>
        <ErrorState title={t('analyzing.errorTitle')} ctaLabel={t('analyzing.homeCta')} onCta={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }

  if (outcome?.kind === 'retry') {
    return (
      <Screen>
        <Header showBack={false} />
        <View className="flex-1 items-center justify-center gap-4 px-2">
          <T className="text-6xl">🎥</T>
          <T variant="title" className="text-center">
            {t('analyzing.retryTitle')}
          </T>
          <T variant="body" className="text-center text-muted">
            {outcome.reason || t('analyzing.retryReasons.default')}
          </T>
        </View>
        <View className="gap-3 pb-6">
          <Button label={t('analyzing.retakeCta')} onPress={() => router.replace('/record/camera')} />
          <Button label={t('analyzing.homeCta')} variant="ghost" onPress={() => router.replace('/(tabs)')} />
        </View>
      </Screen>
    );
  }

  if (outcome?.kind === 'error') {
    const err = outcome.error;
    const body =
      err instanceof CoachError
        ? err.kind === 'not_configured'
          ? t('analyzing.notConfigured')
          : err.kind === 'timeout'
            ? t('analyzing.timeout')
            : err.kind === 'network'
              ? t('analyzing.offline')
              : err.message
        : err.message;
    return (
      <Screen>
        <ErrorState
          title={t('analyzing.errorTitle')}
          body={body}
          ctaLabel={t('common.retry')}
          onCta={() => {
            started.current = false;
            setOutcome(null);
            router.replace('/analyzing');
          }}
        />
        <View className="pb-6">
          <Button label={t('analyzing.homeCta')} variant="ghost" onPress={() => router.replace('/(tabs)')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-6">
        <T className="text-7xl">{KICK_EMOJI[session.kickType]}</T>
        <View className="items-center gap-2">
          <T variant="title" className="text-center">
            {t('analyzing.title', { kick: t(`kicks.${session.kickType}`) })}
          </T>
          <T variant="caption">{t('analyzing.sub')}</T>
        </View>
        <View className="w-full gap-3">
          <View className="h-2.5 w-full overflow-hidden rounded-full bg-surface2">
            <View className="h-full rounded-full bg-pitch" style={{ width: `${Math.max(4, progress.progress * 100)}%` }} />
          </View>
          <T variant="bodyStrong" className="text-center text-pitchSoft">
            {t(progress.messageKey)}
          </T>
        </View>
      </View>
      <View className="pb-6">
        <Button label={t('analyzing.cancel')} variant="ghost" onPress={() => router.replace('/(tabs)')} />
      </View>
    </Screen>
  );
}

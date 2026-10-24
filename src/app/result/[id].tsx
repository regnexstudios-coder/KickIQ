import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Alert, Pressable, useWindowDimensions, View } from 'react-native';

import { ScoreCard } from '@/components/ScoreCard';
import { ScoreRing } from '@/components/ScoreRing';
import { SkeletonOverlay } from '@/components/SkeletonOverlay';
import { SubScoreBar } from '@/components/SubScoreBar';
import { Button, Card, Chip, EmptyState, Header, Screen, T } from '@/components/ui';
import { KICK_EMOJI } from '@/constants/kicks';
import { Events } from '@/features/analytics/events';
import { track } from '@/features/analytics/analytics';
import { SUB_SCORE_KEYS } from '@/features/analysis/types';
import { syncToCloud } from '@/features/history/sync';
import { renderScoreCard, shareChallenge, shareScoreCard } from '@/features/share/share';
import type { KickMetrics } from '@/features/pose/types';
import { t } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { previousOfType, useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useSessionStore } from '@/store/useSessionStore';

/** expo-video players are mutated imperatively; kept outside the component for the React Compiler lint. */
function applyPlaybackRate(player: { playbackRate: number }, rate: number) {
  player.playbackRate = rate;
}

const METRIC_ROWS: { key: keyof KickMetrics; unit: 'cm' | 'deg' | 'steps' | 'pct' | 'bool' }[] = [
  { key: 'plant_foot_distance_cm', unit: 'cm' },
  { key: 'plant_foot_angle_deg', unit: 'deg' },
  { key: 'knee_over_ball_deg', unit: 'deg' },
  { key: 'hip_rotation_deg', unit: 'deg' },
  { key: 'shoulder_rotation_deg', unit: 'deg' },
  { key: 'torso_lean_deg', unit: 'deg' },
  { key: 'approach_angle_deg', unit: 'deg' },
  { key: 'approach_steps', unit: 'steps' },
  { key: 'head_down_at_contact', unit: 'bool' },
];

export default function Result() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const analyses = useHistoryStore((s) => s.analyses);
  const update = useHistoryStore((s) => s.update);
  const firstName = useProfileStore((s) => s.firstName);
  const setRetakeOf = useSessionStore((s) => s.setRetakeOf);
  const setKickType = useSessionStore((s) => s.setKickType);
  const analysis = analyses.find((a) => a.id === id);
  const previous = useMemo(() => {
    if (!analysis) return undefined;
    return (analysis.retakeOfId && analyses.find((a) => a.id === analysis.retakeOfId)) || previousOfType(analyses.filter((a) => new Date(a.createdAt) < new Date(analysis.createdAt)), analysis.kickType, analysis.id);
  }, [analysis, analyses]);

  const [slowMo, setSlowMo] = useState(true);
  const [skeleton, setSkeleton] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [saved, setSaved] = useState(false);
  const cardRef = useRef<ComponentRef<typeof View>>(null);

  const player = useVideoPlayer(analysis?.videoUri ?? null, (p) => {
    p.loop = true;
    p.muted = true;
    p.playbackRate = 0.5;
    p.timeUpdateEventInterval = 0.05;
    p.play();
  });
  const timeEvt = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });

  // Skeleton frames are only available for camera clips; pick the nearest frame to the playhead.
  const poseFrames = useSessionStore((s) => (s.lastAnalysisId === id ? s.poseFrames : []));
  const overlayFrame = useMemo(() => {
    if (!skeleton || poseFrames.length === 0) return null;
    const tt = timeEvt.currentTime;
    let best = poseFrames[0]!;
    for (const f of poseFrames) if (Math.abs(f.t - tt) < Math.abs(best.t - tt)) best = f;
    return Math.abs(best.t - tt) < 0.2 ? best : null;
  }, [skeleton, poseFrames, timeEvt.currentTime]);

  if (!analysis) {
    return (
      <Screen>
        <Header />
        <EmptyState title={t('result.notFound')} ctaLabel={t('analyzing.homeCta')} onCta={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }

  const delta = previous ? analysis.kickRating - previous.kickRating : null;
  const isBest = analyses.filter((a) => a.kickType === analysis.kickType).every((a) => a.kickRating <= analysis.kickRating);
  const videoW = width - 40;
  const videoH = videoW * 1.25;

  const toggleSlowMo = () => {
    const next = !slowMo;
    setSlowMo(next);
    applyPlaybackRate(player, next ? 0.5 : 1);
  };

  const onShare = async () => {
    setSharing(true);
    try {
      const uri = await renderScoreCard(cardRef, analysis.id);
      update(analysis.id, { scoreCardUri: uri });
      const ok = await shareScoreCard(uri);
      track(Events.shareCard, { rating: analysis.kickRating, ok });
    } catch (e) {
      Alert.alert(t('share.failed'), (e as Error).message);
    } finally {
      setSharing(false);
    }
  };

  const onRetake = () => {
    track(Events.retake, { from: analysis.kickRating });
    setRetakeOf(analysis.id);
    setKickType(analysis.kickType);
    router.push('/record/camera');
  };

  const onSave = async () => {
    haptic.success();
    setSaved(true);
    syncToCloud().catch(() => {});
    setTimeout(() => router.replace('/(tabs)/progress'), 400);
  };

  return (
    <Screen scroll padded={false}>
      <View className="px-5">
        <Header
          title={t('result.title')}
          onBack={() => router.replace('/(tabs)')}
          right={
            <Pressable onPress={() => shareChallenge(analysis.kickRating).then((ok) => track(Events.challengeShare, { ok }))} accessibilityLabel={t('result.challengeShare')} className="h-10 w-10 items-center justify-center rounded-full bg-surface">
              <Ionicons name="trophy-outline" size={20} color={colors.gold} />
            </Pressable>
          }
        />
      </View>

      <View className="items-center gap-3 px-5 pt-2">
        <ScoreRing rating={analysis.kickRating} />
        <View className="flex-row flex-wrap justify-center gap-2">
          <Chip label={`${KICK_EMOJI[analysis.kickType]} ${t(`kicks.${analysis.kickType}`)}`} />
          {isBest ? <Chip label={t('result.newBest', { kick: t(`kicks.${analysis.kickType}`) })} tone="gold" /> : null}
          {delta != null ? (
            <Chip label={delta > 0 ? t('result.improved', { delta }) : delta < 0 ? t('result.dropped', { delta }) : t('result.same')} tone={delta > 0 ? 'accent' : 'muted'} />
          ) : null}
        </View>
      </View>

      <View className="mt-6 gap-4 px-5">
        {SUB_SCORE_KEYS.map((k) => (
          <SubScoreBar key={k} keyName={k} value={analysis.subScores[k]} previous={previous?.subScores[k]} />
        ))}
      </View>

      {analysis.videoUri ? (
        <View className="mt-6 px-5">
          <View className="overflow-hidden rounded-3xl bg-surface" style={{ width: videoW, height: videoH }}>
            <VideoView player={player} style={{ width: videoW, height: videoH }} contentFit="cover" nativeControls={false} />
            <SkeletonOverlay frame={overlayFrame} width={videoW} height={videoH} />
            <View className="absolute bottom-3 left-3 flex-row gap-2">
              <Pressable onPress={toggleSlowMo} className={`rounded-full px-3 py-1.5 ${slowMo ? 'bg-pitch' : 'bg-bg/70'}`}>
                <T variant="caption" className={slowMo ? 'text-bg font-sansBold' : 'text-ink'}>
                  {t('result.slowMo')} {slowMo ? '0.5×' : '1×'}
                </T>
              </Pressable>
              {poseFrames.length > 0 ? (
                <Pressable onPress={() => setSkeleton((s) => !s)} className={`rounded-full px-3 py-1.5 ${skeleton ? 'bg-pitch' : 'bg-bg/70'}`}>
                  <T variant="caption" className={skeleton ? 'text-bg font-sansBold' : 'text-ink'}>
                    {t('result.skeleton')}
                  </T>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      <View className="mt-6 px-5">
        <Card tone="accent" className="gap-2">
          <View className="flex-row items-center gap-2">
            <Ionicons name="flash" size={18} color={colors.pitch} />
            <T variant="label" className="text-pitchSoft">
              {t('result.oneFix')}
            </T>
          </View>
          <T variant="heading" className="text-xl leading-7">
            {analysis.oneFix}
          </T>
          <T variant="label" className="mt-2">
            {t('result.why')}
          </T>
          <T variant="caption" className="text-ink">
            {analysis.whyItMatters}
          </T>
        </Card>
        <T variant="caption" className="mt-2 text-right">
          {t('result.confidence', { pct: Math.round(analysis.confidence * 100) })}
        </T>
        {analysis.confidence < 0.6 ? (
          <T variant="caption" className="mt-1 text-gold">
            {t('result.lowConfidence')}
          </T>
        ) : null}
      </View>

      <View className="mt-6 px-5">
        <T variant="label" className="mb-3">
          {t('result.drills')}
        </T>
        <View className="gap-3">
          {analysis.drills.map((d, i) => (
            <Card key={d.name} className="flex-row gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-pitch/15">
                <T variant="bodyStrong" className="text-pitch">
                  {i + 1}
                </T>
              </View>
              <View className="flex-1 gap-1">
                <View className="flex-row items-center justify-between">
                  <T variant="bodyStrong">{d.name}</T>
                  <Chip label={d.reps} tone="accent" />
                </View>
                <T variant="caption">{d.how}</T>
              </View>
            </Card>
          ))}
        </View>
      </View>

      <View className="mt-6 px-5">
        <T variant="label" className="mb-3">
          {t('result.metricsTitle')}
        </T>
        <Card className="gap-2.5">
          {analysis.metrics ? (
            <>
              {METRIC_ROWS.map(({ key, unit }) => {
                const raw = analysis.metrics![key];
                const v =
                  unit === 'bool'
                    ? t(raw ? 'result.units.bool_yes' : 'result.units.bool_no')
                    : t(`result.units.${unit}`, { v: String(raw) });
                return (
                  <View key={key} className="flex-row items-center justify-between">
                    <T variant="caption" className="text-ink">
                      {t(`result.metrics.${key}`)}
                    </T>
                    <T variant="mono">{v}</T>
                  </View>
                );
              })}
              <T variant="caption" className="mt-1 text-xs">
                {t('result.estimatedNote')}
              </T>
            </>
          ) : (
            <T variant="caption">{t('result.noMetrics')}</T>
          )}
        </Card>
      </View>

      <View className="mt-8 gap-3 px-5 pb-6">
        <Button label={t('result.shareCard')} onPress={onShare} loading={sharing} icon={<Ionicons name="share-social" size={20} color={colors.bg} />} />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button label={t('result.retake')} variant="secondary" onPress={onRetake} icon={<Ionicons name="refresh" size={18} color={colors.ink} />} />
          </View>
          <View className="flex-1">
            <Button label={saved ? t('result.saved') : t('result.save')} variant="secondary" onPress={onSave} icon={<Ionicons name={saved ? 'checkmark' : 'bookmark-outline'} size={18} color={colors.ink} />} />
          </View>
        </View>
        {previous ? <Button label={t('result.compare')} variant="ghost" onPress={() => router.push(`/compare/${analysis.id}`)} /> : null}
      </View>

      {/* Off-screen share card, captured on demand. */}
      <View style={{ position: 'absolute', left: -10000, top: 0 }} pointerEvents="none">
        <ScoreCard ref={cardRef} analysis={analysis} firstName={firstName} />
      </View>
    </Screen>
  );
}

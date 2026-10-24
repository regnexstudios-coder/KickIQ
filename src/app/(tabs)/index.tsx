import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { ScoreRing } from '@/components/ScoreRing';
import { Button, Card, Chip, Screen, T } from '@/components/ui';
import { KICK_EMOJI } from '@/constants/kicks';
import { t, tList } from '@/i18n';
import { formatShortDate } from '@/lib/date';
import { colors, ratingColor } from '@/lib/theme';
import { rankEntries, useChallengeStore } from '@/store/useChallengeStore';
import { bestByKick, latestAnalysis, useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useSessionStore } from '@/store/useSessionStore';
import { liveStreak, useStreakStore } from '@/store/useStreakStore';

export default function Home() {
  const analyses = useHistoryStore((s) => s.analyses);
  const firstName = useProfileStore((s) => s.firstName);
  const streak = useStreakStore();
  const challenge = useChallengeStore();
  const setRetakeOf = useSessionStore((s) => s.setRetakeOf);

  useEffect(() => {
    challenge.ensureWeek();
  }, [challenge]);

  const last = latestAnalysis(analyses);
  const best = useMemo(() => bestByKick(analyses), [analyses]);
  const live = liveStreak(streak);
  const tip = tList('home.tips')[new Date().getDate() % 4] ?? '';
  const top = rankEntries(challenge.entries)[0];
  const myBest = best[challenge.kickType];

  const startRating = () => {
    setRetakeOf(null);
    router.push('/record');
  };

  return (
    <Screen scroll>
      <View className="flex-row items-center justify-between pt-2">
        <View>
          <T variant="label" className="text-pitch">
            {t('common.appName')}
          </T>
          <T variant="title">{firstName ? t('home.greeting', { name: firstName }) : t('home.greetingAnon')}</T>
        </View>
        <View className="flex-row items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5">
          <Ionicons name="flame" size={16} color={live > 0 ? colors.gold : colors.muted} />
          <T variant="bodyStrong" className={live > 0 ? 'text-gold' : 'text-muted'}>
            {live}
          </T>
        </View>
      </View>

      <Pressable onPress={startRating} accessibilityRole="button" className="mt-6 overflow-hidden rounded-3xl active:opacity-90">
        <LinearGradient colors={[colors.pitch, colors.pitchDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 24 }}>
          <View className="flex-row items-center justify-between">
            <View className="gap-1">
              <T variant="display" className="text-bg text-5xl">
                {t('home.rate')}
              </T>
              <T variant="bodyStrong" className="text-bg/80">
                {t('home.rateSub')}
              </T>
            </View>
            <View className="h-14 w-14 items-center justify-center rounded-full bg-bg/20">
              <Ionicons name="videocam" size={28} color={colors.bg} />
            </View>
          </View>
        </LinearGradient>
      </Pressable>

      <View className="mt-6 flex-row gap-3">
        <Card className="flex-1 items-center gap-2" onPress={last ? () => router.push(`/result/${last.id}`) : undefined}>
          <T variant="label">{t('home.lastScore')}</T>
          {last ? (
            <>
              <ScoreRing rating={last.kickRating} size={96} stroke={9} animate={false} showLabel={false} />
              <T variant="caption">
                {KICK_EMOJI[last.kickType]} {t(`kicks.${last.kickType}`)} · {formatShortDate(last.createdAt)}
              </T>
            </>
          ) : (
            <>
              <ScoreRing rating={null} size={96} stroke={9} animate={false} showLabel={false} />
              <T variant="caption" className="text-center">
                {t('home.noScoreYet')}
              </T>
            </>
          )}
        </Card>
        <Card className="flex-1 justify-between gap-2">
          <T variant="label">{t('home.streak')}</T>
          <View className="flex-row items-end gap-1">
            <T variant="display" className={live > 0 ? 'text-gold' : 'text-muted'}>
              {live}
            </T>
            <Ionicons name="flame" size={28} color={live > 0 ? colors.gold : colors.muted} style={{ marginBottom: 8 }} />
          </View>
          <T variant="caption">{live > 0 ? t('home.bestStreak', { count: streak.best }) : t('home.streakZero')}</T>
        </Card>
      </View>

      <Card className="mt-4 gap-3" tone="accent" onPress={() => router.push('/challenge')}>
        <View className="flex-row items-center justify-between">
          <T variant="label" className="text-pitchSoft">
            {t('home.weeklyChallenge')}
          </T>
          <Chip label={challenge.weekKey} />
        </View>
        <T variant="heading">
          {KICK_EMOJI[challenge.kickType]} {t('home.weeklyBody', { kick: t(`kicks.${challenge.kickType}`) })}
        </T>
        <View className="flex-row items-center justify-between">
          <T variant="caption">
            {top ? t('home.leaderboardTop', { score: top.score, name: top.displayName }) : t('home.noEntries')}
          </T>
          {myBest ? (
            <T variant="caption" style={{ color: ratingColor(myBest.kickRating) }}>
              {t('home.yourBest', { score: myBest.kickRating })}
            </T>
          ) : null}
        </View>
      </Card>

      <Card className="mt-4 flex-row items-start gap-3" tone="muted">
        <Ionicons name="bulb" size={20} color={colors.gold} />
        <View className="flex-1 gap-0.5">
          <T variant="label">{t('home.tipTitle')}</T>
          <T variant="body">{tip}</T>
        </View>
      </Card>

      {!last ? (
        <View className="mt-6">
          <T variant="caption" className="mb-3 text-center">
            {t('home.noScoreBody')}
          </T>
          <Button label={t('home.rate')} onPress={startRating} variant="secondary" size="md" />
        </View>
      ) : null}
    </Screen>
  );
}

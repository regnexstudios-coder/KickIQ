import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { ScoreRing } from '@/components/ScoreRing';
import { Card, EmptyState, Header, Screen, T } from '@/components/ui';
import { KICK_EMOJI } from '@/constants/kicks';
import { SUB_SCORE_KEYS } from '@/features/analysis/types';
import { t } from '@/i18n';
import { formatShortDate } from '@/lib/date';
import { ratingColor } from '@/lib/theme';
import { previousOfType, useHistoryStore } from '@/store/useHistoryStore';

export default function Compare() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const analyses = useHistoryStore((s) => s.analyses);
  const after = analyses.find((a) => a.id === id);
  const before = useMemo(() => {
    if (!after) return undefined;
    return (after.retakeOfId && analyses.find((a) => a.id === after.retakeOfId)) || previousOfType(analyses.filter((a) => new Date(a.createdAt) < new Date(after.createdAt)), after.kickType, after.id);
  }, [after, analyses]);

  if (!after || !before) {
    return (
      <Screen>
        <Header title={t('compare.title')} />
        <EmptyState title={t('compare.empty')} ctaLabel={t('home.rate')} onCta={() => router.replace('/record')} icon="git-compare-outline" />
      </Screen>
    );
  }

  const delta = after.kickRating - before.kickRating;
  const sameFix = before.oneFix.trim().toLowerCase() === after.oneFix.trim().toLowerCase();

  return (
    <Screen scroll>
      <Header title={t('compare.title')} />
      <T variant="caption" className="mb-4 text-center">
        {KICK_EMOJI[after.kickType]} {t(`kicks.${after.kickType}`)}
      </T>
      <View className="flex-row items-center justify-around">
        <View className="items-center gap-1">
          <T variant="label">{t('compare.before')}</T>
          <ScoreRing rating={before.kickRating} size={120} stroke={10} animate={false} showLabel={false} />
          <T variant="caption">{formatShortDate(before.createdAt)}</T>
        </View>
        <View className="items-center">
          <T variant="label">{t('compare.delta')}</T>
          <T variant="display" style={{ color: delta >= 0 ? ratingColor(80) : ratingColor(30) }}>
            {delta > 0 ? `+${delta}` : delta}
          </T>
        </View>
        <View className="items-center gap-1">
          <T variant="label">{t('compare.after')}</T>
          <ScoreRing rating={after.kickRating} size={120} stroke={10} animate={false} showLabel={false} />
          <T variant="caption">{formatShortDate(after.createdAt)}</T>
        </View>
      </View>

      <Card className="mt-6 gap-3">
        {SUB_SCORE_KEYS.map((k) => {
          const b = before.subScores[k];
          const a = after.subScores[k];
          const d = a - b;
          return (
            <View key={k} className="flex-row items-center justify-between">
              <T variant="bodyStrong" className="flex-1">
                {t(`subScores.${k}`)}
              </T>
              <T variant="mono" className="w-10 text-right text-muted">
                {b}
              </T>
              <T variant="mono" className={`w-12 text-center ${d > 0 ? 'text-pitch' : d < 0 ? 'text-danger' : 'text-muted'}`}>
                {d > 0 ? `+${d}` : d === 0 ? '·' : d}
              </T>
              <T variant="mono" className="w-10 text-right">
                {a}
              </T>
            </View>
          );
        })}
      </Card>

      <Card tone={sameFix ? 'muted' : 'accent'} className="mt-4 gap-2">
        <T variant="label" className={sameFix ? '' : 'text-pitchSoft'}>
          {t('result.oneFix')}
        </T>
        <T variant="body">{after.oneFix}</T>
        <T variant="caption">{sameFix ? t('compare.sameFix') : t('compare.newFix')}</T>
      </Card>
    </Screen>
  );
}

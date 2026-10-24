import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, type ComponentRef } from 'react';
import { View } from 'react-native';

import { T } from '@/components/ui';
import { KICK_EMOJI } from '@/constants/kicks';
import type { Analysis } from '@/features/analysis/types';
import { SUB_SCORE_KEYS } from '@/features/analysis/types';
import { t } from '@/i18n';
import { colors, ratingColor } from '@/lib/theme';

import { ScoreRing } from './ScoreRing';

/**
 * 9:16 branded share card. Rendered at 360x640 and captured at 1080x1920 by react-native-view-shot.
 * Keep it self-contained: no images that need network, no animation.
 */
export const ScoreCard = forwardRef<ComponentRef<typeof View>, { analysis: Analysis; firstName?: string }>(function ScoreCard({ analysis, firstName }, ref) {
  const color = ratingColor(analysis.kickRating);
  return (
    <View ref={ref} collapsable={false} style={{ width: 360, height: 640 }}>
      <LinearGradient colors={[colors.surface2, colors.bg]} style={{ flex: 1, padding: 28, justifyContent: 'space-between' }}>
        <View className="flex-row items-center justify-between">
          <T variant="display" className="text-3xl text-pitch">
            {t('common.appName')}
          </T>
          <T variant="label">{t('share.cardTitle')}</T>
        </View>

        <View className="items-center gap-2">
          <ScoreRing rating={analysis.kickRating} size={240} stroke={18} animate={false} />
          <T variant="heading" className="mt-2">
            {KICK_EMOJI[analysis.kickType]} {t(`kicks.${analysis.kickType}`)}
          </T>
          {firstName ? <T variant="caption">{firstName}</T> : null}
        </View>

        <View className="gap-2.5">
          {SUB_SCORE_KEYS.map((k) => {
            const v = analysis.subScores[k];
            return (
              <View key={k} className="gap-1">
                <View className="flex-row justify-between">
                  <T variant="caption" className="text-ink">
                    {t(`subScores.${k}`)}
                  </T>
                  <T variant="mono">{v}/25</T>
                </View>
                <View className="h-2 overflow-hidden rounded-full bg-surface">
                  <View style={{ width: `${(v / 25) * 100}%`, backgroundColor: ratingColor((v / 25) * 100) }} className="h-full" />
                </View>
              </View>
            );
          })}
        </View>

        <View className="rounded-2xl border p-4" style={{ borderColor: color, backgroundColor: `${color}1A` }}>
          <T variant="label" style={{ color }}>
            {t('result.oneFix')}
          </T>
          <T variant="body" className="mt-1" numberOfLines={3}>
            {analysis.oneFix}
          </T>
        </View>

        <View className="flex-row items-center justify-between">
          <T variant="bodyStrong" className="text-pitch">
            {t('share.cardCta')}
          </T>
          <T variant="caption">{t('share.cardFooter')}</T>
        </View>
      </LinearGradient>
    </View>
  );
});

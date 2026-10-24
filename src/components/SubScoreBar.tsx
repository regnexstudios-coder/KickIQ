import { View } from 'react-native';

import { T } from '@/components/ui';
import type { SubScoreKey } from '@/features/analysis/types';
import { t } from '@/i18n';
import { ratingColor } from '@/lib/theme';

interface SubScoreBarProps {
  keyName: SubScoreKey;
  value: number;
  previous?: number;
  max?: number;
}

export function SubScoreBar({ keyName, value, previous, max = 25 }: SubScoreBarProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  const color = ratingColor((value / max) * 100);
  const delta = previous == null ? null : value - previous;
  return (
    <View className="gap-1.5">
      <View className="flex-row items-baseline justify-between">
        <T variant="bodyStrong">{t(`subScores.${keyName}`)}</T>
        <View className="flex-row items-baseline gap-2">
          {delta != null && delta !== 0 ? (
            <T variant="caption" className={delta > 0 ? 'text-pitch' : 'text-danger'}>
              {delta > 0 ? `+${delta}` : delta}
            </T>
          ) : null}
          <T variant="mono">
            {value}
            <T variant="caption">/{max}</T>
          </T>
        </View>
      </View>
      <View className="h-2.5 overflow-hidden rounded-full bg-surface2">
        <View style={{ width: `${pct * 100}%`, backgroundColor: color }} className="h-full rounded-full" />
      </View>
    </View>
  );
}

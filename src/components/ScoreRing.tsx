import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { T } from '@/components/ui';
import { useCountUp } from '@/hooks/useCountUp';
import { t } from '@/i18n';
import { colors, ratingColor, ratingLabelKey } from '@/lib/theme';

interface ScoreRingProps {
  rating: number | null;
  size?: number;
  stroke?: number;
  animate?: boolean;
  showLabel?: boolean;
}

export function ScoreRing({ rating, size = 220, stroke = 16, animate = true, showLabel = true }: ScoreRingProps) {
  const target = rating ?? 0;
  const animated = useCountUp(target, animate ? 1400 : 0);
  const value = animate ? animated : target;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  const color = ratingColor(rating);

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <T variant="display" style={{ fontSize: size * 0.36, lineHeight: size * 0.4, color }}>
        {rating == null ? '—' : Math.round(value)}
      </T>
      {showLabel ? (
        <T variant="label" className="mt-1">
          {t(ratingLabelKey(rating))}
        </T>
      ) : null}
    </View>
  );
}

import { View } from 'react-native';

import { T } from './Text';

export function Chip({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'accent' | 'gold' }) {
  const cls =
    tone === 'accent'
      ? 'bg-pitch/15 border-pitch/40'
      : tone === 'gold'
        ? 'bg-gold/15 border-gold/40'
        : 'bg-surface2 border-line';
  const text = tone === 'accent' ? 'text-pitchSoft' : tone === 'gold' ? 'text-gold' : 'text-muted';
  return (
    <View className={`self-start rounded-full border px-3 py-1 ${cls}`}>
      <T variant="caption" className={`${text} font-sansMedium`}>
        {label}
      </T>
    </View>
  );
}

import { Pressable, View } from 'react-native';

import { haptic } from '@/lib/haptics';

import { T } from './Text';

interface OptionTileProps {
  label: string;
  description?: string;
  emoji?: string;
  selected?: boolean;
  onPress: () => void;
}

/** One-tap answer tile used by the onboarding quiz and kick picker. */
export function OptionTile({ label, description, emoji, selected, onPress }: OptionTileProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      className={`flex-row items-center gap-4 rounded-2xl border p-4 ${
        selected ? 'border-pitch bg-pitch/10' : 'border-line bg-surface active:bg-surface2'
      }`}
    >
      {emoji ? <T className="text-2xl">{emoji}</T> : null}
      <View className="flex-1">
        <T variant="bodyStrong">{label}</T>
        {description ? <T variant="caption">{description}</T> : null}
      </View>
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
          selected ? 'border-pitch bg-pitch' : 'border-muted'
        }`}
      >
        {selected ? <View className="h-2 w-2 rounded-full bg-bg" /> : null}
      </View>
    </Pressable>
  );
}

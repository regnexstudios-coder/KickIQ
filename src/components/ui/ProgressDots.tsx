import { View } from 'react-native';

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View className="flex-row gap-1.5" accessibilityLabel={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-1.5 rounded-full ${i <= current ? 'bg-pitch' : 'bg-line'} ${i === current ? 'w-6' : 'w-3'}`}
        />
      ))}
    </View>
  );
}

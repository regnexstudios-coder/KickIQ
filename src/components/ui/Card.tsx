import { Pressable, View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  className?: string;
  onPress?: () => void;
  tone?: 'default' | 'accent' | 'muted';
}

const tones = {
  default: 'bg-surface border-line',
  accent: 'bg-pitch/10 border-pitch/40',
  muted: 'bg-surface2 border-line',
};

export function Card({ className = '', onPress, tone = 'default', children, ...rest }: CardProps) {
  const cls = `rounded-2xl border p-4 ${tones[tone]} ${className}`;
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} className={`${cls} active:opacity-80`}>
        {children}
      </Pressable>
    );
  }
  return (
    <View {...rest} className={cls}>
      {children}
    </View>
  );
}

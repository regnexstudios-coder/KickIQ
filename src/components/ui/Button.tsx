import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';

import { haptic } from '@/lib/haptics';
import { colors } from '@/lib/theme';

import { T } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
  full?: boolean;
}

const base: Record<Variant, { box: string; text: string }> = {
  primary: { box: 'bg-pitch active:bg-pitchDark', text: 'text-bg' },
  secondary: { box: 'bg-surface2 border border-line active:bg-line', text: 'text-ink' },
  ghost: { box: 'bg-transparent active:bg-surface', text: 'text-ink' },
  danger: { box: 'bg-danger/15 border border-danger/40 active:bg-danger/25', text: 'text-danger' },
  gold: { box: 'bg-gold active:bg-yellow-500', text: 'text-bg' },
};

const sizes: Record<Size, { box: string; text: string }> = {
  lg: { box: 'h-14 px-6 rounded-2xl', text: 'text-lg' },
  md: { box: 'h-12 px-5 rounded-xl', text: 'text-base' },
  sm: { box: 'h-9 px-4 rounded-lg', text: 'text-sm' },
};

export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  loading,
  disabled,
  icon,
  className = '',
  full = true,
  onPress,
  ...rest
}: ButtonProps) {
  const v = base[variant];
  const s = sizes[size];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        haptic.tap();
        onPress?.(e);
      }}
      className={`${v.box} ${s.box} ${full ? 'w-full' : 'self-start'} flex-row items-center justify-center ${
        isDisabled ? 'opacity-50' : ''
      } ${className}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'gold' ? colors.bg : colors.ink} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon}
          <T variant="bodyStrong" className={`${v.text} ${s.text} font-sansBold`}>
            {label}
          </T>
        </View>
      )}
    </Pressable>
  );
}

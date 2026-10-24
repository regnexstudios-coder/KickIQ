import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { colors } from '@/lib/theme';

import { T } from './Text';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  showBack?: boolean;
}

export function Header({ title, onBack, right, showBack = true }: HeaderProps) {
  return (
    <View className="h-12 flex-row items-center justify-between">
      <View className="w-12">
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
        ) : null}
      </View>
      {title ? (
        <T variant="heading" className="flex-1 text-center" numberOfLines={1}>
          {title}
        </T>
      ) : (
        <View className="flex-1" />
      )}
      <View className="w-12 items-end">{right}</View>
    </View>
  );
}

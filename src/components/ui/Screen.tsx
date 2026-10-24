import type { ReactNode } from 'react';
import { ScrollView, View, type ViewProps } from 'react-native';
import { cssInterop } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';

// Third-party components need explicit registration before `className` works on them.
cssInterop(SafeAreaView, { className: 'style' });

interface ScreenProps extends ViewProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  className?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  /** Transparent background (e.g. controls layered over the camera). */
  transparent?: boolean;
}

export function Screen({ children, scroll, padded = true, className = '', edges, transparent, ...rest }: ScreenProps) {
  const pad = padded ? 'px-5' : '';
  return (
    <SafeAreaView className={`flex-1 ${transparent ? 'bg-transparent' : 'bg-bg'}`} edges={edges ?? ['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName={`${pad} pb-10 ${className}`}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View {...rest} className={`flex-1 ${pad} ${className}`}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

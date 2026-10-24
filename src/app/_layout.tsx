import '../global.css';

import { BarlowCondensed_700Bold, BarlowCondensed_900Black } from '@expo-google-fonts/barlow-condensed';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { bootstrap } from '@/features/bootstrap';
import { useHydrated } from '@/hooks/useHydrated';
import { colors } from '@/lib/theme';
import { useProfileStore } from '@/store/useProfileStore';
import { isEntitled, useSubscriptionStore } from '@/store/useSubscriptionStore';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 300 });

export const unstable_settings = { anchor: 'index' };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BarlowCondensed_700Bold,
    BarlowCondensed_900Black,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const hydrated = useHydrated();
  const ageVerified = useProfileStore((s) => s.ageVerified);
  const onboardingComplete = useProfileStore((s) => s.onboardingComplete);
  const entitled = useSubscriptionStore((s) => isEntitled(s));

  useEffect(() => {
    if (hydrated) bootstrap();
  }, [hydrated]);

  useEffect(() => {
    if (fontsLoaded && hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, hydrated]);

  if (!fontsLoaded || !hydrated) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const inApp = ageVerified && onboardingComplete && entitled;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="legal/privacy" options={{ presentation: 'modal' }} />
        <Stack.Screen name="legal/terms" options={{ presentation: 'modal' }} />
        <Stack.Screen name="rate" />
        <Stack.Screen name="invite/[code]" />

        <Stack.Protected guard={!ageVerified}>
          <Stack.Screen name="age-gate" />
          <Stack.Screen name="blocked" />
        </Stack.Protected>

        <Stack.Protected guard={ageVerified && !onboardingComplete}>
          <Stack.Screen name="onboarding/[step]" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>

        <Stack.Protected guard={ageVerified && onboardingComplete && !entitled}>
          <Stack.Screen name="paywall" options={{ gestureEnabled: false }} />
        </Stack.Protected>

        <Stack.Protected guard={inApp}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="record/index" options={{ presentation: 'modal' }} />
          <Stack.Screen name="record/camera" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="record/preview" />
          <Stack.Screen name="analyzing" options={{ gestureEnabled: false }} />
          <Stack.Screen name="result/[id]" />
          <Stack.Screen name="compare/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="referral" options={{ presentation: 'modal' }} />
          <Stack.Screen name="challenge" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

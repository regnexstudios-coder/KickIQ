import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { t } from '@/i18n';
import { colors, fonts } from '@/lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 84, paddingTop: 8 },
        tabBarActiveTintColor: colors.pitch,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.sansSemi, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={typeof color === "string" ? color : colors.muted} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: t('progress.title'), tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={typeof color === "string" ? color : colors.muted} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t('settings.title'), tabBarIcon: ({ color, size }) => <Ionicons name="settings-sharp" size={size} color={typeof color === "string" ? color : colors.muted} /> }}
      />
    </Tabs>
  );
}

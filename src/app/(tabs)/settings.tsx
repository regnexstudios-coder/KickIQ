import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, TextInput, View } from 'react-native';

import { Card, Screen, T } from '@/components/ui';
import { Events } from '@/features/analytics/events';
import { resetAnalytics, track } from '@/features/analytics/analytics';
import { currentUserId } from '@/features/auth/supabase';
import { openManageSubscriptions, restorePurchases } from '@/features/billing/billing';
import { deleteCloudData } from '@/features/history/sync';
import { deleteAllClips } from '@/features/history/videoStorage';
import { t } from '@/i18n';
import { config, isConfigured } from '@/lib/config';
import { clearAllLocalData } from '@/lib/storage';
import { colors } from '@/lib/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useStreakStore } from '@/store/useStreakStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';

function Row({ icon, label, value, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} className="flex-row items-center gap-3 border-b border-line py-3.5 active:opacity-70">
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.muted} />
      <View className="flex-1">
        <T variant="bodyStrong" className={danger ? 'text-danger' : ''}>
          {label}
        </T>
        {value ? <T variant="caption">{value}</T> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

export default function Settings() {
  const sub = useSubscriptionStore();
  const profile = useProfileStore();
  const [userId, setUserId] = useState<string | null>(null);
  const [height, setHeight] = useState(profile.heightCm ? String(profile.heightCm) : '');

  useEffect(() => {
    currentUserId().then(setUserId);
  }, []);

  const subLabel =
    sub.status === 'active' ? t('settings.subscriptionActive') : sub.status === 'trial' || sub.status === 'promo' ? t('settings.subscriptionTrial') : t('settings.subscriptionNone');

  const deleteEverything = () => {
    Alert.alert(t('settings.deleteData'), t('settings.deleteDataBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteDataConfirm'),
        style: 'destructive',
        onPress: async () => {
          track(Events.deleteData);
          await deleteCloudData().catch(() => {});
          deleteAllClips();
          await SecureStore.deleteItemAsync('kickiq.dob').catch(() => {});
          useHistoryStore.getState().clear();
          useStreakStore.getState().reset();
          useChallengeStore.getState().reset();
          useSubscriptionStore.getState().reset();
          useProfileStore.getState().reset();
          await clearAllLocalData().catch(() => {});
          await resetAnalytics().catch(() => {});
          Alert.alert(t('settings.deleted'));
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <T variant="title" className="pt-2">
        {t('settings.title')}
      </T>

      <T variant="label" className="mt-6 mb-2">
        {t('settings.profile')}
      </T>
      <Card className="gap-4">
        <View className="gap-1.5">
          <T variant="caption">{t('settings.firstName')}</T>
          <TextInput
            value={profile.firstName}
            onChangeText={profile.setFirstName}
            placeholder={t('settings.firstNamePlaceholder')}
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            maxLength={24}
            className="h-12 rounded-xl border border-line bg-surface2 px-4 font-sans text-ink"
          />
        </View>
        <View className="gap-1.5">
          <T variant="caption">{t('settings.heightCm')}</T>
          <TextInput
            value={height}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, '').slice(0, 3);
              setHeight(digits);
              const n = Number(digits);
              profile.setHeightCm(n >= 120 && n <= 220 ? n : null);
            }}
            keyboardType="number-pad"
            placeholder={t('settings.heightPlaceholder')}
            placeholderTextColor={colors.muted}
            className="h-12 rounded-xl border border-line bg-surface2 px-4 font-sans text-ink"
          />
        </View>
      </Card>

      <T variant="label" className="mt-6 mb-2">
        {t('settings.account')}
      </T>
      <Card className="py-0">
        <Row icon="card-outline" label={t('settings.subscription')} value={subLabel} onPress={openManageSubscriptions} />
        <Row
          icon="refresh-outline"
          label={t('settings.restore')}
          onPress={async () => Alert.alert((await restorePurchases()) ? t('paywall.restored') : t('paywall.nothingToRestore'))}
        />
        <Row icon="gift-outline" label={t('settings.referral')} value={profile.referralCode ?? undefined} onPress={() => router.push('/referral')} />
        <Row
          icon="person-circle-outline"
          label={userId ? t('settings.signedInAs', { id: userId.slice(0, 8) }) : t('settings.notSignedIn')}
        />
      </Card>

      <T variant="label" className="mt-6 mb-2">
        {t('legal.privacyTitle')}
      </T>
      <Card className="py-0">
        <Row icon="shield-checkmark-outline" label={t('settings.privacy')} onPress={() => router.push('/legal/privacy')} />
        <Row icon="document-text-outline" label={t('settings.terms')} onPress={() => router.push('/legal/terms')} />
        <Row icon="mail-outline" label={t('settings.support')} value={config.links.supportEmail} onPress={() => Linking.openURL(`mailto:${config.links.supportEmail}?subject=KickIQ%20support`)} />
        <Row icon="trash-outline" label={t('settings.deleteData')} onPress={deleteEverything} danger />
      </Card>
      <T variant="caption" className="mt-3">
        {t('settings.storage')}
      </T>

      <T variant="label" className="mt-6 mb-2">
        {t('settings.diagnostics')}
      </T>
      <Card className="gap-1">
        <T variant="caption">Gemini: {isConfigured.gemini ? (config.gemini.analyzeEndpoint ? 'edge function' : 'direct') : 'mock coach'}</T>
        <T variant="caption">Supabase: {isConfigured.supabase ? 'on' : 'local only'}</T>
        <T variant="caption">RevenueCat: {isConfigured.revenueCat ? 'on' : 'mock store'}</T>
        <T variant="caption">PostHog: {isConfigured.posthog ? 'on' : 'off'}</T>
        <T variant="caption">Pose model: {isConfigured.poseModel ? 'configured' : 'not configured'}</T>
      </Card>

      <T variant="caption" className="mt-6 text-center">
        {t('settings.version', { version: `${Application.nativeApplicationVersion ?? '1.0.0'} (${Application.nativeBuildVersion ?? 'dev'})` })}
      </T>
    </Screen>
  );
}

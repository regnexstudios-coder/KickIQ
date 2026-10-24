import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { PlanCard } from '@/components/PlanCard';
import { ScoreRing } from '@/components/ScoreRing';
import { Button, Screen, T } from '@/components/ui';
import { Events } from '@/features/analytics/events';
import { track } from '@/features/analytics/analytics';
import { billingMode, getPlans, purchasePlan, restorePurchases } from '@/features/billing/billing';
import { MOCK_PLANS, type Plan, type PlanId } from '@/features/billing/plans';
import { t, tList } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { useProfileStore } from '@/store/useProfileStore';

/** A/B: variant A animates 58→86, variant B animates 61→89 with the annual plan preselected. Assigned once per install. */
function useVariant(): 'A' | 'B' {
  const variant = useProfileStore((s) => s.paywallVariant);
  const setVariant = useProfileStore((s) => s.setPaywallVariant);
  useEffect(() => {
    if (!variant) setVariant(Math.random() < 0.5 ? 'A' : 'B');
  }, [variant, setVariant]);
  return variant ?? 'A';
}

export default function Paywall() {
  const variant = useVariant();
  const [plans, setPlans] = useState<Plan[]>(MOCK_PLANS);
  const [selected, setSelected] = useState<PlanId>('annual');
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);
  const [rating, setRating] = useState(variant === 'A' ? 58 : 61);
  const from = variant === 'A' ? 58 : 61;
  const to = variant === 'A' ? 86 : 89;

  useEffect(() => {
    track(Events.paywallView, { variant, mode: billingMode() });
    getPlans().then(setPlans);
    const timer = setTimeout(() => setRating(to), 700);
    return () => clearTimeout(timer);
  }, [variant, to]);

  const plan = useMemo(() => plans.find((p) => p.id === selected) ?? plans[1] ?? MOCK_PLANS[1]!, [plans, selected]);

  const buy = async () => {
    setBusy('purchase');
    const outcome = await purchasePlan(plan);
    setBusy(null);
    if (outcome === 'purchased') {
      haptic.success();
      track(Events.trialStart, { plan: plan.id, price: plan.price, variant });
      router.replace('/(tabs)');
    } else if (outcome === 'failed') {
      haptic.error();
      Alert.alert(t('paywall.failed'));
    }
  };

  const restore = async () => {
    setBusy('restore');
    const ok = await restorePurchases();
    setBusy(null);
    track(Events.restore, { ok });
    if (ok) {
      Alert.alert(t('paywall.restored'));
      router.replace('/(tabs)');
    } else {
      Alert.alert(t('paywall.nothingToRestore'));
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false}>
        <View className="items-center gap-2 pt-4">
          <ScoreRing rating={rating} size={170} stroke={14} showLabel={false} />
          <T variant="title" className="text-center">
            {t('paywall.title', { from, to })}
          </T>
          <T variant="caption" className="text-center">
            {t('paywall.subtitle')}
          </T>
        </View>

        <View className="mt-5 gap-2 rounded-2xl border border-line bg-surface p-4">
          {tList('paywall.features').map((f) => (
            <View key={f} className="flex-row items-center gap-3">
              <Ionicons name="checkmark-circle" size={20} color={colors.pitch} />
              <T variant="bodyStrong">{f}</T>
            </View>
          ))}
        </View>

        <View className="mt-6 gap-4">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} selected={selected === p.id} onSelect={() => setSelected(p.id)} />
          ))}
        </View>

        {billingMode() === 'mock' ? (
          <T variant="caption" className="mt-4 text-center text-gold">
            {t('paywall.mockNotice')}
          </T>
        ) : null}

        <View className="mt-6 gap-3">
          <Button label={t('paywall.trialCta')} onPress={buy} loading={busy === 'purchase'} disabled={busy !== null} />
          <T variant="caption" className="text-center">
            {t('paywall.thenPrice', { price: `${plan.priceString}${plan.id === 'weekly' ? t('paywall.perWeek') : t('paywall.perYear')}` })}
          </T>
          <Pressable onPress={restore} disabled={busy !== null} accessibilityRole="button" className="items-center py-2">
            <T variant="caption" className="underline">
              {busy === 'restore' ? t('common.loading') : t('paywall.restore')}
            </T>
          </Pressable>
        </View>

        <T variant="caption" className="mt-4 text-center text-xs">
          {t('paywall.legal')}
        </T>
        <View className="mt-3 flex-row justify-center gap-6">
          <Pressable onPress={() => router.push('/legal/terms')} accessibilityRole="link">
            <T variant="caption" className="underline">
              {t('paywall.terms')}
            </T>
          </Pressable>
          <Pressable onPress={() => router.push('/legal/privacy')} accessibilityRole="link">
            <T variant="caption" className="underline">
              {t('paywall.privacy')}
            </T>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

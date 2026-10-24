import { Pressable, View } from 'react-native';

import { Chip, T } from '@/components/ui';
import type { Plan } from '@/features/billing/plans';
import { t } from '@/i18n';
import { haptic } from '@/lib/haptics';

interface PlanCardProps {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}

export function PlanCard({ plan, selected, onSelect }: PlanCardProps) {
  const period = plan.id === 'weekly' ? t('paywall.perWeek') : t('paywall.perYear');
  const note = plan.id === 'annual' ? t('paywall.annualNote') : plan.id === 'family' ? t('paywall.familyNote') : t('paywall.weeklyNote');
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic.select();
        onSelect();
      }}
      className={`relative flex-row items-center justify-between rounded-2xl border-2 p-4 ${
        selected ? 'border-pitch bg-pitch/10' : 'border-line bg-surface'
      }`}
    >
      {plan.highlight ? (
        <View className="absolute -top-3 left-4">
          <Chip label={t('paywall.bestValue')} tone="gold" />
        </View>
      ) : null}
      <View className="gap-0.5">
        <T variant="heading">{t(`paywall.${plan.id}`)}</T>
        <T variant="caption">{note}</T>
      </View>
      <View className="items-end">
        <T variant="heading">
          {plan.priceString}
          <T variant="caption"> {period}</T>
        </T>
        {plan.perWeekString && plan.id !== 'weekly' ? <T variant="caption">{plan.perWeekString}{t('paywall.perWeek')}</T> : null}
      </View>
    </Pressable>
  );
}

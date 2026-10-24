import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import { t } from '@/i18n';
import { colors } from '@/lib/theme';

import { Button } from './Button';
import { T } from './Text';

interface StateProps {
  title: string;
  body?: string;
  ctaLabel?: string;
  onCta?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function EmptyState({ title, body, ctaLabel, onCta, icon = 'football-outline' }: StateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-6 py-10">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-surface2">
        <Ionicons name={icon} size={30} color={colors.pitch} />
      </View>
      <T variant="heading" className="text-center">
        {title}
      </T>
      {body ? (
        <T variant="caption" className="text-center">
          {body}
        </T>
      ) : null}
      {ctaLabel && onCta ? <Button label={ctaLabel} onPress={onCta} size="md" full={false} className="mt-2" /> : null}
    </View>
  );
}

export function ErrorState({ title, body, ctaLabel, onCta }: StateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-6 py-10">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-danger/15">
        <Ionicons name="alert-circle-outline" size={30} color={colors.danger} />
      </View>
      <T variant="heading" className="text-center">
        {title}
      </T>
      <T variant="caption" className="text-center">
        {body ?? t('common.genericError')}
      </T>
      {onCta ? (
        <Button label={ctaLabel ?? t('common.retry')} onPress={onCta} size="md" full={false} variant="secondary" className="mt-2" />
      ) : null}
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3">
      <ActivityIndicator color={colors.pitch} size="large" />
      <T variant="caption">{label ?? t('common.loading')}</T>
    </View>
  );
}

import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';

import { Button, Screen, T } from '@/components/ui';
import { Events } from '@/features/analytics/events';
import { track } from '@/features/analytics/analytics';
import { t } from '@/i18n';
import { config } from '@/lib/config';
import { ageFromDob } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { useProfileStore } from '@/store/useProfileStore';

function Field({ label, value, onChange, max, placeholder }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder: string }) {
  return (
    <View className="flex-1 gap-1.5">
      <T variant="label">{label}</T>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, max))}
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        maxLength={max}
        accessibilityLabel={label}
        className="h-14 rounded-xl border border-line bg-surface px-4 text-center font-display text-2xl text-ink"
      />
    </View>
  );
}

export default function AgeGate() {
  const [m, setM] = useState('');
  const [d, setD] = useState('');
  const [y, setY] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setAgeVerified = useProfileStore((s) => s.setAgeVerified);

  const dob = useMemo(() => {
    const mm = Number(m);
    const dd = Number(d);
    const yy = Number(y);
    if (!mm || !dd || y.length !== 4) return null;
    const date = new Date(yy, mm - 1, dd);
    if (date.getFullYear() !== yy || date.getMonth() !== mm - 1 || date.getDate() !== dd) return null;
    if (date > new Date() || yy < 1900) return null;
    return date;
  }, [m, d, y]);

  const submit = async () => {
    if (!dob) {
      setError(t('ageGate.invalid'));
      haptic.error();
      return;
    }
    const age = ageFromDob(dob);
    if (age < config.limits.minAge) {
      track(Events.ageGateBlocked, { age });
      router.replace('/blocked');
      return;
    }
    // DOB stays in the secure keychain; the store only keeps the birth year.
    await SecureStore.setItemAsync('kickiq.dob', dob.toISOString()).catch(() => {});
    haptic.success();
    setAgeVerified(dob.getFullYear());
    router.replace('/onboarding/1');
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-between py-6">
        <View className="gap-6">
          <View className="gap-2 pt-10">
            <T variant="label" className="text-pitch">
              {t('common.appName')}
            </T>
            <T variant="title">{t('ageGate.title')}</T>
            <T variant="caption">{t('ageGate.subtitle')}</T>
          </View>
          <View className="flex-row gap-3">
            <Field label={t('ageGate.month')} value={m} onChange={setM} max={2} placeholder="MM" />
            <Field label={t('ageGate.day')} value={d} onChange={setD} max={2} placeholder="DD" />
            <Field label={t('ageGate.year')} value={y} onChange={setY} max={4} placeholder="YYYY" />
          </View>
          {error ? (
            <T variant="caption" className="text-danger">
              {error}
            </T>
          ) : null}
        </View>
        <Button label={t('ageGate.cta')} onPress={submit} disabled={!m || !d || y.length !== 4} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

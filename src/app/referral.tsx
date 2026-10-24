import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Card, Header, Screen, T } from '@/components/ui';
import { Events } from '@/features/analytics/events';
import { track } from '@/features/analytics/analytics';
import { getSupabase } from '@/features/auth/supabase';
import { evaluateRedeem, normaliseCode, REFERRAL_FREE_DAYS, type RedeemResult } from '@/features/referral/referral';
import { shareText } from '@/features/share/share';
import { referralShareText } from '@/features/share/scoreCardText';
import { t } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { useProfileStore } from '@/store/useProfileStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';

export default function Referral() {
  const params = useLocalSearchParams<{ code?: string }>();
  const profile = useProfileStore();
  const grantPromoDays = useSubscriptionStore((s) => s.grantPromoDays);
  const [input, setInput] = useState(params.code ?? '');
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const code = profile.referralCode ?? '------';

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    haptic.tap();
    setTimeout(() => setCopied(false), 1500);
  };

  const redeem = async () => {
    setBusy(true);
    let result: RedeemResult = evaluateRedeem(input, profile.referralCode, profile.redeemedReferral);
    const sb = getSupabase();
    if (result === 'ok' && sb) {
      const { data, error } = await sb.rpc('redeem_referral', { p_code: normaliseCode(input) });
      if (!error && typeof data === 'string') result = data as RedeemResult;
    }
    setBusy(false);
    if (result === 'ok') {
      profile.setRedeemedReferral(normaliseCode(input));
      grantPromoDays(REFERRAL_FREE_DAYS);
      track(Events.referralRedeem, { ok: true });
      haptic.success();
      setMessage({ tone: 'ok', text: t('referral.redeemed') });
    } else {
      haptic.error();
      setMessage({ tone: 'err', text: t(`referral.${result}`) });
    }
  };

  return (
    <Screen scroll>
      <Header title={t('settings.referral')} />
      <T variant="title" className="mt-2">
        {t('referral.title')}
      </T>
      <T variant="caption" className="mt-2">
        {t('referral.body')}
      </T>

      <Card className="mt-6 items-center gap-3">
        <T variant="label">{t('referral.yourCode')}</T>
        <T variant="display" className="tracking-widest text-pitch">
          {code}
        </T>
        <View className="w-full flex-row gap-3">
          <View className="flex-1">
            <Button label={copied ? t('referral.copied') : t('referral.copy')} variant="secondary" size="md" onPress={copy} />
          </View>
          <View className="flex-1">
            <Button label={t('referral.shareCta')} size="md" onPress={() => shareText(referralShareText(code))} />
          </View>
        </View>
      </Card>

      <Card className="mt-6 gap-3">
        <T variant="label">{t('referral.redeemTitle')}</T>
        {profile.redeemedReferral ? (
          <T variant="caption">{t('referral.already')}</T>
        ) : (
          <>
            <TextInput
              value={input}
              onChangeText={(v) => setInput(v.toUpperCase().slice(0, 8))}
              placeholder={t('referral.redeemPlaceholder')}
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              className="h-12 rounded-xl border border-line bg-surface2 px-4 font-displayBold text-xl tracking-widest text-ink"
            />
            <Button label={t('referral.redeem')} size="md" onPress={redeem} loading={busy} disabled={input.length < 6} />
          </>
        )}
        {message ? (
          <T variant="caption" className={message.tone === 'ok' ? 'text-pitch' : 'text-danger'}>
            {message.text}
          </T>
        ) : null}
      </Card>
    </Screen>
  );
}

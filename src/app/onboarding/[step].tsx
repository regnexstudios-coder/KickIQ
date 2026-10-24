import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Button, Chip, Header, OptionTile, ProgressDots, Screen, T } from '@/components/ui';
import { GOALS, LEVELS, POSITIONS, TRAIN_FREQ, WEAKNESSES } from '@/constants/kicks';
import { Events } from '@/features/analytics/events';
import { track } from '@/features/analytics/analytics';
import { t, tList } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { useProfileStore, type OnboardingAnswers } from '@/store/useProfileStore';

const TOTAL = 6;

type Step = { key: keyof OnboardingAnswers; options: readonly string[]; titleKey: string; withDesc?: boolean };

const STEPS: Step[] = [
  { key: 'position', options: POSITIONS, titleKey: 'onboarding.position' },
  { key: 'level', options: LEVELS, titleKey: 'onboarding.level', withDesc: true },
  { key: 'weakness', options: WEAKNESSES, titleKey: 'onboarding.weakness' },
  { key: 'goal', options: GOALS, titleKey: 'onboarding.goal' },
  { key: 'frequency', options: TRAIN_FREQ, titleKey: 'onboarding.frequency' },
];

const EMOJI: Record<string, string> = {
  forward: '🎯', midfielder: '🧠', defender: '🛡️', goalkeeper: '🧤', any: '⚽',
  power: '💥', accuracy: '🎯', curve: '🌀', consistency: '📈',
  make_team: '📋', score_more: '🥅', set_pieces: '🚩', go_pro: '🔭',
  rarely: '🌙', weekly: '📅', few_times: '🔁', daily: '🔥',
};

export default function OnboardingStep() {
  const params = useLocalSearchParams<{ step: string }>();
  const step = Math.min(TOTAL, Math.max(1, Number(params.step) || 1));
  const answers = useProfileStore((s) => s.answers);
  const setAnswer = useProfileStore((s) => s.setAnswer);
  const completeOnboarding = useProfileStore((s) => s.completeOnboarding);

  useEffect(() => {
    track(Events.onboardingStep, { step });
  }, [step]);

  const goNext = () => {
    if (step < TOTAL) router.push(`/onboarding/${step + 1}`);
  };

  const finish = () => {
    haptic.success();
    completeOnboarding();
    router.replace('/paywall');
  };

  const def = STEPS[step - 1];

  return (
    <Screen>
      <Header showBack={step > 1} right={<ProgressDots total={TOTAL} current={step - 1} />} />
      <View className="flex-1 justify-between py-4">
        {def ? (
          <View className="gap-5">
            <View className="gap-2">
              <Chip label={t('onboarding.socialProof')} tone="gold" />
              <T variant="title">{t(`${def.titleKey}.title`)}</T>
              <T variant="caption">{t('onboarding.progress', { step, total: TOTAL })}</T>
            </View>
            <View className="gap-3">
              {def.options.map((opt) => (
                <OptionTile
                  key={opt}
                  emoji={EMOJI[opt]}
                  label={t(`${def.titleKey}.${opt}`)}
                  description={def.withDesc ? t(`${def.titleKey}.${opt}_desc`) : undefined}
                  selected={answers[def.key] === opt}
                  onPress={() => {
                    setAnswer(def.key, opt as never);
                    setTimeout(goNext, 160);
                  }}
                />
              ))}
            </View>
          </View>
        ) : (
          <View className="flex-1 justify-center gap-6">
            <View className="items-center gap-3">
              <T className="text-7xl">🏟️</T>
              <T variant="title" className="text-center">
                {t('onboarding.ready.title')}
              </T>
              <T variant="body" className="text-center text-muted">
                {t('onboarding.ready.body')}
              </T>
            </View>
            <View className="gap-2 rounded-2xl border border-line bg-surface p-4">
              {tList('onboarding.ready.bullets').map((b) => (
                <View key={b} className="flex-row items-center gap-3">
                  <View className="h-2 w-2 rounded-full bg-pitch" />
                  <T variant="bodyStrong">{b}</T>
                </View>
              ))}
            </View>
          </View>
        )}
        {def ? (
          answers[def.key] ? <Button label={t('common.next')} onPress={goNext} /> : <View className="h-14" />
        ) : (
          <Button label={t('onboarding.ready.cta')} onPress={finish} />
        )}
      </View>
    </Screen>
  );
}

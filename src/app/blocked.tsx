import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Screen, T } from '@/components/ui';
import { t } from '@/i18n';

export default function Blocked() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-4">
        <T className="text-6xl">⚽</T>
        <T variant="title" className="text-center">
          {t('ageGate.blockedTitle')}
        </T>
        <T variant="body" className="text-center text-muted">
          {t('ageGate.blockedBody')}
        </T>
      </View>
      <View className="pb-6">
        <Button label={t('ageGate.blockedCta')} variant="secondary" onPress={() => router.replace('/age-gate')} />
      </View>
    </Screen>
  );
}

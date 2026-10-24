import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Header, OptionTile, Screen, T } from '@/components/ui';
import { KICK_EMOJI, KICK_TYPES } from '@/constants/kicks';
import { t } from '@/i18n';
import { useSessionStore } from '@/store/useSessionStore';

export default function ChooseKick() {
  const kickType = useSessionStore((s) => s.kickType);
  const setKickType = useSessionStore((s) => s.setKickType);
  return (
    <Screen>
      <Header title={t('record.chooseTitle')} />
      <View className="flex-1 justify-between py-4">
        <View className="gap-4">
          <T variant="caption">{t('record.chooseSub')}</T>
          <View className="gap-3">
            {KICK_TYPES.map((k) => (
              <OptionTile key={k} emoji={KICK_EMOJI[k]} label={t(`kicks.${k}`)} description={t(`kicks.${k}_desc`)} selected={kickType === k} onPress={() => setKickType(k)} />
            ))}
          </View>
        </View>
        <Button label={t('common.continue')} onPress={() => router.push('/record/camera')} />
      </View>
    </Screen>
  );
}

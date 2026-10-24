import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Header, Screen, T } from '@/components/ui';
import { KICK_EMOJI } from '@/constants/kicks';
import { fetchLeaderboard } from '@/features/challenge/leaderboard';
import { t } from '@/i18n';
import { ratingColor } from '@/lib/theme';
import { rankEntries, useChallengeStore, type LeaderboardEntry } from '@/store/useChallengeStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useSessionStore } from '@/store/useSessionStore';

function timeLeft(): { days: number; hours: number } {
  const now = new Date();
  const day = now.getDay() || 7; // Monday = 1
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + (8 - day));
  nextMonday.setHours(0, 0, 0, 0);
  const ms = nextMonday.getTime() - now.getTime();
  return { days: Math.floor(ms / 86_400_000), hours: Math.floor((ms % 86_400_000) / 3_600_000) };
}

export default function Challenge() {
  const challenge = useChallengeStore();
  const firstName = useProfileStore((s) => s.firstName);
  const setKickType = useSessionStore((s) => s.setKickType);
  const setRetakeOf = useSessionStore((s) => s.setRetakeOf);
  const [entries, setEntries] = useState<LeaderboardEntry[]>(rankEntries(challenge.entries));
  const left = timeLeft();

  useEffect(() => {
    challenge.ensureWeek();
    fetchLeaderboard(challenge.weekKey, challenge.kickType).then(setEntries);
  }, [challenge]);

  return (
    <Screen scroll>
      <Header title={t('challenge.title')} />
      <View className="mt-2 gap-2">
        <Chip label={challenge.weekKey} />
        <T variant="title">
          {KICK_EMOJI[challenge.kickType]} {t('challenge.subtitle', { kick: t(`kicks.${challenge.kickType}`) })}
        </T>
        <T variant="caption">{t('challenge.endsIn', { days: left.days, hours: left.hours })}</T>
      </View>

      <T variant="label" className="mt-6 mb-2">
        {t('challenge.leaderboard')}
      </T>
      <Card className="gap-1 py-2">
        {entries.length === 0 ? (
          <T variant="caption" className="py-4 text-center">
            {t('challenge.empty')}
          </T>
        ) : (
          entries.map((e, i) => (
            <View key={e.id} className={`flex-row items-center gap-3 rounded-xl px-2 py-2.5 ${e.isMe ? 'bg-pitch/10' : ''}`}>
              <T variant="heading" className="w-8 text-muted">
                {i + 1}
              </T>
              <T variant="bodyStrong" className="flex-1">
                {e.displayName}
                {e.isMe ? ` · ${t('challenge.you')}` : ''}
              </T>
              <T variant="display" className="text-3xl" style={{ color: ratingColor(e.score) }}>
                {e.score}
              </T>
            </View>
          ))
        )}
      </Card>
      {!firstName ? (
        <T variant="caption" className="mt-3 text-gold">
          {t('challenge.nameNeeded')}
        </T>
      ) : null}
      <T variant="caption" className="mt-3">
        {t('challenge.rules')}
      </T>

      <View className="mt-8">
        <Button
          label={t('challenge.enter')}
          onPress={() => {
            setRetakeOf(null);
            setKickType(challenge.kickType);
            router.push('/record/camera');
          }}
        />
      </View>
    </Screen>
  );
}

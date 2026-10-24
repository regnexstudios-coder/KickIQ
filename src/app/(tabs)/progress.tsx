import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { LineChart } from '@/components/LineChart';
import { Card, EmptyState, Screen, T } from '@/components/ui';
import { KICK_EMOJI, KICK_TYPES, type KickType } from '@/constants/kicks';
import { deleteLocalFile } from '@/features/history/videoStorage';
import { t } from '@/i18n';
import { formatShortDate } from '@/lib/date';
import { colors, ratingColor } from '@/lib/theme';
import { bestByKick, byKick, previousOfType, useHistoryStore } from '@/store/useHistoryStore';

export default function Progress() {
  const analyses = useHistoryStore((s) => s.analyses);
  const remove = useHistoryStore((s) => s.remove);
  const [filter, setFilter] = useState<KickType | 'all'>('all');
  const { width } = useWindowDimensions();

  const list = useMemo(() => byKick(analyses, filter), [analyses, filter]);
  const best = useMemo(() => bestByKick(analyses), [analyses]);
  const points = useMemo(
    () =>
      [...list]
        .reverse()
        .slice(-12)
        .map((a, i) => ({ x: i, y: a.kickRating, label: formatShortDate(a.createdAt) })),
    [list],
  );

  if (analyses.length === 0) {
    return (
      <Screen>
        <T variant="title" className="pt-2">
          {t('progress.title')}
        </T>
        <EmptyState title={t('progress.emptyTitle')} body={t('progress.emptyBody')} ctaLabel={t('progress.emptyCta')} onCta={() => router.push('/record')} />
      </Screen>
    );
  }

  const confirmDelete = (id: string, videoUri: string | null) => {
    Alert.alert(t('progress.deleteConfirmTitle'), t('progress.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteLocalFile(videoUri);
          remove(id);
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <T variant="title" className="pt-2">
        {t('progress.title')}
      </T>

      <T variant="label" className="mt-5 mb-2">
        {t('progress.best')}
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
        {KICK_TYPES.map((k) => {
          const b = best[k];
          return (
            <Card key={k} className="w-32 items-center gap-1" onPress={b ? () => router.push(`/result/${b.id}`) : undefined}>
              <T className="text-2xl">{KICK_EMOJI[k]}</T>
              <T variant="display" className="text-4xl" style={{ color: ratingColor(b?.kickRating ?? null) }}>
                {b ? b.kickRating : '—'}
              </T>
              <T variant="caption" className="text-center" numberOfLines={1}>
                {t(`kicks.${k}`)}
              </T>
            </Card>
          );
        })}
      </ScrollView>

      <View className="mt-6 flex-row items-center justify-between">
        <T variant="label">{t('progress.chart')}</T>
        <T variant="caption">{t('progress.attempts', { count: list.length })}</T>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 py-3">
        {(['all', ...KICK_TYPES] as const).map((k) => (
          <Pressable
            key={k}
            onPress={() => setFilter(k)}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === k }}
            className={`rounded-full border px-3 py-1.5 ${filter === k ? 'border-pitch bg-pitch/15' : 'border-line bg-surface'}`}
          >
            <T variant="caption" className={filter === k ? 'text-pitchSoft' : ''}>
              {k === 'all' ? t('progress.filterAll') : t(`kicks.${k}`)}
            </T>
          </Pressable>
        ))}
      </ScrollView>
      <Card className="items-center">
        {points.length > 0 ? (
          <LineChart points={points} width={width - 40 - 32} />
        ) : (
          <T variant="caption" className="py-8">
            {t('progress.emptyTitle')}
          </T>
        )}
      </Card>

      <T variant="label" className="mt-6 mb-2">
        {t('progress.history')}
      </T>
      <View className="gap-2">
        {list.map((a) => {
          const prev = previousOfType(analyses, a.kickType, a.id);
          const hasPrev = prev && new Date(prev.createdAt) < new Date(a.createdAt);
          return (
            <Card key={a.id} className="flex-row items-center gap-3" onPress={() => router.push(`/result/${a.id}`)}>
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-surface2">
                <T variant="display" className="text-2xl" style={{ color: ratingColor(a.kickRating) }}>
                  {a.kickRating}
                </T>
              </View>
              <View className="flex-1">
                <T variant="bodyStrong">
                  {KICK_EMOJI[a.kickType]} {t(`kicks.${a.kickType}`)}
                </T>
                <T variant="caption" numberOfLines={1}>
                  {formatShortDate(a.createdAt)} · {a.oneFix}
                </T>
              </View>
              {hasPrev ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => router.push(`/compare/${a.id}`)}
                  accessibilityLabel={t('progress.compareCta')}
                  className="h-9 w-9 items-center justify-center rounded-full bg-surface2"
                >
                  <Ionicons name="git-compare" size={18} color={colors.pitch} />
                </Pressable>
              ) : null}
              <Pressable hitSlop={8} onPress={() => confirmDelete(a.id, a.videoUri)} accessibilityLabel={t('common.delete')} className="h-9 w-9 items-center justify-center">
                <Ionicons name="trash-outline" size={18} color={colors.muted} />
              </Pressable>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

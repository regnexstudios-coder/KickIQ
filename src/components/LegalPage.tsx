import { View } from 'react-native';

import { Header, Screen, T } from '@/components/ui';
import type { LegalSection } from '@/content/legal';
import { LAST_UPDATED } from '@/content/legal';

export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <Screen scroll>
      <Header title={title} />
      <T variant="caption" className="mt-2">
        Last updated {LAST_UPDATED}
      </T>
      <View className="mt-4 gap-5">
        {sections.map((s) => (
          <View key={s.heading} className="gap-1.5">
            <T variant="heading" className="text-xl">
              {s.heading}
            </T>
            <T variant="body" className="text-muted">
              {s.body}
            </T>
          </View>
        ))}
      </View>
    </Screen>
  );
}

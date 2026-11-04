import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../components/ui';
import { dayTemplates, extras } from '../data/templates';
import { useStore } from '../store';
import { colors, fonts } from '../theme';
import { countOf, relativeDay } from '../utils';

/** Мої дні: що входить у кожен тренувальний день */
export function ProgramScreen({ onBack }: { onBack?: () => void }) {
  const { exerciseById, workouts } = useStore();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Header onBack={onBack} title="Мої дні" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={st.title}>Мої дні</Text>
          <Text style={st.lead}>
            Три дні на тиждень по колу. На сторінці дня вправи розкладені саме так, а ті, що ти вже робив, стоять першими.
          </Text>
        </View>
        {dayTemplates.map((t) => {
          const last = workouts.find((w) => w.typeId === t.id);
          const count = workouts.filter((w) => w.typeId === t.id).length;
          return (
            <View key={t.id} style={[st.day, { borderTopColor: t.color }]}>
              <View style={st.dayHead}>
                <Text style={[st.short, { color: t.color }]}>{t.short}</Text>
                <Text style={st.dayMeta}>{count ? `${countOf(count, 'раз', 'рази', 'разів')}, востаннє ${relativeDay(last!.date)}` : 'ще не було'}</Text>
              </View>
              <Text style={st.name}>{t.name}</Text>
              {t.blocks.map((b) => (
                <View key={b.title} style={st.block}>
                  <Text style={st.blockTitle}>{b.title}</Text>
                  <Text style={st.blockList}>{b.ids.map((id) => exerciseById(id)?.name).filter(Boolean).join(', ')}</Text>
                </View>
              ))}
              <View style={st.block}>
                <Text style={st.blockTitle}>Додатково, галочкою</Text>
                <Text style={st.blockList}>{extras.map((x) => x.label).join(', ')}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 44, lineHeight: 50 },
  lead: { color: colors.muted, fontSize: 15, lineHeight: 21, marginTop: 4, maxWidth: 560 },
  day: { marginHorizontal: 16, marginTop: 18, padding: 18, borderRadius: 20, backgroundColor: colors.surface, borderTopWidth: 5, borderWidth: 1, borderColor: colors.hair },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  short: { fontFamily: fonts.displaySemi, fontSize: 17 },
  dayMeta: { color: colors.muted, fontSize: 13 },
  name: { color: colors.ink, fontFamily: fonts.display, fontSize: 28, lineHeight: 32, marginTop: 2, marginBottom: 6 },
  block: { marginTop: 12 },
  blockTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  blockList: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 },
});

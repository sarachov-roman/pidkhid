import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Header, SectionTitle, Tap } from '../components/ui';
import { TypePicker, WorkoutCard } from '../components/WorkoutParts';
import { dayTemplates, templateById } from '../data/templates';
import { useStore } from '../store';
import { colors, fonts } from '../theme';
import { countOf, dayTitle, formatDayLong, fromDateKey, toDateKey } from '../utils';

const monthNames = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
const weekLetters = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

/** Календар тренувань: місяць сіткою, вибраний день під нею */
export function CalendarScreen({ onBack, onOpenDay }: { onBack?: () => void; onOpenDay: (date: string) => void }) {
  const { workouts } = useStore();
  const insets = useSafeAreaInsets();
  const today = toDateKey();
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDate = new Map(workouts.map((w) => [w.date, w]));
  const y = month.getFullYear();
  const m = month.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // скільки клітинок до 1-го числа (тиждень з понеділка)
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateKey(new Date(y, m, i + 1))),
  ];
  while (cells.length % 7) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));

  const monthKey = toDateKey(month).slice(0, 7);
  const inMonth = workouts.filter((w) => w.date.startsWith(monthKey));
  const counts = dayTemplates.map((t) => ({ t, n: inMonth.filter((w) => w.typeId === t.id).length })).filter((x) => x.n);

  const shift = (n: number) => setMonth(new Date(y, m + n, 1));
  const sel = byDate.get(selected);

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Header onBack={onBack} title="Календар тренувань" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={st.monthRow}>
          <Tap onPress={() => shift(-1)} style={st.arrow} accessibilityLabel="Попередній місяць">
            <Icon name="left" size={26} />
          </Tap>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={st.month}>{monthNames[m]}</Text>
            <Text style={st.year}>{y}</Text>
          </View>
          <Tap onPress={() => shift(1)} style={st.arrow} accessibilityLabel="Наступний місяць">
            <Icon name="right" size={26} />
          </Tap>
        </View>

        <View style={st.grid}>
          <View style={st.row}>
            {weekLetters.map((l) => (
              <Text key={l} style={st.wl}>{l}</Text>
            ))}
          </View>
          {rows.map((r, ri) => (
            <View key={ri} style={st.row}>
              {r.map((d, ci) => {
                if (!d) return <View key={ci} style={st.cell} />;
                const w = byDate.get(d);
                const t = w ? templateById(w.typeId) : null;
                const isToday = d === today;
                const isSel = d === selected;
                return (
                  <Tap key={d} onPress={() => setSelected(d)} style={st.cell} accessibilityLabel={`${formatDayLong(d)}${t ? `, ${t.short}` : ''}`}>
                    <View
                      style={[
                        st.cellInner,
                        t && { backgroundColor: t.color },
                        isToday && !t && { borderColor: colors.ink },
                        isSel && st.cellSel,
                      ]}
                    >
                      <Text style={[st.cellNum, t && { color: colors.bg }, d > today && !t && { color: colors.faint }]}>
                        {Number(d.slice(8))}
                      </Text>
                      {t && <Text style={st.cellType}>{t.id === 'free' ? '•' : t.short.replace('День ', 'Д')}</Text>}
                    </View>
                  </Tap>
                );
              })}
            </View>
          ))}
        </View>

        <View style={st.legend}>
          {dayTemplates.map((t) => (
            <View key={t.id} style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: t.color }]} />
              <Text style={st.legendText}>{t.short}: {t.name}</Text>
            </View>
          ))}
        </View>
        <Text style={st.monthSummary}>
          {inMonth.length
            ? `${countOf(inMonth.length, 'тренування', 'тренування', 'тренувань')} за місяць${counts.length ? ': ' + counts.map((x) => `${x.t.short.toLowerCase()} ×${x.n}`).join(', ') : ''}`
            : 'У цьому місяці ще не було тренувань'}
        </Text>

        <SectionTitle>{dayTitle(selected, today)}, {formatDayLong(selected).split(', ')[1]}</SectionTitle>
        <View style={{ paddingHorizontal: 16 }}>
          {sel ? (
            <WorkoutCard workout={sel} onPress={() => onOpenDay(selected)} showDate={false} />
          ) : (
            <>
              <Text style={st.noWorkout}>
                {selected > today
                  ? 'Цей день ще попереду. Можна заздалегідь вибрати тренування.'
                  : selected === today
                    ? 'Сьогодні ще не тренувався. Вибери, яке буде:'
                    : 'Цього дня тренування не записане. Вибери, яке було:'}
              </Text>
              <TypePicker date={selected} onPicked={() => onOpenDay(selected)} />
            </>
          )}
        </View>
        {fromDateKey(selected).getMonth() !== m && (
          <Tap onPress={() => setMonth(new Date(fromDateKey(selected).getFullYear(), fromDateKey(selected).getMonth(), 1))} style={st.backTo}>
            <Text style={st.backToText}>Показати місяць вибраного дня</Text>
          </Tap>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginTop: 4 },
  arrow: { width: 48, height: 56, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: colors.ink, fontSize: 40, lineHeight: 42, marginTop: -4 },
  month: { color: colors.ink, fontFamily: fonts.display, fontSize: 36, lineHeight: 40 },
  year: { color: colors.muted, fontSize: 14 },
  grid: { marginHorizontal: 12, marginTop: 10, padding: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hair },
  row: { flexDirection: 'row' },
  wl: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '600', paddingVertical: 6 },
  cell: { flex: 1, aspectRatio: 1, maxHeight: 78, padding: 3 },
  cellInner: {
    flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  cellSel: { borderColor: colors.ink, borderWidth: 2 },
  cellNum: { color: colors.ink, fontFamily: fonts.displaySemi, fontSize: 18 },
  cellType: { color: colors.bg, fontSize: 11, fontWeight: '800', marginTop: -2 },
  legend: { paddingHorizontal: 20, marginTop: 14, gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { color: colors.muted, fontSize: 13 },
  monthSummary: { color: colors.ink, fontSize: 14, fontWeight: '600', paddingHorizontal: 20, marginTop: 12 },
  noWorkout: { color: colors.muted, fontSize: 15, lineHeight: 21, marginBottom: 12 },
  backTo: { alignSelf: 'center', marginTop: 16 },
  backToText: { color: colors.ink, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});

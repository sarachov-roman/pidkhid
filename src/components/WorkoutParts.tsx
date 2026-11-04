import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { dayTemplates, DayTemplate, extraLabel, freeDay, templateById } from '../data/templates';
import { useStore, Workout } from '../store';
import { colors, fonts, radius } from '../theme';
import { bestReps, countOf, formatDayShort, relativeDay, toDateKey, topWeight, WorkSet } from '../utils';
import { Icon } from './Icon';
import { Delta, Tap } from './ui';

/** Різниця з минулим разом: спершу робоча вага, якщо однакова, то найкращий підхід */
export function SetsDelta({ sets, prev, timed }: { sets: WorkSet[]; prev?: WorkSet[]; timed?: boolean }) {
  if (!prev) return <Text style={{ color: colors.muted, fontSize: 13 }}>вперше</Text>;
  const dw = topWeight(sets) - topWeight(prev);
  return dw !== 0 ? <Delta value={dw} unit="кг" /> : <Delta value={bestReps(sets) - bestReps(prev)} unit={timed ? 'с' : 'повт'} />;
}

/** Кількість вправ і підходів по датах */
export function useDayStats() {
  const { sessions } = useStore();
  return useMemo(() => {
    const m = new Map<string, { exercises: number; sets: number }>();
    for (const s of sessions) {
      const cur = m.get(s.date) ?? { exercises: 0, sets: 0 };
      cur.exercises += 1;
      cur.sets += s.sets.length;
      m.set(s.date, cur);
    }
    return m;
  }, [sessions]);
}

/** Який день наступний за колом 1 → 2 → 3 → 1 перед вказаною датою */
export function useSuggestedType(date: string) {
  const { workouts } = useStore();
  const prevMain = workouts.find((w) => w.date < date && w.typeId !== 'free');
  const order = dayTemplates.map((t) => t.id);
  return prevMain ? order[(order.indexOf(prevMain.typeId) + 1) % order.length] : order[0];
}

export function workoutSummary(w: Workout, stats?: { exercises: number; sets: number }) {
  return (
    [
      stats ? `${countOf(stats.exercises, 'вправа', 'вправи', 'вправ')}, ${countOf(stats.sets, 'підхід', 'підходи', 'підходів')}` : '',
      w.extras?.length ? w.extras.map(extraLabel).join(', ').toLowerCase() : '',
    ]
      .filter(Boolean)
      .join(' + ') || 'Ще порожньо'
  );
}

/** Картка тренування для списків */
export function WorkoutCard({
  workout,
  onPress,
  active,
  showDate = true,
}: {
  workout: Workout;
  onPress: () => void;
  active?: boolean;
  showDate?: boolean;
}) {
  const stats = useDayStats();
  const t = templateById(workout.typeId);
  return (
    <Tap onPress={onPress} style={[st.wCard, active && st.wCardActive]} accessibilityRole="button">
      <View style={[st.bar, { backgroundColor: t.color }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        {showDate && <Text style={st.wDate}>{formatDayShort(workout.date)}</Text>}
        <Text style={st.wName} numberOfLines={1}>
          {t.id === 'free' ? t.name : `${t.short}: ${t.name}`}
        </Text>
        <Text style={st.meta}>{workoutSummary(workout, stats.get(workout.date))}</Text>
      </View>
      <Icon name="right" size={20} color={colors.faint} />
    </Tap>
  );
}

/** Вибір типу тренування на дату: три твої дні + вільне */
export function TypePicker({ date, onPicked }: { date: string; onPicked: () => void }) {
  const { workouts, startWorkout } = useStore();
  const suggested = useSuggestedType(date);
  const today = toDateKey();
  const start = (t: DayTemplate) => {
    startWorkout(date, t.id);
    onPicked();
  };
  return (
    <View style={st.cards}>
      {dayTemplates.map((t) => {
        const last = workouts.find((w) => w.typeId === t.id && w.date < date);
        return (
          <Tap key={t.id} onPress={() => start(t)} style={st.typeCard} accessibilityRole="button" accessibilityLabel={`${t.short}: ${t.name}`}>
            <View style={[st.bar, { backgroundColor: t.color }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={st.typeHead}>
                <Text style={[st.typeShort, { color: t.color }]}>{t.short}</Text>
                {t.id === suggested && <Text style={st.nextTag}>за планом</Text>}
              </View>
              <Text style={st.typeName}>{t.name}</Text>
              <Text style={st.meta}>{last ? `Востаннє ${relativeDay(last.date, today)}` : 'Ще не було'}</Text>
            </View>
            <Icon name="plus" size={24} color={colors.ink} />
          </Tap>
        );
      })}
      <Tap onPress={() => start(freeDay)} style={st.freeCard} accessibilityRole="button">
        <Text style={st.freeText}>Інше тренування, без плану</Text>
      </Tap>
    </View>
  );
}

const st = StyleSheet.create({
  cards: { gap: 10 },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.l, borderWidth: 1, borderColor: colors.hair,
    paddingVertical: 16, paddingRight: 16, minHeight: 92,
  },
  bar: { width: 6, alignSelf: 'stretch', borderRadius: 3, marginLeft: 12, marginRight: 14 },
  typeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeShort: { fontFamily: fonts.displaySemi, fontSize: 16 },
  nextTag: {
    color: colors.bg, backgroundColor: colors.ink, fontSize: 11, fontWeight: '700',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
  typeName: { color: colors.ink, fontFamily: fonts.display, fontSize: 24, lineHeight: 28, marginTop: 2 },
  meta: { color: colors.muted, fontSize: 13, marginTop: 4 },
  plus: { color: colors.ink, fontSize: 30, fontWeight: '300', marginLeft: 8 },
  freeCard: {
    borderRadius: 14, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed',
    paddingVertical: 14, alignItems: 'center',
  },
  freeText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  wCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.l, borderWidth: 1, borderColor: colors.hair, paddingVertical: 12, paddingRight: 14 },
  wCardActive: { backgroundColor: colors.surfaceHi },
  wDate: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  wName: { color: colors.ink, fontSize: 16, fontWeight: '600', marginTop: 2 },
  chev: { color: colors.faint, fontSize: 26, marginLeft: 8 },
});

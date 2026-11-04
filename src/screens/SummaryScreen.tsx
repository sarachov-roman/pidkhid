import React, { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Button, Card, Header, SectionTitle, Tap } from '../components/ui';
import { SetsDelta } from '../components/WorkoutParts';
import { extraLabel, templateById } from '../data/templates';
import { useStore } from '../store';
import { alpha, colors, fonts, mix, radius } from '../theme';
import {
  best1RM, fmtDuration, fmtInt, fmtNum, fmtSets, formatDay, formatDayLong, markPRs, topWeight, volume, workSets,
} from '../utils';

/** Підсумок тренування: що вийшло, рекорди і порівняння з минулим разом */
export function SummaryScreen({
  date,
  onBack,
  onDone,
}: {
  date: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const { workoutOn, sessionsOn, historyOf, exerciseById, workouts, reopenWorkout } = useStore();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const workout = workoutOn(date);
  const t = templateById(workout?.typeId ?? 'free');
  const done = sessionsOn(date);
  const setsCount = done.reduce((n, s) => n + workSets(s.sets).length, 0);
  const vol = done.reduce((n, s) => n + volume(s.sets), 0);
  const prevW = workouts.find((w) => w.typeId === t.id && w.date < date);
  const prevVol = prevW ? sessionsOn(prevW.date).reduce((n, s) => n + volume(s.sets), 0) : 0;
  const volDelta = prevVol > 0 && vol > 0 ? Math.round(((vol - prevVol) / prevVol) * 100) : null;
  const duration = workout?.startedAt && (workout.finishedAt ?? workout.endedAt) ? (workout.finishedAt ?? workout.endedAt!) - workout.startedAt : 0;

  const items = done.map((s) => {
    const ex = exerciseById(s.exerciseId);
    const past = historyOf(s.exerciseId).filter((h) => h.date < date);
    return { s, ex, prev: past[0], pr: markPRs(s.sets, past).some(Boolean) };
  });
  const records = items.filter((x) => x.pr && x.ex);
  const better = items.filter((x) => x.prev && (topWeight(x.s.sets) > topWeight(x.prev.sets) || (topWeight(x.s.sets) === topWeight(x.prev.sets) && workSets(x.s.sets).reduce((n, y) => n + y.reps, 0) > workSets(x.prev.sets).reduce((n, y) => n + y.reps, 0)))).length;

  const text = () =>
    [
      `${t.id === 'free' ? t.name : `${t.short}: ${t.name}`}, ${formatDayLong(date)}`,
      ...items.map((x) => (x.ex ? `${x.ex.name}: ${fmtSets(x.s.sets, x.ex.timed)}` : '')),
      workout?.extras?.length ? `Додатково: ${workout.extras.map(extraLabel).join(', ').toLowerCase()}` : '',
      `Разом: ${setsCount} підходів, ${fmtInt(vol)} кг${duration ? `, ${fmtDuration(duration)}` : ''}`,
    ]
      .filter(Boolean)
      .join('\n');

  const copy = async () => {
    try {
      if (Platform.OS === 'web') await (navigator as any).clipboard.writeText(text());
      else await Share.share({ message: text() });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // буфер обміну може бути недоступний
    }
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Header onBack={onBack} title={formatDay(date)} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <View style={[st.hero, { backgroundColor: mix(t.color, colors.surface, 0.17), borderColor: alpha(t.color, 0.4) }]}>
          <Text style={[st.kicker, { color: t.color }]}>{t.id === 'free' ? t.name : t.short}</Text>
          <Text style={st.title}>{workout?.finishedAt ? 'Тренування завершено' : 'Підсумок дня'}</Text>
          <Text style={st.sub}>{t.id === 'free' ? formatDayLong(date) : `${t.name}, ${formatDayLong(date)}`}</Text>
          <View style={st.stats}>
            {duration > 60000 ? <Big value={fmtDuration(duration)} label="тривалість" /> : null}
            <Big value={String(setsCount)} label="підходів" />
            <Big value={fmtInt(vol)} label="кг об'єму" />
          </View>
          {volDelta !== null && (
            <Text style={[st.delta, { color: volDelta >= 0 ? colors.up : colors.down }]}>
              {volDelta >= 0 ? '▲' : '▼'} {Math.abs(volDelta)}% об'єму до минулого разу ({formatDay(prevW!.date)})
            </Text>
          )}
        </View>

        {records.length > 0 && (
          <>
            <SectionTitle hint={`${records.length}`}>Нові рекорди</SectionTitle>
            <Card style={st.group}>
              {records.map((x, i) => (
                <View key={x.s.id} style={[st.recRow, i < records.length - 1 && st.divider]}>
                  <View style={st.recIcon}><Icon name="trophy" size={18} color={colors.gold} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.name} numberOfLines={1}>{x.ex!.name}</Text>
                    <Text style={st.meta}>розрахунковий максимум ≈ {fmtNum(Math.round(best1RM(x.s.sets) * 2) / 2)} кг</Text>
                  </View>
                  <Text style={st.recVal}>{fmtNum(topWeight(x.s.sets))} <Text style={st.recUnit}>кг</Text></Text>
                </View>
              ))}
            </Card>
          </>
        )}

        <SectionTitle hint={items.some((x) => x.prev) ? `${better} з ${items.filter((x) => x.prev).length} краще, ніж було` : undefined}>Вправи</SectionTitle>
        {items.length === 0 ? (
          <Text style={st.empty}>У цей день ще нічого не записано.</Text>
        ) : (
          <Card style={st.group}>
            {items.map((x, i) =>
              x.ex ? (
                <View key={x.s.id} style={[st.exRow, i < items.length - 1 && st.divider]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.name} numberOfLines={1}>{x.ex.name}</Text>
                    <Text style={st.sets}>{fmtSets(x.s.sets, x.ex.timed)}</Text>
                  </View>
                  <SetsDelta sets={x.s.sets} prev={x.prev?.sets} timed={x.ex.timed} />
                </View>
              ) : null,
            )}
          </Card>
        )}

        {workout?.extras?.length ? (
          <Text style={st.extras}>Додатково: {workout.extras.map(extraLabel).join(', ').toLowerCase()}</Text>
        ) : null}
        {workout?.note ? (
          <Card style={[st.group, { padding: 14, marginTop: 12 }]}>
            <Text style={st.note}>{workout.note}</Text>
          </Card>
        ) : null}

        <View style={st.actions}>
          <Button kind="ghost" icon={copied ? 'check' : 'copy'} label={copied ? 'Скопійовано' : 'Скопіювати підсумок'} onPress={copy} style={{ height: 48 }} />
          {workout?.finishedAt ? (
            <Tap onPress={() => { reopenWorkout(date); onBack(); }} hitSlop={8} style={{ alignSelf: 'center', marginTop: 6 }}>
              <Text style={st.reopen}>Повернутися до тренування й дописати</Text>
            </Tap>
          ) : null}
        </View>
      </ScrollView>

      <View style={[st.dock, { paddingBottom: insets.bottom + 12 }]}>
        <Button label="Готово" icon="check" color={t.color} onPress={onDone} />
      </View>
    </View>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={st.bigNum} numberOfLines={1}>{value}</Text>
      <Text style={st.bigLabel}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { marginHorizontal: 16, marginTop: 6, padding: 22, borderRadius: 26, borderWidth: 1 },
  kicker: { fontSize: 14, fontWeight: '700' },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 38, lineHeight: 42, marginTop: 4 },
  sub: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 12, marginTop: 20 },
  bigNum: { color: colors.ink, fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  bigLabel: { color: colors.muted, fontSize: 12, marginTop: 1 },
  delta: { fontSize: 14, fontWeight: '700', marginTop: 14 },
  group: { marginHorizontal: 16, overflow: 'hidden' },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  recIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: alpha(colors.gold, 0.14), alignItems: 'center', justifyContent: 'center' },
  recVal: { color: colors.ink, fontFamily: fonts.display, fontSize: 24 },
  recUnit: { color: colors.muted, fontSize: 14, fontFamily: fonts.displayMedium },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sets: { color: colors.ink, opacity: 0.85, fontFamily: fonts.displayMedium, fontSize: 17, marginTop: 2 },
  empty: { color: colors.muted, fontSize: 15, paddingHorizontal: 20 },
  extras: { color: colors.muted, fontSize: 14, paddingHorizontal: 20, marginTop: 14 },
  note: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  actions: { paddingHorizontal: 16, marginTop: 18, gap: 8 },
  reopen: { color: colors.muted, fontSize: 13, textDecorationLine: 'underline' },
  dock: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
  },
});

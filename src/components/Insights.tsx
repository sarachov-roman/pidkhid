import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { templateById } from '../data/templates';
import { useStore } from '../store';
import { colors, groups } from '../theme';
import { addDays, fmtNum, toDateKey, weekStart, workSets } from '../utils';

/** Теплова карта: кожен квадратик це день, колір відповідає дню тренування */
export function Heatmap({ weeks = 16 }: { weeks?: number }) {
  const { workouts } = useStore();
  const today = toDateKey();
  const start = addDays(weekStart(new Date()), -(weeks - 1) * 7);
  const byDate = useMemo(() => new Map(workouts.map((w) => [w.date, w])), [workouts]);
  return (
    <View style={st.heat}>
      {Array.from({ length: weeks }, (_, wi) => (
        <View key={wi} style={st.heatCol}>
          {Array.from({ length: 7 }, (_, di) => {
            const key = toDateKey(addDays(start, wi * 7 + di));
            const w = byDate.get(key);
            const future = key > today;
            return (
              <View
                key={di}
                style={[
                  st.heatCell,
                  { backgroundColor: w ? templateById(w.typeId).color : future ? 'transparent' : colors.surfaceHi },
                  key === today && !w && { borderWidth: 1.5, borderColor: colors.ink, backgroundColor: 'transparent' },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Скільки робочих підходів на тиждень припадає на кожну групу м'язів (середнє за 4 тижні) */
export function GroupBars() {
  const { sessions, exerciseById } = useStore();
  const rows = useMemo(() => {
    const cut = toDateKey(addDays(new Date(), -27));
    const sets = new Map<string, number>();
    for (const s of sessions) {
      if (s.date < cut) continue;
      const ex = exerciseById(s.exerciseId);
      if (!ex) continue;
      sets.set(ex.group, (sets.get(ex.group) ?? 0) + workSets(s.sets).length);
    }
    return groups
      .map((g) => ({ g, perWeek: (sets.get(g.id) ?? 0) / 4 }))
      .filter((x) => x.perWeek > 0)
      .sort((a, b) => b.perWeek - a.perWeek);
  }, [sessions, exerciseById]);

  if (!rows.length) return <Text style={st.empty}>Тут з'явиться розподіл навантаження по групах м'язів.</Text>;
  const max = Math.max(...rows.map((r) => r.perWeek));
  return (
    <View style={{ gap: 12 }}>
      {rows.map(({ g, perWeek }) => (
        <View key={g.id} style={st.barRow}>
          <Text style={st.barName}>{g.name}</Text>
          <View style={st.barTrack}>
            <View style={[st.barFill, { width: `${Math.max(4, (perWeek / max) * 100)}%`, backgroundColor: g.color }]} />
          </View>
          <Text style={st.barVal}>{fmtNum(Math.round(perWeek * 10) / 10)}</Text>
        </View>
      ))}
      <Text style={st.barHint}>робочих підходів на тиждень, у середньому за 4 тижні</Text>
    </View>
  );
}

const st = StyleSheet.create({
  heat: { flexDirection: 'row', gap: 4 },
  heatCol: { flex: 1, gap: 4 },
  heatCell: { width: '100%', aspectRatio: 1, borderRadius: 4 },
  empty: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barName: { width: 56, color: colors.ink, fontSize: 14, fontWeight: '600' },
  barTrack: { flex: 1, height: 12, borderRadius: 6, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  barVal: { width: 34, textAlign: 'right', color: colors.muted, fontSize: 14, fontWeight: '600' },
  barHint: { color: colors.faint, fontSize: 12 },
});

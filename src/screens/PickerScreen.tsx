import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExerciseRow, RowGroup } from '../components/ExerciseRow';
import { Button, Header, SectionTitle, Tap } from '../components/ui';
import { useStore } from '../store';
import { colors, fonts, GroupId, groupById, groups } from '../theme';
import { templateById } from '../data/templates';
import { fmtSets, relativeDay } from '../utils';

export function PickerScreen({ date, onBack, onOpen }: { date: string; onBack: () => void; onOpen: (exerciseId: string) => void }) {
  const { exercises, sessions, addExercise, workoutOn, planFor, workouts } = useStore();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const lastSession = useMemo(() => {
    const m = new Map<string, (typeof sessions)[number]>();
    for (const x of sessions) {
      const cur = m.get(x.exerciseId);
      if (!cur || x.date > cur.date) m.set(x.exerciseId, x);
    }
    return m;
  }, [sessions]);
  const lastDone = useMemo(() => new Map([...lastSession].map(([k, v]) => [k, v.date])), [lastSession]);

  const q = query.trim().toLowerCase();
  const matches = (name: string) => !q || q.split(/\s+/).every((w) => name.toLowerCase().includes(w));
  const exactMatch = exercises.some((e) => e.name.toLowerCase() === q);

  // Один спільний список без розбиття за групами м'язів:
  // спершу те, що вже робив (найсвіжіше зверху), далі решта за абеткою.
  const recent = exercises
    .filter((e) => lastDone.has(e.id) && matches(e.name))
    .sort((a, b) => (lastDone.get(b.id)! > lastDone.get(a.id)! ? 1 : -1));
  const rest = exercises
    .filter((e) => !lastDone.has(e.id) && matches(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  const nothing = recent.length === 0 && rest.length === 0;

  // вправи з блоків цього дня, яких ще нема в плані
  const inPlan = new Set(planFor(date));
  const tpl = templateById(workoutOn(date)?.typeId ?? 'free');
  const prevW = workouts.find((w) => w.typeId === tpl.id && w.date < date && sessions.some((x) => x.date === w.date));
  const lastIds = prevW ? sessions.filter((x) => x.date === prevW.date).map((x) => x.exerciseId).filter((id) => !inPlan.has(id)) : [];
  const lastTime = q ? [] : lastIds.map((id) => exercises.find((e) => e.id === id)).filter((e): e is (typeof exercises)[number] => !!e);
  const dayIds = [...new Set(tpl.blocks.flatMap((b) => b.ids))].filter((id) => !inPlan.has(id) && !lastIds.includes(id));
  const fromDay = q ? [] : exercises.filter((e) => dayIds.includes(e.id)).sort((a, b) => dayIds.indexOf(a.id) - dayIds.indexOf(b.id));
  const shownRest = rest.filter((e) => !fromDay.includes(e) && !lastTime.includes(e) && !inPlan.has(e.id));
  const shownRecent = recent.filter((e) => !fromDay.includes(e) && !lastTime.includes(e) && !inPlan.has(e.id));

  const create = (gid: GroupId) => {
    const ex = addExercise(query, gid);
    setCreating(false);
    onOpen(ex.id);
  };

  const row = (e: (typeof exercises)[number], i: number, list: unknown[]) => {
    const d = lastDone.get(e.id);
    const ls = lastSession.get(e.id);
    const g = groupById(e.group);
    return (
      <ExerciseRow
        key={e.id}
        exercise={e}
        meta={d && ls ? `${relativeDay(d)}: ${fmtSets(ls.sets, e.timed)}` : `${g.name}, ще не робив`}
        onPress={() => onOpen(e.id)}
        last={i === list.length - 1}
      />
    );
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Header onBack={onBack} title="Вибір вправи" />

      <View style={st.searchWrap}>
        <TextInput
          value={query}
          onChangeText={(t) => { setQuery(t); setCreating(false); }}
          placeholder={`Пошук серед ${exercises.length} вправ, наприклад «жим»`}
          placeholderTextColor={colors.faint}
          style={st.search}
          autoCorrect={false}
          autoFocus={Platform.OS === 'web'}
          returnKeyType="search"
          accessibilityLabel="Пошук вправи"
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {lastTime.length > 0 && prevW && (
          <>
            <SectionTitle hint={`${lastTime.length}`}>{`Було ${relativeDay(prevW.date)}, ${tpl.short.toLowerCase()}`}</SectionTitle>
            <RowGroup>{lastTime.map(row)}</RowGroup>
          </>
        )}
        {fromDay.length > 0 && (
          <>
            <SectionTitle hint={`${fromDay.length}`}>{tpl.id === 'free' ? 'З плану' : `З цього дня, ${tpl.short.toLowerCase()}`}</SectionTitle>
            <RowGroup>{fromDay.map(row)}</RowGroup>
          </>
        )}
        {shownRecent.length > 0 && (
          <>
            <SectionTitle hint={`${shownRecent.length}`}>Ти вже робив</SectionTitle>
            <RowGroup>{shownRecent.map(row)}</RowGroup>
          </>
        )}
        {shownRest.length > 0 && (
          <>
            <SectionTitle hint={`${shownRest.length}`}>{shownRecent.length > 0 || fromDay.length > 0 ? 'Інші вправи' : 'Усі вправи'}</SectionTitle>
            <RowGroup>{shownRest.map(row)}</RowGroup>
          </>
        )}

        {q.length > 1 && !exactMatch && (
          <View style={st.createBox}>
            {nothing && <Text style={st.notFound}>Такої вправи немає у списку. Можна додати свою.</Text>}
            {!creating ? (
              <Button kind="ghost" label={`Додати «${query.trim()}»`} onPress={() => setCreating(true)} />
            ) : (
              <>
                <Text style={st.createLabel}>Яка група м'язів?</Text>
                <Text style={st.createHint}>Від неї залежить лише колір смужки біля назви.</Text>
                <View style={st.createGroups}>
                  {groups.map((g) => (
                    <Chip key={g.id} label={g.name} color={g.color} onPress={() => create(g.id)} />
                  ))}
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Chip({ label, color, active, onPress }: { label: string; color?: string; active?: boolean; onPress: () => void }) {
  return (
    <Tap
      onPress={onPress}
      style={[st.chip, active && st.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      {color ? <View style={[st.dot, { backgroundColor: color }]} /> : null}
      <Text style={[st.chipText, active && { color: colors.bg }]}>{label}</Text>
    </Tap>
  );
}

const st = StyleSheet.create({
  searchWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  search: {
    height: 48, borderRadius: 12, backgroundColor: colors.surface, color: colors.ink,
    paddingHorizontal: 16, fontSize: 16,
  },
  chip: {
    height: 36, borderRadius: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  createBox: { marginHorizontal: 16, marginTop: 24 },
  notFound: { color: colors.muted, fontSize: 15, marginBottom: 12 },
  createLabel: { color: colors.ink, fontFamily: fonts.displaySemi, fontSize: 20 },
  createHint: { color: colors.muted, fontSize: 14, marginTop: 4, marginBottom: 12 },
  createGroups: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExerciseRow, RowGroup } from '../components/ExerciseRow';
import { Icon } from '../components/Icon';
import { GroupBars, Heatmap } from '../components/Insights';
import { ProgressChart } from '../components/ProgressChart';
import { Button, Card, Delta, Header, SectionTitle, Segmented, Tap } from '../components/ui';
import { Session, useStore } from '../store';
import { alpha, colors, fonts, groupById } from '../theme';
import {
  best1RM, bestReps, computePRs, fmtInt, fmtNum, fmtSets, formatDay, formatDayShort, parseNum, relativeDay, toDateKey, topWeight,
  volume, workSets,
} from '../utils';

/** Усі вправи, які ти вже робив: остання вага, рекорд і зміна за місяць; зверху огляд активності */
export function ProgressScreen({ onBack, onOpenExercise }: { onBack?: () => void; onOpenExercise: (id: string) => void }) {
  const { sessions, workouts, exerciseById } = useStore();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const by = new Map<string, Session[]>();
    for (const s of sessions) by.set(s.exerciseId, [...(by.get(s.exerciseId) ?? []), s]);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 28);
    const cut = toDateKey(monthAgo);
    return [...by.entries()]
      .map(([id, list]) => {
        const sorted = [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
        const last = sorted[0];
        const old = sorted.find((s) => s.date <= cut) ?? sorted[sorted.length - 1];
        const usesWeight = sorted.some((s) => topWeight(s.sets) > 0);
        const metric = (s: Session) => (usesWeight ? topWeight(s.sets) : bestReps(s.sets));
        return {
          id,
          last,
          count: sorted.length,
          best: Math.max(...sorted.map(metric)),
          change: sorted.length > 1 ? metric(last) - metric(old) : 0,
          usesWeight,
        };
      })
      .sort((a, b) => (a.last.date < b.last.date ? 1 : -1));
  }, [sessions]);

  const totals = useMemo(() => {
    const setsN = sessions.reduce((n, s) => n + workSets(s.sets).length, 0);
    const tons = sessions.reduce((n, s) => n + volume(s.sets), 0) / 1000;
    const prs = computePRs(sessions).length;
    return { workouts: workouts.length, sets: setsN, tons, prs };
  }, [sessions, workouts]);

  const q = query.trim().toLowerCase();
  const shown = items.filter((x) => !q || (exerciseById(x.id)?.name.toLowerCase().includes(q) ?? false));

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Header onBack={onBack} title="Прогрес і рекорди" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={st.title}>Прогрес</Text>
          <Text style={st.lead}>Твої рекорди, активність і навантаження. Нижче кожна вправа окремо.</Text>
        </View>

        {items.length > 0 && (
          <>
            <View style={st.totals}>
              <Total n={fmtInt(totals.workouts)} label="тренувань" />
              <Total n={fmtInt(totals.sets)} label="підходів" />
              <Total n={fmtNum(Math.round(totals.tons * 10) / 10)} label="тонн піднято" />
              <Total n={String(totals.prs)} label="рекордів" gold />
            </View>

            <SectionTitle hint="16 тижнів">Активність</SectionTitle>
            <Card style={st.card}>
              <Heatmap />
            </Card>

            <SectionTitle>Навантаження по групах</SectionTitle>
            <Card style={st.card}>
              <GroupBars />
            </Card>
          </>
        )}

        <BodyWeightCard />

        {items.length > 6 && (
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Знайти вправу"
              placeholderTextColor={colors.faint}
              style={st.search}
              accessibilityLabel="Знайти вправу"
            />
          </View>
        )}
        {items.length === 0 ? (
          <Text style={st.empty}>Поки що порожньо. Запиши перше тренування, і тут з'являться рекорди, активність і твої вправи.</Text>
        ) : (
          <>
            <SectionTitle hint={`${shown.length}`}>Вправи</SectionTitle>
            <RowGroup>
              {shown.map((x, i) => {
                const ex = exerciseById(x.id);
                if (!ex) return null;
                const unit = x.usesWeight ? 'кг' : ex.timed ? 'с' : 'повт';
                return (
                  <ExerciseRow
                    key={x.id}
                    exercise={ex}
                    detail={fmtSets(x.last.sets, ex.timed)}
                    meta={`Рекорд ${fmtNum(x.best)} ${unit}, востаннє ${relativeDay(x.last.date)}`}
                    right={x.count > 1 ? <Delta value={x.change} unit={unit} /> : <Text style={st.once}>1 раз</Text>}
                    onPress={() => onOpenExercise(x.id)}
                    last={i === shown.length - 1}
                  />
                );
              })}
            </RowGroup>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Total({ n, label, gold }: { n: string; label: string; gold?: boolean }) {
  return (
    <Card style={st.total}>
      <Text style={[st.totalNum, gold && { color: colors.gold }]}>{n}</Text>
      <Text style={st.totalLabel}>{label}</Text>
    </Card>
  );
}

/** Вага тіла: швидкий запис і графік */
function BodyWeightCard() {
  const { bodyweight, setBodyweight, removeBodyweight } = useStore();
  const today = toDateKey();
  const todayEntry = bodyweight.find((b) => b.date === today);
  const [text, setText] = useState('');
  const latest = bodyweight[0];
  const points = [...bodyweight].reverse().slice(-20).map((b) => ({ date: b.date, value: b.kg }));

  const save = () => {
    const n = parseNum(text);
    if (n && n > 20 && n < 400) {
      setBodyweight(today, Math.round(n * 10) / 10);
      setText('');
    }
  };

  return (
    <>
      <SectionTitle hint={latest ? `востаннє ${relativeDay(latest.date)}` : undefined}>Вага тіла</SectionTitle>
      <Card style={st.card}>
        {points.length >= 2 ? (
          <ProgressChart points={points} color={colors.gold} unit="кг" />
        ) : latest ? (
          <Text style={st.bwBig}>{fmtNum(latest.kg)} <Text style={st.bwUnit}>кг</Text></Text>
        ) : (
          <Text style={st.bwEmpty}>Записуй вагу раз на кілька днів, і тут з'явиться графік.</Text>
        )}
        <View style={st.bwRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={save}
            placeholder={todayEntry ? `Сьогодні ${fmtNum(todayEntry.kg)} кг` : 'Вага сьогодні, кг'}
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
            style={st.bwInput}
            accessibilityLabel="Вага тіла, кг"
          />
          <Button label={todayEntry ? 'Оновити' : 'Записати'} onPress={save} style={{ height: 48, paddingHorizontal: 20 }} disabled={parseNum(text) === null} />
        </View>
        {todayEntry && (
          <Tap onPress={() => removeBodyweight(today)} hitSlop={8} style={{ marginTop: 10 }}>
            <Text style={st.bwRemove}>Прибрати запис за сьогодні</Text>
          </Tap>
        )}
      </Card>
    </>
  );
}

type Metric = 'weight' | '1rm' | 'volume';

/** Одна вправа: рекорди, графік і вся історія */
export function ExerciseScreen({ exerciseId, onBack, onOpenDay }: { exerciseId: string; onBack: () => void; onOpenDay: (date: string) => void }) {
  const { exerciseById, historyOf, notes } = useStore();
  const insets = useSafeAreaInsets();
  const [metricId, setMetricId] = useState<Metric>('weight');
  const ex = exerciseById(exerciseId);
  const hist = historyOf(exerciseId);
  if (!ex) return null;
  const g = groupById(ex.group);
  const usesWeight = hist.some((s) => topWeight(s.sets) > 0);
  const unit = usesWeight ? 'кг' : ex.timed ? 'с' : 'повт';
  const base = (s: Session) => (usesWeight ? topWeight(s.sets) : bestReps(s.sets));
  const bestS = hist.reduce<Session | undefined>((b, s) => (!b || base(s) > base(b) ? s : b), undefined);
  const volS = hist.reduce<Session | undefined>((b, s) => (!b || volume(s.sets) > volume(b.sets) ? s : b), undefined);
  const rmS = hist.reduce<Session | undefined>((b, s) => (!b || best1RM(s.sets) > best1RM(b.sets) ? s : b), undefined);

  const showMetrics = usesWeight && !ex.timed;
  const metric = (s: Session) =>
    metricId === '1rm' && showMetrics ? Math.round(best1RM(s.sets) * 2) / 2 : metricId === 'volume' && showMetrics ? volume(s.sets) : base(s);
  const chartUnit = metricId === 'weight' || !showMetrics ? unit : 'кг';
  const points = [...hist].reverse().slice(-16).map((s) => ({ date: s.date, value: metric(s) }));

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Header onBack={onBack} title="Прогрес вправи" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={{ paddingHorizontal: 20 }}>
          <View style={st.groupRow}>
            <View style={[st.groupDot, { backgroundColor: g.color }]} />
            <Text style={st.groupName}>{g.name}</Text>
          </View>
          <Text style={st.exTitle}>{ex.name}</Text>
          <Text style={st.lead}>{hist.length} {hist.length === 1 ? 'запис' : hist.length < 5 ? 'записи' : 'записів'}</Text>
        </View>

        {bestS && (
          <View style={st.records}>
            <Card style={st.rec}>
              <View style={st.recHead}>
                <Icon name="trophy" size={15} color={colors.gold} />
                <Text style={st.recLabel}>{usesWeight ? 'Найбільша вага' : 'Найкращий підхід'}</Text>
              </View>
              <Text style={st.recBig}>{fmtNum(base(bestS))} <Text style={st.recUnit}>{unit}</Text></Text>
              <Text style={st.recDate}>{formatDay(bestS.date)}</Text>
            </Card>
            {showMetrics && rmS && (
              <Card style={st.rec}>
                <View style={st.recHead}>
                  <Icon name="zap" size={15} color={g.color} />
                  <Text style={st.recLabel}>Розрахунковий максимум</Text>
                </View>
                <Text style={st.recBig}>{fmtNum(Math.round(best1RM(rmS.sets) * 2) / 2)} <Text style={st.recUnit}>кг</Text></Text>
                <Text style={st.recDate}>на 1 повтор, {formatDay(rmS.date)}</Text>
              </Card>
            )}
            {usesWeight && volS && (
              <Card style={st.rec}>
                <View style={st.recHead}>
                  <Icon name="layers" size={15} color={colors.muted} />
                  <Text style={st.recLabel}>Найбільший об'єм</Text>
                </View>
                <Text style={st.recBig}>{fmtInt(volume(volS.sets))} <Text style={st.recUnit}>кг</Text></Text>
                <Text style={st.recDate}>{formatDay(volS.date)}</Text>
              </Card>
            )}
          </View>
        )}

        {notes[exerciseId] ? (
          <Card style={[st.card, { marginTop: 12, flexDirection: 'row', gap: 10 }]}>
            <Icon name="note" size={18} color={colors.muted} />
            <Text style={st.noteText}>{notes[exerciseId]}</Text>
          </Card>
        ) : null}

        {points.length >= 2 && (
          <>
            <SectionTitle>Графік</SectionTitle>
            {showMetrics && (
              <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                <Segmented
                  options={[
                    { id: 'weight' as Metric, label: 'Вага' },
                    { id: '1rm' as Metric, label: '1ПМ' },
                    { id: 'volume' as Metric, label: "Об'єм" },
                  ]}
                  value={metricId}
                  onChange={setMetricId}
                />
              </View>
            )}
            <Card style={st.card}>
              <ProgressChart points={points} color={g.color} unit={chartUnit} />
            </Card>
          </>
        )}

        <SectionTitle>Історія</SectionTitle>
        <Card style={st.card}>
          {hist.map((s, i) => (
            <View key={s.id} style={[st.histRow, i < hist.length - 1 && st.histDivider]}>
              <View style={{ flex: 1 }}>
                <Text style={st.histDate} onPress={() => onOpenDay(s.date)}>{formatDayShort(s.date)}</Text>
                <Text style={st.histSets}>{fmtSets(s.sets, ex.timed)}</Text>
              </View>
              {hist[i + 1] && <Delta value={base(s) - base(hist[i + 1])} unit={unit} />}
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 44, lineHeight: 50 },
  lead: { color: colors.muted, fontSize: 15, lineHeight: 21, marginTop: 4, maxWidth: 560 },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 16, marginTop: 18 },
  total: { flexGrow: 1, flexBasis: '45%', minWidth: 120, paddingVertical: 12, paddingHorizontal: 14 },
  totalNum: { color: colors.ink, fontFamily: fonts.display, fontSize: 26, lineHeight: 30 },
  totalLabel: { color: colors.muted, fontSize: 12, marginTop: 1 },
  search: { height: 46, borderRadius: 12, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: 16, fontSize: 16 },
  empty: { color: colors.muted, fontSize: 15, lineHeight: 22, paddingHorizontal: 20, marginTop: 24 },
  once: { color: colors.muted, fontSize: 13 },
  bwBig: { color: colors.ink, fontFamily: fonts.display, fontSize: 34 },
  bwUnit: { fontSize: 18, color: colors.muted, fontFamily: fonts.displayMedium },
  bwEmpty: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  bwRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  bwInput: { flex: 1, minWidth: 0, height: 48, borderRadius: 12, backgroundColor: colors.surfaceHi, color: colors.ink, paddingHorizontal: 14, fontSize: 16 },
  bwRemove: { color: colors.muted, fontSize: 13, textDecorationLine: 'underline' },
  groupRow: { flexDirection: 'row', alignItems: 'center' },
  groupDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  groupName: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  exTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 38, lineHeight: 42, marginTop: 6 },
  records: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 18, flexWrap: 'wrap' },
  rec: { flex: 1, minWidth: 150, padding: 16 },
  recHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recLabel: { color: colors.muted, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  recBig: { color: colors.ink, fontFamily: fonts.display, fontSize: 34, lineHeight: 40, marginTop: 4 },
  recUnit: { fontSize: 18, color: colors.muted, fontFamily: fonts.displayMedium },
  recDate: { color: colors.muted, fontSize: 13 },
  card: { marginHorizontal: 16, padding: 16 },
  noteText: { color: colors.ink, fontSize: 14, lineHeight: 20, flex: 1 },
  histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  histDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  histDate: { color: colors.muted, fontSize: 13 },
  histSets: { color: colors.ink, fontFamily: fonts.displayMedium, fontSize: 19, marginTop: 2 },
});

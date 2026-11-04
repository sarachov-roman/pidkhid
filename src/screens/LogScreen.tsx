import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { ProgressChart } from '../components/ProgressChart';
import { Button, Card, Chip, Delta, Header, SectionTitle, Tap } from '../components/ui';
import { useRest } from '../rest';
import { useStore } from '../store';
import { alpha, colors, fonts, groupById, radius } from '../theme';
import {
  best1RM, bestReps, fmtNum, fmtSet, fmtSets, formatDayShort, markPRs, parseNum, platesPerSide, relativeDay, suggestNext,
  toDateKey, topWeight, WorkSet, workSets,
} from '../utils';

/** Підсумок порівняно з минулим разом, щоб одразу було видно: прогрес чи стоїш на місці */
function verdict(sets: WorkSet[], prev: WorkSet[], timed?: boolean): { text: string; tone: 'up' | 'down' | 'same' } | null {
  const a = workSets(sets);
  const b = workSets(prev);
  if (!a.length || !b.length) return null;
  const unit = timed ? 'с' : 'повт.';
  const dw = topWeight(a) - topWeight(b);
  const dr = a.reduce((n, x) => n + x.reps, 0) - b.reduce((n, x) => n + x.reps, 0);
  if (dw > 0) return { text: `Робоча вага більша на ${fmtNum(dw)} кг`, tone: 'up' };
  if (dw < 0) return { text: `Робоча вага менша на ${fmtNum(-dw)} кг`, tone: 'down' };
  if (dr > 0) return { text: `Та сама вага, разом на ${dr} ${unit} більше`, tone: 'up' };
  if (dr < 0) return { text: `Та сама вага, разом на ${-dr} ${unit} менше`, tone: 'down' };
  return { text: 'Як минулого разу: та сама вага й повтори', tone: 'same' };
}

export function LogScreen({ exerciseId, date, onBack }: { exerciseId: string; date: string; onBack: () => void }) {
  const { exerciseById, historyOf, saveSets, deleteSession, notes, setNote } = useStore();
  const rest = useRest();
  const insets = useSafeAreaInsets();
  const ex = exerciseById(exerciseId);
  const today = date;

  const history = historyOf(exerciseId);
  const todaySession = history.find((h) => h.date === today);
  const prev = history.find((h) => h.date < today);
  const past = history.filter((h) => h.date < today);

  const [sets, setSets] = useState<WorkSet[]>(() => todaySession?.sets ?? []);
  const [sel, setSel] = useState<number>(() => (todaySession ? todaySession.sets.length - 1 : -1));
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showPlates, setShowPlates] = useState(false);

  const update = (next: WorkSet[]) => {
    setSets(next);
    saveSets(exerciseId, date, next);
  };

  if (!ex) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <Header onBack={onBack} />
        <Text style={{ color: colors.muted, padding: 20 }}>Вправу не знайдено.</Text>
      </View>
    );
  }

  const g = groupById(ex.group);
  const repUnit = ex.timed ? 'с' : 'повт';
  const prevSets = prev?.sets ?? [];
  const prevWork = workSets(prevSets);
  const todayWork = workSets(sets).length;
  const ghosts = prevWork.slice(todayWork);
  const prs = markPRs(sets, past);
  const gotPR = prs.some(Boolean);

  const addSet = () => {
    const i = sets.length;
    const fallback: WorkSet = ex.bodyweight ? { weight: 0, reps: ex.timed ? 30 : 10 } : { weight: 20, reps: 10 };
    // новий підхід = такий самий, як цей підхід минулого разу; якщо його не було, то як попередній сьогодні
    const lastWork = [...sets].reverse().find((x) => !x.warm);
    const base = prevWork[todayWork] ?? lastWork ?? sets[i - 1] ?? prevWork[prevWork.length - 1] ?? fallback;
    update([...sets, { weight: base.weight, reps: base.reps }]);
    setSel(i);
    rest.start();
  };

  const patch = (i: number, p: Partial<WorkSet>) => {
    update(sets.map((x, j) => (j === i ? { ...x, ...p } : x)));
  };

  const removeSel = () => {
    const next = sets.filter((_, j) => j !== sel);
    update(next);
    setSel(Math.min(sel, next.length - 1));
  };

  const current = sel >= 0 ? sets[sel] : undefined;
  const v = verdict(sets, prevSets, ex.timed);
  const sug = prevWork.length ? suggestNext(prevSets, ex.timed) : null;
  const plates = current && current.weight > 20 && !current.warm ? platesPerSide(current.weight) : null;

  // для вправ з власною вагою без обтяження стежимо за повторами
  const useReps = past.concat(todaySession ? [todaySession] : []).every((h) => topWeight(h.sets) === 0);
  const chartPoints = [...past].reverse().slice(-12).map((h) => ({ date: h.date, value: useReps ? bestReps(h.sets) : topWeight(h.sets) }));
  if (todayWork) chartPoints.push({ date: today, value: useReps ? bestReps(sets) : topWeight(sets) });

  const prev1rm = prev ? best1RM(prev.sets) : 0;
  let workIdx = -1;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <Header onBack={onBack} right={sets.length > 0 ? <Tap onPress={onBack} hitSlop={10}><Text style={st.done}>Готово</Text></Tap> : null} />

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 340 + insets.bottom }}>
          <View style={st.titleBlock}>
            <View style={st.groupRow}>
              <View style={[st.groupDot, { backgroundColor: g.color }]} />
              <Text style={st.groupName}>{g.name}</Text>
            </View>
            <Text style={st.title}>{ex.name}</Text>
          </View>

          {gotPR && (
            <View style={st.prBanner}>
              <Icon name="trophy" size={20} color={colors.gold} />
              <Text style={st.prBannerText}>Новий рекорд! Такого в цій вправі ще не було.</Text>
            </View>
          )}

          {prev ? (
            <Card style={st.lastCard}>
              <Text style={st.lastLabel}>Минулого разу, {formatDayShort(prev.date)} ({relativeDay(prev.date, toDateKey())})</Text>
              <Text style={st.lastSets}>{fmtSets(prev.sets, ex.timed)}</Text>
              {prev1rm > 0 && !ex.timed && <Text style={st.lastMeta}>Розрахунковий максимум ≈ {fmtNum(Math.round(prev1rm * 2) / 2)} кг</Text>}
              {v && (
                <Text style={[st.verdict, { color: v.tone === 'up' ? colors.up : v.tone === 'down' ? colors.down : colors.ink }]}>
                  {v.tone === 'up' ? '▲ ' : v.tone === 'down' ? '▼ ' : '= '}{v.text}
                </Text>
              )}
              {notes[exerciseId] ? <Text style={st.lastNote}>Нотатка: {notes[exerciseId]}</Text> : null}
            </Card>
          ) : (
            <Text style={[st.sub, { paddingHorizontal: 20 }]}>Перший запис цієї вправи. Поїхали.</Text>
          )}

          {sug && todayWork === 0 && (
            <View style={[st.sug, { borderColor: alpha(g.color, 0.5), backgroundColor: alpha(g.color, 0.1) }]}>
              <View style={st.sugHead}>
                <Icon name="zap" size={18} color={g.color} fill={alpha(g.color, 0.3)} />
                <Text style={st.sugLabel}>Ціль на сьогодні</Text>
              </View>
              <Text style={st.sugBig}>{fmtSet({ weight: sug.weight, reps: sug.reps }, ex.timed)}</Text>
              <Text style={st.sugReason}>{sug.reason}</Text>
              <View style={st.sugBtns}>
                <Chip
                  label="Взяти ціль"
                  icon="plus"
                  color={g.color}
                  on
                  onPress={() => {
                    update([{ weight: sug.weight, reps: sug.reps }]);
                    setSel(0);
                    rest.start();
                  }}
                />
                <Chip
                  label="Повторити як було"
                  icon="repeat"
                  onPress={() => {
                    update(prevSets.map((x) => ({ ...x })));
                    setSel(prevSets.length - 1);
                    rest.start();
                  }}
                />
              </View>
            </View>
          )}

          <View style={st.table}>
            <View style={st.thead}>
              <Text style={[st.th, { width: 30 }]}>#</Text>
              <Text style={[st.th, { flex: 1 }]}>{date === toDateKey() ? 'Сьогодні' : formatDayShort(date)}</Text>
              <Text style={[st.th, { width: 92, textAlign: 'right' }]}>Минулого разу</Text>
            </View>
            {sets.length === 0 && ghosts.length === 0 && <Text style={st.emptyRow}>Натисни «Додати підхід», щоб записати перший.</Text>}
            {sets.map((t, i) => {
              if (!t.warm) workIdx++;
              const p = t.warm ? undefined : prevWork[workIdx];
              const active = i === sel;
              const pr = prs[i];
              let delta: React.ReactNode = null;
              if (p) {
                const dw = t.weight - p.weight;
                delta = dw !== 0 ? <Delta value={dw} unit="кг" /> : <Delta value={t.reps - p.reps} unit={repUnit} />;
              }
              return (
                <Tap
                  key={i}
                  onPress={() => setSel(i)}
                  style={[st.tr, active && { borderColor: g.color, backgroundColor: colors.surfaceHi }, t.warm && { opacity: 0.8 }]}
                  accessibilityLabel={`${t.warm ? 'Розминка' : `Підхід ${workIdx + 1}`}`}
                >
                  <Text style={[st.idx, active && { color: colors.ink }, t.warm && { color: colors.muted }]}>{t.warm ? 'Р' : workIdx + 1}</Text>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <Text style={[st.setBig, t.warm && { color: colors.muted }]}>
                      {t.weight ? fmtNum(t.weight) : ex.timed ? '' : 'вага тіла'}
                      {t.weight ? <Text style={st.setUnit}> кг</Text> : null}
                      <Text style={st.times}>{t.weight || !ex.timed ? '  ×  ' : ''}</Text>
                      {t.reps}
                      {ex.timed ? <Text style={st.setUnit}> с</Text> : null}
                    </Text>
                    {delta}
                    {pr && (
                      <View style={st.prTag}>
                        <Icon name="star" size={12} color={colors.bg} fill={colors.bg} />
                        <Text style={st.prTagText}>{pr === 'weight' ? 'рекорд' : 'макс. 1ПМ'}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={st.prev}>{p ? fmtSet(p, ex.timed) : ''}</Text>
                </Tap>
              );
            })}
            {ghosts.map((p, k) => (
              <Tap
                key={`g${k}`}
                onPress={k === 0 ? addSet : undefined}
                style={[st.tr, { opacity: 0.5 }]}
                accessibilityLabel={`Підхід ${todayWork + k + 1}`}
              >
                <Text style={st.idx}>{todayWork + k + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.setGhost}>{k === 0 ? '+ повторити' : '—'}</Text>
                </View>
                <Text style={st.prev}>{fmtSet(p, ex.timed)}</Text>
              </Tap>
            ))}
          </View>

          {chartPoints.length >= 2 && (
            <>
              <SectionTitle hint={useReps ? 'найкращий підхід' : 'робоча вага'}>Прогрес</SectionTitle>
              <Card style={st.card}>
                <ProgressChart points={chartPoints} color={g.color} unit={useReps ? repUnit : 'кг'} />
              </Card>
            </>
          )}

          <SectionTitle hint="налаштування тренажера, хват, висота сидіння">Нотатка до вправи</SectionTitle>
          <Card style={st.card}>
            <TextInput
              value={notes[exerciseId] ?? ''}
              onChangeText={(t) => setNote(exerciseId, t)}
              placeholder="Наприклад: сидіння на 4, спинка на 2"
              placeholderTextColor={colors.faint}
              multiline
              style={st.noteInput}
              accessibilityLabel="Нотатка до вправи"
            />
          </Card>

          {past.length > 0 && (
            <>
              <SectionTitle hint={`${past.length} ${past.length === 1 ? 'запис' : past.length < 5 ? 'записи' : 'записів'}`}>Історія</SectionTitle>
              <Card style={st.card}>
                {past.map((h, i) => (
                  <View key={h.id} style={[st.histRow, i < past.length - 1 && st.histDivider]}>
                    {confirmId === h.id ? (
                      <>
                        <Text style={[st.histDate, { flex: 1 }]}>Видалити запис за {formatDayShort(h.date)}?</Text>
                        <Tap onPress={() => { deleteSession(h.id); setConfirmId(null); }} style={st.histBtn}>
                          <Text style={{ color: colors.down, fontWeight: '600' }}>Видалити</Text>
                        </Tap>
                        <Tap onPress={() => setConfirmId(null)} style={st.histBtn}>
                          <Text style={{ color: colors.ink }}>Скасувати</Text>
                        </Tap>
                      </>
                    ) : (
                      <>
                        <View style={{ flex: 1 }}>
                          <Text style={st.histDate}>{formatDayShort(h.date)}</Text>
                          <Text style={st.histSets}>{fmtSets(h.sets, ex.timed)}</Text>
                        </View>
                        <Tap onPress={() => setConfirmId(h.id)} hitSlop={10} accessibilityLabel="Видалити запис" style={st.histBtn}>
                          <Icon name="x" size={18} color={colors.faint} />
                        </Tap>
                      </>
                    )}
                  </View>
                ))}
              </Card>
            </>
          )}
        </ScrollView>

        <View style={[st.pad, { paddingBottom: insets.bottom + 14 }]}>
          {current && (
            <>
              <View style={st.padHead}>
                <Text style={st.padTitle}>{current.warm ? 'Розминка' : `Підхід ${sets.slice(0, sel + 1).filter((x) => !x.warm).length}`}</Text>
                <Tap onPress={removeSel} hitSlop={8} style={st.removeBtn}>
                  <Icon name="trash" size={15} color={colors.muted} />
                  <Text style={st.padRemove}>Прибрати</Text>
                </Tap>
              </View>
              <View style={st.padRow}>
                <Stepper
                  label={ex.bodyweight ? 'Обтяження, кг' : 'Вага, кг'}
                  value={current.weight}
                  step={2.5}
                  min={0}
                  decimal
                  onChange={(x) => patch(sel, { weight: x })}
                />
                <Stepper
                  label={ex.timed ? 'Секунди' : 'Повтори'}
                  value={current.reps}
                  step={ex.timed ? 5 : 1}
                  min={1}
                  onChange={(x) => patch(sel, { reps: x })}
                />
              </View>
              <View style={st.chips}>
                <Chip label="Розминка" on={!!current.warm} color={colors.gold} onPress={() => patch(sel, { warm: !current.warm })} />
                <Chip label="Млинці" icon="layers" on={showPlates} onPress={() => setShowPlates((x) => !x)} />
                <Chip label="Відпочинок" icon="timer" onPress={() => rest.start()} />
              </View>
              {showPlates && (
                <Text style={st.plates}>
                  {plates
                    ? `З кожного боку грифа (20 кг): ${plates.map(fmtNum).join(' + ')}${Math.abs(plates.reduce((a, b) => a + b, 0) * 2 + 20 - current.weight) > 0.01 ? ' (точніше не набрати)' : ''}`
                    : current.weight > 0 && current.weight <= 20
                      ? 'Це лише гриф або менше'
                      : 'Введи вагу більше 20 кг'}
                </Text>
              )}
            </>
          )}
          <Button
            label={sets.length === 0 && prevWork.length > 0 ? `Почати: ${fmtSet(prevWork[0], ex.timed)}` : 'Додати підхід'}
            icon="plus"
            color={g.color === '#E8EAED' ? undefined : g.color}
            onPress={addSet}
            style={{ marginTop: current ? 10 : 0 }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Stepper({
  label, value, step, min, decimal, onChange,
}: {
  label: string; value: number; step: number; min: number; decimal?: boolean; onChange: (v: number) => void;
}) {
  const [text, setText] = useState(fmtNum(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(fmtNum(value)); }, [value, focused]);

  const set = (v: number) => onChange(Math.max(min, Math.round(v * 100) / 100));

  return (
    <View style={st.stepper}>
      <Text style={st.stepLabel}>{label}</Text>
      <View style={st.stepRow}>
        <Tap onPress={() => set(value - step)} style={st.stepBtn} accessibilityLabel={`${label}: мінус ${fmtNum(step)}`}>
          <Icon name="minus" size={22} />
        </Tap>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            const n = parseNum(t);
            if (n !== null) onChange(decimal ? n : Math.round(n));
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          selectTextOnFocus
          style={st.stepValue}
          accessibilityLabel={label}
        />
        <Tap onPress={() => set(value + step)} style={st.stepBtn} accessibilityLabel={`${label}: плюс ${fmtNum(step)}`}>
          <Icon name="plus" size={22} />
        </Tap>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  done: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  titleBlock: { paddingHorizontal: 20, paddingTop: 4 },
  groupRow: { flexDirection: 'row', alignItems: 'center' },
  groupDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  groupName: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 40, lineHeight: 44, marginTop: 6 },
  sub: { color: colors.muted, fontSize: 15, lineHeight: 21, marginTop: 8 },

  prBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 14, padding: 14, borderRadius: radius.m,
    backgroundColor: alpha(colors.gold, 0.14), borderWidth: 1, borderColor: alpha(colors.gold, 0.5),
  },
  prBannerText: { color: colors.gold, fontSize: 15, fontWeight: '700', flex: 1 },

  table: { marginHorizontal: 16, marginTop: 16 },
  lastCard: { marginHorizontal: 16, marginTop: 16, padding: 16 },
  lastLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  lastSets: { color: colors.ink, fontFamily: fonts.display, fontSize: 30, lineHeight: 36, marginTop: 4 },
  lastMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  lastNote: { color: colors.muted, fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  verdict: { fontSize: 15, fontWeight: '700', marginTop: 8 },

  sug: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: radius.l, borderWidth: 1 },
  sugHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sugLabel: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  sugBig: { color: colors.ink, fontFamily: fonts.display, fontSize: 34, lineHeight: 40, marginTop: 4 },
  sugReason: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 },
  sugBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },

  thead: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 6 },
  th: { color: colors.faint, fontSize: 12, fontWeight: '600' },
  emptyRow: { color: colors.muted, fontSize: 15, padding: 12 },
  tr: {
    flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingHorizontal: 12,
    borderRadius: radius.m, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: colors.surface, marginBottom: 6,
  },
  idx: { width: 30, color: colors.faint, fontFamily: fonts.displaySemi, fontSize: 18 },
  setBig: { color: colors.ink, fontFamily: fonts.display, fontSize: 28 },
  setUnit: { fontSize: 16, color: colors.muted, fontFamily: fonts.displayMedium },
  times: { fontSize: 20, color: colors.faint, fontFamily: fonts.displayMedium },
  setGhost: { color: colors.muted, fontSize: 15 },
  prev: { width: 92, textAlign: 'right', color: colors.muted, fontFamily: fonts.displayMedium, fontSize: 18 },
  prTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 7, height: 22 },
  prTagText: { color: colors.bg, fontSize: 11, fontWeight: '800' },

  card: { marginHorizontal: 16, padding: 16 },
  noteInput: { color: colors.ink, fontSize: 15, lineHeight: 21, minHeight: 44, padding: 0, textAlignVertical: 'top' },
  histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  histDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  histDate: { color: colors.muted, fontSize: 13 },
  histSets: { color: colors.ink, fontFamily: fonts.displayMedium, fontSize: 19, marginTop: 2 },
  histBtn: { paddingHorizontal: 8, paddingVertical: 6 },

  pad: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 14, backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
  },
  padHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  padTitle: { color: colors.ink, fontFamily: fonts.displaySemi, fontSize: 20 },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  padRemove: { color: colors.muted, fontSize: 14 },
  padRow: { flexDirection: 'row', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  plates: { color: colors.muted, fontSize: 13, marginTop: 8 },
  stepper: { flex: 1 },
  stepLabel: { color: colors.muted, fontSize: 13, marginBottom: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.m, height: 64, borderWidth: 1, borderColor: colors.hair },
  stepBtn: { width: 50, height: 64, alignItems: 'center', justifyContent: 'center' },
  stepValue: {
    flex: 1, minWidth: 0, textAlign: 'center', color: colors.ink, fontFamily: fonts.display, fontSize: 34, padding: 0, height: 64,
  },
});

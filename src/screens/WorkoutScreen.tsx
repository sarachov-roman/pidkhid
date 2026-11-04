import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Button, Card, Chip, Delta, Header, SectionTitle, Tap } from '../components/ui';
import { SetsDelta } from '../components/WorkoutParts';
import { dayTemplates, extras, freeDay, templateById } from '../data/templates';
import { useRest } from '../rest';
import { useStore } from '../store';
import { alpha, colors, fonts, groupById, mix, radius } from '../theme';
import {
  countOf, dayTitle, fmtClock, fmtDuration, fmtInt, fmtNum, fmtSet, fmtSets, formatDay, formatDayLong, formatDayShort, markPRs,
  parseNum, relativeDay, suggestNext, toDateKey, volume, WorkSet, workSets,
} from '../utils';

type Row = { weight: number; reps: number; warm?: boolean; done: boolean };

/** Екран тренування: усі вправи дня на одній сторінці, цифри вже підставлені, галочка записує підхід */
export function WorkoutScreen({
  date,
  onBack,
  onOpenExercise,
  onPick,
  onSwap,
  onSummary,
}: {
  date: string;
  onBack: () => void;
  onOpenExercise: (exerciseId: string) => void;
  onPick: () => void;
  onSwap: (exerciseId: string) => void;
  onSummary: () => void;
}) {
  const {
    workoutOn, sessionsOn, startWorkout, toggleExtra, setWorkoutNote, deleteWorkout, planFor, finishWorkout, workouts, repeatLast,
  } = useStore();
  const rest = useRest();
  const insets = useSafeAreaInsets();
  const today = toDateKey();
  const workout = workoutOn(date);
  const t = templateById(workout?.typeId ?? 'free');
  const done = sessionsOn(date);
  const ids = planFor(date);
  const [choosingType, setChoosingType] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [now, setNow] = useState(Date.now());

  const live = !!workout?.startedAt && !workout.finishedAt && date === today;
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, [live]);

  const setsCount = done.reduce((n, s) => n + workSets(s.sets).length, 0);
  const vol = done.reduce((n, s) => n + volume(s.sets), 0);
  const elapsed = workout?.startedAt ? (workout.finishedAt ?? now) - workout.startedAt : 0;
  const prevSameType = workouts.find((w) => w.typeId === t.id && w.date < date);
  const finished = !!workout?.finishedAt;
  const canFinish = date === today && !finished && setsCount > 0;
  const doneIds = new Set(done.map((s) => s.exerciseId));

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Header
        onBack={onBack}
        title={formatDayShort(date)}
        right={done.length > 0 ? <Tap onPress={onSummary} hitSlop={10}><Text style={st.link}>Підсумок</Text></Tap> : null}
      />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}>
        <View style={st.head}>
          <Text style={st.title}>{dayTitle(date)}</Text>
          <Tap
            onPress={() => setChoosingType((v) => !v)}
            style={[st.typeBtn, { backgroundColor: mix(t.color, colors.surface, 0.16), borderColor: alpha(t.color, 0.4) }]}
            accessibilityRole="button"
            accessibilityLabel="Змінити тип тренування"
          >
            <View style={[st.typeDot, { backgroundColor: t.color }]} />
            <Text style={st.typeText} numberOfLines={1}>{t.id === 'free' ? t.name : `${t.short}: ${t.name}`}</Text>
            <Text style={st.typeChange}>{choosingType ? 'Закрити' : 'Змінити'}</Text>
          </Tap>
          {choosingType && (
            <Card style={st.typeList}>
              {[...dayTemplates, freeDay].map((x) => (
                <Tap
                  key={x.id}
                  onPress={() => { startWorkout(date, x.id); setChoosingType(false); }}
                  style={[st.typeOption, x.id === t.id && st.typeOptionActive]}
                >
                  <View style={[st.typeDot, { backgroundColor: x.color }]} />
                  <Text style={st.typeText}>{x.id === 'free' ? x.name : `${x.short}: ${x.name}`}</Text>
                </Tap>
              ))}
            </Card>
          )}

          <View style={st.stats}>
            <Stat icon="timer" value={elapsed > 60000 ? fmtDuration(elapsed) : '—'} label={finished ? 'тривалість' : 'час'} />
            <Stat icon="check" value={`${setsCount}`} label={setsCount === 1 ? 'підхід' : setsCount < 5 && setsCount > 0 ? 'підходи' : 'підходів'} />
            <Stat icon="layers" value={fmtInt(vol)} label="кг об'єму" />
          </View>
          {prevSameType && (
            <Text style={st.vs}>Минулого разу, {formatDay(prevSameType.date)}, було {countOf(sessionsOn(prevSameType.date).length, 'вправа', 'вправи', 'вправ')}.</Text>
          )}
        </View>

        {ids.length === 0 ? (
          <Card style={st.emptyCard}>
            <Text style={st.emptyTitle}>Додай першу вправу</Text>
            <Text style={st.emptyText}>
              Після вибору вправи одразу побачиш, що робив минулого й позаминулого разу, і підставиш вагу.
            </Text>
            <Button kind="primary" icon="plus" label="Додати вправу" color={t.color} onPress={onPick} style={{ marginTop: 14 }} />
            {prevSameType && sessionsOn(prevSameType.date).length > 0 && (
              <Button
                kind="ghost"
                icon="copy"
                label={`Ті самі, що ${formatDay(prevSameType.date)} (${countOf(sessionsOn(prevSameType.date).length, 'вправа', 'вправи', 'вправ')})`}
                onPress={() => repeatLast(date)}
                style={{ marginTop: 8 }}
              />
            )}
          </Card>
        ) : (
          <View style={st.cards}>
            {ids.map((id) => (
              <ExerciseCard
                key={`${date}:${id}`}
                exerciseId={id}
                date={date}
                finished={finished}
                onOpen={() => onOpenExercise(id)}
                onSwap={() => onSwap(id)}
              />
            ))}
          </View>
        )}

        {ids.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <Button kind="ghost" icon="plus" label="Додати вправу" onPress={onPick} style={{ height: 50 }} />
          </View>
        )}

        <SectionTitle hint="просто відміть, що робив">Додатково</SectionTitle>
        <View style={st.extras}>
          {extras.map((x) => {
            const on = workout?.extras?.includes(x.id) ?? false;
            return (
              <Tap
                key={x.id}
                onPress={() => toggleExtra(date, x.id)}
                style={[st.extra, on && st.extraOn]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={x.label}
              >
                <View style={[st.check, on && st.checkOn]}>{on ? <Icon name="check" size={14} color={colors.up} stroke={3.5} /> : null}</View>
                <Text style={[st.extraText, on && { color: colors.bg }]}>{x.label}</Text>
              </Tap>
            );
          })}
        </View>

        {workout && (
          <>
            <SectionTitle>Нотатка до дня</SectionTitle>
            <Card style={st.noteCard}>
              <TextInput
                value={workout.note ?? ''}
                onChangeText={(x) => setWorkoutNote(date, x)}
                placeholder="Самопочуття, сон, що змінити наступного разу"
                placeholderTextColor={colors.faint}
                multiline
                style={st.noteInput}
                accessibilityLabel="Нотатка до дня"
              />
            </Card>
          </>
        )}

        <View style={st.deleteBox}>
          {!confirmDelete ? (
            <Tap onPress={() => setConfirmDelete(true)} hitSlop={8}>
              <Text style={st.deleteLink}>Видалити це тренування</Text>
            </Tap>
          ) : (
            <View style={{ gap: 12 }}>
              <Text style={st.confirmText}>
                Видалити тренування за {formatDay(date)}
                {done.length ? ` разом з ${countOf(done.length, 'вправою', 'вправами', 'вправами')}` : ''}?
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button kind="danger" label="Видалити" onPress={() => { deleteWorkout(date); onBack(); }} style={{ flex: 1 }} />
                <Button kind="ghost" label="Скасувати" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {(canFinish || (finished && done.length > 0)) && (
        <View style={[st.dock, { paddingBottom: insets.bottom + 12 }]}>
          {canFinish ? (
            <Button
              label={`Завершити тренування (${doneIds.size} з ${ids.length})`}
              icon="check"
              color={t.color}
              onPress={() => {
                rest.stop();
                finishWorkout(date);
                onSummary();
              }}
            />
          ) : (
            <Button label="Підсумок тренування" icon="trophy" color={t.color} onPress={onSummary} />
          )}
        </View>
      )}
    </View>
  );
}

function Stat({ icon, value, label }: { icon: 'timer' | 'check' | 'layers'; value: string; label: string }) {
  return (
    <Card style={st.stat}>
      <Icon name={icon} size={15} color={colors.muted} />
      <Text style={st.statBig} numberOfLines={1}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </Card>
  );
}

/** Картка вправи: підходи з підставленими цифрами; галочка записує підхід і запускає відпочинок */
function ExerciseCard({
  exerciseId,
  date,
  finished,
  onOpen,
  onSwap,
}: {
  exerciseId: string;
  date: string;
  finished: boolean;
  onOpen: () => void;
  onSwap: () => void;
}) {
  const { exerciseById, historyOf, sessionsOn, saveSets, notes, removeExercise, draftOf, setDraft } = useStore();
  const rest = useRest();
  const ex = exerciseById(exerciseId);
  const today = toDateKey();
  const history = historyOf(exerciseId);
  const prev = history.find((h) => h.date < date);
  const past = history.filter((h) => h.date < date);
  const prevWork = prev ? workSets(prev.sets) : [];

  const [rows, setRowsState] = useState<Row[]>(() => {
    const saved = sessionsOn(date).find((s) => s.exerciseId === exerciseId)?.sets ?? [];
    // чернетка переживає виходи з екрана; вірна, поки кількість відмічених збігається із записаним
    const draft = draftOf(date, exerciseId);
    if (draft && draft.filter((r) => r.done).length === saved.length) return draft;
    const doneRows: Row[] = saved.map((s) => ({ weight: s.weight, reps: s.reps, warm: s.warm, done: true }));
    const savedWork = saved.filter((s) => !s.warm).length;
    // для минулих днів не підсовуємо нових підходів до вже записаного
    if (date < today && saved.length > 0) return doneRows;
    let planned: Row[] = prevWork.slice(savedWork).map((s) => ({ weight: s.weight, reps: s.reps, done: false }));
    if (!prevWork.length && saved.length === 0) {
      // першого разу цифр не вгадуємо: один порожній підхід, вагу вписуєш сам
      planned = [{ weight: 0, reps: 0, done: false }];
    }
    return [...doneRows, ...planned];
  });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const setRows = (next: Row[]) => {
    setRowsState(next);
    setDraft(date, exerciseId, next);
  };

  if (!ex) return null;
  const g = groupById(ex.group);
  const unit = ex.timed ? 'с' : 'повт';

  const persist = (rs: Row[]) =>
    saveSets(
      exerciseId,
      date,
      rs.filter((r) => r.done).map((r): WorkSet => (r.warm ? { weight: r.weight, reps: r.reps, warm: true } : { weight: r.weight, reps: r.reps })),
    );

  const toggle = (i: number) => {
    if (!rows[i].done && rows[i].reps <= 0) return; // порожній підхід не записуємо
    const next = rows.map((r, j) => (j === i ? { ...r, done: !r.done } : r));
    setRows(next);
    persist(next);
    if (next[i].done && date === today) rest.start();
  };
  const edit = (i: number, p: Partial<Row>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...p } : r));
    setRows(next);
    if (rows[i].done) persist(next);
  };
  const addRow = () => {
    const last = [...rows].reverse().find((r) => !r.warm);
    const base = last ?? { weight: 0, reps: 0 };
    setRows([...rows, { weight: base.weight, reps: base.reps, done: false }]);
  };
  const removeLast = () => {
    const next = rows.slice(0, -1);
    setRows(next);
    persist(next);
  };
  const addWarm = () => {
    const top = Math.max(0, ...rows.filter((r) => !r.warm).map((r) => r.weight));
    if (top <= 0) return;
    setRows([{ weight: Math.max(2.5, Math.round((top * 0.6) / 2.5) * 2.5), reps: 8, warm: true, done: false }, ...rows]);
  };

  const planned = rows.filter((r) => !r.done && !r.warm);
  const sug = prev ? suggestNext(prev.sets, ex.timed) : null;
  const showSug = !!sug && planned.length > 0 && planned.some((r) => r.weight !== sug.weight || r.reps !== sug.reps);
  const applySug = () => {
    if (!sug) return;
    setRows(rows.map((r) => (!r.done && !r.warm ? { ...r, weight: sug.weight, reps: sug.reps } : r)));
  };
  const prs = markPRs(rows.map((r) => ({ weight: r.weight, reps: r.reps, warm: r.warm || !r.done })), past);
  const doneCount = rows.filter((r) => r.done).length;
  const allDone = rows.length > 0 && doneCount === rows.length;
  let workIdx = -1;

  return (
    <Card style={[st.card, allDone && { borderColor: alpha(colors.up, 0.4) }]}>
      <Tap onPress={onOpen} style={st.cardHead} accessibilityRole="button" accessibilityLabel={`${ex.name}, подробиці`}>
        <View style={[st.plate, { backgroundColor: g.color }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.exName} numberOfLines={2}>{ex.name}</Text>
          {notes[exerciseId] ? <Text style={st.exNote} numberOfLines={2}>{notes[exerciseId]}</Text> : null}
        </View>
        {allDone ? <View style={st.doneTag}><Icon name="check" size={14} color={colors.bg} stroke={3.5} /></View> : <Icon name="right" size={18} color={colors.faint} />}
      </Tap>

      {past.length > 0 ? (
        <View style={st.hist}>
          {past.slice(0, 3).map((h, k) => (
            <View key={h.id} style={st.histRow}>
              <Text style={[st.histWhen, k === 0 && { color: colors.ink }]}>
                {k === 0 ? 'Минулого разу' : k === 1 ? 'Позаминулого' : 'Раніше'}
              </Text>
              <Text style={st.histDate}>{relativeDay(h.date)}</Text>
              <Text style={[st.histSets, k === 0 && { color: colors.ink }]} numberOfLines={2}>{fmtSets(h.sets, ex.timed)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={st.first}>Першого разу. Впиши вагу й повтори, далі я підкажу, що брати.</Text>
      )}

      {showSug && sug && (
        <Tap onPress={applySug} style={[st.goal, { borderColor: alpha(g.color, 0.5), backgroundColor: alpha(g.color, 0.1) }]} accessibilityRole="button">
          <Icon name="zap" size={16} color={g.color} fill={alpha(g.color, 0.3)} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.goalText}>Ціль: {fmtSet({ weight: sug.weight, reps: sug.reps }, ex.timed)}</Text>
            <Text style={st.goalWhy}>{sug.reason}</Text>
          </View>
          <Text style={st.goalBtn}>Взяти</Text>
        </Tap>
      )}

      <View style={st.colHead}>
        <Text style={[st.colText, { width: 24 }]}>#</Text>
        <Text style={[st.colText, { width: 80, textAlign: 'center' }]}>{ex.bodyweight ? '+КГ' : 'КГ'}</Text>
        <View style={{ width: 16 }} />
        <Text style={[st.colText, { width: 64, textAlign: 'center' }]}>{ex.timed ? 'СЕК' : 'ПОВТ'}</Text>
        <Text style={[st.colText, { flex: 1, textAlign: 'right', paddingRight: 8 }]}>БУЛО</Text>
        <View style={{ width: 44 }} />
      </View>

      {rows.map((r, i) => {
        if (!r.warm) workIdx++;
        const p = r.warm ? undefined : prevWork[workIdx];
        const pr = prs[i];
        return (
          <View key={i} style={[st.row, r.done && { backgroundColor: alpha(colors.up, 0.1) }]}>
            <Text style={[st.idx, r.warm && { color: colors.gold }]}>{r.warm ? 'Р' : workIdx + 1}</Text>
            <NumInput value={r.weight} decimal width={80} placeholder={ex.bodyweight ? 'тіло' : '0'} onChange={(v) => edit(i, { weight: v })} />
            <Text style={st.x}>×</Text>
            <NumInput value={r.reps} width={64} onChange={(v) => edit(i, { reps: Math.max(0, Math.round(v)) })} />
            <View style={st.ghost}>
              {r.done && p ? (
                <View style={{ alignItems: 'flex-end' }}>
                  {r.weight !== p.weight ? <Delta value={r.weight - p.weight} unit="кг" /> : <Delta value={r.reps - p.reps} unit={unit} />}
                </View>
              ) : p ? (
                <Text style={st.ghostText}>{fmtSet(p, ex.timed)}</Text>
              ) : null}
              {pr && (
                <View style={st.prTag}>
                  <Icon name="star" size={11} color={colors.bg} fill={colors.bg} />
                  <Text style={st.prTagText}>рекорд</Text>
                </View>
              )}
            </View>
            <Tap
              onPress={() => toggle(i)}
              style={[st.checkBtn, r.done && { backgroundColor: colors.up, borderColor: colors.up }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: r.done }}
              accessibilityLabel={`Підхід ${r.warm ? 'розминки' : workIdx + 1}: ${r.done ? 'зроблено' : 'відмітити'}`}
            >
              <Icon name="check" size={22} color={r.done ? colors.bg : colors.faint} stroke={3} />
            </Tap>
          </View>
        );
      })}

      {confirmRemove ? (
        <View style={st.confirmRow}>
          <Text style={st.confirmText}>{doneCount ? `Прибрати вправу й ${countOf(doneCount, 'підхід', 'підходи', 'підходів')}?` : 'Прибрати вправу з дня?'}</Text>
          <Tap onPress={() => removeExercise(date, exerciseId)} style={st.confirmBtn}><Text style={{ color: colors.down, fontWeight: '700' }}>Прибрати</Text></Tap>
          <Tap onPress={() => setConfirmRemove(false)} style={st.confirmBtn}><Text style={{ color: colors.ink }}>Ні</Text></Tap>
        </View>
      ) : (
        <View style={st.foot}>
          <Chip label="Підхід" icon="plus" onPress={addRow} />
          {!ex.timed && <Chip label="Розминка" onPress={addWarm} />}
          {rows.length > 0 && <Chip label="Мінус" icon="minus" onPress={removeLast} />}
          <View style={{ flex: 1 }} />
          {doneCount === 0 && !finished && (
            <Tap onPress={onSwap} hitSlop={8} style={st.iconBtn} accessibilityLabel="Замінити вправу"><Icon name="repeat" size={18} color={colors.muted} /></Tap>
          )}
          <Tap onPress={() => (doneCount || rows.length ? setConfirmRemove(true) : removeExercise(date, exerciseId))} hitSlop={8} style={st.iconBtn} accessibilityLabel="Прибрати вправу">
            <Icon name="trash" size={18} color={colors.muted} />
          </Tap>
        </View>
      )}
    </Card>
  );
}

/** Невелике числове поле в рядку підходу */
function NumInput({
  value, onChange, decimal, width, placeholder,
}: {
  value: number; onChange: (v: number) => void; decimal?: boolean; width: number; placeholder?: string;
}) {
  const [text, setText] = useState(value ? fmtNum(value) : '');
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(value ? fmtNum(value) : ''); }, [value, focused]);
  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        setText(t);
        const n = t.trim() === '' ? 0 : parseNum(t);
        if (n !== null) onChange(decimal ? n : Math.round(n));
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      style={[st.input, { width }]}
    />
  );
}

const st = StyleSheet.create({
  link: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  head: { paddingHorizontal: 20, paddingTop: 2 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 46, lineHeight: 52 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingHorizontal: 14, height: 50,
    borderRadius: radius.m, gap: 10, borderWidth: 1,
  },
  typeDot: { width: 12, height: 12, borderRadius: 6 },
  typeText: { color: colors.ink, fontSize: 16, fontWeight: '600', flex: 1 },
  typeChange: { color: colors.muted, fontSize: 14 },
  typeList: { marginTop: 6, overflow: 'hidden' },
  typeOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 48 },
  typeOptionActive: { backgroundColor: colors.surfaceHi },
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, minWidth: 0, paddingVertical: 11, paddingHorizontal: 12, gap: 2 },
  statBig: { color: colors.ink, fontFamily: fonts.display, fontSize: 24, lineHeight: 28 },
  statLabel: { color: colors.muted, fontSize: 12 },
  vs: { color: colors.muted, fontSize: 13, marginTop: 10 },
  emptyCard: { marginHorizontal: 16, marginTop: 18, padding: 18 },
  emptyTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  hist: { marginTop: 10, gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.m, backgroundColor: colors.surfaceHi },
  histRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  histWhen: { color: colors.muted, fontSize: 13, fontWeight: '700', width: 112 },
  histDate: { color: colors.faint, fontSize: 12, width: 84 },
  histSets: { color: colors.muted, fontFamily: fonts.displayMedium, fontSize: 16, flex: 1, minWidth: 140 },
  first: { color: colors.muted, fontSize: 13, marginTop: 10 },
  empty: { color: colors.muted, fontSize: 15, lineHeight: 22, paddingHorizontal: 20, marginTop: 20 },

  cards: { gap: 12, paddingHorizontal: 16, marginTop: 18 },
  card: { paddingVertical: 12, paddingHorizontal: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2, paddingRight: 2 },
  plate: { width: 5, alignSelf: 'stretch', borderRadius: 3, minHeight: 26 },
  exName: { color: colors.ink, fontFamily: fonts.displaySemi, fontSize: 21, lineHeight: 25 },
  exNote: { color: colors.muted, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  doneTag: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.up, alignItems: 'center', justifyContent: 'center' },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, padding: 10, borderRadius: radius.m, borderWidth: 1 },
  goalText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  goalWhy: { color: colors.muted, fontSize: 12, marginTop: 1 },
  goalBtn: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  colHead: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingHorizontal: 4 },
  colText: { color: colors.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderRadius: radius.m, paddingHorizontal: 4, marginTop: 4 },
  idx: { width: 24, color: colors.muted, fontFamily: fonts.displaySemi, fontSize: 17 },
  input: {
    height: 42, borderRadius: 10, backgroundColor: colors.surfaceHi, color: colors.ink, textAlign: 'center',
    fontFamily: fonts.display, fontSize: 23, padding: 0,
  },
  x: { width: 16, textAlign: 'center', color: colors.faint, fontSize: 16 },
  ghost: { flex: 1, minWidth: 0, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 8, gap: 3 },
  ghostText: { color: colors.muted, fontFamily: fonts.displayMedium, fontSize: 15 },
  prTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.gold, borderRadius: 7, paddingHorizontal: 6, height: 18 },
  prTagText: { color: colors.bg, fontSize: 10, fontWeight: '800' },
  checkBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center',
  },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  confirmText: { color: colors.ink, fontSize: 14, flex: 1, minWidth: 160 },
  confirmBtn: { paddingHorizontal: 10, paddingVertical: 8 },

  extras: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  extra: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: radius.m,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, minWidth: 150, flexGrow: 1,
  },
  extraOn: { backgroundColor: colors.up, borderColor: colors.up },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  checkOn: { borderColor: colors.bg, backgroundColor: colors.bg },
  extraText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  noteCard: { marginHorizontal: 16, padding: 14 },
  noteInput: { color: colors.ink, fontSize: 15, lineHeight: 21, minHeight: 44, padding: 0, textAlignVertical: 'top' },
  deleteBox: { marginTop: 32, paddingHorizontal: 20 },
  deleteLink: { color: colors.down, fontSize: 14 },
  dock: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
  },
});

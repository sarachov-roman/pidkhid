import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Ring } from '../components/Ring';
import { Card, SectionTitle, Tap } from '../components/ui';
import { useDayStats, useSuggestedType, WorkoutCard, workoutSummary } from '../components/WorkoutParts';
import { dayTemplates, freeDay, templateById } from '../data/templates';
import { useStore } from '../store';
import { alpha, colors, fonts, mix } from '../theme';
import { addDays, computePRs, countOf, fmtInt, fmtNum, formatDayLong, relativeDay, toDateKey, volume, weekStart } from '../utils';

export type Section = 'calendar' | 'progress' | 'program' | 'settings';

const monthsNom = ['січні', 'лютому', 'березні', 'квітні', 'травні', 'червні', 'липні', 'серпні', 'вересні', 'жовтні', 'листопаді', 'грудні'];
const weekLetters = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

/** Головна: що сьогодні, ціль тижня, коротка статистика і свіжі рекорди */
export function MainScreen({
  onOpenDay,
  onSummary,
  onSection,
  onOpenExercise,
}: {
  onOpenDay: (date: string) => void;
  onSummary: (date: string) => void;
  onSection: (s: Section) => void;
  onOpenExercise: (id: string) => void;
}) {
  const { workouts, sessions, startWorkout, resetAll, settings, exerciseById } = useStore();
  const insets = useSafeAreaInsets();
  const stats = useDayStats();
  const today = toDateKey();
  const todayW = workouts.find((w) => w.date === today);
  const suggestedId = useSuggestedType(today);
  const suggested = templateById(suggestedId);
  const demo = process.env.EXPO_PUBLIC_DEMO === '1';

  const now = new Date();
  const ws = weekStart(now);
  const weekDates = Array.from({ length: 7 }, (_, i) => toDateKey(addDays(ws, i)));
  const byDate = new Map(workouts.map((w) => [w.date, w]));
  const thisWeek = weekDates.filter((d) => byDate.has(d)).length;
  const goal = settings.weeklyGoal;

  const numbers = useMemo(() => {
    const monthKey = today.slice(0, 7);
    const month = workouts.filter((w) => w.date.startsWith(monthKey)).length;
    // тижні поспіль, коли було хоч одне тренування (поточний тиждень рахуємо, якщо вже був)
    let streak = 0;
    let cursor = weekStart(new Date());
    const has = (start: Date) => {
      const a = toDateKey(start);
      const b = toDateKey(addDays(start, 7));
      return workouts.some((w) => w.date >= a && w.date < b);
    };
    if (!has(cursor)) cursor = addDays(cursor, -7);
    while (has(cursor)) {
      streak++;
      cursor = addDays(cursor, -7);
    }
    const a = toDateKey(weekStart(new Date()));
    const lastA = toDateKey(addDays(weekStart(new Date()), -7));
    const vol = sessions.filter((s) => s.date >= a).reduce((n, s) => n + volume(s.sets), 0);
    const prevVol = sessions.filter((s) => s.date >= lastA && s.date < a).reduce((n, s) => n + volume(s.sets), 0);
    return { month, streak, vol, prevVol };
  }, [workouts, sessions, today]);

  const recentPRs = useMemo(() => {
    const cut = toDateKey(addDays(new Date(), -30));
    const seen = new Set<string>();
    return computePRs(sessions)
      .filter((p) => p.date >= cut)
      .filter((p) => (seen.has(p.exerciseId) ? false : (seen.add(p.exerciseId), true)))
      .slice(0, 4);
  }, [sessions]);

  const last = workouts.find((w) => w.date < today);

  const begin = (typeId: string) => {
    startWorkout(today, typeId);
    onOpenDay(today);
  };

  const heroT = todayW ? templateById(todayW.typeId) : suggested;
  const left = Math.max(0, goal - thisWeek);

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 40 }}>
      <View style={st.top}>
        <View>
          <Text style={st.greet}>Привіт</Text>
          <Text style={st.date}>{formatDayLong(today)}</Text>
        </View>
        <View style={st.streak} accessibilityLabel={`${numbers.streak} тижнів поспіль`}>
          <Icon name="flame" size={18} color={numbers.streak ? colors.gold : colors.faint} fill={numbers.streak ? alpha(colors.gold, 0.25) : 'none'} />
          <Text style={[st.streakText, !numbers.streak && { color: colors.faint }]}>{numbers.streak}</Text>
        </View>
      </View>
      {demo && workouts.length > 0 && (
        <Tap onPress={resetAll} hitSlop={8} style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <Text style={st.demo}>Тут приклад записів. Почати з нуля</Text>
        </Tap>
      )}

      {/* Головне: сьогоднішнє тренування */}
      <View style={[st.hero, { backgroundColor: mix(heroT.color, colors.surface, 0.17), borderColor: alpha(heroT.color, 0.4) }]}>
        <Text style={[st.heroKicker, { color: heroT.color }]}>
          {todayW?.finishedAt ? `Сьогодні виконано, ${heroT.short.toLowerCase()}` : todayW ? `Сьогодні, ${heroT.short.toLowerCase()}` : `За планом сьогодні, ${heroT.short.toLowerCase()}`}
        </Text>
        <Text style={st.heroTitle}>{heroT.name}</Text>
        <Text style={st.heroMeta}>
          {todayW
            ? workoutSummary(todayW, stats.get(today))
            : (() => {
                const prev = workouts.find((w) => w.typeId === suggestedId && w.date < today);
                return prev ? `Минулого разу ${relativeDay(prev.date)}: ${workoutSummary(prev, stats.get(prev.date)).toLowerCase()}` : 'Ще не було жодного разу';
              })()}
        </Text>
        <Tap
          onPress={() => (todayW?.finishedAt ? onSummary(today) : todayW ? onOpenDay(today) : begin(suggestedId))}
          style={[st.heroBtn, { backgroundColor: heroT.color }]}
          accessibilityRole="button"
        >
          <Text style={st.heroBtnText}>{todayW?.finishedAt ? 'Підсумок тренування' : todayW ? 'Продовжити тренування' : `Почати ${heroT.short.toLowerCase()}`}</Text>
          <Icon name="right" size={20} color={colors.bg} />
        </Tap>
        {!todayW && (
          <View style={st.otherRow}>
            <Text style={st.otherLabel}>Або інший:</Text>
            {[...dayTemplates.filter((t) => t.id !== suggestedId), freeDay].map((t) => (
              <Tap key={t.id} onPress={() => begin(t.id)} style={st.otherChip} accessibilityRole="button">
                <View style={[st.dot, { backgroundColor: t.color }]} />
                <Text style={st.otherText}>{t.id === 'free' ? 'Без плану' : t.short}</Text>
              </Tap>
            ))}
          </View>
        )}
      </View>

      {/* Тиждень: кільце цілі й дні */}
      <Card style={st.week}>
        <View style={st.goalRow}>
          <Ring size={74} stroke={8} progress={goal ? thisWeek / goal : 0} color={thisWeek >= goal ? colors.up : colors.gold}>
            <Text style={st.ringNum}>{thisWeek}<Text style={st.ringOf}>/{goal}</Text></Text>
          </Ring>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.goalTitle}>Цей тиждень</Text>
            <Text style={st.goalSub}>
              {thisWeek >= goal
                ? 'Ціль тижня виконано. Так тримати!'
                : `Лишилось ${countOf(left, 'тренування', 'тренування', 'тренувань')} до цілі`}
            </Text>
          </View>
        </View>
        <View style={st.weekDays}>
          {weekDates.map((d, i) => {
            const w = byDate.get(d);
            const t = w ? templateById(w.typeId) : null;
            const isToday = d === today;
            const future = d > today;
            return (
              <Tap
                key={d}
                onPress={() => (w ? onOpenDay(d) : onSection('calendar'))}
                style={st.weekDay}
                accessibilityLabel={`${weekLetters[i]}${t ? `: ${t.short}` : ''}`}
              >
                <Text style={[st.weekLetter, isToday && { color: colors.ink }]}>{weekLetters[i]}</Text>
                <View
                  style={[
                    st.weekDot,
                    t && { backgroundColor: t.color, borderColor: t.color },
                    isToday && !t && { borderColor: colors.ink },
                    future && !t && { opacity: 0.35 },
                  ]}
                >
                  {t ? (
                    t.id === 'free' ? <Icon name="check" size={16} color={colors.bg} stroke={3} /> : <Text style={[st.weekNum, { color: colors.bg }]}>{t.short.replace('День ', '')}</Text>
                  ) : (
                    <Text style={st.weekNum}>{Number(d.slice(8))}</Text>
                  )}
                </View>
              </Tap>
            );
          })}
        </View>
      </Card>

      {/* Свіжі рекорди */}
      {recentPRs.length > 0 && (
        <>
          <SectionTitle hint="за 30 днів">Нові рекорди</SectionTitle>
          <Card style={{ marginHorizontal: 16, overflow: 'hidden' }}>
            {recentPRs.map((p, i) => {
              const ex = exerciseById(p.exerciseId);
              if (!ex) return null;
              return (
                <Tap
                  key={p.exerciseId}
                  onPress={() => onOpenExercise(p.exerciseId)}
                  style={[st.prRow, i < recentPRs.length - 1 && st.prDivider]}
                  accessibilityRole="button"
                >
                  <View style={st.prIcon}><Icon name="trophy" size={18} color={colors.gold} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.prName} numberOfLines={1}>{ex.name}</Text>
                    <Text style={st.prMeta}>{relativeDay(p.date)}{p.kind === '1rm' ? ', розрахунковий максимум' : ''}</Text>
                  </View>
                  <Text style={st.prVal}>{fmtNum(Math.round(p.value * 2) / 2)} <Text style={st.prUnit}>кг</Text></Text>
                </Tap>
              );
            })}
          </Card>
        </>
      )}

      {last && (
        <>
          <SectionTitle>Останнє тренування</SectionTitle>
          <View style={{ paddingHorizontal: 16 }}>
            <WorkoutCard workout={last} onPress={() => onOpenDay(last.date)} />
          </View>
        </>
      )}

      {!last && !todayW && (
        <Text style={st.first}>
          Почни перше тренування кнопкою вгорі. Далі програма сама підказуватиме, який день за планом, що ти робив минулого разу і що спробувати цього разу.
        </Text>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  greet: { color: colors.ink, fontFamily: fonts.display, fontSize: 34, lineHeight: 38 },
  date: { color: colors.muted, fontSize: 15, marginTop: 2 },
  streak: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hair,
  },
  streakText: { color: colors.ink, fontFamily: fonts.display, fontSize: 20 },
  demo: { color: colors.muted, fontSize: 13, textDecorationLine: 'underline' },

  hero: { marginHorizontal: 16, marginTop: 20, padding: 22, borderRadius: 26, borderWidth: 1, overflow: 'hidden' },
  watermarkText: { position: 'absolute', right: 10, top: -22, fontFamily: fonts.display, fontSize: 210, lineHeight: 230 },
  watermark: { position: 'absolute', right: -10, top: 6 },
  heroKicker: { fontSize: 14, fontWeight: '700' },
  heroTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 40, lineHeight: 44, marginTop: 6 },
  heroMeta: { color: colors.muted, fontSize: 15, lineHeight: 21, marginTop: 8 },
  heroBtn: { marginTop: 20, height: 56, borderRadius: 16, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  heroBtnText: { color: colors.bg, fontSize: 17, fontWeight: '800' },
  otherRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 },
  otherLabel: { color: colors.muted, fontSize: 14, marginRight: 2 },
  otherChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7, height: 34, paddingHorizontal: 12, borderRadius: 17,
    borderWidth: 1, borderColor: colors.line, backgroundColor: 'rgba(0,0,0,0.12)',
  },
  otherText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  dot: { width: 9, height: 9, borderRadius: 5 },

  week: { marginHorizontal: 16, marginTop: 14, padding: 16 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringNum: { color: colors.ink, fontFamily: fonts.display, fontSize: 24 },
  ringOf: { color: colors.muted, fontSize: 15, fontFamily: fonts.displayMedium },
  goalTitle: { color: colors.ink, fontFamily: fonts.displaySemi, fontSize: 22 },
  goalSub: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 },
  weekDays: { flexDirection: 'row', marginTop: 16 },
  weekDay: { flex: 1, alignItems: 'center', gap: 8 },
  weekLetter: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  weekDot: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  weekNum: { color: colors.ink, fontFamily: fonts.displaySemi, fontSize: 16 },

  numbers: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 12, flexWrap: 'wrap' },
  num: { flex: 1, minWidth: 140, padding: 16 },
  numBig: { color: colors.ink, fontFamily: fonts.display, fontSize: 34, lineHeight: 38 },
  numLabel: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  numDelta: { fontSize: 13, fontWeight: '700', marginTop: 6 },

  prRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  prDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  prIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: alpha(colors.gold, 0.14), alignItems: 'center', justifyContent: 'center' },
  prName: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  prMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  prVal: { color: colors.ink, fontFamily: fonts.display, fontSize: 24 },
  prUnit: { color: colors.muted, fontSize: 14, fontFamily: fonts.displayMedium },
  first: { color: colors.muted, fontSize: 15, lineHeight: 22, paddingHorizontal: 20, marginTop: 24 },
});

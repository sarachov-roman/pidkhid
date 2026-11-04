export type WorkSet = { weight: number; reps: number; /** розминковий підхід: не рахується в рекордах і тоннажі */ warm?: boolean };

const pad = (n: number) => String(n).padStart(2, '0');

/** Локальна дата у форматі YYYY-MM-DD */
export function toDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Понеділок тижня, до якого належить дата */
export function weekStart(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (r.getDay() + 6) % 7; // пн = 0
  r.setDate(r.getDate() - day);
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const monthsGen = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];
const weekdays = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function formatDay(key: string): string {
  const d = fromDateKey(key);
  return `${d.getDate()} ${monthsGen[d.getMonth()]}`;
}

export function formatDayShort(key: string): string {
  const d = fromDateKey(key);
  return `${weekdays[d.getDay()]}, ${d.getDate()} ${monthsGen[d.getMonth()]}`;
}

export function relativeDay(key: string, today: string = toDateKey()): string {
  const diff = Math.round((fromDateKey(today).getTime() - fromDateKey(key).getTime()) / 86400000);
  if (diff === 0) return 'сьогодні';
  if (diff === 1) return 'вчора';
  if (diff < 7) return `${diff} ${plural(diff, 'день', 'дні', 'днів')} тому`;
  if (diff < 14) return 'тиждень тому';
  return formatDay(key);
}

export function weekRangeLabel(start: Date): string {
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${monthsGen[end.getMonth()]}`;
  }
  return `${start.getDate()} ${monthsGen[start.getMonth()]} – ${end.getDate()} ${monthsGen[end.getMonth()]}`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

/** 57.5 → "57,5"; 60 → "60" */
export function fmtNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(r).replace('.', ',');
}

/** 12840 → "12 840" */
export function fmtInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}

export function fmtSet(s: WorkSet, timed = false): string {
  const tail = timed ? `${s.reps}с` : `${s.reps}`;
  if (!s.weight) return tail;
  return `${fmtNum(s.weight)}×${tail}`;
}

/** Робочі підходи (без розминки) */
export const workSets = (sets: WorkSet[]): WorkSet[] => sets.filter((s) => !s.warm);

export function fmtSets(sets: WorkSet[], timed = false): string {
  const ws = workSets(sets);
  const list = ws.length ? ws : sets;
  // вправи з власною вагою: "10, 9, 8 повт"
  if (list.length && list.every((s) => !s.weight)) return `${list.map((s) => s.reps).join(', ')} ${timed ? 'с' : 'повт'}`;
  return list.map((s) => fmtSet(s, timed)).join(' / ');
}

/** Тоннаж; для вправ без ваги рахуємо повтори */
export function volume(sets: WorkSet[]): number {
  return workSets(sets).reduce((sum, s) => sum + (s.weight > 0 ? s.weight * s.reps : s.reps), 0);
}

export function topWeight(sets: WorkSet[]): number {
  return workSets(sets).reduce((m, s) => Math.max(m, s.weight), 0);
}

export function bestReps(sets: WorkSet[]): number {
  return workSets(sets).reduce((m, s) => Math.max(m, s.reps), 0);
}

/** Розрахунковий максимум на 1 повтор (формула Еплі) */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export function best1RM(sets: WorkSet[]): number {
  return workSets(sets).reduce((m, s) => Math.max(m, e1rm(s.weight, s.reps)), 0);
}

/** Млинці з одного боку грифа: 62,5 → [20, 10, 1.25] при грифі 20 кг */
export function platesPerSide(weight: number, bar = 20): number[] | null {
  let left = (weight - bar) / 2;
  if (left <= 0) return null;
  const out: number[] = [];
  for (const p of [25, 20, 15, 10, 5, 2.5, 1.25]) {
    while (left + 1e-9 >= p) {
      out.push(p);
      left -= p;
    }
  }
  return out.length ? out : null;
}

/** Що спробувати цього разу, щоб рухатися вперед (подвійна прогресія) */
export function suggestNext(prev: WorkSet[], timed = false): { weight: number; reps: number; reason: string } | null {
  const ws = workSets(prev);
  if (!ws.length) return null;
  const top = topWeight(ws);
  const atTop = ws.filter((s) => s.weight === top);
  const minReps = Math.min(...atTop.map((s) => s.reps));
  if (timed) return { weight: top, reps: minReps + 5, reason: 'Спробуй втриматися на 5 секунд довше' };
  if (top === 0) return { weight: 0, reps: minReps + 1, reason: 'Спробуй зробити на 1 повтор більше' };
  if (minReps >= 10 && atTop.length >= 2) {
    return { weight: top + 2.5, reps: 8, reason: `Усі підходи на 10+ повторів. Час додати 2,5 кг` };
  }
  return { weight: top, reps: minReps + 1, reason: `Та сама вага, але хоч на 1 повтор більше в слабшому підході` };
}

export type PRKind = 'weight' | '1rm';

/** Які підходи сьогодні побили колишній рекорд вправи (мітка на першому такому підході) */
export function markPRs(sets: WorkSet[], past: { sets: WorkSet[] }[]): (PRKind | null)[] {
  if (!past.length) return sets.map(() => null);
  let w = Math.max(...past.map((p) => topWeight(p.sets)));
  let r = Math.max(...past.map((p) => best1RM(p.sets)));
  return sets.map((s) => {
    if (s.warm || s.weight <= 0) return null;
    const e = e1rm(s.weight, s.reps);
    let kind: PRKind | null = null;
    if (s.weight > w) kind = 'weight';
    else if (e > r + 0.4) kind = '1rm';
    w = Math.max(w, s.weight);
    r = Math.max(r, e);
    return kind;
  });
}

export type PREvent = { exerciseId: string; date: string; kind: PRKind; value: number };

/** Усі рекорди за історію (від найновішого) */
export function computePRs(sessions: { exerciseId: string; date: string; sets: WorkSet[] }[]): PREvent[] {
  const by = new Map<string, typeof sessions>();
  for (const s of sessions) by.set(s.exerciseId, [...(by.get(s.exerciseId) ?? []), s]);
  const out: PREvent[] = [];
  for (const [exerciseId, list] of by) {
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let bw = 0;
    let br = 0;
    let seen = false;
    for (const s of sorted) {
      const w = topWeight(s.sets);
      const r = best1RM(s.sets);
      if (seen && w > 0) {
        if (w > bw) out.push({ exerciseId, date: s.date, kind: 'weight', value: w });
        else if (r > br + 0.4) out.push({ exerciseId, date: s.date, kind: '1rm', value: r });
      }
      bw = Math.max(bw, w);
      br = Math.max(br, r);
      seen = true;
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 3120000 → "52 хв", 4500000 → "1 год 15 хв" */
export function fmtDuration(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} год ${String(m % 60).padStart(2, '0')} хв` : `${m} хв`;
}

/** 83 → "1:23" */
export function fmtClock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function parseNum(text: string): number | null {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const weekdaysLong = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота'];

/** «вівторок, 3 листопада» */
export function formatDayLong(key: string): string {
  const d = fromDateKey(key);
  return `${weekdaysLong[d.getDay()]}, ${d.getDate()} ${monthsGen[d.getMonth()]}`;
}

/** «Сьогодні», «Вчора», «Завтра» або «Вівторок» */
export function dayTitle(key: string, today: string = toDateKey()): string {
  const diff = Math.round((fromDateKey(today).getTime() - fromDateKey(key).getTime()) / 86400000);
  if (diff === 0) return 'Сьогодні';
  if (diff === 1) return 'Вчора';
  if (diff === -1) return 'Завтра';
  const w = weekdaysLong[fromDateKey(key).getDay()];
  return w[0].toUpperCase() + w.slice(1);
}

export function shiftDate(key: string, days: number): string {
  return toDateKey(addDays(fromDateKey(key), days));
}

/** Скільки разів: «1 вправа», «3 вправи», «5 вправ» */
export function countOf(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`;
}

// Приклад історії для веб-превʼю (вмикається змінною EXPO_PUBLIC_DEMO=1).
// У звичайній збірці не використовується.
import type { Session } from '../store';
import { addDays, toDateKey, uid, weekStart } from '../utils';

type Plan = { id: string; base: number; step: number; reps: number[] };

const days: { day: number; items: Plan[] }[] = [
  {
    day: 0, // пн: верх грудей + ширина спини
    items: [
      { id: 'incline', base: 50, step: 2.5, reps: [10, 8, 8] },
      { id: 'lat-pulldown', base: 50, step: 2.5, reps: [10, 10, 9] },
      { id: 'db-row', base: 26, step: 2, reps: [10, 10, 8] },
      { id: 'rope-pushdown', base: 20, step: 2.5, reps: [12, 12, 10] },
      { id: 'ez-curl', base: 25, step: 2.5, reps: [10, 9, 8] },
      { id: 'lateral', base: 8, step: 1, reps: [15, 14, 12] },
      { id: 'hanging-raise', base: 0, step: 0, reps: [12, 10, 10] },
    ],
  },
  {
    day: 2, // ср: ноги + плечі
    items: [
      { id: 'squat', base: 70, step: 5, reps: [8, 8, 8] },
      { id: 'leg-press', base: 140, step: 10, reps: [12, 10, 10] },
      { id: 'leg-curl-seated', base: 40, step: 5, reps: [12, 12] },
      { id: 'ohp', base: 35, step: 2.5, reps: [8, 7, 6] },
      { id: 'lateral', base: 8, step: 1, reps: [15, 14, 12] },
      { id: 'reverse-pec', base: 30, step: 5, reps: [15, 12] },
      { id: 'hyperext', base: 0, step: 0, reps: [15, 15] },
    ],
  },
  {
    day: 4, // пт: низ грудей + глибина спини
    items: [
      { id: 'bench', base: 60, step: 2.5, reps: [8, 8, 7] },
      { id: 'bb-row', base: 50, step: 2.5, reps: [10, 10, 9] },
      { id: 'cable-row', base: 55, step: 5, reps: [12, 10] },
      { id: 'skull', base: 25, step: 2.5, reps: [10, 10, 8] },
      { id: 'hammer', base: 14, step: 2, reps: [10, 10] },
      { id: 'cable-lateral', base: 5, step: 1, reps: [15, 12] },
      { id: 'neck-flex', base: 10, step: 2.5, reps: [15, 15] },
    ],
  },
];

export function demoSessions(): Session[] {
  const monday = weekStart(new Date());
  const out: Session[] = [];
  for (let w = 5; w >= 1; w--) {
    const ws = addDays(monday, -7 * w);
    const k = 5 - w;
    for (const d of days) {
      for (const p of d.items) {
        const weight = p.base + p.step * Math.floor(k * 0.8);
        const reps = p.reps.map((r) => (p.base === 0 ? r + Math.floor(k / 2) : r));
        out.push({ id: uid(), exerciseId: p.id, date: toDateKey(addDays(ws, d.day)), sets: reps.map((r) => ({ weight, reps: r })) });
      }
    }
  }
  return out;
}

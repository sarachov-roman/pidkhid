import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { demoSessions } from './data/demo';
import { Exercise, presetExercises } from './data/exercises';
import { guessTemplate, templateById } from './data/templates';
import type { GroupId } from './theme';
import { toDateKey, uid, WorkSet } from './utils';

export type Session = {
  id: string;
  exerciseId: string;
  date: string; // YYYY-MM-DD
  sets: WorkSet[];
};

/** Тренування: один на дату. typeId: 'd1' | 'd2' | 'd3' | 'free' */
export type Workout = {
  id: string;
  date: string;
  typeId: string;
  /** Відмічене «Додатково»: 'abs' | 'neck' | 'forearms' | 'lowerback' */
  extras?: string[];
  /** Нотатка до дня */
  note?: string;
  /** Час першого й останнього запису в цей день (мс), для тривалості */
  startedAt?: number;
  endedAt?: number;
  /** Які вправи заплановані на день, у порядку виконання */
  plan?: string[];
  /** Коли натиснув «Завершити тренування» */
  finishedAt?: number;
  /** Чернетки підходів за id вправи: що вписано, але ще не відмічено галочкою (щоб не зникало при переходах) */
  drafts?: Record<string, DraftRow[]>;
};

export type DraftRow = { weight: number; reps: number; warm?: boolean; done: boolean };

export type BodyWeight = { date: string; kg: number };

export type Settings = {
  /** Відпочинок між підходами, секунди */
  restSec: number;
  /** Скільки тренувань на тиждень */
  weeklyGoal: number;
};

export type Data = {
  version: 2;
  /** Коли дані востаннє змінювались (мс); потрібно для синхронізації між пристроями */
  updatedAt?: number;
  customExercises: Exercise[];
  sessions: Session[];
  workouts: Workout[];
  bodyweight: BodyWeight[];
  /** Нотатки до вправ (налаштування тренажера тощо) за id вправи */
  notes: Record<string, string>;
  settings: Settings;
};

// Ключ лишається тим самим, щоб старі записи підхопилися
const KEY = 'pidkhid:data:v1';
const defaultSettings: Settings = { restSec: 90, weeklyGoal: 3 };
const empty: Data = {
  version: 2, customExercises: [], sessions: [], workouts: [], bodyweight: [], notes: {}, settings: defaultSettings,
};

/** Кожна дата з підходами має отримати тренування; тип вгадуємо за вправами */
function withWorkouts(d: Data): Data {
  const known = new Set(d.workouts.map((w) => w.date));
  const missing = [...new Set(d.sessions.map((s) => s.date))].filter((date) => !known.has(date));
  if (missing.length === 0) return d;
  const added = missing.map((date) => ({
    id: uid(),
    date,
    typeId: guessTemplate(d.sessions.filter((s) => s.date === date).map((s) => s.exerciseId)),
  }));
  return { ...d, workouts: [...d.workouts, ...added] };
}

function omit<T>(o: Record<string, T> | undefined, key: string): Record<string, T> | undefined {
  if (!o || !(key in o)) return o;
  const { [key]: _, ...rest } = o;
  return rest;
}

export function migrate(raw: any): Data {
  const st = raw?.settings ?? {};
  const d: Data = {
    version: 2,
    updatedAt: Number.isFinite(raw?.updatedAt) ? raw.updatedAt : undefined,
    customExercises: Array.isArray(raw?.customExercises) ? raw.customExercises : [],
    sessions: Array.isArray(raw?.sessions) ? raw.sessions : [],
    workouts: Array.isArray(raw?.workouts) ? raw.workouts : [],
    bodyweight: Array.isArray(raw?.bodyweight) ? raw.bodyweight : [],
    notes: raw?.notes && typeof raw.notes === 'object' ? raw.notes : {},
    settings: {
      restSec: Number.isFinite(st.restSec) ? st.restSec : defaultSettings.restSec,
      weeklyGoal: Number.isFinite(st.weeklyGoal) ? st.weeklyGoal : defaultSettings.weeklyGoal,
    },
  };
  return withWorkouts(d);
}

/** Вправи, які були в останнє тренування такого ж типу (для кнопки «Як минулого разу») */
function lastPlanOf(d: Data, typeId: string, date: string): string[] {
  const prev = [...d.workouts]
    .filter((w) => w.typeId === typeId && w.date < date && d.sessions.some((s) => s.date === w.date))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return prev ? d.sessions.filter((s) => s.date === prev.date).map((s) => s.exerciseId) : [];
}

/** План дня: збережений, а якщо його нема, то вже зроблене або типовий для цього дня */
function planOf(d: Data, w: Workout): string[] {
  const done = d.sessions.filter((s) => s.date === w.date).map((s) => s.exerciseId);
  const base = w.plan ?? [];
  return [...base, ...done.filter((id) => !base.includes(id))];
}

type Store = {
  ready: boolean;
  exercises: Exercise[];
  sessions: Session[];
  /** Від найновішого */
  workouts: Workout[];
  bodyweight: BodyWeight[];
  notes: Record<string, string>;
  settings: Settings;
  exerciseById: (id: string) => Exercise | undefined;
  workoutOn: (date: string) => Workout | undefined;
  /** Підходи за дату в порядку, в якому записував */
  sessionsOn: (date: string) => Session[];
  /** Усі записи вправи, від найновішого */
  historyOf: (exerciseId: string) => Session[];
  /** Почати тренування на дату (або змінити тип, якщо вже є) */
  startWorkout: (date: string, typeId: string) => void;
  /** Відмітити або зняти «Додатково» (прес, шия, передпліччя, поперек) */
  toggleExtra: (date: string, extraId: string) => void;
  setWorkoutNote: (date: string, note: string) => void;
  /** Вправи дня у порядку виконання (заплановані й уже зроблені) */
  planFor: (date: string) => string[];
  addToPlan: (date: string, exerciseId: string) => void;
  /** Додає вправи з останнього такого ж дня (за бажанням, не автоматично) */
  repeatLast: (date: string) => void;
  draftOf: (date: string, exerciseId: string) => DraftRow[] | undefined;
  setDraft: (date: string, exerciseId: string, rows: DraftRow[]) => void;
  /** Прибрати вправу з дня разом з її підходами */
  removeExercise: (date: string, exerciseId: string) => void;
  swapExercise: (date: string, oldId: string, newId: string) => void;
  finishWorkout: (date: string) => void;
  reopenWorkout: (date: string) => void;
  /** Видалити тренування разом з усіма підходами цього дня */
  deleteWorkout: (date: string) => void;
  /** Записати підходи вправи на дату (порожній список прибирає вправу з дня) */
  saveSets: (exerciseId: string, date: string, sets: WorkSet[]) => void;
  deleteSession: (id: string) => void;
  addExercise: (name: string, group: GroupId) => Exercise;
  setNote: (exerciseId: string, note: string) => void;
  setBodyweight: (date: string, kg: number) => void;
  removeBodyweight: (date: string) => void;
  setSettings: (p: Partial<Settings>) => void;
  /** Усі дані одним текстом (для копії) */
  /** Поточні дані та їх мітка часу (для синхронізації) */
  getData: () => Data;
  /** Підставити дані з іншого пристрою без нової мітки часу */
  applyRemote: (d: Data) => void;
  updatedAt: number;
  exportJson: () => string;
  /** Замінює всі записи даними з копії; false, якщо файл не схожий на копію */
  importJson: (text: string) => boolean;
  /** Стерти всі записи */
  resetAll: () => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setRaw] = useState<Data>(empty);
  // кожна зміна від користувача ставить мітку часу; вона потрібна синхронізації
  const setData = useCallback((f: Data | ((d: Data) => Data)) => {
    setRaw((d) => {
      const n = typeof f === 'function' ? f(d) : f;
      return n === d ? d : { ...n, updatedAt: Math.max(Date.now(), (d.updatedAt ?? 0) + 1) };
    });
  }, []);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          setRaw(migrate(JSON.parse(raw)));
        } else if (process.env.EXPO_PUBLIC_DEMO === '1') {
          setRaw(migrate({ sessions: demoSessions() }));
        }
      } catch {
        // пошкоджені дані: стартуємо з чистого аркуша, щоб застосунок не падав
      }
      loaded.current = true;
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {});
  }, [data]);

  const exercises = useMemo(() => [...presetExercises, ...data.customExercises], [data.customExercises]);
  const exerciseById = useCallback((id: string) => exercises.find((e) => e.id === id), [exercises]);

  const workouts = useMemo(
    () => [...data.workouts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [data.workouts],
  );
  const bodyweight = useMemo(
    () => [...data.bodyweight].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [data.bodyweight],
  );
  const workoutOn = useCallback((date: string) => data.workouts.find((w) => w.date === date), [data.workouts]);
  const sessionsOn = useCallback((date: string) => data.sessions.filter((s) => s.date === date), [data.sessions]);

  const historyOf = useCallback(
    (exerciseId: string) =>
      data.sessions
        .filter((s) => s.exerciseId === exerciseId)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [data.sessions],
  );

  const patchWorkout = (d: Data, date: string, p: (w: Workout) => Workout): Data => {
    const w = d.workouts.find((x) => x.date === date);
    return w ? { ...d, workouts: d.workouts.map((x) => (x === w ? p(x) : x)) } : d;
  };

  const startWorkout = useCallback((date: string, typeId: string) => {
    setData((d) => {
      const existing = d.workouts.find((w) => w.date === date);
      if (existing) {
        const hasDone = d.sessions.some((s) => s.date === date);
        const plan = existing.plan;
        return { ...d, workouts: d.workouts.map((w) => (w === existing ? { ...w, typeId, plan } : w)) };
      }
      return { ...d, workouts: [...d.workouts, { id: uid(), date, typeId, plan: [] }] };
    });
  }, []);

  const planFor = useCallback(
    (date: string) => {
      const w = data.workouts.find((x) => x.date === date);
      return w ? planOf(data, w) : data.sessions.filter((s) => s.date === date).map((s) => s.exerciseId);
    },
    [data],
  );

  const addToPlan = useCallback((date: string, exerciseId: string) => {
    setData((d) =>
      patchWorkout(d, date, (w) => {
        const cur = planOf(d, w);
        return { ...w, plan: cur.includes(exerciseId) ? cur : [...cur, exerciseId] };
      }),
    );
  }, []);

  const draftOf = useCallback(
    (date: string, exerciseId: string) => data.workouts.find((w) => w.date === date)?.drafts?.[exerciseId],
    [data.workouts],
  );

  const setDraft = useCallback((date: string, exerciseId: string, rows: DraftRow[]) => {
    setData((d) => patchWorkout(d, date, (w) => ({ ...w, drafts: { ...w.drafts, [exerciseId]: rows } })));
  }, []);

  const repeatLast = useCallback((date: string) => {
    setData((d) =>
      patchWorkout(d, date, (w) => {
        const cur = planOf(d, w);
        const add = lastPlanOf(d, w.typeId, date).filter((id) => !cur.includes(id));
        return { ...w, plan: [...cur, ...add] };
      }),
    );
  }, []);

  const removeExercise = useCallback((date: string, exerciseId: string) => {
    setData((d) => {
      const next = patchWorkout(d, date, (w) => ({ ...w, plan: planOf(d, w).filter((id) => id !== exerciseId), drafts: omit(w.drafts, exerciseId) }));
      return { ...next, sessions: next.sessions.filter((s) => !(s.date === date && s.exerciseId === exerciseId)) };
    });
  }, []);

  const swapExercise = useCallback((date: string, oldId: string, newId: string) => {
    setData((d) => {
      const next = patchWorkout(d, date, (w) => {
        const cur = planOf(d, w).filter((id) => id !== newId);
        return { ...w, plan: cur.map((id) => (id === oldId ? newId : id)), drafts: omit(w.drafts, oldId) };
      });
      return { ...next, sessions: next.sessions.filter((s) => !(s.date === date && s.exerciseId === oldId)) };
    });
  }, []);

  const finishWorkout = useCallback((date: string) => {
    setData((d) => patchWorkout(d, date, (w) => ({ ...w, finishedAt: Date.now() })));
  }, []);

  const reopenWorkout = useCallback((date: string) => {
    setData((d) => patchWorkout(d, date, (w) => ({ ...w, finishedAt: undefined })));
  }, []);

  const toggleExtra = useCallback((date: string, extraId: string) => {
    setData((d) =>
      patchWorkout(d, date, (w) => {
        const cur = w.extras ?? [];
        return { ...w, extras: cur.includes(extraId) ? cur.filter((x) => x !== extraId) : [...cur, extraId] };
      }),
    );
  }, []);

  const setWorkoutNote = useCallback((date: string, note: string) => {
    setData((d) => patchWorkout(d, date, (w) => ({ ...w, note })));
  }, []);

  const deleteWorkout = useCallback((date: string) => {
    setData((d) => ({
      ...d,
      workouts: d.workouts.filter((w) => w.date !== date),
      sessions: d.sessions.filter((s) => s.date !== date),
    }));
  }, []);

  const saveSets = useCallback((exerciseId: string, date: string, sets: WorkSet[]) => {
    setData((d) => {
      const existing = d.sessions.find((s) => s.exerciseId === exerciseId && s.date === date);
      let sessions: Session[];
      if (sets.length === 0) sessions = d.sessions.filter((s) => s !== existing);
      // правка вже записаної вправи лишає її на своєму місці, щоб зберігся порядок виконання
      else if (existing) sessions = d.sessions.map((s) => (s === existing ? { ...s, sets } : s));
      else sessions = [...d.sessions, { id: uid(), exerciseId, date, sets }];
      let next = withWorkouts({ ...d, sessions });
      // тривалість рахуємо лише для записів «наживо», сьогодні
      if (sets.length && date === toDateKey()) {
        const now = Date.now();
        next = patchWorkout(next, date, (w) => ({ ...w, startedAt: w.startedAt ?? now, endedAt: now }));
      }
      return next;
    });
  }, []);

  const deleteSession = useCallback((id: string) => {
    setData((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) }));
  }, []);

  const addExercise = useCallback((name: string, group: GroupId) => {
    const ex: Exercise = { id: 'c-' + uid(), name: name.trim(), group, custom: true };
    setData((d) => ({ ...d, customExercises: [...d.customExercises, ex] }));
    return ex;
  }, []);

  const setNote = useCallback((exerciseId: string, note: string) => {
    setData((d) => {
      const notes = { ...d.notes };
      if (note.trim()) notes[exerciseId] = note;
      else delete notes[exerciseId];
      return { ...d, notes };
    });
  }, []);

  const setBodyweight = useCallback((date: string, kg: number) => {
    setData((d) => ({ ...d, bodyweight: [...d.bodyweight.filter((b) => b.date !== date), { date, kg }] }));
  }, []);

  const removeBodyweight = useCallback((date: string) => {
    setData((d) => ({ ...d, bodyweight: d.bodyweight.filter((b) => b.date !== date) }));
  }, []);

  const setSettings = useCallback((p: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...p } }));
  }, []);

  const getData = useCallback(() => latest.current, []);
  const applyRemote = useCallback((d: Data) => setRaw(migrate(d)), []);

  const exportJson = useCallback(() => JSON.stringify(latest.current, null, 1), []);

  const importJson = useCallback((text: string) => {
    try {
      const raw = JSON.parse(text);
      if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sessions)) return false;
      setData(migrate(raw));
      return true;
    } catch {
      return false;
    }
  }, []);

  const resetAll = useCallback(() => setData(empty), []);

  const value = useMemo<Store>(
    () => ({
      ready, exercises, sessions: data.sessions, workouts, bodyweight, notes: data.notes, settings: data.settings,
      exerciseById, workoutOn, sessionsOn, historyOf,
      startWorkout, toggleExtra, setWorkoutNote, planFor, addToPlan, repeatLast, draftOf, setDraft, removeExercise, swapExercise, finishWorkout, reopenWorkout,
      deleteWorkout, saveSets, deleteSession, addExercise,
      setNote, setBodyweight, removeBodyweight, setSettings, exportJson, importJson, resetAll, getData, applyRemote,
      updatedAt: data.updatedAt ?? 0,
    }),
    [ready, exercises, data.sessions, data.notes, data.settings, workouts, bodyweight, exerciseById, workoutOn, sessionsOn,
      historyOf, startWorkout, toggleExtra, setWorkoutNote, planFor, addToPlan, repeatLast, draftOf, setDraft, removeExercise, swapExercise, finishWorkout, reopenWorkout,
      deleteWorkout, saveSets, deleteSession, addExercise,
      setNote, setBodyweight, removeBodyweight, setSettings, exportJson, importJson, resetAll, getData, applyRemote, data.updatedAt],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore поза StoreProvider');
  return s;
}

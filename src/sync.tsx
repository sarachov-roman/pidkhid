import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Data, migrate, useStore } from './store';

/**
 * Синхронізація з приватним репозиторієм GitHub.
 * Дані лежать у файлі data.json; токен зберігається лише на цьому пристрої.
 * Нічого не губимо: при розбіжності дані двох пристроїв зливаються, а перед заміною локальних зберігається запасна копія.
 */

const CFG_KEY = 'pidkhid:sync:v1';
const BACKUP_KEY = 'pidkhid:backup:before-sync';
const FILE = 'data.json';

type Cfg = { repo: string; token: string; syncedAt: number };
export type SyncStatus =
  | { state: 'off' }
  | { state: 'idle' | 'syncing'; at?: number }
  | { state: 'ok'; at: number }
  | { state: 'error'; message: string };

type Api = {
  connected: boolean;
  repo: string;
  status: SyncStatus;
  connect: (repo: string, token: string) => Promise<{ ok: boolean; message?: string }>;
  disconnect: () => void;
  syncNow: () => Promise<void>;
};

const Ctx = createContext<Api | null>(null);

const enc = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const dec = (b64: string) => {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

class GhError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function gh(cfg: { repo: string; token: string }, method: string, body?: unknown) {
  const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${FILE}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

function explain(e: unknown): string {
  if (e instanceof GhError) {
    if (e.status === 401) return 'GitHub не прийняв токен. Створи новий і встав ще раз.';
    if (e.status === 403) return 'Токен не має права писати в цей репозиторій (потрібен Contents: Read and write).';
    if (e.status === 404) return 'Репозиторій не знайдено або токен не бачить його. Перевір назву й доступ токена.';
    return `GitHub відповів помилкою ${e.status}.`;
  }
  return 'Немає зв’язку з GitHub. Дані збережені на пристрої, синхронізація повториться пізніше.';
}

/** Злиття даних двох пристроїв: нічого не втрачаємо, при збігу ключа перемагає свіжіша сторона */
export function mergeData(a: Data, b: Data): Data {
  const newer = (a.updatedAt ?? 0) >= (b.updatedAt ?? 0) ? a : b;
  const older = newer === a ? b : a;
  const byKey = <T,>(list: T[], key: (x: T) => string) => new Map(list.map((x) => [key(x), x]));
  const union = <T,>(o: T[], n: T[], key: (x: T) => string) => [...new Map([...byKey(o, key), ...byKey(n, key)]).values()];
  return migrate({
    ...newer,
    customExercises: union(older.customExercises, newer.customExercises, (x) => x.id),
    sessions: union(older.sessions, newer.sessions, (x) => `${x.exerciseId}|${x.date}`),
    workouts: union(older.workouts, newer.workouts, (x) => x.date),
    bodyweight: union(older.bodyweight, newer.bodyweight, (x) => x.date),
    notes: { ...older.notes, ...newer.notes },
    updatedAt: Math.max(a.updatedAt ?? 0, b.updatedAt ?? 0) + 1,
  });
}

const hasContent = (d: Data) => d.sessions.length + d.workouts.length + d.bodyweight.length + d.customExercises.length > 0;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { ready, getData, applyRemote, updatedAt } = useStore();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [status, setStatus] = useState<SyncStatus>({ state: 'off' });
  const cfgRef = useRef<Cfg | null>(null);
  const busy = useRef(false);
  const again = useRef(false);
  cfgRef.current = cfg;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CFG_KEY);
        if (raw) {
          const c = JSON.parse(raw);
          if (c?.repo && c?.token) {
            setCfg({ repo: c.repo, token: c.token, syncedAt: Number(c.syncedAt) || 0 });
            setStatus({ state: 'idle' });
          }
        }
      } catch {
        // без налаштувань синхронізація просто вимкнена
      }
      setCfgLoaded(true);
    })();
  }, []);

  const saveCfg = useCallback(async (c: Cfg | null) => {
    cfgRef.current = c;
    setCfg(c);
    try {
      if (c) await AsyncStorage.setItem(CFG_KEY, JSON.stringify(c));
      else await AsyncStorage.removeItem(CFG_KEY);
    } catch {
      // нема куди зберегти: працюватиме до закриття
    }
  }, []);

  const run = useCallback(async (): Promise<void> => {
    const c = cfgRef.current;
    if (!c) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    setStatus((s) => ({ state: 'syncing', at: s.state === 'ok' ? s.at : undefined }));
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const local = getData();
        const res = await gh(c, 'GET');
        let sha: string | undefined;
        let remote: Data | null = null;
        if (res.status === 200) {
          const j = await res.json();
          sha = j.sha;
          // великі файли GitHub віддає без content; наші дані малі
          remote = migrate(JSON.parse(dec(j.content)));
        } else if (res.status !== 404) {
          throw new GhError(res.status, 'get');
        }

        const lu = local.updatedAt ?? 0;
        const ru = remote?.updatedAt ?? 0;
        const localChanged = lu > c.syncedAt;
        const remoteChanged = !!remote && ru > c.syncedAt;
        let result: Data = local;
        let push = false;

        if (!remote) {
          push = true;
        } else if (!localChanged && !hasContent(local) && hasContent(remote)) {
          // порожній пристрій і в репозиторії є записи (у старих записів може не бути мітки часу)
          result = remote;
        } else if (!remoteChanged && hasContent(local) && !hasContent(remote)) {
          push = true;
        } else if (remoteChanged && !localChanged) {
          result = remote;
        } else if (remoteChanged && localChanged) {
          result = mergeData(local, remote);
          push = true;
        } else if (localChanged) {
          push = true;
        }

        if (result !== local) {
          try {
            await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify(local));
          } catch {
            // запасна копія необов'язкова: у репозиторії є історія
          }
          applyRemote(result);
        }

        if (push) {
          const put = await gh(c, 'PUT', {
            message: `Підхід: ${new Date().toISOString()}`,
            content: enc(JSON.stringify(result)),
            ...(sha ? { sha } : {}),
          });
          if (put.status === 409 || put.status === 422) continue; // хтось встиг записати: беремо свіже й зливаємо
          if (!put.ok) throw new GhError(put.status, 'put');
        }
        await saveCfg({ ...c, syncedAt: result.updatedAt ?? Date.now() });
        setStatus({ state: 'ok', at: Date.now() });
        break;
      }
    } catch (e) {
      setStatus({ state: 'error', message: explain(e) });
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        setTimeout(() => void run(), 300);
      }
    }
  }, [getData, applyRemote, saveCfg]);

  // при запуску й коли повертаєшся в програму
  useEffect(() => {
    if (!ready || !cfgLoaded || !cfg) return;
    void run();
  }, [ready, cfgLoaded, !!cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [run]);

  // після кожної зміни, з паузою, щоб не слати на кожну цифру
  useEffect(() => {
    if (!ready || !cfg || updatedAt <= cfg.syncedAt) return;
    const t = setTimeout(() => void run(), 3500);
    return () => clearTimeout(t);
  }, [updatedAt, ready, cfg, run]);

  const connect = useCallback(
    async (repo: string, token: string) => {
      const r = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
      const t = token.trim();
      if (!/^[\w.-]+\/[\w.-]+$/.test(r)) return { ok: false, message: 'Назва репозиторію має вигляд логін/pidkhid-data.' };
      if (!t) return { ok: false, message: 'Встав токен.' };
      try {
        const res = await gh({ repo: r, token: t }, 'GET');
        if (res.status !== 200 && res.status !== 404) throw new GhError(res.status, 'get');
      } catch (e) {
        return { ok: false, message: explain(e) };
      }
      await saveCfg({ repo: r, token: t, syncedAt: 0 });
      setStatus({ state: 'idle' });
      setTimeout(() => void run(), 50);
      return { ok: true };
    },
    [saveCfg, run],
  );

  const disconnect = useCallback(() => {
    void saveCfg(null);
    setStatus({ state: 'off' });
  }, [saveCfg]);

  const value = useMemo<Api>(
    () => ({ connected: !!cfg, repo: cfg?.repo ?? '', status, connect, disconnect, syncNow: run }),
    [cfg, status, connect, disconnect, run],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSync(): Api {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSync поза SyncProvider');
  return s;
}

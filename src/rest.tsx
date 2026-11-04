import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, Vibration, View } from 'react-native';
import { Icon } from './components/Icon';
import { Tap } from './components/ui';
import { useStore } from './store';
import { colors, fonts } from './theme';
import { fmtClock } from './utils';

type Timer = { endsAt: number; total: number } | null;
type Rest = {
  timer: Timer;
  now: number;
  done: boolean;
  /** Запустити відпочинок (за замовчуванням з налаштувань) */
  start: (sec?: number) => void;
  add: (sec: number) => void;
  stop: () => void;
};

const Ctx = createContext<Rest>({ timer: null, now: 0, done: false, start: () => {}, add: () => {}, stop: () => {} });
export const useRest = () => useContext(Ctx);

/** Сигнал наприкінці відпочинку: звук у браузері, вібрація на телефоні */
function alertEnd() {
  try {
    if (Platform.OS === 'web') {
      const w = window as any;
      const AC = w.AudioContext || w.webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        [0, 0.24].forEach((t) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = 880;
          o.connect(g);
          g.connect(ctx.destination);
          const at = ctx.currentTime + t;
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
          o.start(at);
          o.stop(at + 0.22);
        });
      }
      w.navigator?.vibrate?.([200, 100, 200]);
    } else {
      Vibration.vibrate([0, 250, 120, 250]);
    }
  } catch {
    // звук необов'язковий
  }
}

export function RestProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useStore();
  const [timer, setTimer] = useState<Timer>(null);
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState(false);

  const start = useCallback(
    (sec?: number) => {
      const s = sec ?? settings.restSec;
      const t = Date.now();
      setDone(false);
      setNow(t);
      setTimer({ endsAt: t + s * 1000, total: s });
    },
    [settings.restSec],
  );
  const add = useCallback((sec: number) => {
    setDone(false);
    setTimer((p) => (p ? { endsAt: Math.max(Date.now() + 1000, p.endsAt + sec * 1000), total: Math.max(5, p.total + sec) } : p));
  }, []);
  const stop = useCallback(() => {
    setTimer(null);
    setDone(false);
  }, []);

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (timer && !done && now >= timer.endsAt) {
      setDone(true);
      alertEnd();
    }
  }, [now, timer, done]);

  // після сигналу плашка сама зникає
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => {
      setTimer(null);
      setDone(false);
    }, 9000);
    return () => clearTimeout(id);
  }, [done]);

  const value = useMemo(() => ({ timer, now, done, start, add, stop }), [timer, now, done, start, add, stop]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Плашка таймера знизу: видно на будь-якому екрані, поки триває відпочинок */
export function RestBar({ bottomInset = 0 }: { bottomInset?: number }) {
  const { timer, now, done, add, stop } = useRest();
  if (!timer) return null;
  const leftMs = Math.max(0, timer.endsAt - now);
  const left = Math.ceil(leftMs / 1000);
  const pct = Math.min(1, Math.max(0, 1 - leftMs / (timer.total * 1000)));
  const tone = done ? colors.up : colors.gold;
  return (
    <View style={[st.wrap, { paddingBottom: 10 + bottomInset }]} accessibilityLiveRegion="polite">
      <View style={st.bar}>
        <View style={[st.fill, { width: `${pct * 100}%`, backgroundColor: done ? colors.up : colors.surfaceHi }]} />
        <View style={st.inner}>
          <Icon name="timer" size={22} color={tone} />
          <Text style={[st.time, { color: done ? colors.ink : colors.ink }]}>{done ? 'Час працювати' : fmtClock(left)}</Text>
          <View style={{ flex: 1 }} />
          {!done && (
            <>
              <Tap onPress={() => add(-15)} style={st.btn} accessibilityLabel="Мінус 15 секунд"><Text style={st.btnText}>−15</Text></Tap>
              <Tap onPress={() => add(15)} style={st.btn} accessibilityLabel="Плюс 15 секунд"><Text style={st.btnText}>+15</Text></Tap>
            </>
          )}
          <Tap onPress={stop} style={st.close} hitSlop={8} accessibilityLabel="Закрити таймер">
            <Icon name={done ? 'check' : 'x'} size={18} color={done ? colors.bg : colors.muted} />
          </Tap>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 8, backgroundColor: colors.bg },
  bar: { height: 52, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hair, overflow: 'hidden', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 8 },
  time: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 0.5 },
  btn: { height: 34, paddingHorizontal: 11, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});

// Fira Sans Condensed: вузький шрифт з українською кирилицею. Підключаємо лише 3 накреслення з 18.
import { FiraSansCondensed_500Medium } from '@expo-google-fonts/fira-sans-condensed/500Medium';
import { FiraSansCondensed_600SemiBold } from '@expo-google-fonts/fira-sans-condensed/600SemiBold';
import { FiraSansCondensed_700Bold } from '@expo-google-fonts/fira-sans-condensed/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Image, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { MainScreen } from './src/screens/MainScreen';
import { ExerciseScreen, ProgressScreen } from './src/screens/ProgressScreen';
import { ProgramScreen } from './src/screens/ProgramScreen';
import { Icon, IconName } from './src/components/Icon';
import { Tap } from './src/components/ui';
import { RestBar, RestProvider } from './src/rest';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { SummaryScreen } from './src/screens/SummaryScreen';
import { LogScreen } from './src/screens/LogScreen';
import { PickerScreen } from './src/screens/PickerScreen';
import { StoreProvider, useStore } from './src/store';
import { SyncProvider } from './src/sync';
import { alpha, colors, fonts } from './src/theme';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.body.style.backgroundColor = colors.bg;
  // темні смуги прокрутки й без синього підсвічування при кліку
  const css = document.createElement('style');
  css.textContent = `
    * { scrollbar-width: thin; scrollbar-color: ${colors.line} transparent; -webkit-tap-highlight-color: transparent; }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-thumb { background: ${colors.line}; border-radius: 5px; border: 2px solid ${colors.bg}; }
    input:focus { outline: none; }
  `;
  document.head.appendChild(css);
}

type Route =
  | { name: 'main' }
  | { name: 'calendar' }
  | { name: 'progress' }
  | { name: 'program' }
  | { name: 'settings' }
  | { name: 'exercise'; exerciseId: string }
  | { name: 'day'; date: string }
  | { name: 'pick'; date: string; swap?: string }
  | { name: 'summary'; date: string }
  | { name: 'log'; date: string; exerciseId: string };

type Nav = {
  push: (r: Route) => void;
  back: () => void;
  replace: (r: Route) => void;
  /** Чи є куди повертатися: на кореневих екранах комп'ютера кнопки "Назад" немає */
  canBack: boolean;
  wide: boolean;
};

/** Від цієї ширини (комп'ютер, планшет) показуємо бокове меню */
const WIDE = 900;

function Navigator() {
  const { ready, addToPlan, swapExercise } = useStore();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [stack, setStack] = useState<Route[]>([{ name: 'main' }]);
  const route = stack[stack.length - 1];

  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const push = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const replace = useCallback((r: Route) => setStack((s) => [...s.slice(0, -1), r]), []);

  // Android: системна кнопка "назад"
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, back]);

  // Комп'ютер: Esc повертає на крок назад, N відкриває список вправ на сторінці дня
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      if (e.key === 'Escape') setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
      else if (!typing && (e.key === 'n' || e.key === 'т') && !e.metaKey && !e.ctrlKey) {
        setStack((s) => {
          const top = s[s.length - 1];
          if (top.name !== 'day') return s;
          e.preventDefault();
          return [...s, { name: 'pick', date: top.date }];
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ready) return null;
  const nav: Nav = { push, back, replace, canBack: stack.length > 1, wide };
  const go = (r: Route) => setStack([r]);
  const screen = <Fade key={JSON.stringify(route)}>{renderRoute(route, nav, go, { addToPlan, swapExercise })}</Fade>;
  const section = stack[0].name;

  if (!wide) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>{screen}</View>
        <RestBar bottomInset={stack.length > 1 ? insets.bottom : 0} />
        {stack.length === 1 && <TabBar section={section} onGo={(id) => go({ name: id })} />}
      </View>
    );
  }

  return (
    <View style={styles.wide}>
      <View style={styles.side}>
        <View style={styles.sideBrand}>
          <Image source={require('./assets/icon.png')} style={styles.sideIcon} />
          <Text style={styles.sideTitle}>Підхід</Text>
        </View>
        {sections.map(([id, label, icon]) => {
          const on = section === id;
          return (
            <Tap key={id} onPress={() => go({ name: id })} style={[styles.sideItem, on && styles.sideItemOn]} accessibilityRole="button">
              <Icon name={icon} size={20} color={on ? colors.ink : colors.muted} />
              <Text style={[styles.sideLabel, on && { color: colors.ink }]}>{label}</Text>
            </Tap>
          );
        })}
        <Text style={styles.sideHint}>Esc повертає на крок назад{'\n'}N додає вправу в день</Text>
      </View>
      <View style={styles.main}>
        <View style={styles.mainInner}>
          <View style={{ flex: 1 }}>{screen}</View>
          <RestBar />
        </View>
      </View>
    </View>
  );
}

const sections: readonly (readonly ['main' | 'calendar' | 'progress' | 'program' | 'settings', string, IconName])[] = [
  ['main', 'Головна', 'home'],
  ['calendar', 'Календар тренувань', 'calendar'],
  ['progress', 'Прогрес і рекорди', 'chart'],
  ['program', 'Мої дні', 'list'],
  ['settings', 'Налаштування', 'sliders'],
];

const tabLabels: Record<string, string> = { main: 'Головна', calendar: 'Календар', progress: 'Прогрес', program: 'Дні', settings: 'Ще' };

/** Нижнє меню на телефоні: видно лише на головних екранах */
function TabBar({ section, onGo }: { section: string; onGo: (id: (typeof sections)[number][0]) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {sections.map(([id, , icon]) => {
        const on = section === id;
        return (
          <Tap key={id} onPress={() => onGo(id)} style={styles.tab} accessibilityRole="button" accessibilityLabel={tabLabels[id]} accessibilityState={{ selected: on }}>
            <View style={[styles.tabPill, on && { backgroundColor: alpha(colors.ink, 0.1) }]}>
              <Icon name={icon} size={22} color={on ? colors.ink : colors.faint} />
            </View>
            <Text style={[styles.tabLabel, on && { color: colors.ink }]}>{tabLabels[id]}</Text>
          </Tap>
        );
      })}
    </View>
  );
}

/** Плавна поява екрана */
function Fade({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [v]);
  return (
    <Animated.View style={{ flex: 1, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

function renderRoute(
  r: Route,
  nav: Nav,
  go: (r: Route) => void,
  plan: { addToPlan: (date: string, id: string) => void; swapExercise: (date: string, oldId: string, newId: string) => void },
) {
  const { push, back, replace, canBack } = nav;
  const openDay = (date: string) => push({ name: 'day', date });
  switch (r.name) {
    case 'main':
      return (
        <MainScreen
          onOpenDay={openDay}
          onSummary={(date) => push({ name: 'summary', date })}
          onSection={(s) => go({ name: s })}
          onOpenExercise={(id) => push({ name: 'exercise', exerciseId: id })}
        />
      );
    case 'calendar':
      return <CalendarScreen onBack={canBack ? back : undefined} onOpenDay={openDay} />;
    case 'progress':
      return <ProgressScreen onBack={canBack ? back : undefined} onOpenExercise={(id) => push({ name: 'exercise', exerciseId: id })} />;
    case 'program':
      return <ProgramScreen onBack={canBack ? back : undefined} />;
    case 'settings':
      return <SettingsScreen onBack={canBack ? back : undefined} />;
    case 'exercise':
      return <ExerciseScreen key={r.exerciseId} exerciseId={r.exerciseId} onBack={back} onOpenDay={openDay} />;
    case 'day':
      return (
        <WorkoutScreen
          key={r.date}
          date={r.date}
          onBack={back}
          onOpenExercise={(id) => push({ name: 'log', date: r.date, exerciseId: id })}
          onPick={() => push({ name: 'pick', date: r.date })}
          onSwap={(id) => push({ name: 'pick', date: r.date, swap: id })}
          onSummary={() => push({ name: 'summary', date: r.date })}
        />
      );
    case 'summary':
      return <SummaryScreen date={r.date} onBack={back} onDone={() => go({ name: 'main' })} />;
    case 'pick':
      return (
        <PickerScreen
          date={r.date}
          onBack={back}
          onOpen={(id) => {
            if (r.swap) plan.swapExercise(r.date, r.swap, id);
            else plan.addToPlan(r.date, id);
            back();
          }}
        />
      );
    case 'log':
      return <LogScreen key={r.date + r.exerciseId} exerciseId={r.exerciseId} date={r.date} onBack={back} />;
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({ FiraSansCondensed_500Medium, FiraSansCondensed_600SemiBold, FiraSansCondensed_700Bold });

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <SyncProvider>
        <RestProvider>
          <View style={styles.root}>
            <StatusBar style="light" />
            {fontsLoaded ? <Navigator /> : null}
          </View>
        </RestProvider>
        </SyncProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    width: '100%',
  },
  wide: { flex: 1, flexDirection: 'row' },
  side: { width: 250, paddingTop: 22, paddingHorizontal: 12, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line, gap: 4 },
  sideBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, marginBottom: 18 },
  sideIcon: { width: 36, height: 36, borderRadius: 9 },
  sideTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 24 },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 46, paddingHorizontal: 12, borderRadius: 12 },
  tabs: { flexDirection: 'row', paddingTop: 6, backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabPill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { color: colors.faint, fontSize: 11, fontWeight: '600' },
  sideItemOn: { backgroundColor: colors.surfaceHi },
  sideLabel: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  sideHint: { color: colors.faint, fontSize: 12, lineHeight: 18, paddingHorizontal: 12, marginTop: 'auto', marginBottom: 18 },
  main: { flex: 1, minWidth: 0, alignItems: 'center' },
  mainInner: { flex: 1, width: '100%', maxWidth: 820 },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: 48 },
  emptyTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 44 },
  emptyText: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 460 },
});

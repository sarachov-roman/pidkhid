import React, { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Button, Card, Chip, Header, SectionTitle, Tap } from '../components/ui';
import { useStore } from '../store';
import { useSync } from '../sync';
import { colors, fonts } from '../theme';
import { fmtClock, toDateKey } from '../utils';

const restOptions = [60, 90, 120, 150, 180, 240];
const goalOptions = [2, 3, 4, 5, 6];

/** Налаштування, копія даних і відновлення */
export function SettingsScreen({ onBack }: { onBack?: () => void }) {
  const { settings, setSettings, exportJson, importJson, resetAll, workouts, sessions } = useStore();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pasted, setPasted] = useState('');
  const [confirmImport, setConfirmImport] = useState<string | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const demo = process.env.EXPO_PUBLIC_DEMO === '1';
  const sync = useSync();
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [busyConnect, setBusyConnect] = useState(false);
  const connect = async () => {
    setBusyConnect(true);
    setSyncMsg(null);
    const r = await sync.connect(repo, token);
    setBusyConnect(false);
    if (r.ok) { setToken(''); setSyncMsg(null); } else setSyncMsg(r.message ?? 'Не вийшло підключити.');
  };
  const st0 = sync.status;
  const statusText =
    st0.state === 'syncing' ? 'Синхронізую…'
    : st0.state === 'ok' ? `Усе збережено на GitHub о ${new Date(st0.at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`
    : st0.state === 'error' ? st0.message
    : 'Підключено. Чекаю першої синхронізації.';

  const say = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const saveFile = async () => {
    const json = exportJson();
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pidkhid-${toDateKey()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        say('Файл копії збережено. Шукай його в «Завантаженнях».');
      } else {
        await Share.share({ message: json });
      }
    } catch {
      say('Не вдалося зберегти файл. Спробуй скопіювати текстом.', false);
    }
  };

  const copyText = async () => {
    try {
      if (Platform.OS === 'web') await (navigator as any).clipboard.writeText(exportJson());
      else await Share.share({ message: exportJson() });
      say('Копію скопійовано. Встав її кудись у безпечне місце.');
    } catch {
      say('Не вдалося скопіювати.', false);
    }
  };

  const pickFile = () => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        setConfirmImport(await f.text());
      } catch {
        say('Не вдалося прочитати файл.', false);
      }
    };
    input.click();
  };

  const doImport = () => {
    if (confirmImport === null) return;
    const ok = importJson(confirmImport);
    setConfirmImport(null);
    setPasted('');
    say(ok ? 'Записи відновлено з копії.' : 'Цей файл не схожий на копію «Підходу».', ok);
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Header onBack={onBack} title="Налаштування" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={st.title}>Налаштування</Text>
        </View>

        <SectionTitle hint="після підходу">Відпочинок</SectionTitle>
        <View style={st.chips}>
          {restOptions.map((s) => (
            <Chip key={s} label={fmtClock(s)} on={settings.restSec === s} onPress={() => setSettings({ restSec: s })} />
          ))}
        </View>

        <SectionTitle hint="для кільця цілі">Тренувань на тиждень</SectionTitle>
        <View style={st.chips}>
          {goalOptions.map((n) => (
            <Chip key={n} label={String(n)} on={settings.weeklyGoal === n} onPress={() => setSettings({ weeklyGoal: n })} />
          ))}
        </View>

        <SectionTitle hint={sync.connected ? 'увімкнено' : 'щоб дані не зникали'}>Синхронізація з GitHub</SectionTitle>
        <Card style={st.card}>
          {sync.connected ? (
            <>
              <Text style={st.p}>Репозиторій: {sync.repo}</Text>
              <View style={st.msg}>
                <Icon name={st0.state === 'error' ? 'x' : 'check'} size={16} color={st0.state === 'error' ? colors.down : colors.up} />
                <Text style={[st.msgText, { color: st0.state === 'error' ? colors.down : colors.up }]}>{statusText}</Text>
              </View>
              <View style={st.btns}>
                <Button kind="ghost" icon="repeat" label="Синхронізувати зараз" onPress={() => void sync.syncNow()} style={st.btn} />
                <Button kind="ghost" label="Відключити" onPress={sync.disconnect} style={st.btn} />
              </View>
            </>
          ) : (
            <>
              <Text style={st.p}>
                Записи зберігаються в твоєму приватному репозиторії й однакові на всіх пристроях. Токен лишається лише на цьому пристрої.
              </Text>
              <TextInput value={repo} onChangeText={setRepo} placeholder="логін/pidkhid-data" placeholderTextColor={colors.faint} autoCapitalize="none" autoCorrect={false} style={st.field} accessibilityLabel="Репозиторій" />
              <TextInput value={token} onChangeText={setToken} placeholder="Токен доступу" placeholderTextColor={colors.faint} autoCapitalize="none" autoCorrect={false} secureTextEntry style={st.field} accessibilityLabel="Токен" />
              {syncMsg && (
                <View style={st.msg}>
                  <Icon name="x" size={16} color={colors.down} />
                  <Text style={[st.msgText, { color: colors.down }]}>{syncMsg}</Text>
                </View>
              )}
              <Button label={busyConnect ? 'Перевіряю…' : 'Підключити'} onPress={connect} disabled={busyConnect || !repo.trim() || !token.trim()} style={{ marginTop: 12, height: 48 }} />
            </>
          )}
        </Card>

        <SectionTitle hint={`${workouts.length} тренувань, ${sessions.length} записів вправ`}>Копія даних</SectionTitle>
        <Card style={st.card}>
          <Text style={st.p}>
            Усі записи лежать лише в цій програмі. Раз на кілька тижнів зберігай копію: якщо щось станеться з комп'ютером чи телефоном, ти все відновиш.
          </Text>
          <View style={st.btns}>
            <Button kind="ghost" icon="download" label="Зберегти файл" onPress={saveFile} style={st.btn} />
            <Button kind="ghost" icon="copy" label="Скопіювати текстом" onPress={copyText} style={st.btn} />
          </View>
          {msg && (
            <View style={st.msg}>
              <Icon name={msg.ok ? 'check' : 'x'} size={16} color={msg.ok ? colors.up : colors.down} />
              <Text style={[st.msgText, { color: msg.ok ? colors.up : colors.down }]}>{msg.text}</Text>
            </View>
          )}
        </Card>

        <SectionTitle>Відновити з копії</SectionTitle>
        <Card style={st.card}>
          {confirmImport === null ? (
            <>
              {Platform.OS === 'web' && <Button kind="ghost" icon="upload" label="Вибрати файл копії" onPress={pickFile} />}
              <TextInput
                value={pasted}
                onChangeText={setPasted}
                placeholder="Або встав сюди текст копії"
                placeholderTextColor={colors.faint}
                multiline
                style={st.paste}
                accessibilityLabel="Текст копії"
              />
              <Button label="Відновити з тексту" onPress={() => setConfirmImport(pasted)} disabled={!pasted.trim()} style={{ marginTop: 10, height: 48 }} />
            </>
          ) : (
            <>
              <Text style={st.p}>Усі теперішні записи буде замінено даними з копії. Продовжити?</Text>
              <View style={st.btns}>
                <Button kind="danger" label="Замінити записи" onPress={doImport} style={st.btn} />
                <Button kind="ghost" label="Скасувати" onPress={() => setConfirmImport(null)} style={st.btn} />
              </View>
            </>
          )}
        </Card>

        {!demo && (
          <View style={{ paddingHorizontal: 20, marginTop: 34 }}>
            {!confirmErase ? (
              <Tap onPress={() => setConfirmErase(true)} hitSlop={8}>
                <Text style={st.erase}>Стерти всі записи</Text>
              </Tap>
            ) : (
              <>
                <Text style={st.p}>Зникнуть усі тренування, вправи й вага тіла. Спершу збережи копію. Стерти?</Text>
                <View style={st.btns}>
                  <Button kind="danger" label="Стерти все" onPress={() => { resetAll(); setConfirmErase(false); say('Усе стерто.'); }} style={st.btn} />
                  <Button kind="ghost" label="Скасувати" onPress={() => setConfirmErase(false)} style={st.btn} />
                </View>
              </>
            )}
          </View>
        )}
        <Text style={st.version}>Підхід. Записи на цьому пристрої, а з GitHub ще й у репозиторії.</Text>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 44, lineHeight: 50 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  card: { marginHorizontal: 16, padding: 16 },
  p: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  btns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  btn: { flexGrow: 1, flexBasis: 180, height: 50 },
  msg: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  msgText: { fontSize: 14, fontWeight: '600', flex: 1 },
  paste: {
    minHeight: 70, maxHeight: 140, marginTop: 12, borderRadius: 12, backgroundColor: colors.surfaceHi, color: colors.ink,
    padding: 12, fontSize: 13, textAlignVertical: 'top',
  },
  field: { height: 46, borderRadius: 12, backgroundColor: colors.surfaceHi, color: colors.ink, paddingHorizontal: 14, fontSize: 15, marginTop: 10 },
  erase: { color: colors.down, fontSize: 14 },
  version: { color: colors.faint, fontSize: 12, paddingHorizontal: 20, marginTop: 28 },
});

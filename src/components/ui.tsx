import React from 'react';
import { Platform, Pressable, PressableProps, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { Icon, IconName } from './Icon';

export function Tap({ style, children, ...rest }: PressableProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        Platform.OS === 'web' && { cursor: 'pointer' },
        style,
        hovered && { opacity: 0.88 },
        pressed && { opacity: 0.65, transform: [{ scale: 0.98 }] },
      ]}
    >
      {children}
    </Pressable>
  );
}

export function Header({ title, onBack, right }: { title?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={s.header}>
      <View style={{ width: 104 }}>
        {onBack ? (
          <Tap onPress={onBack} style={s.back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Назад">
            <Icon name="left" size={18} />
            <Text style={s.backText}>Назад</Text>
          </Tap>
        ) : null}
      </View>
      {title ? <Text style={s.headerTitle} numberOfLines={1}>{title}</Text> : <View style={{ flex: 1 }} />}
      <View style={{ width: 104, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <View style={s.sectionTitleRow}>
      <Text style={s.sectionTitle}>{children}</Text>
      {hint ? <Text style={s.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

/** Картка з тонкою світлою обводкою */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  style,
  textStyle,
  disabled,
  color,
  icon,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  /** Колір кнопки (наприклад, колір дня) замість білого */
  color?: string;
  icon?: IconName;
}) {
  const fg = kind === 'primary' ? colors.bg : kind === 'danger' ? colors.down : colors.ink;
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[
        s.btn,
        kind === 'primary' ? { backgroundColor: color ?? colors.ink } : kind === 'danger' ? s.btnDanger : s.btnGhost,
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text style={[s.btnText, { color: fg }, textStyle]}>{label}</Text>
    </Tap>
  );
}

/** Невеликий перемикач-«пігулка» */
export function Chip({
  label,
  icon,
  on,
  onPress,
  color,
}: {
  label: string;
  icon?: IconName;
  on?: boolean;
  onPress: () => void;
  color?: string;
}) {
  const accent = color ?? colors.ink;
  return (
    <Tap onPress={onPress} style={[s.chip, on && { backgroundColor: accent, borderColor: accent }]} accessibilityRole="button" accessibilityState={{ selected: !!on }}>
      {icon ? <Icon name={icon} size={16} color={on ? colors.bg : colors.muted} /> : null}
      <Text style={[s.chipText, on && { color: colors.bg }]}>{label}</Text>
    </Tap>
  );
}

/** Сегментований перемикач: кілька варіантів, один вибраний */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Tap key={o.id} onPress={() => onChange(o.id)} style={[s.segItem, value === o.id && s.segOn]} accessibilityRole="button" accessibilityState={{ selected: value === o.id }}>
          <Text style={[s.segText, value === o.id && { color: colors.ink }]}>{o.label}</Text>
        </Tap>
      ))}
    </View>
  );
}

export function Delta({ value, unit }: { value: number; unit: string }) {
  if (!value) return <Text style={[s.delta, { color: colors.muted }]}>=</Text>;
  const up = value > 0;
  const n = Math.abs(Math.round(value * 100) / 100).toString().replace('.', ',');
  return (
    <Text style={[s.delta, { color: up ? colors.up : colors.down }]}>
      {up ? '▲' : '▼'} {n}{unit ? ` ${unit}` : ''}
    </Text>
  );
}

export const s = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  back: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, height: 38, paddingLeft: 8, paddingRight: 14,
    borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hair,
  },
  backText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  headerTitle: { color: colors.muted, fontSize: 15, flex: 1, textAlign: 'center' },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 30,
    marginBottom: 12,
  },
  sectionTitle: { color: colors.ink, fontFamily: fonts.displaySemi, fontSize: 22, letterSpacing: 0.2 },
  sectionHint: { color: colors.muted, fontSize: 13 },
  card: { backgroundColor: colors.surface, borderRadius: radius.l, borderWidth: 1, borderColor: colors.hair },
  btn: {
    height: 54, borderRadius: radius.m, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
    flexDirection: 'row', gap: 8,
  },
  btnGhost: { backgroundColor: colors.surfaceHi },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  btnText: { fontSize: 16, fontWeight: '700' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 18,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  seg: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.m, padding: 3, borderWidth: 1, borderColor: colors.hair },
  segItem: { flex: 1, height: 36, borderRadius: radius.m - 3, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.surfaceHi },
  segText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  delta: { fontFamily: fonts.displaySemi, fontSize: 17 },
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Exercise } from '../data/exercises';
import { colors, fonts, groupById } from '../theme';
import { Icon } from './Icon';
import { Tap } from './ui';

/** Рядок вправи з кольоровою "планкою" групи м'язів зліва */
export function ExerciseRow({
  exercise,
  meta,
  detail,
  right,
  onPress,
  last,
  active,
}: {
  exercise: Exercise;
  meta?: string;
  detail?: string;
  right?: React.ReactNode;
  onPress: () => void;
  last?: boolean;
  active?: boolean;
}) {
  const g = groupById(exercise.group);
  return (
    <Tap onPress={onPress} style={[st.row, !last && st.divider, active && st.active]} accessibilityRole="button" accessibilityLabel={exercise.name}>
      <View style={[st.plate, { backgroundColor: g.color }]} />
      <View style={st.body}>
        <Text style={st.name} numberOfLines={1}>{exercise.name}</Text>
        {detail ? <Text style={st.detail} numberOfLines={1}>{detail}</Text> : null}
        {meta ? <Text style={st.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <View style={st.right}>{right ?? <Icon name="right" size={20} color={colors.faint} />}</View>
    </Tap>
  );
}

export function RowGroup({ children }: { children: React.ReactNode }) {
  return <View style={st.group}>{children}</View>;
}

const st = StyleSheet.create({
  group: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.hair },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingRight: 16, minHeight: 64 },
  active: { backgroundColor: colors.surfaceHi },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  plate: { width: 5, alignSelf: 'stretch', borderRadius: 3, marginLeft: 12, marginRight: 14 },
  body: { flex: 1, minWidth: 0 },
  name: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  detail: { color: colors.ink, opacity: 0.85, fontFamily: fonts.displayMedium, fontSize: 18, marginTop: 3, letterSpacing: 0.3 },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  right: { marginLeft: 10, alignItems: 'flex-end' },
  chev: { color: colors.faint, fontSize: 26, lineHeight: 26 },
});

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors, fonts } from '../theme';
import { fmtNum, formatDay } from '../utils';

/** Простий лінійний графік прогресу: одна лінія, підписані перша, остання й найкраща точки */
export function ProgressChart({
  points,
  color,
  unit,
}: {
  points: { date: string; value: number }[];
  color: string;
  unit: string;
}) {
  const [w, setW] = useState(0);
  const h = 120;
  const padX = 10;
  const padY = 14;

  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => padX + (points.length === 1 ? (w - 2 * padX) / 2 : (i * (w - 2 * padX)) / (points.length - 1));
  const y = (v: number) => padY + (1 - (v - min) / span) * (h - 2 * padY);

  const first = points[0];
  const last = points[points.length - 1];
  const change = last.value - first.value;

  return (
    <View>
      <View style={st.head}>
        <Text style={st.big}>
          {fmtNum(last.value)}
          <Text style={st.unit}> {unit}</Text>
        </Text>
        <Text style={[st.change, { color: change > 0 ? colors.up : change < 0 ? colors.down : colors.muted }]}>
          {change > 0 ? '+' : change < 0 ? '−' : ''}
          {fmtNum(Math.abs(change))} {unit} з {formatDay(first.date)}
        </Text>
      </View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: h }}>
        {w > 0 && (
          <Svg width={w} height={h}>
            <Line x1={0} x2={w} y1={y(max)} y2={y(max)} stroke={colors.line} strokeWidth={1} strokeDasharray="3,5" />
            <Line x1={0} x2={w} y1={y(min)} y2={y(min)} stroke={colors.line} strokeWidth={1} strokeDasharray="3,5" />
            <Polyline
              points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) => (
              <Circle
                key={p.date}
                cx={x(i)}
                cy={y(p.value)}
                r={i === points.length - 1 ? 5 : 3}
                fill={i === points.length - 1 ? color : colors.bg}
                stroke={color}
                strokeWidth={2}
              />
            ))}
          </Svg>
        )}
      </View>
      <View style={st.axis}>
        <Text style={st.axisText}>{formatDay(first.date)}</Text>
        <Text style={st.axisText}>макс. {fmtNum(max)} {unit}</Text>
        <Text style={st.axisText}>{formatDay(last.date)}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 },
  big: { color: colors.ink, fontFamily: fonts.display, fontSize: 34 },
  unit: { fontSize: 18, color: colors.muted, fontFamily: fonts.displayMedium },
  change: { fontSize: 14, fontWeight: '600' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { color: colors.faint, fontSize: 12 },
});

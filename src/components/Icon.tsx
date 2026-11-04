import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

// Прості лінійні іконки 24×24 (штрих 2, закруглені кінці)
const paths = {
  home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M3 10h18 M8 3v4 M16 3v4',
  chart: 'M3 17l6-6 4 4 8-8 M15 7h6v6',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3.5 6h.01 M3.5 12h.01 M3.5 18h.01',
  sliders: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  timer: 'M12 9v4l2.5 1.5 M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M9.5 2h5',
  trophy: 'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M17 5h3v2a3 3 0 0 1-3 3 M7 5H4v2a3 3 0 0 0 3 3',
  flame: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4.2 0 2 .8 3 2 3 .6-2.6-.2-5.3 1-8.8z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  right: 'M9 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
  x: 'M6 6l12 12 M18 6L6 18',
  note: 'M5 3h9l5 5v13H5z M14 3v5h5 M8 13h8 M8 17h5',
  copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
  download: 'M12 4v11 M7 10l5 5 5-5 M4 20h16',
  upload: 'M12 20V9 M7 14l5-5 5 5 M4 4h16',
  scale: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M8 10a4 4 0 0 1 8 0 M12 10l2-2.5',
  dumbbell: 'M6.5 6.5v11 M17.5 6.5v11 M3 9v6 M21 9v6 M6.5 12h11',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  layers: 'M12 3 3 8l9 5 9-5z M3 13l9 5 9-5',
  repeat: 'M17 2l4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3',
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 22,
  color = colors.ink,
  stroke = 2,
  fill = 'none',
}: {
  name: IconName;
  size?: number;
  color?: string;
  stroke?: number;
  fill?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d={paths[name]} fill={fill} />
    </Svg>
  );
}

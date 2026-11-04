// Кольори взято з олімпійських млинців: червоний 25 кг, синій 20, жовтий 15, зелений 10, білий 5.
// Найбільші групи м'язів отримують "найважчий" колір.

export const colors = {
  bg: '#161A1F', // гумова підлога залу
  surface: '#1F252C',
  surfaceHi: '#2A323B',
  line: '#343D47',
  hair: 'rgba(255,255,255,0.07)',
  ink: '#EEF1F4',
  muted: '#8B96A3',
  faint: '#5D6773',
  up: '#4CC27A',
  down: '#E8705F',
  gold: '#F5C451',
};

export const radius = { s: 10, m: 14, l: 18, xl: 24 };

export type GroupId = 'legs' | 'back' | 'chest' | 'shoulders' | 'arms' | 'core' | 'neck';

export const groups: { id: GroupId; name: string; color: string; plate: string }[] = [
  { id: 'legs', name: 'Ноги', color: '#E5483B', plate: '25' },
  { id: 'back', name: 'Спина', color: '#3D7FE0', plate: '20' },
  { id: 'chest', name: 'Груди', color: '#F2C230', plate: '15' },
  { id: 'shoulders', name: 'Плечі', color: '#3FB56A', plate: '10' },
  { id: 'arms', name: 'Руки', color: '#E8EAED', plate: '5' },
  { id: 'core', name: 'Прес', color: '#8E99A6', plate: '2.5' },
  { id: 'neck', name: 'Шия', color: '#A98BE0', plate: '1.25' },
];

export const groupById = (id: GroupId) => groups.find((g) => g.id === id) ?? groups[0];

export const fonts = {
  display: 'FiraSansCondensed_700Bold',
  displaySemi: 'FiraSansCondensed_600SemiBold',
  displayMedium: 'FiraSansCondensed_500Medium',
};

const rgb = (c: string) => {
  const n = parseInt(c.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Змішує колір a з b: t = частка a (0..1) */
export function mix(a: string, b: string, t: number): string {
  const A = rgb(a);
  const B = rgb(b);
  return `rgb(${A.map((v, i) => Math.round(v * t + B[i] * (1 - t))).join(',')})`;
}

export function alpha(c: string, a: number): string {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
}

// Design tokens — SPEC §7.1/7.2/7.3/7.13. Single source of truth for colors, type, ring geometry, motion.
export const COLORS = {
  bg: '#000000',
  surface: '#0A0B0D',
  surface2: '#121418',
  hairline: 'rgba(255,255,255,0.08)',
  track: 'rgba(255,255,255,0.06)',
  text: '#F5F7FA',
  muted: '#6B7280',
  dim: '#3A3F47',
  green: '#16EC06',
  yellow: '#FFDE00',
  red: '#FF0026',
  strain: '#0093E7',
  sleep: '#7BA1BB',
  temp: '#F5A623', // skin temperature — ONLY on the Health screen
  // v1 aliases, kept so nothing breaks:
  black: '#000000',
  recoveryGreen: '#16EC06',
  recoveryYellow: '#FFDE00',
  recoveryRed: '#FF0026',
  strainBlue: '#0093E7',
  sleepTeal: '#7BA1BB',
};

export const TYPE = {
  hero: { size: 88, lineHeight: 0.92 },
  card: { size: 56, lineHeight: 1.0 },
  secondary: { size: 32, lineHeight: 1.0 },
  tertiary: { size: 20, lineHeight: 1.0 },
  label: { size: 11 },
  labelLg: { size: 12 },
};

export const RING = {
  rotate: 135, // deg — opens a 90° gap at the bottom
  arcFraction: 0.75, // 270° of 360°
  hero: { size: 220, stroke: 10 },
  small: { size: 104, stroke: 6 },
  dayStrip: { size: 28, stroke: 3 },
};

export const MOTION = {
  ring: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  card: { duration: 0.24, y: 12, stagger: 0.04 },
  tab: { duration: 0.15 },
  pulse: { duration: 2 },
};

export function band(score) {
  if (score >= 67) return { color: COLORS.green, name: 'GREEN', word: 'READY' };
  if (score >= 34) return { color: COLORS.yellow, name: 'YELLOW', word: 'MODERATE' };
  return { color: COLORS.red, name: 'RED', word: 'REST' };
}

export function rangeState(value, range) {
  if (value === null || value === undefined || !range) return 'unknown';
  const { min, max } = range;
  if (min === undefined || max === undefined || min === null || max === null) return 'unknown';
  if (value < min) return 'below';
  if (value > max) return 'above';
  return 'in';
}

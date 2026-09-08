// Theme constants — colors from SPEC §7, plus recovery-band color helper.
export const COLORS = {
  black: '#000000',
  surface: '#0F1115',
  text: '#F5F7FA',
  muted: '#8B93A1',
  recoveryGreen: '#16EC06',
  recoveryYellow: '#FFDE00',
  recoveryRed: '#FF0026',
  strainBlue: '#0093E7',
  sleepTeal: '#7BA1BB',
};

export function band(score) {
  if (score >= 67) return { color: COLORS.recoveryGreen, name: 'GREEN', word: 'Ready' };
  if (score >= 34) return { color: COLORS.recoveryYellow, name: 'YELLOW', word: 'Moderate' };
  return { color: COLORS.recoveryRed, name: 'RED', word: 'Rest' };
}

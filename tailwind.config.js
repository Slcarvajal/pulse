// Tailwind config — Whoop-style dark palette and type scale (SPEC §7)
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        black: '#000000',
        surface: '#0F1115',
        text: '#F5F7FA',
        muted: '#8B93A1',
        recoveryGreen: '#16EC06',
        recoveryYellow: '#FFDE00',
        recoveryRed: '#FF0026',
        strainBlue: '#0093E7',
        sleepTeal: '#7BA1BB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        hero: ['72px', { fontWeight: '700' }],
        secondary: ['40px', { fontWeight: '700' }],
        label: ['11px', { letterSpacing: '0.12em' }],
      },
    },
  },
  plugins: [],
};

// Tailwind config — mirrors src/theme.js COLORS (SPEC §7.1) and the numeral/label type scale (§7.2).
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
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
        temp: '#F5A623',
        // v1 aliases, kept so nothing breaks:
        black: '#000000',
        recoveryGreen: '#16EC06',
        recoveryYellow: '#FFDE00',
        recoveryRed: '#FF0026',
        strainBlue: '#0093E7',
        sleepTeal: '#7BA1BB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        condensed: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        hero: ['88px', { lineHeight: '0.92', fontWeight: '700' }],
        card: ['56px', { lineHeight: '1', fontWeight: '700' }],
        num2: ['32px', { lineHeight: '1', fontWeight: '700' }],
        num3: ['20px', { lineHeight: '1', fontWeight: '700' }],
        label: ['11px', { letterSpacing: '0.14em' }],
      },
    },
  },
  plugins: [],
};

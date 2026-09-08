// TabBar — fixed bottom nav, 5 tabs with inline thin-stroke SVG icons (SPEC §7.12).
import { COLORS } from '../theme.js';

const TABS = [
  { key: 'home', label: 'Home' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'strain', label: 'Strain' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'health', label: 'Health' },
];

function Icon({ tab, color }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  if (tab === 'home') {
    return (
      <svg {...props}>
        <path d="M3 10.5 10 4l7 6.5" />
        <path d="M5 9v7h10V9" />
      </svg>
    );
  }
  if (tab === 'recovery') {
    return (
      <svg {...props}>
        <path d="M14.5 4.8A7 7 0 1 1 5.5 4.8" />
      </svg>
    );
  }
  if (tab === 'strain') {
    return (
      <svg {...props}>
        <path d="M11 2 4 12h4.5l-1 6L16 8h-4.5z" />
      </svg>
    );
  }
  if (tab === 'sleep') {
    return (
      <svg {...props}>
        <path d="M13.5 3.5A7 7 0 1 0 13.5 16.5 5.6 5.6 0 0 1 13.5 3.5Z" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M10 16.5 3.5 10A4 4 0 0 1 10 5.2 4 4 0 0 1 16.5 10Z" />
    </svg>
  );
}

export default function TabBar({ active, onChange }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex"
      style={{
        height: 56,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: COLORS.bg,
        borderTop: `1px solid ${COLORS.hairline}`,
      }}
    >
      {TABS.map((t) => {
        const isActive = active === t.key;
        const color = isActive ? COLORS.text : COLORS.dim;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange?.(t.key)}
            className="flex-1 flex flex-col items-center justify-center gap-1"
          >
            <Icon tab={t.key} color={color} />
            <span className="lbl" style={{ color, fontSize: 10 }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

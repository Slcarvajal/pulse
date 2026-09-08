// TabBar — fixed bottom nav, 3 tabs with inline SVG icons.
import { COLORS } from '../theme.js';

const TABS = [
  { key: 'today', label: 'Today' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'trends', label: 'Trends' },
];

function Icon({ tab, color }) {
  if (tab === 'today') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
        <circle cx="12" cy="12" r="3.5" fill={color} />
      </svg>
    );
  }
  if (tab === 'sleep') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" fill={color} />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 17l5-6 4 4 7-9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TabBar({ active, onChange }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex bg-surface border-t border-black/40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const color = isActive ? COLORS.text : COLORS.muted;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange?.(tab.key)}
            className="flex-1 flex flex-col items-center gap-1 py-2"
          >
            <Icon tab={tab.key} color={color} />
            <span className={`text-label uppercase ${isActive ? 'text-text' : 'text-muted'}`}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

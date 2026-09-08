// Delta — ▲/▼/— chip. Monochrome by design: deltas are context, not status. SPEC §7.6.
import { COLORS } from '../theme.js';

export default function Delta({ value, decimals = 0 }) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const rounded = Number(value.toFixed(decimals));
  const arrow = rounded > 0 ? '▲' : rounded < 0 ? '▼' : '—';
  const formatted = rounded > 0 ? `+${rounded}` : `${rounded}`;
  return (
    <span
      className="lbl"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 18,
        borderRadius: 9,
        padding: '0 6px',
        background: COLORS.surface2,
        color: COLORS.text,
      }}
    >
      <span>{arrow}</span>
      <span>{formatted}</span>
    </span>
  );
}

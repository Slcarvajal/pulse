// Sparkline — monochrome 7-day trend line for MetricCard. Plain SVG, no chart library. SPEC §7.6.
import { COLORS } from '../theme.js';

export default function Sparkline({ data = [], width = 88, height = 32 }) {
  const values = data.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (values.length < 2) return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} />;

  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const n = data.length;
  const points = data.map((v, i) => {
    const x = pad + (i / (n - 1)) * (width - pad * 2);
    const val = v === null || v === undefined || Number.isNaN(v) ? null : v;
    const y = val === null ? null : pad + (1 - (val - min) / span) * (height - pad * 2);
    return { x, y };
  });

  const known = points.filter((p) => p.y !== null);
  const last = known[known.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={known.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={COLORS.muted}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last && <circle cx={last.x} cy={last.y} r={3} fill={COLORS.text} />}
    </svg>
  );
}

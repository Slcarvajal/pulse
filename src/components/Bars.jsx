// Bars — plain SVG bar chart with a dashed baseline line, no chart library.
import { COLORS } from '../theme.js';

export default function Bars({ data = [], colorFor, baseline, height = 120, max }) {
  const values = data.map((d) => (typeof d === 'number' ? d : d.value));
  const computedMax = max ?? Math.max(1, ...values, baseline || 0);
  const barWidth = 100 / (data.length || 1);
  const baselineY = baseline != null ? height - (baseline / computedMax) * height : null;

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {baselineY != null && (
        <line
          x1="0"
          x2="100"
          y1={baselineY}
          y2={baselineY}
          stroke={COLORS.muted}
          strokeWidth="0.6"
          strokeDasharray="2,2"
        />
      )}
      {data.map((d, i) => {
        const v = typeof d === 'number' ? d : d.value;
        const barH = computedMax ? (v / computedMax) * height : 0;
        const color = colorFor ? colorFor(d, i) : COLORS.strainBlue;
        return (
          <rect
            key={i}
            x={i * barWidth + barWidth * 0.15}
            y={height - barH}
            width={barWidth * 0.7}
            height={Math.max(0, barH)}
            rx="1"
            fill={color}
          />
        );
      })}
    </svg>
  );
}

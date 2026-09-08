// RangeBar — personal-range dot-on-track for a single Health metric. SPEC §7.7.
import { COLORS } from '../theme.js';

export default function RangeBar({ value, range, accent, decimals }) {
  const dp = decimals !== undefined && decimals !== null
    ? decimals
    : (value !== null && value !== undefined && Number.isInteger(value) ? 0 : 1);
  const fmtEnd = (v) => v.toFixed(dp);
  const { min = 0, max = 0, mean = (min + max) / 2, sd = 0 } = range || {};
  let domainMin = mean - 3 * sd;
  let domainMax = mean + 3 * sd;
  if (value !== null && value !== undefined) {
    domainMin = Math.min(domainMin, value);
    domainMax = Math.max(domainMax, value);
  }
  const span = domainMax - domainMin || 1;
  const pct = (v) => Math.max(0, Math.min(100, ((v - domainMin) / span) * 100));

  const inRange = value !== null && value !== undefined && value >= min && value <= max;
  const dotColor = inRange ? COLORS.text : (accent || COLORS.red);

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ height: 6 }}>
        <div className="absolute inset-0" style={{ background: COLORS.track, borderRadius: 3 }} />
        <div
          className="absolute"
          style={{
            top: 0,
            bottom: 0,
            left: `${pct(min)}%`,
            width: `${Math.max(0, pct(max) - pct(min))}%`,
            background: 'rgba(255,255,255,0.14)',
            borderRadius: 3,
          }}
        />
        {value !== null && value !== undefined && (
          <div
            className="absolute rounded-full"
            style={{
              width: 10,
              height: 10,
              top: -2,
              left: `calc(${pct(value)}% - 5px)`,
              background: dotColor,
            }}
          />
        )}
      </div>
      <div className="w-full flex items-center justify-between mt-1">
        <span className="lbl">{fmtEnd(domainMin)}</span>
        <span className="lbl">{fmtEnd(domainMax)}</span>
      </div>
    </div>
  );
}

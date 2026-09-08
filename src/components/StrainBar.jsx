// StrainBar — 0-21 strain track with target band and current-value marker. SPEC §7.10.
import { COLORS } from '../theme.js';

const DOMAIN_MAX = 21;

export default function StrainBar({ strain = 0, target }) {
  const pct = (v) => Math.max(0, Math.min(100, (v / DOMAIN_MAX) * 100));
  const { min: tMin, max: tMax } = target || {};
  const hasTarget = tMin !== undefined && tMax !== undefined;

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ height: 8 }}>
        <div className="absolute inset-0" style={{ background: COLORS.track, borderRadius: 4 }} />
        {hasTarget && (
          <div
            className="absolute"
            style={{
              top: 0,
              bottom: 0,
              left: `${pct(tMin)}%`,
              width: `${Math.max(0, pct(tMax) - pct(tMin))}%`,
              background: 'rgba(0,147,231,0.22)',
              borderRadius: 4,
            }}
          />
        )}
        <div
          className="absolute"
          style={{
            top: 0,
            bottom: 0,
            left: 0,
            width: `${pct(strain)}%`,
            background: COLORS.strain,
            borderRadius: 4,
          }}
        />
        <div
          className="absolute"
          style={{
            width: 2,
            top: -2,
            bottom: -2,
            left: `calc(${pct(strain)}% - 1px)`,
            background: COLORS.text,
          }}
        />
      </div>
      <div className="w-full flex items-center justify-between mt-1">
        <span className="lbl">0</span>
        <span className="lbl">21</span>
      </div>
      {hasTarget && <div className="lbl mt-1">TARGET {tMin}–{tMax}</div>}
    </div>
  );
}

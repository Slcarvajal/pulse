// Health Monitor screen — five RangeBar metric cards + VO2 max. SPEC §6.9, §7.7, §7.14 Health.
import Card from '../components/Card.jsx';
import RangeBar from '../components/RangeBar.jsx';
import { COLORS } from '../theme.js';

const fmt = (v, d) => (v === null || v === undefined || Number.isNaN(v) ? '--' : v.toFixed(d));
const fmtSigned = (v, d) => {
  if (v === null || v === undefined || Number.isNaN(v)) return '--';
  const s = v.toFixed(d);
  return v > 0 ? `+${s}` : s;
};

const METRICS = [
  { key: 'rhr', label: 'RESTING HEART RATE', unit: 'BPM', decimals: 0, rangeDecimals: 0 },
  { key: 'hrv', label: 'HRV', unit: 'MS', decimals: 1, rangeDecimals: 1 },
  { key: 'respiratoryRate', label: 'RESPIRATORY RATE', unit: 'RPM', decimals: 1, rangeDecimals: 1 },
  { key: 'spo2', label: 'BLOOD OXYGEN', unit: '%', decimals: 1, rangeDecimals: 1 },
  { key: 'skinTempDeviation', label: 'SKIN TEMPERATURE', unit: '°C', decimals: 2, rangeDecimals: 2, signed: true, accent: COLORS.temp },
];

export default function Health({ data }) {
  const today = data?.today || {};
  const ranges = data?.personalRange || {};

  const vo2max = today.vo2max;
  const vo2maxLevel = today.vo2maxLevel;
  const vo2Pct = vo2max === null || vo2max === undefined ? 0 : Math.max(0, Math.min(100, (vo2max / 60) * 100));

  return (
    <div
      className="w-full flex flex-col"
      style={{ background: COLORS.bg, paddingLeft: 16, paddingRight: 16, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 88, gap: 12, minHeight: '100%' }}
    >
      <div className="w-full flex items-center" style={{ height: 48 }}>
        <span
          style={{
            fontFamily: "'Barlow Condensed', system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: COLORS.muted,
          }}
        >
          HEALTH MONITOR
        </span>
      </div>

      {METRICS.map((m) => {
        const value = today[m.key];
        const range = ranges[m.key];
        const isMissing = value === null || value === undefined || Number.isNaN(value);
        const valueStr = m.signed ? fmtSigned(value, m.decimals) : fmt(value, m.decimals);
        const rMin = range?.min;
        const rMax = range?.max;
        const rangeStr = `30D RANGE ${fmt(rMin, m.rangeDecimals)}–${fmt(rMax, m.rangeDecimals)}`;
        return (
          <Card key={m.key} label={m.label}>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="num-2" style={isMissing ? { color: COLORS.muted } : undefined}>{valueStr}</span>
              <span className="lbl">{m.unit}</span>
            </div>
            <RangeBar value={isMissing ? null : value} range={range} accent={m.accent} />
            <div className="mt-2">
              <span className="lbl">{rangeStr}</span>
            </div>
            {isMissing && (
              <div className="mt-1">
                <span className="lbl">NO READING YET</span>
              </div>
            )}
          </Card>
        );
      })}

      <Card label="VO2 MAX">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="num-card">{fmt(vo2max, 1)}</span>
          <span className="lbl">ML/KG/MIN</span>
        </div>
        <div
          className="mb-3"
          style={{
            fontFamily: "'Barlow Condensed', system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: COLORS.text,
          }}
        >
          {vo2maxLevel || '—'}
        </div>
        <div className="relative w-full" style={{ height: 6 }}>
          <div className="absolute inset-0" style={{ background: COLORS.track, borderRadius: 3 }} />
          {vo2max !== null && vo2max !== undefined && (
            <div
              className="absolute rounded-full"
              style={{
                width: 6,
                height: 12,
                top: -3,
                left: `calc(${vo2Pct}% - 3px)`,
                background: COLORS.text,
                borderRadius: 3,
              }}
            />
          )}
        </div>
        <div className="w-full flex items-center justify-between mt-1">
          <span className="lbl">0</span>
          <span className="lbl">60</span>
        </div>
      </Card>
    </div>
  );
}

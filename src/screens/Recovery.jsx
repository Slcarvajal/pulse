// Recovery screen — hero recovery ring, five INPUTS metric cards, 7-day recovery trend.
// SPEC §6.1 (recoveryV2 inputs/weights), §7.14 Recovery.
import Card from '../components/Card.jsx';
import Ring from '../components/Ring.jsx';
import MetricCard from '../components/MetricCard.jsx';
import { COLORS, RING, band } from '../theme.js';

function fmt(value, decimals, signed = false) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  const n = Number(Number(value).toFixed(decimals));
  if (signed && n > 0) return `+${n.toFixed(decimals)}`;
  return n.toFixed(decimals);
}

function last7(history, key) {
  return (history || []).slice(-7).map((d) => (d && d[key] !== undefined ? d[key] : null));
}

const INPUTS = [
  { key: 'hrv', label: 'HRV', unit: 'ms', decimals: 0 },
  { key: 'rhr', label: 'RESTING HEART RATE', unit: 'bpm', decimals: 0 },
  { key: 'respiratoryRate', label: 'RESPIRATORY RATE', unit: 'rpm', decimals: 1 },
  { key: 'spo2', label: 'BLOOD OXYGEN', unit: '%', decimals: 1 },
  { key: 'skinTempDeviation', label: 'SKIN TEMPERATURE', unit: '°C', decimals: 2, signed: true },
];

function RecoveryTrend({ history }) {
  const days = (history || []).slice(-7);
  const width = 311;
  const height = 90;
  const padX = 14;
  const padY = 10;
  const n = days.length;

  const points = days.map((d, i) => {
    const v = d && typeof d.recovery === 'number' ? d.recovery : null;
    const x = n > 1 ? padX + (i / (n - 1)) * (width - 2 * padX) : width / 2;
    const y = v === null ? null : padY + (1 - Math.max(0, Math.min(100, v)) / 100) * (height - 2 * padY);
    return { x, y, value: v, color: v === null ? COLORS.dim : band(v).color };
  });
  const known = points.filter((p) => p.y !== null);

  return (
    <Card label="7-DAY RECOVERY">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polyline
          points={known.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={COLORS.muted}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {known.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={p.color} />
        ))}
      </svg>
      <div className="w-full flex" style={{ marginTop: 6 }}>
        {points.map((p, i) => (
          <span key={i} className="lbl" style={{ flex: 1, textAlign: 'center' }}>
            {p.value === null ? '--' : Math.round(p.value)}
          </span>
        ))}
      </div>
    </Card>
  );
}

export default function Recovery({ data }) {
  const today = data?.today ?? {};
  const deltas = data?.deltas ?? {};
  const history = data?.history ?? [];
  const recovery = typeof today.recovery === 'number' ? today.recovery : 0;
  const info = band(recovery);

  return (
    <div
      style={{
        background: COLORS.bg,
        minHeight: '100%',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 88,
      }}
    >
      <div style={{ height: 48, display: 'flex', alignItems: 'center' }}>
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
          RECOVERY
        </span>
      </div>

      <div className="flex flex-col" style={{ gap: 12 }}>
        <div className="w-full flex flex-col items-center" style={{ paddingTop: 8, paddingBottom: 8 }}>
          <Ring size={RING.hero.size} stroke={RING.hero.stroke} value={recovery} max={100} color={info.color} sub={info.word} label="RECOVERY">
            <span className="lbl" style={{ color: COLORS.muted }}>%</span>
          </Ring>
        </div>

        <span className="lbl">INPUTS</span>

        {INPUTS.map((inp) => {
          const raw = today[inp.key];
          const value = fmt(raw, inp.decimals, inp.signed);
          const delta = deltas ? deltas[inp.key] : undefined;
          return (
            <MetricCard
              key={inp.key}
              label={inp.label}
              value={value}
              unit={inp.unit}
              delta={delta}
              deltaDecimals={inp.decimals}
              data={last7(history, inp.key)}
            />
          );
        })}

        <RecoveryTrend history={history} />
      </div>
    </div>
  );
}

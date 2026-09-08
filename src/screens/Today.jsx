// Today screen — hero recovery ring, strain/sleep rings, 2x2 stat grid, refresh icon (SPEC §7 "Today").
import Ring from '../components/Ring.jsx';
import Stat from '../components/Stat.jsx';
import { COLORS, band } from '../theme.js';

function RefreshIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0 0 12.5 2.5M18.5 9A7 7 0 0 0 6 6.5"
        stroke={COLORS.muted}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Today({ data, onRefresh, refreshing }) {
  const today = data?.today ?? {};
  const deltas = data?.deltas ?? {};
  const info = band(today.recovery ?? 0);

  return (
    <div className="px-4 pt-6 pb-24 flex flex-col items-center gap-8">
      <div className="w-full flex items-center justify-between">
        <span className="text-label uppercase text-muted">Pulse</span>
        <button type="button" onClick={onRefresh} aria-label="Refresh" className={refreshing ? 'animate-spin' : ''}>
          <RefreshIcon />
        </button>
      </div>

      <Ring size={220} value={today.recovery ?? 0} max={100} color={info.color}>
        <span className="text-2xl font-bold tabular-nums text-text -mt-1">%</span>
        <span className="text-label uppercase mt-2" style={{ color: info.color }}>
          {info.name} · {info.word}
        </span>
      </Ring>

      <div className="w-full flex justify-center gap-10">
        <Ring size={120} value={today.strain ?? 0} max={21} color={COLORS.strainBlue} label="STRAIN">
          <span className="text-label text-muted">/21</span>
        </Ring>
        <Ring size={120} value={today.sleepScore ?? 0} max={100} color={COLORS.sleepTeal} label="SLEEP">
          <span className="text-label text-muted">%</span>
        </Ring>
      </div>

      <div className="w-full grid grid-cols-2 gap-x-6 gap-y-6">
        <Stat label="RHR" value={today.rhr ?? '--'} unit="bpm" delta={deltas.rhr} deltaInvert />
        <Stat label="HRV" value={today.hrv ?? '--'} unit="ms" delta={deltas.hrv} />
        <Stat label="SpO2" value={today.spo2 ?? '--'} unit="%" />
        <Stat label="Steps" value={today.steps ?? '--'} />
      </div>
    </div>
  );
}

// Stat — uppercase micro-label, huge tabular-nums value, optional Delta chip.
import Delta from './Delta.jsx';

export default function Stat({ label, value, unit, delta, deltaDecimals = 0, deltaInvert = false }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label uppercase text-muted">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-secondary tabular-nums text-text">{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {delta !== undefined && <Delta value={delta} decimals={deltaDecimals} invert={deltaInvert} />}
    </div>
  );
}

// MetricCard — one recovery-input metric: label, value, delta, 7-day sparkline. SPEC §7.6.
import Card from './Card.jsx';
import Delta from './Delta.jsx';
import Sparkline from './Sparkline.jsx';
import { COLORS } from '../theme.js';

export default function MetricCard({ label, value, unit, delta, deltaDecimals = 0, data = [] }) {
  return (
    <Card>
      <div className="w-full flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="lbl">{label}</span>
          <div className="flex items-baseline gap-1">
            <span className="num-2">{value}</span>
            {unit && <span className="lbl" style={{ color: COLORS.muted }}>{unit}</span>}
          </div>
          {delta !== undefined && <Delta value={delta} decimals={deltaDecimals} />}
        </div>
        <Sparkline data={data} width={88} height={32} />
      </div>
    </Card>
  );
}

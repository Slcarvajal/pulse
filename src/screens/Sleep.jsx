// Sleep screen — hero performance ring, hours-vs-need, hypnogram, stage/latency stats, consistency, need breakdown, 7-night bars. SPEC §7.14 Sleep.
import Card from '../components/Card.jsx';
import Ring from '../components/Ring.jsx';
import Hypnogram from '../components/Hypnogram.jsx';
import { COLORS } from '../theme.js';

const STAGE_COLOR = {
  DEEP: '#7BA1BB',
  REM: 'rgba(123,161,187,0.75)',
  LIGHT: 'rgba(123,161,187,0.45)',
  AWAKE: '#3A3F47',
};

const SLEEP_DEBT = 'rgba(123,161,187,0.6)';
const SLEEP_STRAIN = 'rgba(123,161,187,0.35)';

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function initialFor(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  return DAY_INITIALS[new Date(y, m - 1, d).getDay()];
}

function signedBed(m) {
  return m >= 720 ? m - 1440 : m;
}

function stddev(arr) {
  const clean = (arr || []).filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (clean.length < 2) return 0;
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length;
  const variance = clean.reduce((a, b) => a + (b - mean) ** 2, 0) / clean.length;
  return Math.sqrt(variance);
}

function Tile({ value, label, dot }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="num-2">{value}</span>
      <div className="flex items-center gap-1.5">
        {dot && <span style={{ width: 6, height: 6, borderRadius: 3, background: dot }} />}
        <span className="lbl">{label}</span>
      </div>
    </div>
  );
}

export default function Sleep({ data }) {
  const sleep = data?.sleep || {};
  const stages = sleep.stages || {};
  const nights = Array.isArray(sleep.nights) ? sleep.nights : [];
  const needBreakdown = sleep.needBreakdown || {};

  const asleepMin = sleep.asleepMin ?? 0;
  const needHours = sleep.need ?? 7.5;
  const needMin = needHours * 60;
  const barMax = Math.max(asleepMin, needMin, 1) * 1.05;
  const asleepPct = Math.min(100, (asleepMin / barMax) * 100);
  const needPct = Math.min(100, (needMin / barMax) * 100);
  const asleepH = Math.floor(asleepMin / 60);
  const asleepM = Math.round(asleepMin % 60);
  const needH = Math.floor(needHours);
  const needM = Math.round((needHours - needH) * 60);

  const sdBed = Math.round(stddev(nights.map((n) => signedBed(n.bedtimeMin ?? 0))));
  const sdWake = Math.round(stddev(nights.map((n) => n.wakeMin ?? 0)));

  const baseline = needBreakdown.baseline ?? 0;
  const debt = needBreakdown.debt ?? 0;
  const strain = needBreakdown.strain ?? 0;
  const nap = needBreakdown.nap ?? 0;
  const posTotal = Math.max(0.001, baseline + debt + strain);
  const napAbs = Math.abs(nap);
  const barDomain = Math.max(posTotal + napAbs, 0.001);

  const last7 = nights.slice(-7);
  const hoursVals = last7.map((n) => (n.asleepMin ?? 0) / 60);
  const meanNeed = last7.length ? last7.reduce((a, n) => a + (n.need ?? 0), 0) / last7.length : 0;
  const chartMax = Math.max(meanNeed, ...hoursVals, 1) + 0.5;
  const CHART_H = 100;
  const meanY = CHART_H - (meanNeed / chartMax) * CHART_H;

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
        <span className="lbl-lg" style={{ letterSpacing: '0.2em' }}>SLEEP</span>
      </div>

      <div className="flex flex-col" style={{ gap: 12 }}>
        {/* 2. Hero performance ring */}
        <Card>
          <div className="w-full flex flex-col items-center py-2">
            <Ring size={220} value={sleep.performance ?? 0} max={100} color={COLORS.sleep} label="SLEEP PERFORMANCE">
              <span className="lbl-lg" style={{ color: COLORS.muted, marginTop: -8 }}>%</span>
            </Ring>
          </div>
        </Card>

        {/* 3. Hours vs need */}
        <Card label="HOURS VS NEED">
          <div className="relative w-full" style={{ height: 8 }}>
            <div className="absolute inset-0" style={{ background: COLORS.track, borderRadius: 4 }} />
            <div
              className="absolute"
              style={{ top: 0, bottom: 0, left: 0, width: `${asleepPct}%`, background: COLORS.sleep, borderRadius: 4 }}
            />
            <div
              className="absolute"
              style={{ top: -2, bottom: -2, left: `calc(${needPct}% - 1px)`, width: 2, background: COLORS.text }}
            />
          </div>
          <div className="mt-2">
            <span className="lbl">
              {asleepH}H {asleepM}M OF {needH}H {needM}M
            </span>
          </div>
        </Card>

        {/* 4. Sleep stages hypnogram */}
        <Card label="SLEEP STAGES">
          <Hypnogram segments={sleep.hypnogram || []} start={sleep.start} end={sleep.end} />
        </Card>

        {/* 5. Stage tile row */}
        <Card>
          <div className="w-full grid grid-cols-4">
            <Tile value={stages.deep ?? 0} label="DEEP" dot={STAGE_COLOR.DEEP} />
            <Tile value={stages.rem ?? 0} label="REM" dot={STAGE_COLOR.REM} />
            <Tile value={stages.light ?? 0} label="LIGHT" dot={STAGE_COLOR.LIGHT} />
            <Tile value={stages.awake ?? 0} label="AWAKE" dot={STAGE_COLOR.AWAKE} />
          </div>
        </Card>

        {/* 6. Latency/awake/disturbances/efficiency row */}
        <Card>
          <div className="w-full grid grid-cols-4">
            <Tile value={sleep.latencyMin ?? 0} label="LATENCY" />
            <Tile value={sleep.awakeMin ?? 0} label="AWAKE" />
            <Tile value={sleep.disturbances ?? 0} label="DISTURBANCES" />
            <Tile value={Math.round(sleep.efficiency ?? 0)} label="EFFICIENCY" />
          </div>
        </Card>

        {/* 7. Consistency */}
        <Card label="CONSISTENCY">
          <span className="num-card">{Math.round(sleep.consistency ?? 0)}</span>
          <div className="mt-1">
            <span className="lbl">
              BEDTIME ±{sdBed}M · WAKE ±{sdWake}M
            </span>
          </div>
        </Card>

        {/* 8. Sleep need breakdown */}
        <Card
          label="SLEEP NEED"
          right={
            <div className="text-right">
              <span className="num-2">{Math.round((sleep.debtHours ?? 0) * 10) / 10}H</span>
            </div>
          }
        >
          <svg width="100%" height="16" viewBox="0 0 100 16" preserveAspectRatio="none">
            <defs>
              <pattern id="sleepNapHatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="4" height="4" fill="transparent" />
                <line x1="0" y1="0" x2="0" y2="4" stroke={COLORS.dim} strokeWidth="2" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="100" height="16" rx="2" fill={COLORS.track} />
            <rect x="0" y="0" width={(baseline / barDomain) * 100} height="16" fill={COLORS.sleep} />
            <rect
              x={(baseline / barDomain) * 100}
              y="0"
              width={(debt / barDomain) * 100}
              height="16"
              fill={SLEEP_DEBT}
            />
            <rect
              x={((baseline + debt) / barDomain) * 100}
              y="0"
              width={(strain / barDomain) * 100}
              height="16"
              fill={SLEEP_STRAIN}
            />
            {napAbs > 0 && (
              <rect
                x={(posTotal / barDomain) * 100}
                y="0"
                width={(napAbs / barDomain) * 100}
                height="16"
                fill="url(#sleepNapHatch)"
              />
            )}
          </svg>
          <div className="w-full flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
            <span className="lbl flex items-center gap-1.5">
              <span style={{ width: 6, height: 6, borderRadius: 3, background: COLORS.sleep, display: 'inline-block' }} />
              BASELINE {baseline}H
            </span>
            <span className="lbl flex items-center gap-1.5">
              <span style={{ width: 6, height: 6, borderRadius: 3, background: SLEEP_DEBT, display: 'inline-block' }} />
              DEBT {debt}H
            </span>
            <span className="lbl flex items-center gap-1.5">
              <span style={{ width: 6, height: 6, borderRadius: 3, background: SLEEP_STRAIN, display: 'inline-block' }} />
              STRAIN {strain}H
            </span>
            <span className="lbl flex items-center gap-1.5">
              <span style={{ width: 6, height: 6, borderRadius: 3, background: COLORS.dim, display: 'inline-block' }} />
              NAP -{napAbs}H
            </span>
          </div>
        </Card>

        {/* 9. Last 7 nights */}
        <Card label="LAST 7 NIGHTS">
          <svg width="100%" height={CHART_H} viewBox={`0 0 100 ${CHART_H}`} preserveAspectRatio="none">
            <line
              x1="0"
              x2="100"
              y1={meanY}
              y2={meanY}
              stroke={COLORS.dim}
              strokeWidth="1"
              strokeDasharray="3,3"
              vectorEffect="non-scaling-stroke"
            />
            {hoursVals.map((h, i) => {
              const n = last7.length || 1;
              const gap = 2;
              const bw = (100 - gap * (n - 1)) / n;
              const x = i * (bw + gap);
              const bh = (h / chartMax) * CHART_H;
              return (
                <rect
                  key={i}
                  x={x}
                  y={CHART_H - bh}
                  width={bw}
                  height={Math.max(0, bh)}
                  rx="1"
                  fill={COLORS.sleep}
                />
              );
            })}
          </svg>
          <div className="w-full flex justify-between mt-1">
            {last7.map((n, i) => (
              <span key={i} className="lbl">
                {initialFor(n.date)}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

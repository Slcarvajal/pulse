// Home screen — header, stale banner, day strip, hero recovery ring, strain/sleep rings, HR timeline, health monitor summary (SPEC §7.14).
import { motion } from 'framer-motion';
import Card from '../components/Card.jsx';
import Ring from '../components/Ring.jsx';
import DayStrip from '../components/DayStrip.jsx';
import HRTimeline from '../components/HRTimeline.jsx';
import { COLORS, RING, MOTION, band, rangeState } from '../theme.js';

const HEALTH_DOTS = [
  { key: 'rhr', label: 'RHR' },
  { key: 'hrv', label: 'HRV' },
  { key: 'respiratoryRate', label: 'RESP' },
  { key: 'spo2', label: 'SPO2' },
  { key: 'skinTempDeviation', label: 'TEMP' },
];

function TrendsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 19V5M4 19h16M7 15l3.5-4 3 3L19 8" stroke={COLORS.dim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0 0 12.5 2.5M18.5 9A7 7 0 0 0 6 6.5"
        stroke={COLORS.dim}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StaleBanner() {
  return (
    <div
      className="w-full flex items-center justify-center"
      style={{ height: 28, background: 'rgba(245,166,35,0.10)', borderBottom: `1px solid ${COLORS.hairline}` }}
    >
      <span className="lbl" style={{ color: COLORS.temp }}>SHOWING CACHED DATA</span>
    </div>
  );
}

function fadeIn(i) {
  return {
    initial: { opacity: 0, y: MOTION.card.y },
    animate: { opacity: 1, y: 0 },
    transition: { duration: MOTION.card.duration, delay: i * MOTION.card.stagger },
  };
}

export default function Home({ data = {}, onRefresh, refreshing, onNavigate }) {
  const today = data?.today ?? {};
  const sleep = data?.sleep ?? {};
  const personalRange = data?.personalRange ?? {};
  const history = Array.isArray(data?.history) ? data.history : [];
  const days = history.slice(-7);
  const info = band(today.recovery ?? 0);

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
      <div className="w-full flex items-center justify-between" style={{ height: 48 }}>
        <span className="lbl-lg" style={{ letterSpacing: '0.2em', color: COLORS.muted }}>PULSE</span>
        <div className="flex items-center" style={{ gap: 16 }}>
          <button type="button" aria-label="Trends" onClick={() => onNavigate?.('trends')}>
            <TrendsIcon />
          </button>
          <button
            type="button"
            aria-label="Refresh"
            onClick={onRefresh}
            className={refreshing ? 'animate-spin' : ''}
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      {data?.stale && <StaleBanner />}

      <div className="w-full flex flex-col" style={{ gap: 12, marginTop: 12 }}>
        <motion.div {...fadeIn(0)}>
          <DayStrip days={days} />
        </motion.div>

        <motion.div {...fadeIn(1)}>
          <Card className="flex flex-col items-center">
            <Ring size={RING.hero.size} stroke={RING.hero.stroke} value={today.recovery ?? 0} max={100} color={info.color} sub={info.word} label="RECOVERY">
              <span className="lbl" style={{ color: COLORS.muted }}>%</span>
            </Ring>
          </Card>
        </motion.div>

        <motion.div {...fadeIn(2)} className="w-full grid grid-cols-2" style={{ gap: 12 }}>
          <Card className="flex flex-col items-center">
            <Ring size={RING.small.size} stroke={RING.small.stroke} value={today.strain ?? 0} max={21} color={COLORS.strain} label="STRAIN" />
          </Card>
          <Card className="flex flex-col items-center">
            <Ring size={RING.small.size} stroke={RING.small.stroke} value={sleep.performance ?? 0} max={100} color={COLORS.sleep} label="SLEEP">
              <span className="lbl" style={{ color: COLORS.muted }}>%</span>
            </Ring>
          </Card>
        </motion.div>

        <motion.div {...fadeIn(3)}>
          <Card label="HEART RATE">
            <HRTimeline hrDay={data?.hrDay ?? []} hrZones={data?.hrZones ?? []} latestHr={data?.latestHr} />
          </Card>
        </motion.div>

        <motion.div {...fadeIn(4)}>
          <Card label="HEALTH MONITOR" style={{ cursor: 'pointer' }} onClick={() => onNavigate?.('health')}>
            <div className="w-full grid grid-cols-5">
              {HEALTH_DOTS.map((m) => {
                const value = today[m.key];
                const range = personalRange[m.key];
                const state = rangeState(value, range);
                const outColor = m.key === 'skinTempDeviation' ? COLORS.temp : COLORS.red;
                const dotColor = state === 'in' ? COLORS.text : state === 'unknown' ? COLORS.dim : outColor;
                return (
                  <div key={m.key} className="flex flex-col items-center" style={{ gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: dotColor, display: 'inline-block' }} />
                    <span className="lbl">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

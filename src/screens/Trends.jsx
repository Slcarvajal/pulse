// Trends screen — back chevron, 7D/30D segment control, three Bars cards vs period mean. SPEC §7.14.
import { useState } from 'react';
import Bars from '../components/Bars.jsx';
import Card from '../components/Card.jsx';
import { COLORS, band } from '../theme.js';

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + (b.value ?? b), 0) / arr.length : 0);
const withDate = (rows, key) =>
  rows
    .filter((d) => typeof d?.[key] === 'number' && !Number.isNaN(d[key]))
    .map((d) => ({ value: d[key], date: d.date }));
const dayInitial = (dateStr) => new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { weekday: 'narrow' });
const shortDate = (dateStr) => {
  const d = new Date(`${dateStr}T12:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
const xLabelsFor = (rows, range) => {
  if (!rows.length) return [];
  if (range === '7D') return rows.map((r) => dayInitial(r.date));
  return rows.map((r, i) => (i === 0 || i === rows.length - 1 ? shortDate(r.date) : ''));
};

function BackChevron() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M15 5l-7 7 7 7" stroke={COLORS.dim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeaderTitle({ children }) {
  return (
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
      {children}
    </span>
  );
}

function Segment({ range, setRange }) {
  return (
    <div className="flex gap-2">
      {['7D', '30D'].map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setRange(r)}
          style={{
            height: 28,
            padding: '0 14px',
            borderRadius: 14,
            background: range === r ? COLORS.surface2 : 'transparent',
            color: range === r ? COLORS.text : COLORS.dim,
            fontFamily: "'Barlow Condensed', system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          }}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

export default function Trends({ data, onBack }) {
  const [range, setRange] = useState('7D');
  const history = Array.isArray(data?.history) ? data.history : [];
  const windowed = range === '7D' ? history.slice(-7) : history.slice(-30);

  const recoveryData = withDate(windowed, 'recovery');
  const strainData = withDate(windowed, 'strain');
  const sleepData = withDate(windowed, 'sleepScore');

  return (
    <div
      className="flex flex-col gap-3 px-4"
      style={{ background: COLORS.bg, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 88, minHeight: '100vh' }}
    >
      <div className="flex items-center gap-3" style={{ height: 48 }}>
        <button type="button" onClick={onBack} aria-label="Back">
          <BackChevron />
        </button>
        <HeaderTitle>TRENDS</HeaderTitle>
      </div>

      <Segment range={range} setRange={setRange} />

      {!history.length ? (
        <Card label="RECOVERY">
          <span className="lbl">NO TREND DATA</span>
        </Card>
      ) : (
        <>
          <Card label="RECOVERY">
            <Bars
              data={recoveryData}
              colorFor={(v) => band(v).color}
              mean={mean(recoveryData)}
              max={100}
              xLabels={xLabelsFor(recoveryData, range)}
            />
          </Card>
          <Card label="STRAIN">
            <Bars
              data={strainData}
              colorFor={() => COLORS.strain}
              mean={mean(strainData)}
              max={21}
              xLabels={xLabelsFor(strainData, range)}
            />
          </Card>
          <Card label="SLEEP">
            <Bars
              data={sleepData}
              colorFor={() => COLORS.sleep}
              mean={mean(sleepData)}
              max={100}
              xLabels={xLabelsFor(sleepData, range)}
            />
          </Card>
        </>
      )}
    </div>
  );
}

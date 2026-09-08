// Trends screen — 7D/30D segmented control, three Bars charts vs 30-day mean baseline (SPEC §7).
import { useState } from 'react';
import Bars from '../components/Bars.jsx';
import { COLORS, band } from '../theme.js';

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

function Section({ label, children, baseline }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-label uppercase text-muted">{label}</span>
        <span className="text-label uppercase text-muted">avg {Math.round(baseline)}</span>
      </div>
      {children}
    </div>
  );
}

export default function Trends({ data }) {
  const [range, setRange] = useState('7D');
  const history = data?.history || [];
  const windowed = range === '7D' ? history.slice(-7) : history.slice(-30);

  if (!history.length) {
    return (
      <div className="min-h-screen bg-black text-text pb-28 px-4 pt-6 flex flex-col gap-8">
        <span className="text-label uppercase text-muted">Trends</span>
        <p className="text-sm text-muted">No trend data available.</p>
      </div>
    );
  }

  const recoveryAll = history.map((d) => d.recovery);
  const strainAll = history.map((d) => d.strain);
  const sleepAll = history.map((d) => d.sleepScore);

  const recoveryBaseline = mean(recoveryAll);
  const strainBaseline = mean(strainAll);
  const sleepBaseline = mean(sleepAll);

  return (
    <div className="min-h-screen bg-black text-text pb-28 px-4 pt-6 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <span className="text-label uppercase text-muted">Trends</span>
        <div className="flex rounded-full bg-surface p-1">
          {['7D', '30D'].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1 rounded-full text-label uppercase transition-colors ${
                range === r ? 'bg-text text-black' : 'text-muted'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <Section label="Recovery" baseline={recoveryBaseline}>
        <Bars
          data={windowed.map((d) => d.recovery)}
          colorFor={(v) => band(v).color}
          baseline={recoveryBaseline}
          max={100}
        />
      </Section>

      <Section label="Strain" baseline={strainBaseline}>
        <Bars
          data={windowed.map((d) => d.strain)}
          colorFor={() => COLORS.strainBlue}
          baseline={strainBaseline}
          max={21}
        />
      </Section>

      <Section label="Sleep" baseline={sleepBaseline}>
        <Bars
          data={windowed.map((d) => d.sleepScore)}
          colorFor={() => COLORS.sleepTeal}
          baseline={sleepBaseline}
          max={100}
        />
      </Section>
    </div>
  );
}

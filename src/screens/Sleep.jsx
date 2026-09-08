// Sleep screen — hours vs need, stacked sleep stages, RHR/HRV hero numbers, 7-night mini bars.
import Delta from '../components/Delta.jsx';
import Bars from '../components/Bars.jsx';
import { COLORS } from '../theme.js';

const STAGE_COLORS = {
  deep: COLORS.sleepTeal,
  rem: COLORS.strainBlue,
  light: COLORS.muted,
  awake: COLORS.recoveryYellow,
};

export default function Sleep({ data }) {
  if (!data || !data.today) {
    return (
      <div className="flex flex-col gap-8 p-4 pb-24">
        <span className="text-label uppercase text-muted">Sleep</span>
        <p className="text-sm text-muted">No sleep data available.</p>
      </div>
    );
  }

  const today = data?.today || {};
  const deltas = data?.deltas || {};
  const stages = data?.sleepStages || {};
  const history = data?.history || [];

  const sleepHours = today.sleepHours ?? 0;
  const sleepNeed = today.sleepNeed ?? 0;
  const barMax = Math.max(sleepHours, sleepNeed, 1) * 1.15;
  const hoursPct = Math.min(100, (sleepHours / barMax) * 100);
  const needPct = Math.min(100, (sleepNeed / barMax) * 100);

  const stageEntries = ['deep', 'rem', 'light', 'awake'].map((key) => ({
    key,
    minutes: stages[key] ?? 0,
  }));
  const totalMinutes = Math.max(1, stageEntries.reduce((sum, s) => sum + s.minutes, 0));

  const lastWeek = history.slice(-7);

  return (
    <div className="flex flex-col gap-8 p-4 pb-24">
      <div>
        <span className="text-label uppercase text-muted">Sleep</span>
      </div>

      {/* Hours slept vs need */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-secondary tabular-nums text-text">{sleepHours}</span>
            <span className="text-sm text-muted">hrs</span>
          </div>
          <span className="text-sm text-muted tabular-nums">need {sleepNeed}h</span>
        </div>
        <div className="relative h-3 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.surface }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${hoursPct}%`, backgroundColor: COLORS.sleepTeal }}
          />
          <div
            className="absolute inset-y-0"
            style={{ left: `${needPct}%`, borderLeft: `2px dashed ${COLORS.muted}` }}
          />
        </div>
      </section>

      {/* Stacked sleep stages */}
      <section className="flex flex-col gap-3">
        <span className="text-label uppercase text-muted">Stages</span>
        <div className="flex h-4 w-full rounded-full overflow-hidden" style={{ backgroundColor: COLORS.surface }}>
          {stageEntries.map((s) => (
            <div
              key={s.key}
              style={{
                width: `${(s.minutes / totalMinutes) * 100}%`,
                backgroundColor: STAGE_COLORS[s.key],
              }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {stageEntries.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_COLORS[s.key] }} />
              <span className="text-label uppercase text-muted">{s.key}</span>
              <span className="text-sm tabular-nums text-text">{s.minutes}m</span>
            </div>
          ))}
        </div>
      </section>

      {/* RHR / HRV hero numbers */}
      <section className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-label uppercase text-muted">RHR</span>
          <span className="text-hero tabular-nums text-text leading-none">{today.rhr ?? '--'}</span>
          <Delta value={deltas.rhr} invert />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-label uppercase text-muted">HRV</span>
          <span className="text-hero tabular-nums text-text leading-none">{today.hrv ?? '--'}</span>
          <Delta value={deltas.hrv} />
        </div>
      </section>

      {/* 7-night mini bars */}
      <section className="flex flex-col gap-3">
        <span className="text-label uppercase text-muted">Last 7 Nights</span>
        <Bars
          data={lastWeek.map((d) => d.sleepHours ?? 0)}
          colorFor={() => COLORS.sleepTeal}
          height={60}
        />
      </section>
    </div>
  );
}

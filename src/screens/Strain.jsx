// Strain screen — hero strain ring, StrainBar target, workouts, time-in-zones, activity tiles. SPEC §6.2/§6.3/§7.14 Strain.
import Card from '../components/Card.jsx';
import Ring from '../components/Ring.jsx';
import StrainBar from '../components/StrainBar.jsx';
import { COLORS, band } from '../theme.js';

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const ZONE_KEYS = ['light', 'moderate', 'vigorous', 'peak'];
const ZONE_LABELS = { light: 'LIGHT', moderate: 'MODERATE', vigorous: 'VIGOROUS', peak: 'PEAK' };
const ZONE_ALPHA = { light: 0.3, moderate: 0.5, vigorous: 0.75, peak: 1.0 };

function fmtTime(iso) {
  if (!iso) return '--';
  try {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(
      new Date(iso)
    );
  } catch {
    return '--';
  }
}

function WorkoutCard({ w }) {
  const zoneMin = w.zoneMin || {};
  const total = ZONE_KEYS.reduce((s, k) => s + (zoneMin[k] || 0), 0);
  return (
    <Card>
      <div className="w-full flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="lbl-lg" style={{ color: COLORS.text }}>
            {w.name ?? w.type ?? 'WORKOUT'}
          </span>
          <span className="lbl">
            {fmtTime(w.start)} · {w.durationMin ?? '--'} MIN
          </span>
        </div>
        <span className="num-2" style={{ color: COLORS.strain }}>
          {typeof w.activityStrain === 'number' ? w.activityStrain.toFixed(1) : '--'}
        </span>
      </div>
      <div className="w-full flex mt-3" style={{ height: 6, borderRadius: 3, overflow: 'hidden', background: COLORS.track }}>
        {total > 0 &&
          ZONE_KEYS.map((k) => {
            const min = zoneMin[k] || 0;
            if (min <= 0) return null;
            return (
              <div
                key={k}
                style={{
                  width: `${(min / total) * 100}%`,
                  height: '100%',
                  background: hexToRgba(COLORS.strain, ZONE_ALPHA[k]),
                }}
              />
            );
          })}
      </div>
      <div className="w-full mt-2">
        <span className="lbl">
          AVG {w.avgHr ?? '--'} BPM · {w.kcal ?? '--'} CAL
        </span>
      </div>
    </Card>
  );
}

export default function Strain({ data }) {
  const today = data?.today ?? {};
  const strain = typeof today.strain === 'number' ? today.strain : 0;
  const target = today.strainTarget || undefined;
  const workouts = Array.isArray(data?.workouts) ? data.workouts : [];
  const zoneMinutes = data?.zoneMinutes || {};
  const info = band(today.recovery ?? 0);

  const zoneVals = ['LIGHT', 'MODERATE', 'VIGOROUS', 'PEAK'].map((k) => zoneMinutes[k] || 0);
  const barKeys = ['moderate', 'vigorous', 'peak'];
  const barVals = ['MODERATE', 'VIGOROUS', 'PEAK'].map((k) => zoneMinutes[k] || 0);
  const barMax = Math.max(30, ...barVals);
  const lightVal = zoneVals[0];
  const fmtZoneMin = (min) => {
    if (min >= 60) return `${Math.floor(min / 60)}H ${min % 60}M`;
    return `${min} MIN`;
  };

  const calories = today.calories || {};
  const distanceKm = typeof today.distanceKm === 'number' ? today.distanceKm.toFixed(1) : '--';
  const stepsFmt =
    typeof today.steps === 'number'
      ? today.steps >= 1000
        ? `${(today.steps / 1000).toFixed(1)}K`
        : String(today.steps)
      : '--';

  return (
    <div className="min-h-full" style={{ background: COLORS.bg, paddingBottom: 88, paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="px-4">
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
            STRAIN
          </span>
        </div>

        <div className="w-full flex flex-col items-center py-4">
          <Ring size={220} stroke={10} value={strain} max={21} color={COLORS.strain} label="STRAIN">
            <span className="lbl mt-1">/ 21</span>
          </Ring>
        </div>

        <div className="flex flex-col gap-3">
          <Card>
            <StrainBar strain={strain} target={target} />
            {target && (
              <div className="lbl mt-1">
                {info.name} RECOVERY
              </div>
            )}
          </Card>

          <div>
            <span className="lbl">WORKOUTS</span>
            <div className="flex flex-col gap-3 mt-2">
              {workouts.length === 0 && (
                <Card>
                  <span className="lbl">NO WORKOUTS LOGGED</span>
                </Card>
              )}
              {workouts.map((w, i) => (
                <WorkoutCard key={i} w={w} />
              ))}
            </div>
          </div>

          <Card label="TIME IN ZONES">
            <div className="flex flex-col gap-3">
              {barKeys.map((k, i) => {
                const val = barVals[i];
                return (
                  <div key={k} className="w-full">
                    <div className="w-full flex items-center justify-between mb-1">
                      <span className="lbl">{ZONE_LABELS[k]}</span>
                      <span className="num-3">{fmtZoneMin(val)}</span>
                    </div>
                    <div className="w-full" style={{ height: 6, borderRadius: 3, background: COLORS.track }}>
                      <div
                        style={{
                          width: `${(val / barMax) * 100}%`,
                          height: '100%',
                          borderRadius: 3,
                          background: hexToRgba(COLORS.strain, ZONE_ALPHA[k]),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <div className="lbl" style={{ color: COLORS.muted }}>
            LIGHT {fmtZoneMin(lightVal)} · BELOW STRAIN THRESHOLD
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Card>
              <div className="flex flex-col gap-1">
                <span className="lbl">CALORIES</span>
                <span className="num-3">{calories.active ?? '--'}</span>
                <span className="lbl">{calories.total ?? '--'} TOTAL</span>
              </div>
            </Card>
            <Card>
              <div className="flex flex-col gap-1">
                <span className="lbl">STEPS</span>
                <span className="num-3">{stepsFmt}</span>
              </div>
            </Card>
            <Card>
              <div className="flex flex-col gap-1">
                <span className="lbl">DISTANCE</span>
                <span className="num-3">{distanceKm}</span>
              </div>
            </Card>
            <Card>
              <div className="flex flex-col gap-1">
                <span className="lbl">FLOORS</span>
                <span className="num-3">{today.floors ?? '--'}</span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

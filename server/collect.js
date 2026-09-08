// Per-metric fetch + normalise into day-keyed maps (v2) — SPEC §5.3, HEALTH_API.md §1-§5.
import * as google from './google.js';

/** API numbers often arrive as strings; undefined when not a finite number. */
function num(v) {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** {year,month,day} -> 'YYYY-MM-DD' */
function civilKey(date) {
  if (!date || !Number.isFinite(Number(date.year))) return null;
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

/** '70200s' -> minutes, or undefined when unparsable */
function durationMinutes(v) {
  const n = num(String(v === undefined || v === null ? '' : v).replace(/s$/, ''));
  return n === undefined ? undefined : n / 60;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

/** tz-local 'YYYY-MM-DD' for a Date, honoring process.env.TZ (matches payload.js). */
function localDateStr(d) {
  const timeZone = process.env.TZ || 'America/New_York';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const p = {};
  for (const x of parts) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

/** '-18000s' -> seconds (number), or undefined when unparsable */
function utcOffsetSeconds(v) {
  return num(String(v === undefined || v === null ? '' : v).replace(/s$/, ''));
}

/** signed offset seconds -> '+HH:MM'/'-HH:MM' */
function formatOffset(offsetSec) {
  const sign = offsetSec < 0 ? '-' : '+';
  const abs = Math.abs(offsetSec);
  const hh = String(Math.floor(abs / 3600)).padStart(2, '0');
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/** UTC RFC3339 time + offset seconds -> { minutesOfDay, iso } in that local offset. */
function localTimeFromUtc(iso, offsetSec) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return { minutesOfDay: 0, iso: null };
  const off = Number.isFinite(offsetSec) ? offsetSec : 0;
  const shifted = new Date(t.getTime() + off * 1000);
  const minutesOfDay = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  return { minutesOfDay, iso: shifted.toISOString().slice(0, 19) + formatOffset(off) };
}

/** LIST daily-summary points -> { 'YYYY-MM-DD': fn(value) }, omitting undefined results. */
function dailyMapBy(points, valueKey, fn) {
  const out = {};
  for (const p of points || []) {
    const v = p && p[valueKey];
    const date = civilKey(v && v.date);
    if (!date) continue;
    const val = fn(v);
    if (val !== undefined) out[date] = val;
  }
  return out;
}

/** dailyRollUp points -> { 'YYYY-MM-DD': valueObject } keyed by civil start date */
function rollUpByDay(points, valueKey) {
  const out = {};
  for (const p of points || []) {
    const date = civilKey(p && p.civilStartTime && p.civilStartTime.date);
    const v = p && p[valueKey];
    if (date && v) out[date] = v;
  }
  return out;
}

function mapValues(obj, fn) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const r = fn(v);
    if (r !== undefined) out[k] = r;
  }
  return out;
}

function zoneMinutesFromValue(v) {
  const zones = {};
  for (const z of (v && v.timeInHeartRateZones) || []) {
    if (!z || !z.heartRateZone) continue;
    const mins = durationMinutes(z.duration);
    zones[z.heartRateZone] = (zones[z.heartRateZone] || 0) + (mins === undefined ? 0 : mins);
  }
  return Object.keys(zones).length ? zones : undefined;
}

/** LIST daily-* v2 metrics over [startDate, endDate] (civil, inclusive). One Promise.all fan-out. */
export async function collectDaily(startDate, endDate) {
  const [hrvPts, rhrPts, spo2Pts, respPts, tempPts, vo2Pts] = await Promise.all([
    google.listRange(google.DATA_TYPES.hrv, startDate, endDate),
    google.listRange(google.DATA_TYPES.rhr, startDate, endDate),
    google.listRange(google.DATA_TYPES.spo2, startDate, endDate),
    google.listRange(google.DATA_TYPES.respiratoryRate, startDate, endDate),
    google.listRange(google.DATA_TYPES.skinTemp, startDate, endDate),
    google.listRange(google.DATA_TYPES.vo2max, startDate, endDate)
  ]);

  return {
    hrv: dailyMapBy(hrvPts, 'dailyHeartRateVariability', (v) => num(v.averageHeartRateVariabilityMilliseconds)),
    rhr: dailyMapBy(rhrPts, 'dailyRestingHeartRate', (v) => num(v.beatsPerMinute)),
    spo2: dailyMapBy(spo2Pts, 'dailyOxygenSaturation', (v) => num(v.averagePercentage)),
    respiratoryRate: dailyMapBy(respPts, 'dailyRespiratoryRate', (v) => num(v.breathsPerMinute)),
    skinTempDeviation: dailyMapBy(tempPts, 'dailySleepTemperatureDerivations', (v) => {
      const n = num(v.nightlyTemperatureCelsius);
      const b = num(v.baselineTemperatureCelsius);
      return n !== undefined && b !== undefined ? n - b : undefined;
    }),
    vo2max: dailyMapBy(vo2Pts, 'dailyVo2Max', (v) => num(v.vo2Max)),
    vo2maxLevel: dailyMapBy(vo2Pts, 'dailyVo2Max', (v) => (v.cardioFitnessLevel !== undefined ? String(v.cardioFitnessLevel) : undefined))
  };
}

/** dailyRollUp v2 metrics over [startDate, endDate] (civil, inclusive). One Promise.all fan-out. */
export async function collectRollups(startDate, endDate) {
  const [stepsPts, zonePts, azmPts, activeEnergyPts, totalCaloriesPts, distancePts, floorsPts, sedentaryPts] = await Promise.all([
    google.dailyRollUp(google.DATA_TYPES.steps, startDate, endDate),
    google.dailyRollUp(google.DATA_TYPES.zones, startDate, endDate),
    google.dailyRollUp(google.DATA_TYPES.activeZoneMinutes, startDate, endDate),
    google.dailyRollUp(google.DATA_TYPES.activeEnergy, startDate, endDate),
    google.dailyRollUp(google.DATA_TYPES.totalCalories, startDate, endDate),
    google.dailyRollUp(google.DATA_TYPES.distance, startDate, endDate),
    google.dailyRollUp(google.DATA_TYPES.floors, startDate, endDate),
    google.dailyRollUp(google.DATA_TYPES.sedentary, startDate, endDate)
  ]);

  return {
    steps: mapValues(rollUpByDay(stepsPts, 'steps'), (v) => num(v.countSum)),
    zoneMinutes: mapValues(rollUpByDay(zonePts, 'timeInHeartRateZone'), zoneMinutesFromValue),
    activeZoneMinutes: mapValues(
      rollUpByDay(azmPts, 'activeZoneMinutes'),
      (v) => (num(v.sumInFatBurnHeartZone) || 0) + (num(v.sumInCardioHeartZone) || 0) + (num(v.sumInPeakHeartZone) || 0)
    ),
    activeKcal: mapValues(rollUpByDay(activeEnergyPts, 'activeEnergyBurned'), (v) => num(v.kcalSum)),
    totalKcal: mapValues(rollUpByDay(totalCaloriesPts, 'totalCalories'), (v) => num(v.kcalSum)),
    distanceKm: mapValues(rollUpByDay(distancePts, 'distance'), (v) => {
      const n = num(v.millimetersSum);
      return n === undefined ? undefined : n / 1e6;
    }),
    floors: mapValues(rollUpByDay(floorsPts, 'floors'), (v) => num(v.countSum)),
    sedentaryMin: mapValues(rollUpByDay(sedentaryPts, 'sedentaryPeriod'), (v) => durationMinutes(v.durationSum))
  };
}

// ASLEEP/RESTLESS appear in non-STAGES sessions; bucket them with light/awake.
const STAGE_KEYS = { DEEP: 'deep', REM: 'rem', LIGHT: 'light', ASLEEP: 'light', AWAKE: 'awake', RESTLESS: 'awake' };

function intervalMinutes(interval) {
  const ms = new Date(interval && interval.endTime) - new Date(interval && interval.startTime);
  return Number.isFinite(ms) && ms > 0 ? ms / 60000 : 0;
}

/** Civil end date of a session: UTC end shifted by the session's UTC offset. */
function sessionEndDate(interval) {
  const end = new Date(interval && interval.endTime);
  if (Number.isNaN(end.getTime())) return null;
  const offsetSec = durationMinutes(interval.startUtcOffset);
  return isoDate(new Date(end.getTime() + (offsetSec === undefined ? 0 : offsetSec * 60) * 1000));
}

/** Sleep points -> Map<'YYYY-MM-DD', {s, inBed, main}> picking mainSleep, else longest. */
function pickMainSleepByDay(points) {
  const best = new Map();
  for (const p of points || []) {
    const s = p && p.sleep;
    const interval = s && s.interval;
    if (!interval) continue;
    const date = sessionEndDate(interval);
    if (!date) continue;
    const inBed = intervalMinutes(interval);
    const main = !!(s.metadata && s.metadata.mainSleep);
    const prev = best.get(date);
    if (!prev || (main && !prev.main) || (main === prev.main && inBed > prev.inBed)) best.set(date, { s, inBed, main });
  }
  return best;
}

/** Sleep sessions over [startDate, endDate] (civil end date) -> { 'YYYY-MM-DD': sessionObject }. */
export async function collectSleep(startDate, endDate) {
  const points = await google.listRange(google.DATA_TYPES.sleep, startDate, endDate);
  const best = pickMainSleepByDay(points);
  const out = {};
  for (const [date, entry] of best) {
    const s = entry.s;
    const interval = s.interval;
    const startOffsetSec = utcOffsetSeconds(interval.startUtcOffset) ?? 0;
    const endOffsetSec = utcOffsetSeconds(interval.endUtcOffset) ?? startOffsetSec;
    const startLocal = localTimeFromUtc(interval.startTime, startOffsetSec);
    const endLocal = localTimeFromUtc(interval.endTime, endOffsetSec);
    const summary = s.summary || {};
    const rawStages = Array.isArray(s.stages) ? s.stages : [];
    const stages = { deep: 0, rem: 0, light: 0, awake: 0 };
    if (Array.isArray(summary.stagesSummary) && summary.stagesSummary.length) {
      for (const st of summary.stagesSummary) {
        const key = STAGE_KEYS[String(st && st.type).toUpperCase()];
        if (key) stages[key] += num(st.minutes) || 0;
      }
    } else {
      for (const st of rawStages) {
        const key = STAGE_KEYS[String(st && st.type).toUpperCase()];
        if (key) stages[key] += intervalMinutes(st);
      }
    }
    const summaryAwake = num(summary.minutesAwake);
    if (stages.awake === 0 && summaryAwake !== undefined) stages.awake = summaryAwake;
    const summaryAsleep = num(summary.minutesAsleep);
    const asleepMin = summaryAsleep !== undefined ? summaryAsleep : stages.deep + stages.rem + stages.light;
    const inBedMin = entry.inBed > 0 ? entry.inBed : asleepMin + stages.awake;

    const onsetIdx = rawStages.findIndex((st) => !['AWAKE', 'RESTLESS'].includes(String(st && st.type).toUpperCase()));
    let disturbances = 0;
    if (onsetIdx >= 0) {
      for (let i = onsetIdx + 1; i < rawStages.length; i++) {
        const t = String(rawStages[i] && rawStages[i].type).toUpperCase();
        if (t === 'AWAKE' || t === 'RESTLESS') disturbances++;
      }
    }

    const hypnogram = rawStages.map((st) => {
      const t = String(st && st.type).toUpperCase();
      const type = t === 'ASLEEP' ? 'LIGHT' : t === 'RESTLESS' ? 'AWAKE' : t;
      return { type, start: st.startTime, end: st.endTime, min: Math.round(intervalMinutes(st)) };
    });

    out[date] = {
      start: startLocal.iso || interval.startTime,
      end: endLocal.iso || interval.endTime,
      inBedMin: Math.round(inBedMin),
      asleepMin: Math.round(asleepMin),
      stages: { deep: Math.round(stages.deep), rem: Math.round(stages.rem), light: Math.round(stages.light), awake: Math.round(stages.awake) },
      latencyMin: Math.round(num(summary.minutesToFallAsleep) || 0),
      awakeMin: Math.round(stages.awake),
      disturbances,
      hypnogram,
      bedtimeMin: startLocal.minutesOfDay,
      wakeMin: endLocal.minutesOfDay,
      nap: !!(s.metadata && s.metadata.nap)
    };
  }
  return out;
}

/** Exercise sessions over [startDate, endDate] (civil start date) -> workouts[], oldest first. */
export async function collectWorkouts(startDate, endDate) {
  const points = await google.listRange(google.DATA_TYPES.exercise, startDate, endDate);
  const workouts = (points || [])
    .map((p) => {
      const ex = p && p.exercise;
      if (!ex) return null;
      const hzd = (ex.metricsSummary && ex.metricsSummary.heartRateZoneDurations) || {};
      return {
        type: ex.exerciseType,
        name: ex.displayName,
        start: ex.interval && ex.interval.startTime,
        durationMin: Math.round(durationMinutes(ex.activeDuration) ?? 0),
        avgHr: num(ex.metricsSummary && ex.metricsSummary.averageHeartRateBeatsPerMinute),
        zoneMin: {
          light: Math.round(durationMinutes(hzd.lightTime) ?? 0),
          moderate: Math.round(durationMinutes(hzd.moderateTime) ?? 0),
          vigorous: Math.round(durationMinutes(hzd.vigorousTime) ?? 0),
          peak: Math.round(durationMinutes(hzd.peakTime) ?? 0)
        },
        kcal: num(ex.metricsSummary && ex.metricsSummary.caloriesKcal)
      };
    })
    .filter(Boolean);
  workouts.sort((a, b) => new Date(a.start) - new Date(b.start));
  return workouts;
}

/** Latest daily-heart-rate-zones point (last 30 days) -> [{type,min,max}]. */
export async function collectHrZones() {
  const today = localDateStr(new Date());
  const start = addDays(today, -30);
  const points = await google.listRange(google.DATA_TYPES.hrZones, start, today);
  const latest = points[0];
  const v = latest && latest.dailyHeartRateZones;
  const zones = (v && v.heartRateZones) || [];
  return zones.map((z) => ({ type: z.heartRateZoneType, min: num(z.minBeatsPerMinute), max: num(z.maxBeatsPerMinute) }));
}

/** Intraday heart-rate, local 00:00->24:00 for dateStr, 5-min buckets -> hrDay[]. */
export async function collectHrDay(dateStr, tzOffset) {
  const offset = tzOffset || '+00:00';
  const startIso = `${dateStr}T00:00:00${offset}`;
  const endIso = `${addDays(dateStr, 1)}T00:00:00${offset}`;
  const points = await google.rollUp(google.DATA_TYPES.heartRate, startIso, endIso, '300s');
  return points
    .map((p) => {
      const hr = p && p.heartRate;
      return { t: p && p.startTime, avg: num(hr && hr.beatsPerMinuteAvg), min: num(hr && hr.beatsPerMinuteMin), max: num(hr && hr.beatsPerMinuteMax) };
    })
    .filter((b) => b.avg !== undefined || b.min !== undefined || b.max !== undefined);
}

/** Newest heart-rate sample in the last 10 minutes -> {bpm, at} or null. */
export async function collectLatestHr() {
  const now = new Date();
  const start = new Date(now.getTime() - 10 * 60 * 1000);
  const points = await google.listSamplesPhysical(google.DATA_TYPES.heartRate, start.toISOString(), now.toISOString());
  const latest = points[0];
  const bpm = latest && num(latest.heartRate && latest.heartRate.beatsPerMinute);
  if (bpm === undefined) return null;
  const st = (latest.heartRate && latest.heartRate.sampleTime) || latest.sampleTime;
  return { bpm, at: st && st.physicalTime ? st.physicalTime : null };
}

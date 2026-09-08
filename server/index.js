// Express server: static dist/, Google OAuth routes, /api/health payload assembly.
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import * as google from './google.js';
import * as cache from './cache.js';
import * as scores from './scores.js';

const app = express();
const DIST = path.resolve(process.cwd(), 'dist');

app.use(express.static(DIST));

app.get('/api/auth', (req, res) => {
  res.redirect(google.authUrl());
});

app.get('/api/auth/callback', async (req, res) => {
  try {
    await google.exchangeCode(req.query.code);
    res.redirect('/');
  } catch (err) {
    res.status(500).send(`Auth failed: ${err.message}`);
  }
});

// -- payload assembly: Google Health API v4 payload shapes, per docs/HEALTH_API.md. --

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// Local calendar date (not UTC) so evenings west of UTC don't roll "today"
// forward a day and read an empty day for per-day date keys built from it.
function localIsoDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

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

/** '70200s' -> minutes */
function durationMinutes(v) {
  const n = num(String(v === undefined || v === null ? '' : v).replace(/s$/, ''));
  return n === undefined ? 0 : n / 60;
}

/** Daily-summary list points -> { 'YYYY-MM-DD': number } */
function dailyValues(points, valueKey, field) {
  const out = {};
  for (const p of points || []) {
    const v = p && p[valueKey];
    const date = civilKey(v && v.date);
    const n = num(v && v[field]);
    if (date && n !== undefined) out[date] = n;
  }
  return out;
}

/** rollUp points -> { 'YYYY-MM-DD': valueObject } keyed by civil start date */
function rollUpByDay(points, valueKey) {
  const out = {};
  for (const p of points || []) {
    const date = civilKey(p && p.civilStartTime && p.civilStartTime.date);
    const v = p && p[valueKey];
    if (date && v) out[date] = v;
  }
  return out;
}

function stepsByDay(points) {
  const out = {};
  for (const [date, v] of Object.entries(rollUpByDay(points, 'steps'))) {
    const n = num(v.countSum);
    if (n !== undefined) out[date] = n;
  }
  return out;
}

function zoneMinutesByDay(points) {
  const out = {};
  for (const [date, v] of Object.entries(rollUpByDay(points, 'timeInHeartRateZone'))) {
    const zones = {};
    for (const z of v.timeInHeartRateZones || []) {
      if (!z || !z.heartRateZone) continue;
      zones[z.heartRateZone] = (zones[z.heartRateZone] || 0) + durationMinutes(z.duration);
    }
    if (Object.keys(zones).length) out[date] = zones;
  }
  return out;
}

// ASLEEP/RESTLESS appear in non-STAGES sessions; bucket them with light/awake.
const STAGE_KEYS = { DEEP: 'deep', REM: 'rem', LIGHT: 'light', ASLEEP: 'light', AWAKE: 'awake', RESTLESS: 'awake' };

/** Civil end date of a session: UTC end shifted by the session's UTC offset. */
function sessionEndDate(interval) {
  const end = new Date(interval && interval.endTime);
  if (Number.isNaN(end.getTime())) return null;
  const offsetSec = num(String(interval.startUtcOffset || '0').replace(/s$/, '')) || 0;
  return isoDate(new Date(end.getTime() + offsetSec * 1000));
}

function intervalMinutes(interval) {
  const ms = new Date(interval && interval.endTime) - new Date(interval && interval.startTime);
  return Number.isFinite(ms) && ms > 0 ? ms / 60000 : 0;
}

/** Sleep sessions -> per civil end date: main (or longest) session's minutes. */
function sleepByDay(points) {
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
  const out = {};
  for (const [date, entry] of best) {
    const s = entry.s;
    const summary = s.summary || {};
    const stages = { deep: 0, rem: 0, light: 0, awake: 0 };
    if (Array.isArray(summary.stagesSummary) && summary.stagesSummary.length) {
      for (const st of summary.stagesSummary) {
        const key = STAGE_KEYS[String(st && st.type).toUpperCase()];
        if (key) stages[key] += num(st.minutes) || 0;
      }
    } else {
      for (const st of s.stages || []) {
        const key = STAGE_KEYS[String(st && st.type).toUpperCase()];
        if (key) stages[key] += intervalMinutes(st);
      }
    }
    if (stages.awake === 0) stages.awake = num(summary.minutesAwake) || 0;
    const summaryAsleep = num(summary.minutesAsleep);
    const asleepMinutes = summaryAsleep === undefined ? stages.deep + stages.rem + stages.light : summaryAsleep;
    const inBedMinutes = entry.inBed > 0 ? entry.inBed : asleepMinutes + stages.awake;
    out[date] = { ...stages, asleepMinutes, inBedMinutes };
  }
  return out;
}

const EMPTY_SLEEP = { deep: 0, rem: 0, light: 0, awake: 0, asleepMinutes: 0, inBedMinutes: 0 };

function round1(n) {
  return Math.round(n * 10) / 10;
}

/** Fetch 31 days of Health API data and assemble the SPEC §5 payload. */
async function buildHealthPayload() {
  const age = Number(process.env.AGE) || 30;
  const today = localIsoDate(new Date());
  const startDate = addDays(today, -30);

  const [rhrPts, hrvPts, spo2Pts, sleepPts, stepsRollUp, zoneRollUp] = await Promise.all([
    google.listRange(google.DATA_TYPES.rhr, startDate, today),
    google.listRange(google.DATA_TYPES.hrv, startDate, today),
    google.listRange(google.DATA_TYPES.spo2, startDate, today),
    google.listRange(google.DATA_TYPES.sleep, startDate, today),
    google.dailyRollUp(google.DATA_TYPES.steps, startDate, today),
    google.dailyRollUp(google.DATA_TYPES.zones, startDate, today)
  ]);

  const rhrByDay = dailyValues(rhrPts, 'dailyRestingHeartRate', 'beatsPerMinute');
  const hrvByDay = dailyValues(hrvPts, 'dailyHeartRateVariability', 'averageHeartRateVariabilityMilliseconds');
  const spo2ByDay = dailyValues(spo2Pts, 'dailyOxygenSaturation', 'averagePercentage');
  const sleepDay = sleepByDay(sleepPts);
  const stepsDay = stepsByDay(stepsRollUp);
  const zonesDay = zoneMinutesByDay(zoneRollUp);

  const dates = Array.from({ length: 31 }, (_, i) => addDays(startDate, i));
  const raw = dates.map((date) => {
    const sleep = sleepDay[date] || EMPTY_SLEEP;
    return {
      date,
      hrv: hrvByDay[date],
      rhr: rhrByDay[date],
      spo2: spo2ByDay[date],
      steps: stepsDay[date] || 0,
      sleepHours: sleep.asleepMinutes / 60,
      sleep
    };
  });

  const prelimHistory = raw.slice(0, 30).map((d) => ({ date: d.date, hrv: d.hrv, rhr: d.rhr, sleepHours: d.sleepHours }));
  const base = scores.baselines(prelimHistory);

  let prevComputed = null;
  const computed = [];
  for (const d of raw) {
    const need = scores.sleepNeed(prevComputed);
    const rec = scores.recovery({ hrv: d.hrv, rhr: d.rhr, sleepHours: d.sleepHours, sleepNeed: need }, base);
    const str = scores.strain({ zoneMinutes: zonesDay[d.date], steps: d.steps, age });
    const sScore = scores.sleepScore({
      asleepMinutes: d.sleep.asleepMinutes,
      inBedMinutes: d.sleep.inBedMinutes,
      deepMinutes: d.sleep.deep,
      remMinutes: d.sleep.rem,
      needHours: need
    });
    computed.push({
      date: d.date,
      recovery: Math.round(rec),
      strain: Math.round(str),
      sleepScore: Math.round(sScore),
      rhr: Number.isFinite(d.rhr) ? Math.round(d.rhr) : null,
      hrv: Number.isFinite(d.hrv) ? Math.round(d.hrv) : null,
      sleepHours: round1(d.sleepHours),
      sleepNeed: round1(need)
    });
    prevComputed = { strain: str, recovery: rec };
  }

  const history = computed
    .slice(1)
    .map(({ date, recovery, strain, sleepScore, rhr, hrv, sleepHours }) => ({ date, recovery, strain, sleepScore, rhr, hrv, sleepHours }));
  const todayComputed = computed[30];
  const todayRaw = raw[30];

  return {
    generatedAt: new Date().toISOString(),
    today: {
      recovery: todayComputed.recovery,
      strain: todayComputed.strain,
      sleepScore: todayComputed.sleepScore,
      rhr: Number.isFinite(todayRaw.rhr) ? Math.round(todayRaw.rhr) : null,
      hrv: Number.isFinite(todayRaw.hrv) ? Math.round(todayRaw.hrv) : null,
      spo2: Number.isFinite(todayRaw.spo2) ? Math.round(todayRaw.spo2) : null,
      steps: Math.round(todayRaw.steps),
      sleepHours: round1(todayRaw.sleepHours),
      sleepNeed: todayComputed.sleepNeed
    },
    deltas: {
      rhr: Math.round(scores.delta(todayRaw.rhr, base.rhr)),
      hrv: Math.round(scores.delta(todayRaw.hrv, base.hrv)),
      sleepHours: round1(scores.delta(todayRaw.sleepHours, base.sleepHours))
    },
    sleepStages: {
      deep: Math.round(todayRaw.sleep.deep),
      rem: Math.round(todayRaw.sleep.rem),
      light: Math.round(todayRaw.sleep.light),
      awake: Math.round(todayRaw.sleep.awake)
    },
    history
  };
}

app.get('/api/health', async (req, res) => {
  const forceRefresh = req.query.refresh === '1';
  const cached = cache.read();
  if (!forceRefresh && cache.isFresh(cached)) {
    res.json(cached);
    return;
  }
  try {
    if (!google.readToken()) throw new google.AuthRequiredError();
    const payload = await buildHealthPayload();
    cache.write(payload);
    res.json(payload);
  } catch (err) {
    if (err instanceof google.AuthRequiredError) {
      res.status(401).json({ auth: '/api/auth' });
      return;
    }
    if (cached) {
      res.json({ ...cached, stale: true });
      return;
    }
    console.error('health payload error:', err.message);
    res.status(500).json({ error: 'Failed to load health data' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`pulse listening on ${PORT}`);
});

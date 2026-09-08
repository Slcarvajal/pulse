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

// -- payload assembly helpers (dataPoint shape is not fully specified by the
// Health API docs referenced in google.js, so these read defensively across
// the common field names: value/fpVal/intVal for scalars, stage/value for
// sleep-stage type, start/endTime for duration). --

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

function pointDate(p) {
  const t = p && (p.startTime || p.time || p.endTime);
  return typeof t === 'string' ? t.slice(0, 10) : null;
}

function pointValue(p) {
  if (!p) return null;
  if (typeof p.value === 'number') return p.value;
  if (typeof p.fpVal === 'number') return p.fpVal;
  if (typeof p.intVal === 'number') return p.intVal;
  if (Array.isArray(p.value) && p.value[0]) {
    const v = p.value[0];
    if (typeof v.fpVal === 'number') return v.fpVal;
    if (typeof v.intVal === 'number') return v.intVal;
  }
  return null;
}

function pointBpm(p) {
  return typeof p.bpm === 'number' ? p.bpm : pointValue(p);
}

function pointStage(p) {
  const s = p && (p.stage || p.sleepStage || p.value);
  return typeof s === 'string' ? s.toUpperCase() : null;
}

function pointMinutes(p) {
  if (!p || !p.startTime || !p.endTime) return null;
  const ms = new Date(p.endTime) - new Date(p.startTime);
  return Number.isFinite(ms) && ms > 0 ? ms / 60000 : null;
}

function groupByDay(points) {
  const map = new Map();
  for (const p of points || []) {
    const d = pointDate(p);
    if (!d) continue;
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(p);
  }
  return map;
}

function dailyAvg(points) {
  const out = {};
  for (const [date, pts] of groupByDay(points)) {
    const vals = pts.map(pointValue).filter(Number.isFinite);
    if (vals.length) out[date] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return out;
}

function dailySum(points) {
  const out = {};
  for (const [date, pts] of groupByDay(points)) {
    const vals = pts.map(pointValue).filter(Number.isFinite);
    out[date] = vals.reduce((a, b) => a + b, 0);
  }
  return out;
}

function dailySleep(points) {
  const out = {};
  for (const [date, pts] of groupByDay(points)) {
    const stages = { DEEP: 0, REM: 0, LIGHT: 0, AWAKE: 0 };
    for (const p of pts) {
      const stage = pointStage(p);
      const minutes = pointMinutes(p) || 0;
      if (stage && Object.prototype.hasOwnProperty.call(stages, stage)) stages[stage] += minutes;
    }
    const asleepMinutes = stages.DEEP + stages.REM + stages.LIGHT;
    out[date] = {
      deep: stages.DEEP,
      rem: stages.REM,
      light: stages.LIGHT,
      awake: stages.AWAKE,
      asleepMinutes,
      inBedMinutes: asleepMinutes + stages.AWAKE
    };
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

  const [hrvPts, rhrPts, spo2Pts, stepsPts, sleepPts, hrPts] = await Promise.all([
    google.fetchRange(google.DATA_TYPES.hrv, startDate, today),
    google.fetchRange(google.DATA_TYPES.rhr, startDate, today),
    google.fetchRange(google.DATA_TYPES.spo2, startDate, today),
    google.fetchRange(google.DATA_TYPES.steps, startDate, today),
    google.fetchRange(google.DATA_TYPES.sleep, startDate, today),
    google.fetchRange(google.DATA_TYPES.heartRate, today, today)
  ]);

  const hrvByDay = dailyAvg(hrvPts);
  const rhrByDay = dailyAvg(rhrPts);
  const spo2ByDay = dailyAvg(spo2Pts);
  const stepsByDay = dailySum(stepsPts);
  const sleepByDay = dailySleep(sleepPts);
  const todayHrSamples = (hrPts || [])
    .map((p) => ({ bpm: pointBpm(p), minutes: pointMinutes(p) || 1 }))
    .filter((s) => Number.isFinite(s.bpm));

  const dates = Array.from({ length: 31 }, (_, i) => addDays(startDate, i));
  const raw = dates.map((date) => {
    const sleep = sleepByDay[date] || EMPTY_SLEEP;
    return {
      date,
      hrv: hrvByDay[date],
      rhr: rhrByDay[date],
      spo2: spo2ByDay[date],
      steps: stepsByDay[date] || 0,
      sleepHours: sleep.asleepMinutes / 60,
      sleep
    };
  });

  const prelimHistory = raw.slice(0, 30).map((d) => ({ date: d.date, hrv: d.hrv, rhr: d.rhr, sleepHours: d.sleepHours }));
  const base = scores.baselines(prelimHistory);

  let prevComputed = null;
  const computed = [];
  for (const d of raw) {
    const isToday = d.date === today;
    const need = scores.sleepNeed(prevComputed);
    const rec = scores.recovery({ hrv: d.hrv, rhr: d.rhr, sleepHours: d.sleepHours, sleepNeed: need }, base);
    const str = scores.strain({ hrSamples: isToday ? todayHrSamples : undefined, steps: d.steps, age });
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

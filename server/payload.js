// PULSE payload assembly — composes collect.js + scores.js into the SPEC §5.2 shape.
import * as collect from './collect.js';
import * as scores from './scores.js';

const WINDOW_DAYS = 30;
const NIGHTS = 7;

function tzName() {
  return process.env.TZ || 'America/New_York';
}

function localDateStr(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const p = {};
  for (const x of parts) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}

function addDaysStr(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function tzOffsetStr(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(date);
  const p = {};
  for (const x of parts) p[x.type] = x.value;
  const hour = p.hour === '24' ? 0 : Number(p.hour);
  const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second));
  const diffMin = Math.round((asUTC - date.getTime()) / 60000);
  const sign = diffMin >= 0 ? '+' : '-';
  const abs = Math.abs(diffMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

function num(v) {
  return Number.isFinite(v) ? v : null;
}

function str(v) {
  return typeof v === 'string' ? v : null;
}

function zeroFillZones(z) {
  const zo = z || {};
  return {
    LIGHT: Number.isFinite(zo.LIGHT) ? zo.LIGHT : 0,
    MODERATE: Number.isFinite(zo.MODERATE) ? zo.MODERATE : 0,
    VIGOROUS: Number.isFinite(zo.VIGOROUS) ? zo.VIGOROUS : 0,
    PEAK: Number.isFinite(zo.PEAK) ? zo.PEAK : 0
  };
}

function windowContext() {
  const tz = tzName();
  const now = new Date();
  const todayStr = localDateStr(now, tz);
  const startStr = addDaysStr(todayStr, -(WINDOW_DAYS - 1));
  const offset = tzOffsetStr(now, tz);
  return { tz, now, todayStr, startStr, offset };
}

/** Full /api/health payload (SPEC §5.2), 30-day window ending today, history oldest first. */
export async function buildHealthPayload() {
  const { tz, now, todayStr, startStr, offset } = windowContext();

  const [daily, rollups, sleepByDay, workoutsAll, hrZones, hrDay, latestHr] = await Promise.all([
    collect.collectDaily(startStr, todayStr),
    collect.collectRollups(startStr, todayStr),
    collect.collectSleep(startStr, todayStr),
    collect.collectWorkouts(startStr, todayStr),
    collect.collectHrZones(),
    collect.collectHrDay(todayStr, offset),
    collect.collectLatestHr()
  ]);

  const dates = [];
  for (let i = 0; i < WINDOW_DAYS; i++) dates.push(addDaysStr(startStr, i));

  const workoutsByDate = {};
  for (const w of workoutsAll || []) {
    const wStart = w && typeof w.start === 'string' ? new Date(w.start) : null;
    const d = wStart && !Number.isNaN(wStart.getTime()) ? localDateStr(wStart, tz) : null;
    if (!d) continue;
    (workoutsByDate[d] = workoutsByDate[d] || []).push(w);
  }

  const rawRows = dates.map((date) => ({
    date,
    hrv: num(daily.hrv && daily.hrv[date]),
    rhr: num(daily.rhr && daily.rhr[date]),
    spo2: num(daily.spo2 && daily.spo2[date]),
    respiratoryRate: num(daily.respiratoryRate && daily.respiratoryRate[date]),
    skinTempDeviation: num(daily.skinTempDeviation && daily.skinTempDeviation[date]),
    steps: num(rollups.steps && rollups.steps[date]),
    calories: num(rollups.totalKcal && rollups.totalKcal[date]),
    distanceKm: num(rollups.distanceKm && rollups.distanceKm[date]),
    floors: num(rollups.floors && rollups.floors[date]),
    activeZoneMinutes: num(rollups.activeZoneMinutes && rollups.activeZoneMinutes[date]),
    zoneMinutes: (rollups.zoneMinutes && rollups.zoneMinutes[date]) || {},
    workouts: workoutsByDate[date] || [],
    sleepSession: (sleepByDay && sleepByDay[date]) || null
  }));

  const baselineRaw = scores.baselines(rawRows.slice(0, -1), ['hrv', 'rhr', 'respiratoryRate', 'spo2', 'skinTempDeviation']);

  const rows = rawRows.map((r) => {
    const rb = scores.recoveryBreakdown(
      { hrv: r.hrv, rhr: r.rhr, respiratoryRate: r.respiratoryRate, spo2: r.spo2, skinTempDeviation: r.skinTempDeviation },
      baselineRaw
    );
    const strainVal = scores.round1(scores.dayStrain({ zoneMinutes: r.zoneMinutes, workouts: r.workouts, steps: r.steps }));
    return { ...r, recovery: Math.round(rb.score), recoveryRaw: rb.score, recoveryBand: rb.band, strain: strainVal };
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const s = row.sleepSession;
    const asleepMin = s && Number.isFinite(s.asleepMin) ? s.asleepMin : null;
    const inBedMin = s && Number.isFinite(s.inBedMin) ? s.inBedMin : null;
    const deepMin = s && s.stages && Number.isFinite(s.stages.deep) ? s.stages.deep : 0;
    const remMin = s && s.stages && Number.isFinite(s.stages.rem) ? s.stages.rem : 0;

    const nightWindow = rows
      .slice(Math.max(0, i - (NIGHTS - 1)), i + 1)
      .filter((r) => r.sleepSession && Number.isFinite(r.sleepSession.asleepMin))
      .map((r) => ({ asleepMin: r.sleepSession.asleepMin, need: r.need }));
    const debtHours = scores.sleepDebt(nightWindow);
    const yesterdayStrain = i > 0 ? rows[i - 1].strain : 0;
    const needV2 = scores.sleepNeedV2({ yesterdayStrain, debtHours, napMinutes: 0 });

    row.asleepMin = asleepMin;
    row.inBedMin = inBedMin;
    row.debtHours = debtHours;
    row.need = needV2.need;
    row.needBreakdown = needV2.breakdown;
    row.sleepHours = asleepMin != null ? scores.round1(asleepMin / 60) : null;
    row.sleepPerformance = asleepMin != null ? Math.round(scores.sleepPerformance(asleepMin, needV2.need)) : null;
    row.sleepScore = asleepMin != null
      ? Math.round(
        scores.sleepScore({
          asleepMinutes: asleepMin,
          inBedMinutes: inBedMin || asleepMin,
          deepMinutes: deepMin,
          remMinutes: remMin,
          needHours: needV2.need
        })
      )
      : null;
  }

  const today = rows[rows.length - 1];
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  const last7Dates = dates.slice(-NIGHTS);
  const nights = last7Dates
    .map((date) => {
      const row = rows.find((r) => r.date === date);
      const s = row && row.sleepSession;
      if (!s || !Number.isFinite(s.asleepMin) || !Number.isFinite(s.bedtimeMin) || !Number.isFinite(s.wakeMin)) return null;
      return { date, asleepMin: s.asleepMin, need: row.need, performance: row.sleepPerformance, bedtimeMin: s.bedtimeMin, wakeMin: s.wakeMin };
    })
    .filter(Boolean);

  const todaySleepNeed =
    nights.length >= NIGHTS ? today.need : scores.sleepNeed(prev ? { strain: prev.strain, recovery: prev.recoveryRaw } : undefined);

  const baselineFull = scores.baselines(rows.slice(0, -1), [
    'hrv', 'rhr', 'sleepHours', 'recovery', 'strain', 'sleepScore',
    'respiratoryRate', 'spo2', 'skinTempDeviation'
  ]);

  const deltas = {
    rhr: scores.delta(today.rhr, baselineFull.rhr),
    hrv: scores.delta(today.hrv, baselineFull.hrv),
    sleepHours: scores.delta(today.sleepHours, baselineFull.sleepHours),
    respiratoryRate: scores.delta(today.respiratoryRate, baselineFull.respiratoryRate),
    spo2: scores.delta(today.spo2, baselineFull.spo2),
    skinTempDeviation: scores.delta(today.skinTempDeviation, baselineFull.skinTempDeviation),
    recovery: scores.delta(today.recovery, baselineFull.recovery),
    strain: scores.delta(today.strain, baselineFull.strain),
    sleepScore: scores.delta(today.sleepScore, baselineFull.sleepScore)
  };

  const personalRange = {
    rhr: scores.personalRange(rows.map((r) => r.rhr)),
    hrv: scores.personalRange(rows.map((r) => r.hrv)),
    respiratoryRate: scores.personalRange(rows.map((r) => r.respiratoryRate)),
    spo2: scores.personalRange(rows.map((r) => r.spo2)),
    skinTempDeviation: scores.personalRange(rows.map((r) => r.skinTempDeviation))
  };

  const todayRecoveryInputs = scores.recoveryBreakdown(
    { hrv: today.hrv, rhr: today.rhr, respiratoryRate: today.respiratoryRate, spo2: today.spo2, skinTempDeviation: today.skinTempDeviation },
    baselineRaw
  ).inputs;

  const todaySession = today.sleepSession;
  const todayWorkouts = (workoutsByDate[todayStr] || []).map((w) => ({
    type: w.type ?? null,
    name: w.name ?? null,
    start: w.start ?? null,
    durationMin: num(w.durationMin),
    avgHr: num(w.avgHr),
    zoneMin: w.zoneMin || { light: 0, moderate: 0, vigorous: 0, peak: 0 },
    activityStrain: scores.round1(scores.activityStrain(w)),
    kcal: num(w.kcal)
  }));

  return {
    generatedAt: now.toISOString(),
    stale: false,
    tz,
    today: {
      date: todayStr,
      recovery: today.recovery,
      recoveryBand: today.recoveryBand,
      strain: today.strain,
      sleepScore: today.sleepScore,
      rhr: today.rhr,
      hrv: today.hrv,
      spo2: today.spo2,
      respiratoryRate: today.respiratoryRate,
      skinTempDeviation: today.skinTempDeviation,
      vo2max: num(daily.vo2max && daily.vo2max[todayStr]),
      vo2maxLevel: str(daily.vo2maxLevel && daily.vo2maxLevel[todayStr]),
      steps: today.steps,
      activeZoneMinutes: today.activeZoneMinutes,
      calories: {
        active: num(rollups.activeKcal && rollups.activeKcal[todayStr]),
        total: today.calories
      },
      distanceKm: today.distanceKm,
      floors: today.floors,
      sedentaryMin: num(rollups.sedentaryMin && rollups.sedentaryMin[todayStr]),
      sleepHours: today.sleepHours,
      sleepNeed: todaySleepNeed,
      strainTarget: scores.strainTarget(today.recoveryRaw)
    },
    recoveryInputs: todayRecoveryInputs,
    deltas,
    personalRange,
    hrZones: hrZones || [],
    zoneMinutes: zeroFillZones(rollups.zoneMinutes && rollups.zoneMinutes[todayStr]),
    workouts: todayWorkouts,
    sleep: {
      date: todayStr,
      start: (todaySession && todaySession.start) ?? null,
      end: (todaySession && todaySession.end) ?? null,
      inBedMin: today.inBedMin,
      asleepMin: today.asleepMin,
      stages: today.asleepMin != null ? ((todaySession && todaySession.stages) || null) : null,
      latencyMin: (todaySession && num(todaySession.latencyMin)) ?? null,
      awakeMin: (todaySession && num(todaySession.awakeMin)) ?? null,
      disturbances: (todaySession && num(todaySession.disturbances)) ?? null,
      efficiency: today.asleepMin != null ? scores.sleepEfficiency(today.asleepMin, today.inBedMin) : null,
      consistency: Math.round(scores.sleepConsistency(nights)),
      performance: today.sleepPerformance,
      debtHours: today.debtHours,
      need: today.need,
      needBreakdown: today.needBreakdown,
      hypnogram: (todaySession && todaySession.hypnogram) || [],
      nights
    },
    hrDay: hrDay || [],
    latestHr: latestHr || null,
    history: rows.map((r) => ({
      date: r.date,
      recovery: r.recovery,
      strain: r.strain,
      sleepScore: r.sleepScore,
      sleepPerformance: r.sleepPerformance,
      rhr: r.rhr,
      hrv: r.hrv,
      spo2: r.spo2,
      respiratoryRate: r.respiratoryRate,
      skinTempDeviation: r.skinTempDeviation,
      sleepHours: r.sleepHours,
      steps: r.steps,
      calories: r.calories,
      distanceKm: r.distanceKm,
      floors: r.floors,
      activeZoneMinutes: r.activeZoneMinutes
    }))
  };
}

/** Lightweight /api/live payload — hrDay + latestHr only, never the 30-day collectors. */
export async function buildLivePayload() {
  const { now, todayStr, offset } = windowContext();
  const [hrDay, latestHr] = await Promise.all([collect.collectHrDay(todayStr, offset), collect.collectLatestHr()]);
  return {
    generatedAt: now.toISOString(),
    latestHr: latestHr || null,
    hrDay: hrDay || []
  };
}

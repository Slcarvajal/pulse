// PULSE score engine — pure functions, no I/O. Implements SPEC §6.

/**
 * @typedef {Object} Baseline
 * @property {number} mean 30-day mean (today excluded)
 * @property {number} sd   30-day population stddev (0 when undefined)
 * @property {number} n    sample count
 */

/**
 * @typedef {Object} Baselines
 * @property {Baseline} hrv
 * @property {Baseline} rhr
 * @property {Baseline} sleepHours
 * @property {Baseline} recovery
 * @property {Baseline} strain
 * @property {Baseline} sleepScore
 */

/**
 * @typedef {Object} HistoryDay
 * @property {string} date YYYY-MM-DD
 * @property {number} [recovery]
 * @property {number} [strain]
 * @property {number} [sleepScore]
 * @property {number} [rhr]
 * @property {number} [hrv]
 * @property {number} [sleepHours]
 */

/**
 * @typedef {Object} HrSample
 * @property {number} bpm
 * @property {number} [minutes] defaults to 1
 */

/** @type {readonly number[]} index = zone (0..5) */
const ZONE_WEIGHTS = [0, 1, 2, 4, 8, 12];

// Google Health zone name -> SPEC §6 zone weight. LIGHT is everything below fat-burn and
// includes ~19h/day of resting time, so it is dropped (weight 0); the rest map onto z2/z4/z5.
const GOOGLE_ZONE_WEIGHTS = { LIGHT: 0, MODERATE: 2, VIGOROUS: 8, PEAK: 12 };

const RESTORATIVE_TARGET = 0.45;

/**
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export function clamp(v, lo, hi) {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * @param {number[]} xs
 * @returns {number}
 */
export function mean(xs) {
  const ys = xs.filter(Number.isFinite);
  if (ys.length === 0) return 0;
  return ys.reduce((a, b) => a + b, 0) / ys.length;
}

/**
 * @param {number[]} xs
 * @returns {number}
 */
export function stddev(xs) {
  const ys = xs.filter(Number.isFinite);
  if (ys.length < 2) return 0;
  const m = mean(ys);
  return Math.sqrt(ys.reduce((a, b) => a + (b - m) * (b - m), 0) / ys.length);
}

/**
 * @param {HistoryDay[]} history oldest first, today excluded
 * @param {string[]} [keys]
 * @returns {Record<string, Baseline>}
 */
export function baselines(history, keys = ['hrv', 'rhr', 'sleepHours', 'recovery', 'strain', 'sleepScore']) {
  const days = (history || []).slice(-30);
  /** @type {Record<string, Baseline>} */
  const out = {};
  for (const k of keys) {
    const xs = days.map((d) => d[k]).filter(Number.isFinite);
    out[k] = { mean: mean(xs), sd: stddev(xs), n: xs.length };
  }
  return out;
}

/**
 * @param {number} value
 * @param {Baseline} baseline
 * @returns {number}
 */
export function zscore(value, baseline) {
  if (!baseline || !Number.isFinite(value) || !Number.isFinite(baseline.sd) || baseline.sd === 0) return 0;
  return (value - baseline.mean) / baseline.sd;
}

/**
 * @param {number} value
 * @param {Baseline} baseline
 * @returns {number} signed difference vs 30-day mean
 */
export function delta(value, baseline) {
  if (!baseline || !Number.isFinite(value) || baseline.n === 0) return 0;
  return value - baseline.mean;
}

/**
 * @param {{strain?: number, recovery?: number}} [yesterday]
 * @returns {number} hours, capped at 9.5
 */
export function sleepNeed(yesterday) {
  let need = 7.5;
  if (yesterday && Number.isFinite(yesterday.strain) && yesterday.strain > 14) need += 0.5;
  if (yesterday && Number.isFinite(yesterday.recovery) && yesterday.recovery < 34) need += 0.25;
  return Math.min(need, 9.5);
}

/**
 * @param {number} score 0-100
 * @returns {'green'|'yellow'|'red'}
 */
export function band(score) {
  if (score >= 67) return 'green';
  if (score >= 34) return 'yellow';
  return 'red';
}

/**
 * @param {{hrv: number, rhr: number, sleepHours: number, sleepNeed: number}} today
 * @param {Record<string, Baseline>} base
 * @returns {number} 0-100
 */
export function recovery(today, base) {
  const zHrv = zscore(today.hrv, base && base.hrv);
  const zRhr = -zscore(today.rhr, base && base.rhr);
  const need = Number.isFinite(today.sleepNeed) && today.sleepNeed > 0 ? today.sleepNeed : 7.5;
  const sleepRatio = clamp((today.sleepHours || 0) / need, 0, 1);
  const z = 0.5 * zHrv + 0.35 * zRhr + 0.15 * sleepRatio;
  return clamp(50 + 20 * z, 0, 100);
}

/**
 * @param {number} age
 * @returns {number}
 */
export function maxHr(age) {
  return 220 - (Number.isFinite(age) ? age : 30);
}

/**
 * @param {number} bpm
 * @param {number} hrMax
 * @returns {0|1|2|3|4|5}
 */
export function hrZone(bpm, hrMax) {
  const p = hrMax > 0 ? bpm / hrMax : 0;
  if (!Number.isFinite(p) || p < 0.5) return 0;
  if (p < 0.6) return 1;
  if (p < 0.7) return 2;
  if (p < 0.8) return 3;
  if (p < 0.9) return 4;
  return 5;
}

/**
 * @param {HrSample[]} samples
 * @param {number} age
 * @returns {number} weighted zone load
 */
export function zoneLoad(samples, age) {
  const hrMax = maxHr(age);
  let load = 0;
  for (const s of samples || []) {
    if (!s || !Number.isFinite(s.bpm)) continue;
    const minutes = Number.isFinite(s.minutes) ? s.minutes : 1;
    load += minutes * ZONE_WEIGHTS[hrZone(s.bpm, hrMax)];
  }
  return load;
}

/**
 * @param {Record<string, number>} zoneMinutes minutes per Google Health zone name
 * @returns {number} weighted zone load
 */
export function zoneMinutesLoad(zoneMinutes) {
  let load = 0;
  for (const zone of Object.keys(zoneMinutes || {})) {
    const w = GOOGLE_ZONE_WEIGHTS[zone.toUpperCase()];
    const minutes = zoneMinutes[zone];
    if (w === undefined || !Number.isFinite(minutes) || minutes <= 0) continue;
    load += minutes * w;
  }
  return load;
}

/**
 * @param {{zoneMinutes?: Record<string,number>, hrSamples?: HrSample[], steps?: number, age?: number}} input
 * @returns {number} 0-21
 */
export function strain(input) {
  const age = Number.isFinite(input && input.age) ? input.age : 30;
  const zLoad = zoneMinutesLoad(input && input.zoneMinutes);
  if (zLoad > 0) return clamp(21 * (1 - Math.exp(-zLoad / 600)), 0, 21);
  const load = zoneLoad(input && input.hrSamples, age);
  if (input && input.hrSamples && input.hrSamples.length) return clamp(21 * (1 - Math.exp(-load / 600)), 0, 21);
  const steps = Number.isFinite(input && input.steps) ? input.steps : 0;
  return clamp(21 * (1 - Math.exp(-steps / 12000)), 0, 21);
}

/**
 * @param {{asleepMinutes: number, inBedMinutes: number, deepMinutes: number, remMinutes: number, needHours: number}} s
 * @returns {number} 0-100
 */
export function sleepScore(s) {
  const need = Number.isFinite(s.needHours) && s.needHours > 0 ? s.needHours : 7.5;
  const asleep = Number.isFinite(s.asleepMinutes) ? s.asleepMinutes : 0;
  const inBed = Number.isFinite(s.inBedMinutes) && s.inBedMinutes > 0 ? s.inBedMinutes : asleep;
  const deep = Number.isFinite(s.deepMinutes) ? s.deepMinutes : 0;
  const rem = Number.isFinite(s.remMinutes) ? s.remMinutes : 0;
  const duration = clamp(asleep / 60 / need, 0, 1);
  const efficiency = inBed > 0 ? clamp(asleep / inBed, 0, 1) : 0;
  const restorative = asleep > 0 ? clamp((deep + rem) / asleep / RESTORATIVE_TARGET, 0, 1) : 0;
  return clamp(100 * (0.5 * duration + 0.25 * efficiency + 0.25 * restorative), 0, 100);
}

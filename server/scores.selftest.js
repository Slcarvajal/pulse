// Hand-computed checks for server/scores.js — run: node server/scores.selftest.js

import { recovery, strain, sleepScore, sleepNeed, band } from './scores.js';

let failed = 0;
const EPS = 1e-6;

function check(name, actual, expected) {
  const ok = typeof expected === 'number' ? Math.abs(actual - expected) < EPS : actual === expected;
  if (!ok) {
    failed++;
    console.error(`FAIL ${name}: got ${actual}, expected ${expected}`);
  } else {
    console.log(`ok   ${name} = ${actual}`);
  }
}

// Case 1 — sleepNeed: 7.5 + 0.5 (strain 15 > 14) + 0.25 (recovery 30 < 34) = 8.25
check('sleepNeed(strain 15, recovery 30)', sleepNeed({ strain: 15, recovery: 30 }), 8.25);

// Case 2 — recovery: zHrv = (70-60)/10 = 1; zRhr = -(50-55)/5 = 1; ratio = 8/8 = 1
// z = .5(1) + .35(1) + .15(1) = 1.0  ->  50 + 20*1 = 70  -> green
const rec = recovery(
  { hrv: 70, rhr: 50, sleepHours: 8, sleepNeed: 8 },
  { hrv: { mean: 60, sd: 10, n: 30 }, rhr: { mean: 55, sd: 5, n: 30 } }
);
check('recovery(hrv 70, rhr 50, 8/8h)', rec, 70);
check('band(70)', band(rec), 'green');

// Case 3 — sleepScore: duration 420/60/8 = .875; efficiency 420/480 = .875;
// restorative (70+110)/420 = 3/7 = .428571.. / .45 = .952380..
// 100 * (.5*.875 + .25*.875 + .25*.9523809523809523) = 89.43452380952381
check(
  'sleepScore(420 asleep, 480 in bed, 70 deep, 110 rem, need 8h)',
  sleepScore({ asleepMinutes: 420, inBedMinutes: 480, deepMinutes: 70, remMinutes: 110, needHours: 8 }),
  89.43452380952381
);

// Case 4 — strain: maxHR = 220-30 = 190. Zones by %max:
// 30min@100 (z1,w1)=30, 20min@120 (z2,w2)=40, 10min@140 (z3,w4)=40,
// 5min@160 (z4,w8)=40, 2min@180 (z5,w12)=24  ->  load 174
// 21 * (1 - e^(-174/600)) = 21 * (1 - 0.7482635676) = 5.2864650...
check(
  'strain(load 174, age 30)',
  strain({
    age: 30,
    hrSamples: [
      { bpm: 100, minutes: 30 },
      { bpm: 120, minutes: 20 },
      { bpm: 140, minutes: 10 },
      { bpm: 160, minutes: 5 },
      { bpm: 180, minutes: 2 }
    ]
  }),
  5.286465072
);

// Case 4b — strain from Google zone minutes: LIGHT dropped (w0), MODERATE 60 (w2) = 120,
// VIGOROUS 20 (w8) = 160, PEAK 5 (w12) = 60  ->  load 340
check(
  'strain(zoneMinutes 60/20/5)',
  strain({ age: 30, zoneMinutes: { LIGHT: 1140, MODERATE: 60, VIGOROUS: 20, PEAK: 5 } }),
  21 * (1 - Math.exp(-340 / 600))
);

// Case 4c — zone data with only LIGHT falls back to steps
check('strain(LIGHT only, steps 12000)', strain({ age: 30, zoneMinutes: { LIGHT: 1140 }, steps: 12000 }), 21 * (1 - Math.exp(-1)));

// Case 5 — strain fallback (no HR series): 21 * (1 - e^(-12000/12000)) = 21 * (1 - 1/e)
check('strain(steps 12000, no HR)', strain({ steps: 12000, age: 30 }), 21 * (1 - Math.exp(-1)));

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');

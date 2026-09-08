// Hand-computed checks for server/scores.js — run: node server/scores.selftest.js

import {
  recovery, strain, sleepScore, sleepNeed, band,
  recoveryV2, activityStrain, dayStrain, strainTarget,
  sleepPerformance, sleepEfficiency, sleepDebt, sleepConsistency,
  sleepNeedV2, personalRange
} from './scores.js';

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

/* ---------------------------- v2 engine (SPEC §6) ---------------------------- */

// Case 6 — recoveryV2 (SPEC §6.1): zHrv=+1, zRhr=+1 (inverted), resp/spo2/temp all z=0.
// Z = (.40*1 + .25*1 + .15*0 + .10*0 + .10*0) / 1.0 = 0.65  ->  50 + 20*.65 = 63 -> yellow
const rec2 = recoveryV2(
  { hrv: 70, rhr: 50, respiratoryRate: 16, spo2: 96, skinTempDeviation: 0 },
  {
    hrv: { mean: 60, sd: 10, n: 30 },
    rhr: { mean: 55, sd: 5, n: 30 },
    respiratoryRate: { mean: 16, sd: 1, n: 30 },
    spo2: { mean: 96, sd: 1, n: 30 },
    skinTempDeviation: { mean: 0, sd: 0.2, n: 30 }
  }
);
check('recoveryV2(5 inputs)', rec2, 63);
check('band(63)', band(rec2), 'yellow');

// Case 6b — deviation inputs are free within +/-1 sd, then penalise linearly (SPEC §6.1):
// resp z = +2 -> signed = -(2-1) = -1, weight .15
// Z = (.40*1 + .25*1 + .15*-1) / 1.0 = 0.50  ->  50 + 10 = 60
check(
  'recoveryV2(resp 2sd high penalises past tolerance)',
  recoveryV2(
    { hrv: 70, rhr: 50, respiratoryRate: 18, spo2: 96, skinTempDeviation: 0 },
    {
      hrv: { mean: 60, sd: 10, n: 30 },
      rhr: { mean: 55, sd: 5, n: 30 },
      respiratoryRate: { mean: 16, sd: 1, n: 30 },
      spo2: { mean: 96, sd: 1, n: 30 },
      skinTempDeviation: { mean: 0, sd: 0.2, n: 30 }
    }
  ),
  60
);

// Case 6c — missing inputs renormalise: only hrv (+1) and rhr (+1) usable,
// Z = (.40 + .25) / .65 = 1  ->  70
check(
  'recoveryV2(only hrv+rhr, renormalised)',
  recoveryV2({ hrv: 70, rhr: 50 }, { hrv: { mean: 60, sd: 10, n: 30 }, rhr: { mean: 55, sd: 5, n: 30 } }),
  70
);

// Case 7 — activityStrain (SPEC §6.2): 5 light(w0) + 16 mod(w2) + 10 vig(w8) + 0 peak = 112
check(
  'activityStrain(5/16/10/0)',
  activityStrain({ zoneMin: { light: 5, moderate: 16, vigorous: 10, peak: 0 } }),
  21 * (1 - Math.exp(-112 / 220))
);

// Case 7b — dayStrain: day load 340 (as case 4b) + 0.25 * 112 workout bonus = 368
check(
  'dayStrain(zones + 1 workout)',
  dayStrain({
    zoneMinutes: { LIGHT: 1140, MODERATE: 60, VIGOROUS: 20, PEAK: 5 },
    workouts: [{ zoneMin: { light: 5, moderate: 16, vigorous: 10, peak: 0 } }]
  }),
  21 * (1 - Math.exp(-368 / 600))
);

// Case 8 — strainTarget (SPEC §6.3): r=67 -> centre 14 -> 12..16
check('strainTarget(67).min', strainTarget(67).min, 12);
check('strainTarget(67).max', strainTarget(67).max, 16);
// r=0 -> centre 4 -> clamp(2,0,21)..6
check('strainTarget(0).min', strainTarget(0).min, 2);
check('strainTarget(100).max', strainTarget(100).max, 20);

// Case 9 — sleepPerformance / sleepEfficiency (SPEC §6.4-6.5)
check('sleepPerformance(432 min, need 8h)', sleepPerformance(432, 8), 90);
check('sleepEfficiency(432/468)', sleepEfficiency(432, 468), (432 / 468) * 100);

// Case 10 — sleepDebt (SPEC §6.6): 7 nights x 2h deficit = 14h, capped at 10
check(
  'sleepDebt(7 x 2h deficit, capped)',
  sleepDebt(Array.from({ length: 7 }, () => ({ asleepMin: 360, need: 8 }))),
  10
);
check('sleepDebt(no deficit)', sleepDebt([{ asleepMin: 480, need: 8 }, { asleepMin: 500, need: 8 }]), 0);

// Case 11 — sleepConsistency (SPEC §6.7): bedtimes 22:30/23:30 alternating -> signed -90/-30,
// population sd = 30; wake 07:00/08:00 -> sd 30; avgSd 30 -> 100*(1 - 30/90) = 66.666...
check(
  'sleepConsistency(sd 30/30)',
  sleepConsistency([
    { bedtimeMin: 1350, wakeMin: 420 },
    { bedtimeMin: 1410, wakeMin: 480 },
    { bedtimeMin: 1350, wakeMin: 420 },
    { bedtimeMin: 1410, wakeMin: 480 }
  ]),
  100 * (1 - 30 / 90)
);
check(
  'sleepConsistency(identical nights)',
  sleepConsistency([
    { bedtimeMin: 1380, wakeMin: 420 },
    { bedtimeMin: 1380, wakeMin: 420 }
  ]),
  100
);

// Case 12 — sleepNeedV2 (SPEC §6.8): 7.5 + strain .75 (strain 21) + debt 1.0 (5h) - nap .5 (30min)
const need2 = sleepNeedV2({ yesterdayStrain: 21, debtHours: 5, napMinutes: 30 });
check('sleepNeedV2(strain 21, debt 5h, nap 30m).need', need2.need, 8.8);
check('sleepNeedV2 breakdown.strain', need2.breakdown.strain, 0.75);
check('sleepNeedV2 breakdown.nap', need2.breakdown.nap, -0.5);

// Case 13 — personalRange (SPEC §6.9): [1..5] -> mean 3, population sd sqrt(2)
const pr = personalRange([1, 2, 3, 4, 5]);
check('personalRange([1..5]).mean', pr.mean, 3);
check('personalRange([1..5]).sd', pr.sd, Math.sqrt(2));
check('personalRange([1..5]).min', pr.min, 3 - Math.sqrt(2));

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');

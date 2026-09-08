# SPEC — PULSE v2

> v2 is a **superset** of v1. Every v1 field still ships. Nothing in §5 is removed.
> Ground truth for the upstream API is `docs/HEALTH_API.md` (verified live). Do not re-research it.

## 1. Goal
Open an icon on my iPhone home screen → full-screen near-black dashboard showing Recovery, Strain, Sleep and a Health Monitor from my Fitbit Air, refreshed on open. Whoop-grade instrument aesthetic. One user (me).

## 2. Data flow
Fitbit Air → Google Health app → Google cloud → `health.googleapis.com/v4/...` → `/api/health` (server) → JSON cache → React UI. The v4 API has **no `startTime`/`endTime` query params** (400): LIST takes an AIP-160 `filter`, daily totals come from `POST .../dataPoints:dailyRollUp`, and intraday buckets come from `POST .../dataPoints:rollUp` — verified contract in `docs/HEALTH_API.md`.

Auth: Google OAuth 2.0, authorization-code flow, server-side. Consent screen in *Testing* mode, my account as test user. Refresh token persisted to `data/token.json`.

## 3. Repo layout
```
server/
  index.js          Express: static dist/, /api/auth, /api/auth/callback, /api/health, /api/live
  google.js         token exchange/refresh, LIST / dailyRollUp / rollUp wrappers, DATA_TYPES
  collect.js        per-metric fetch + normalise into day-keyed maps (v2)
  payload.js        assemble the /api/health and /api/live payloads (v2)
  scores.js         pure functions: v1 (recovery/strain/sleepScore/baselines) + v2 engine
  scores.selftest.js
  cache.js          read/write data/health.json (6h) and data/live.json (2m), ?refresh=1 bypass
src/
  main.jsx, App.jsx
  api.js            getHealth() / getLive(); `?mock=1` short-circuits to src/mock.json
  mock.json         deterministic 30-day fixture in the full v2 shape
  theme.js          COLORS, TYPE, RING, MOTION, band(), rangeState()
  screens/Home.jsx Recovery.jsx Strain.jsx Sleep.jsx Health.jsx Trends.jsx
  components/Ring.jsx Card.jsx MetricCard.jsx Sparkline.jsx Delta.jsx DayStrip.jsx
             RangeBar.jsx StrainBar.jsx Hypnogram.jsx HRTimeline.jsx Bars.jsx
             Skeleton.jsx StaleBanner.jsx TabBar.jsx
public/
  manifest.json, icons/ (192, 512, apple-touch-icon 180), sw.js
Caddyfile, ecosystem.config.cjs, .env.example, package.json, vite.config.js, tailwind.config.js, index.html
data/               (gitignored)
```

## 4. Environment (.env)
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
BASE_URL=https://carvafit.carvajalgoenaga.com
PORT=3000
TZ=America/New_York
AGE=30
```

## 5. Server contract

### 5.1 Routes
- `GET /api/auth` → 302 to Google consent. Scopes (`server/google.js SCOPES`): `googlehealth.activity_and_fitness.readonly`, `googlehealth.health_metrics_and_measurements.readonly`, `googlehealth.sleep.readonly`. `access_type=offline`, `prompt=consent`.
- `GET /api/auth/callback?code=` → exchange, save `{refresh_token, access_token, expiry}` to `data/token.json`, redirect `/`.
- `GET /api/health[?refresh=1]` → the full payload below. Cache TTL **6h** (`data/health.json`).
- `GET /api/live[?refresh=1]` → `{ generatedAt, latestHr, hrDay }` only. Cache TTL **2 minutes** (`data/live.json`). The UI polls this every 60s while the document is visible. It must never trigger the expensive 30-day fetch.
- 401 with `{ "auth": "/api/auth" }` when no token; UI shows a single "Connect Google" button.
- Any Google error → serve cached JSON if present, add `"stale": true`. If nothing is cached, 503 `{ "message": ... }`.

### 5.2 `/api/health` payload (v2 — superset of v1)
```json
{
  "generatedAt": "2026-09-08T16:00:00.000Z",
  "stale": false,
  "tz": "America/New_York",

  "today": {
    "date": "2026-09-08",
    "recovery": 72,                  
    "recoveryBand": "green",         
    "strain": 11.4,                  
    "sleepScore": 84,                
    "rhr": 58,
    "hrv": 62.4,
    "spo2": 96.2,
    "respiratoryRate": 15.8,
    "skinTempDeviation": 0.12,       
    "vo2max": 38.4,
    "vo2maxLevel": "FAIR",           
    "steps": 8421,
    "activeZoneMinutes": 42,
    "calories": { "active": 612, "total": 2380 },
    "distanceKm": 6.42,
    "floors": 9,
    "sedentaryMin": 649,
    "sleepHours": 7.2,
    "sleepNeed": 8.0,
    "strainTarget": { "min": 12.4, "max": 16.4 }
  },

  "recoveryInputs": {
    "hrv":               { "value": 62.4, "z": 0.61,  "weight": 0.40, "contribution": 0.244 },
    "rhr":               { "value": 58,   "z": -0.40, "weight": 0.25, "contribution": 0.100 },
    "respiratoryRate":   { "value": 15.8, "z": -0.20, "weight": 0.15, "contribution": -0.030 },
    "spo2":              { "value": 96.2, "z": 0.18,  "weight": 0.10, "contribution": -0.018 },
    "skinTempDeviation": { "value": 0.12, "z": 0.35,  "weight": 0.10, "contribution": -0.035 }
  },

  "deltas": {
    "rhr": -2.1, "hrv": 4.3, "sleepHours": 0.4,
    "respiratoryRate": -0.2, "spo2": 0.3, "skinTempDeviation": 0.05,
    "recovery": 6, "strain": -1.2, "sleepScore": 3
  },

  "personalRange": {
    "rhr":               { "min": 54.2, "max": 63.8, "mean": 59.0, "sd": 2.4, "n": 30 },
    "hrv":               { "min": 44.1, "max": 71.9, "mean": 58.0, "sd": 6.9, "n": 30 },
    "respiratoryRate":   { "min": 14.9, "max": 17.1, "mean": 16.0, "sd": 0.55, "n": 30 },
    "spo2":              { "min": 94.4, "max": 97.6, "mean": 96.0, "sd": 0.8, "n": 30 },
    "skinTempDeviation": { "min": -0.34, "max": 0.34, "mean": 0.0, "sd": 0.17, "n": 30 }
  },

  "hrZones": [
    { "type": "LIGHT",    "min": 30,  "max": 116 },
    { "type": "MODERATE", "min": 117, "max": 140 },
    { "type": "VIGOROUS", "min": 141, "max": 170 },
    { "type": "PEAK",     "min": 171, "max": 190 }
  ],

  "zoneMinutes": { "LIGHT": 1121, "MODERATE": 62, "VIGOROUS": 21, "PEAK": 4 },

  "workouts": [
    {
      "type": "VOLLEYBALL",
      "name": "Volleyball",
      "start": "2026-09-08T18:30:00-05:00",
      "durationMin": 30,
      "avgHr": 134,
      "zoneMin": { "light": 5, "moderate": 16, "vigorous": 10, "peak": 0 },
      "activityStrain": 7.6,
      "kcal": 264
    }
  ],

  "sleep": {
    "date": "2026-09-08",
    "start": "2026-09-07T23:14:00-05:00",
    "end":   "2026-09-08T07:02:00-05:00",
    "inBedMin": 468,
    "asleepMin": 432,
    "stages": { "deep": 71, "rem": 96, "light": 265, "awake": 36 },
    "latencyMin": 12,
    "awakeMin": 36,
    "disturbances": 7,
    "efficiency": 92.3,
    "consistency": 78,
    "performance": 90,
    "debtHours": 2.4,
    "need": 8.0,
    "needBreakdown": { "baseline": 7.5, "debt": 0.72, "strain": 0.28, "nap": -0.5 },
    "hypnogram": [
      { "type": "AWAKE", "start": "2026-09-07T23:14:00-05:00", "end": "2026-09-07T23:26:00-05:00", "min": 12 }
    ],
    "nights": [
      { "date": "2026-09-02", "asleepMin": 410, "need": 7.9, "performance": 86,
        "bedtimeMin": 1385, "wakeMin": 428 }
    ]
  },

  "hrDay": [ { "t": "2026-09-08T00:00:00-05:00", "avg": 58, "min": 52, "max": 64 } ],
  "latestHr": { "bpm": 74, "at": "2026-09-08T11:58:00-05:00" },

  "history": [
    { "date": "2026-08-10", "recovery": 61, "strain": 9.8, "sleepScore": 79,
      "sleepPerformance": 88, "rhr": 60, "hrv": 55.2, "spo2": 96.1,
      "respiratoryRate": 16.2, "skinTempDeviation": -0.08, "sleepHours": 7.0,
      "steps": 7100, "calories": 2310, "distanceKm": 5.4, "floors": 6,
      "activeZoneMinutes": 28 }
  ]
}
```

Notes:
- `history` is **30 days, oldest first**, and always includes the v1 keys `date, recovery, strain, sleepScore, rhr, hrv, sleepHours`.
- `sleep.nights` is the **last 7 nights, oldest first**. `bedtimeMin`/`wakeMin` are minutes-past-local-midnight (bedtime may be ≥ 720 for a pre-midnight bedtime — see §6.7).
- `hrDay` is today's 5-minute buckets, ≤ 288 entries, **empty buckets omitted** (the API omits them). Chart code must not assume a fixed length.
- `skinTempDeviation` = `nightlyTemperatureCelsius − baselineTemperatureCelsius`, in °C, signed.
- Any metric the API does not return for a day is `null`, never `0`.

### 5.3 Upstream mapping (dataType → payload field)
| payload | dataType | call | value key |
|---|---|---|---|
| `hrv` | `daily-heart-rate-variability` | LIST | `averageHeartRateVariabilityMilliseconds` |
| `rhr` | `daily-resting-heart-rate` | LIST | `beatsPerMinute` |
| `spo2` | `daily-oxygen-saturation` | LIST | `averagePercentage` |
| `respiratoryRate` | `daily-respiratory-rate` | LIST | `breathsPerMinute` |
| `skinTempDeviation` | `daily-sleep-temperature-derivations` | LIST | `nightlyTemperatureCelsius − baselineTemperatureCelsius` |
| `vo2max`, `vo2maxLevel` | `daily-vo2-max` | LIST | `vo2Max`, `cardioFitnessLevel` |
| `hrZones` | `daily-heart-rate-zones` | LIST (latest day) | `heartRateZones[]` |
| `sleep.*` | `sleep` | LIST (filter by `civil_end_time`) | `sleep` |
| `workouts[]` | `exercise` | LIST (`civil_start_time`) | `exercise` |
| `steps` | `steps` | dailyRollUp | `countSum` |
| `zoneMinutes` | `time-in-heart-rate-zone` | dailyRollUp | `timeInHeartRateZones[]` |
| `activeZoneMinutes` | `active-zone-minutes` | dailyRollUp | sum of `sumIn*HeartZone` |
| `calories.active` | `active-energy-burned` | dailyRollUp | `kcalSum` |
| `calories.total` | `total-calories` | dailyRollUp | `kcalSum` |
| `distanceKm` | `distance` | dailyRollUp | `millimetersSum / 1e6` |
| `floors` | `floors` | dailyRollUp | `countSum` |
| `sedentaryMin` | `sedentary-period` | dailyRollUp | `durationSum` seconds / 60 |
| `hrDay` | `heart-rate` | **intraday `rollUp`**, `windowSize:"300s"`, today 00:00→24:00 local as RFC3339 | `heartRate.beatsPerMinuteAvg/Min/Max` |
| `latestHr` | `heart-rate` | LIST, filter `heart_rate.sample_time.physical_time >= <now-10min>`, `pageSize=200`, take newest | `beatsPerMinute` |

`personalRange` and all `deltas` are computed locally from the 30-day history (§6.8) — the API's `*-personal-range` types return 400 and must not be called.

## 6. Score engine (`server/scores.js`) — pure, no I/O
All v1 exports stay and keep their v1 behaviour: `clamp, mean, stddev, baselines, zscore, delta, sleepNeed, band, recovery, maxHr, hrZone, zoneLoad, zoneMinutesLoad, strain, sleepScore`.
Baselines = 30-day mean and **population** stddev, today excluded. `round1(x) = Math.round(x*10)/10`.

### 6.1 Recovery — `recoveryV2(today, base)` → 0-100, `recoveryBreakdown(today, base)` → `{score, band, inputs}`
Five inputs, z-scored against their own 30-day baseline:

| input | weight | signed z used |
|---|---|---|
| `hrv` | 0.40 | `+z` (higher is better) |
| `rhr` | 0.25 | `−z` (lower is better) |
| `respiratoryRate` | 0.15 | `−max(0, abs(z) − 1)` (deviation) |
| `spo2` | 0.10 | `−max(0, abs(z) − 1)` (deviation) |
| `skinTempDeviation` | 0.10 | `−max(0, abs(z) − 1)` (deviation) |

```
Z = Σ(weight_i * signedZ_i) / Σ(weight_i)      // only over inputs with a finite value AND base.sd > 0
recoveryV2 = clamp(50 + 20 * Z, 0, 100)
```
**Deviation inputs have a ±1 sd tolerance band**: staying inside your own normal range is free (signed z = 0); only a deviation beyond 1 sd penalises, and it does so linearly. A plain `−abs(z)` would subtract ~5.6 points *every* day (E|z| ≈ 0.8) and make green almost unreachable.
If no input is usable, return `50`. Renormalising by the used weight sum means a missing metric neither helps nor hurts.
`recoveryBreakdown` returns `{ score, band: band(score), inputs: { key: {value, z, weight, contribution} } }` where `contribution = weight * signedZ / Σweights`.

### 6.2 Strain — zone weights unchanged
`ZONE_W = { LIGHT: 0, MODERATE: 2, VIGOROUS: 8, PEAK: 12 }` (LIGHT includes ~19h/day of rest, so it is weight 0).

- `activityStrain(workout)` → `21 * (1 − e^(−wLoad/220))`, clamped `[0,21]`, where the **220** divisor (vs 600 for a whole day) rescales a single session onto the same 0-21 axis, and
  `wLoad = light*0 + moderate*2 + vigorous*8 + peak*12` from `workout.zoneMin`.
- `dayStrain({ zoneMinutes, workouts, steps, age })` → `21 * (1 − e^(−total/600))` where
  `total = zoneMinutesLoad(zoneMinutes) + 0.25 * Σ wLoad(workout)`.
  The 0.25 coefficient is a **structured-exercise bonus**: workout minutes are already inside `zoneMinutes`, so only a quarter of their load is added again.
  If `total === 0`, fall back to `21 * (1 − e^(−steps/12000))`.

### 6.3 Strain target — `strainTarget(recoveryScore)` → `{min, max}`
```
r = clamp(recoveryScore, 0, 100)
r >= 67 : centre = 14 + (r - 67) / 33 * 4      // green  → 14.0 .. 18.0
r >= 34 : centre =  9 + (r - 34) / 33 * 5      // yellow →  9.0 .. 14.0
else    : centre =  4 +  r        / 34 * 5     // red    →  4.0 ..  9.0
min = round1(clamp(centre - 2, 0, 21))
max = round1(clamp(centre + 2, 0, 21))
```

### 6.4 Sleep performance — `sleepPerformance(asleepMin, needHours)` → 0-100
`clamp(asleepMin / (needHours * 60), 0, 1) * 100`. `needHours` defaults to 7.5 when non-finite/≤0.

### 6.5 Sleep efficiency — `sleepEfficiency(asleepMin, inBedMin)` → 0-100
`inBedMin > 0 ? clamp(asleepMin / inBedMin, 0, 1) * 100 : 0`.

### 6.6 Sleep debt — `sleepDebt(nights)` → hours
`clamp(Σ over ≤7 most recent nights of max(0, need_i − asleepMin_i/60), 0, 10)`. Nights missing `asleepMin` are skipped.

### 6.7 Sleep consistency — `sleepConsistency(nights)` → 0-100
`bedtimeMin`/`wakeMin` are minutes past local midnight. Bedtimes wrap midnight, so map to a signed offset first:
```
signed(m) = m >= 720 ? m - 1440 : m          // 23:00 → -60, 01:00 → +60
sdBed  = stddev(nights.map(n => signed(n.bedtimeMin)))
sdWake = stddev(nights.map(n => n.wakeMin))          // wake never wraps
avgSd  = (sdBed + sdWake) / 2
consistency = clamp(100 * (1 - avgSd / 90), 0, 100)  // 90-minute average spread → 0
```
Fewer than 2 usable nights → `0`.

### 6.8 Sleep need — `sleepNeedV2({ baselineHours, yesterdayStrain, debtHours, napMinutes })`
→ `{ need, breakdown: { baseline, debt, strain, nap } }`
```
baseline = baselineHours (default 7.5)
strain   = clamp((yesterdayStrain - 10) / 11, 0, 1) * 0.75      // strain 21 → +0.75h
debt     = clamp(debtHours * 0.3, 0, 1.0)
nap      = -Math.min(napMinutes / 60, 0.75)                      // naps reduce need
need     = round1(clamp(baseline + strain + debt + nap, 6, 10))
```
`sleepNeed()` (v1) is retained for the v1 `today.sleepNeed` fallback when no 7-night history exists.

### 6.9 Personal range — `personalRange(values)` → `{min, max, mean, sd, n}`
`mean ± 1 stddev` over the finite values (up to 30 days, today included). `n < 2` → `{min: null, max: null, mean, sd: 0, n}`.
`rangeState(value, range)` (in `src/theme.js`) → `'in' | 'below' | 'above' | 'unknown'`.

### 6.10 Sleep score
`sleepScore()` (v1, 50/25/25 duration/efficiency/restorative) still populates `today.sleepScore` and `history[].sleepScore`. `sleep.performance` (§6.4) is the number the Sleep screen's hero ring shows.

## 7. UI — design system + layouts
PULSE is a dark-mode performance instrument, closer to cockpit telemetry than to a wellness app. **Near-black canvas, always. No light mode, no theme toggle.** Colour is the primary signal, never decoration: the recovery green/yellow/red bands carry the whole information hierarchy, and you must be able to read your status from colour alone before reading a number. Everything that is not a semantic signal stays monochrome. One primary number per card. No skeuomorphism, no decorative gradients, no drop shadows, sparse thin-stroke icons.

### 7.1 Tokens — `src/theme.js`
```js
export const COLORS = {
  bg:        '#000000',
  surface:   '#0A0B0D',
  surface2:  '#121418',
  hairline:  'rgba(255,255,255,0.08)',
  track:     'rgba(255,255,255,0.06)',
  text:      '#F5F7FA',
  muted:     '#6B7280',
  dim:       '#3A3F47',
  green:     '#16EC06',
  yellow:    '#FFDE00',
  red:       '#FF0026',
  strain:    '#0093E7',
  sleep:     '#7BA1BB',
  temp:      '#F5A623',   // skin temperature — ONLY on the Health screen
  // v1 aliases, kept so nothing breaks:
  black: '#000000', recoveryGreen: '#16EC06', recoveryYellow: '#FFDE00',
  recoveryRed: '#FF0026', strainBlue: '#0093E7', sleepTeal: '#7BA1BB',
};
export function band(score) // >=67 {color:green,name:'GREEN',word:'READY'}
                            // >=34 {color:yellow,name:'YELLOW',word:'MODERATE'}
                            // else {color:red,name:'RED',word:'REST'}
```
The same tokens are mirrored into `tailwind.config.js` under `theme.extend.colors` with the same key names.

### 7.2 Typography
Loaded with a plain `<link>` in `index.html`. **No npm font package.**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=Inter:wght@400;600;700&display=swap">
```
Two roles only:

**Numerals** — `Inter`, weight 700, `font-variant-numeric: tabular-nums`, `letter-spacing: -0.03em`, colour `text` (or the semantic colour when the number *is* the signal).
| step | size | line-height | used for |
|---|---|---|---|
| `hero` | 88px | 0.92 | the one number inside a hero ring |
| `card` | 56px | 1.0 | the primary number of a card (latest BPM, VO2 max, small rings) |
| `secondary` | 32px | 1.0 | MetricCard values, stat-row tiles |
| `tertiary` | 20px | 1.0 | inline values inside lists |

**Labels** — `Barlow Condensed`, weight 600, `text-transform: uppercase`, `letter-spacing: 0.14em`, colour `muted`. 11px everywhere; 12px only for the band word and screen titles. Units use the same face at 12px, `muted`, baseline-aligned 4px after the numeral. **Never** set a label in Inter and never a numeral in Barlow Condensed. High typographic contrast between value and description is the point.

CSS helper classes in `src/index.css`: `.num-hero .num-card .num-2 .num-3` and `.lbl .lbl-lg`.

### 7.3 `Ring` — the hero element
Props: `value, max, size, stroke, color, label, children`.
- SVG, `viewBox="0 0 S S"`, `r = (S - stroke) / 2`, `C = 2πr`.
- **270° gauge arc opening at the bottom.** Rotate the whole `<g>` by `135deg` about the centre: the arc then runs from bottom-left, over the top, to bottom-right, with a 90° gap at the bottom.
- Track: full 270°, `stroke = COLORS.track`, same width, `stroke-linecap: round`.
- Value: `stroke-dasharray = "${pct * 0.75 * C} ${C}"`, `pct = clamp(value/max,0,1)`, `stroke-linecap: round`, **solid colour, never a gradient**, no glow, no shadow.
- Stroke width: **10px** for the hero ring (`size 220`), **6px** for small rings (`size 104`), 3px for DayStrip (`size 28`).
- Centre: the numeral (hero 88px / card 56px) with its unit; the `label` sits **under the ring** inside the card, not inside the arc gap.
- Mount animation: animate `stroke-dasharray` from 0 → target over **900ms `cubic-bezier(0.16,1,0.3,1)`**; the numeral counts up over the same 900ms.

### 7.4 `Card`
`background: COLORS.surface`, `border-radius: 20px`, `padding: 16px`, `border: 1px solid COLORS.hairline`, **no box-shadow**. Vertical gap between cards **12px**; screen horizontal padding **16px**. `Card` accepts `label` (rendered top-left as `.lbl`) and `right` (an optional top-right slot).

### 7.5 `DayStrip`
Row of 7 items at the top of Home, `justify-between`, last item = today.
Each item: a 28px `Ring` (stroke 3) whose value is that day's recovery and whose colour is that day's band, with the **day initial** (S M T W T F S) centred inside in Barlow Condensed 11px. Today is **filled**: a disc of the band colour at 18% alpha behind the ring, initial in the band colour. Other days: initial in `dim`. Days with no data: track-only ring, initial in `dim`.

### 7.6 `MetricCard`
A `Card`, `display:flex`, `align-items:center`.
- Left: `label` (`.lbl`), then the value as `.num-2` + unit, then a `Delta` chip.
- Right: a 7-day `Sparkline`, 88×32, **monochrome** — 1.5px `COLORS.muted` polyline, no fill, no axis, with a 3px `COLORS.text` dot on the last point.
- `Delta` chip: inline-flex, height 18px, radius 9px, padding 0 6px, `background: COLORS.surface2`, text 11px Barlow Condensed uppercase in `COLORS.text`, prefixed `▲`/`▼`/`—`. **Monochrome by design** — deltas are context, not status.

### 7.7 `RangeBar` (Health screen)
Horizontal track, height 6px, radius 3px, full width, `background: COLORS.track`.
- Domain: `[mean − 3sd, mean + 3sd]`, expanded if needed to contain today's value.
- Personal range `[range.min, range.max]` drawn as a `rgba(255,255,255,0.14)` segment.
- Today's value: a 10px dot. **In range → `COLORS.text`. Out of range → `COLORS.red`**, except the skin-temperature row which uses `COLORS.temp`.
- End labels (domain min / max) below in `.lbl`.

### 7.8 `Hypnogram`
4 lanes top→bottom: `AWAKE`, `REM`, `LIGHT`, `DEEP`. Lane height 18px, 4px gap, 44px left gutter for lane labels (`.lbl`). x-axis spans `sleep.start → sleep.end`.
Each stage is a rounded rect (radius 2), height 12px, centred in its lane:
`DEEP #7BA1BB` · `REM rgba(123,161,187,0.75)` · `LIGHT rgba(123,161,187,0.45)` · `AWAKE #3A3F47`.
Below the lanes: start and end clock times in `.lbl`.

### 7.9 `HRTimeline`
Full-width SVG, height 120px, x-axis 00:00→24:00 local (from `hrDay`, gaps left as gaps — do **not** interpolate across a missing bucket run of >2).
- Line: `1.5px`, `COLORS.muted`, no fill, `stroke-linejoin: round`.
- Zone bands: a 1px `COLORS.hairline` horizontal rule at each `hrZones[].min`, labelled at the right edge in `.lbl`.
- Segments whose `avg >= MODERATE.min` are re-drawn on top in `COLORS.strain`.
- Top-left overlay: latest BPM as `.num-card` + `BPM` unit + "N MIN AGO" in `.lbl`, with a 6px `COLORS.strain` dot pulsing at 2s.

### 7.10 `StrainBar`
Track height 8px, radius 4px, domain 0→21, `background: COLORS.track`.
- Target band `[strainTarget.min, strainTarget.max]` as an `rgba(0,147,231,0.22)` segment.
- Fill 0→strain in `COLORS.strain`.
- A 2px `COLORS.text` marker at the current value.
- `0` and `21` end labels in `.lbl`; caption `TARGET {min}–{max}`.

### 7.11 `Skeleton`, `StaleBanner`
- `Skeleton`: card-shaped blocks, `background: COLORS.surface2`, radius 20px, `animation: pulse 1.4s ease-in-out infinite` (opacity 0.4 → 0.8 → 0.4). **No gradient shimmer.**
- `StaleBanner`: full-width, 28px, `background: rgba(245,166,35,0.10)`, 1px `hairline` bottom, text `.lbl` in `COLORS.temp`: `SHOWING CACHED DATA`.

### 7.12 `TabBar`
Fixed bottom, height 56px + `env(safe-area-inset-bottom)`, `background: COLORS.bg`, 1px top `hairline`, no blur. **5 tabs: Home · Recovery · Strain · Sleep · Health.**
Icons: inline SVG 20×20, `fill: none`, `stroke: currentColor`, `stroke-width: 1.5`, round caps — Home = house outline, Recovery = 270° arc, Strain = lightning bolt, Sleep = crescent moon, Health = heart outline.
Label 10px Barlow Condensed uppercase 0.14em under the icon. Active `COLORS.text`; inactive `COLORS.dim`.

### 7.13 Motion (Framer Motion)
| what | spec |
|---|---|
| rings + counters | 900ms, `cubic-bezier(0.16, 1, 0.3, 1)`, on mount |
| cards entering a screen | opacity 0→1 and `y: 12 → 0`, 240ms ease-out, **staggered 40ms** by index |
| tab switch | crossfade **150ms**, opacity only (`AnimatePresence mode="wait"`) |
| BPM dot | opacity 1 → 0.35 → 1, 2s, infinite |
No other animation. Respect `prefers-reduced-motion: reduce` by setting all durations to 0.

### 7.14 Screen layouts (top → bottom, exact order)
Every screen: `background: COLORS.bg`, horizontal padding 16px, `padding-top: env(safe-area-inset-top)`, bottom padding **88px** to clear the TabBar, cards separated by 12px.
Screen header (all screens): a 48px row — title in Barlow Condensed 600 12px uppercase 0.2em `COLORS.muted` on the left, optional icon buttons on the right (20px, 1.5px stroke, `COLORS.dim`).

**Home** (`src/screens/Home.jsx`)
1. Header `PULSE`; right side two icon buttons: trends (line-chart glyph) → Trends screen, refresh → `getHealth({refresh:true})` (spins while refreshing).
2. `StaleBanner` — only when `data.stale`.
3. `DayStrip` — last 7 days from `history`, today last.
4. **Hero Recovery card**: `Ring` size 220 stroke 10 in the band colour, `.num-hero` value + `%` centred; under the ring the **band word** (`READY` / `MODERATE` / `REST`) in the band colour at 12px, and under that the label `RECOVERY` in `.lbl`.
5. Two-column grid (12px gap): **Strain card** — `Ring` size 104 stroke 6 `COLORS.strain`, `.num-card` value (1 dp), label `STRAIN`; **Sleep card** — `Ring` size 104 stroke 6 `COLORS.sleep`, `.num-card` `sleep.performance` + `%`, label `SLEEP`.
6. **Heart-rate card**: label `HEART RATE`, latest BPM as `.num-card` + `BPM` + `N MIN AGO`, then `HRTimeline` (120px) over `hrDay`.
7. **Health Monitor summary card**: label `HEALTH MONITOR`, a 5-column row of 8px dots over `.lbl` captions `RHR · HRV · RESP · SPO2 · TEMP`. Dot = `COLORS.text` in range, `COLORS.red` out of range (`TEMP` out of range uses `COLORS.temp`). Tapping the card switches to the Health tab.

**Recovery** (`src/screens/Recovery.jsx`)
1. Header `RECOVERY`.
2. Hero `Ring` 220/10 in the band colour, `.num-hero` + `%`, band word, label `RECOVERY`.
3. Section label `INPUTS`, then five `MetricCard`s in this order, each with its 7-day sparkline and `Delta` vs the 30-day mean:
   `HRV` (ms) · `RESTING HEART RATE` (bpm) · `RESPIRATORY RATE` (rpm) · `BLOOD OXYGEN` (%) · `SKIN TEMPERATURE` (°C, signed, 2 dp).
4. Card `7-DAY RECOVERY`: a monochrome 1.5px sparkline of the last 7 recovery scores with **each point dotted in its own band colour** (4px), and the value under each point in `.lbl`.

**Strain** (`src/screens/Strain.jsx`)
1. Header `STRAIN`.
2. Hero `Ring` 220/10 `COLORS.strain`, value 1 dp in `.num-hero`, `/ 21` in `.lbl` under the number, label `STRAIN`.
3. Card: `StrainBar` with the target band, caption `TARGET {min}–{max} · {BAND} RECOVERY`.
4. `WORKOUTS` — one card per entry in `workouts[]`: name (Barlow Condensed 12px `COLORS.text`) with start time + `{durationMin} MIN` in `.lbl` below; `activityStrain` (1 dp) right-aligned in `.num-2` `COLORS.strain`; a 6px 4-segment zone bar (light/moderate/vigorous/peak at `COLORS.strain` alpha 0.30/0.50/0.75/1.0, widths ∝ minutes); a footer row `AVG {avgHr} BPM · {kcal} CAL`. Empty → one card reading `NO WORKOUTS LOGGED` in `.lbl`.
5. Card `TIME IN ZONES`: four horizontal bars `LIGHT / MODERATE / VIGOROUS / PEAK`, width ∝ minutes, same alpha ramp, minutes right-aligned in `.num-3`.
6. Four-tile stat row: `CALORIES` (`calories.active` big, `{total} TOTAL` in `.lbl`) · `STEPS` · `DISTANCE` (km, 1 dp) · `FLOORS`. `.num-2` values.

**Sleep** (`src/screens/Sleep.jsx`)
1. Header `SLEEP`.
2. Hero `Ring` 220/10 `COLORS.sleep`, `sleep.performance` + `%` in `.num-hero`, label `SLEEP PERFORMANCE`.
3. Card `HOURS VS NEED`: horizontal 8px track, fill `COLORS.sleep` to `asleepMin`, a 2px `COLORS.text` marker at `need*60`, caption `{h}H {m}M OF {needH}H {needM}M`.
4. Card `SLEEP STAGES`: `Hypnogram`.
5. Four-tile stat row `DEEP · REM · LIGHT · AWAKE` — minutes in `.num-2`, `.lbl` under, dot in the stage colour.
6. Four-tile stat row `LATENCY` (min) · `AWAKE` (min) · `DISTURBANCES` · `EFFICIENCY` (%).
7. Card `CONSISTENCY`: `.num-card` percentage + caption `BEDTIME ±{sdBed}M · WAKE ±{sdWake}M`.
8. Card `SLEEP NEED`: one stacked horizontal bar of `needBreakdown` — `baseline` (`COLORS.sleep`), `debt` (`COLORS.sleep` 0.6), `strain` (`COLORS.sleep` 0.35), `nap` (negative, drawn hatched in `COLORS.dim`) — with a legend row and `{debtHours}H` sleep debt as `.num-2`.
9. Card `LAST 7 NIGHTS`: seven vertical bars of hours asleep in `COLORS.sleep`, a dashed 1px `COLORS.dim` line across at the mean need, day initials in `.lbl`.

**Health** (`src/screens/Health.jsx`)
1. Header `HEALTH MONITOR`.
2. Five cards, one per metric, in order `RESTING HEART RATE · HRV · RESPIRATORY RATE · BLOOD OXYGEN · SKIN TEMPERATURE`. Each: label, today's value in `.num-2` + unit, a `RangeBar`, and a caption `30D RANGE {min}–{max}` in `.lbl`. Skin temperature uses `COLORS.temp` for its out-of-range dot; every other row uses `COLORS.red`.
3. Card `VO2 MAX`: `.num-card` value, unit `ML/KG/MIN`, `vo2maxLevel` word in Barlow Condensed 12px `COLORS.text`, and a horizontal 6px position marker over a 0–60 track.

**Trends** (`src/screens/Trends.jsx`) — reached from the Home header icon, not a tab; header shows a back chevron and no tab is active.
1. Header `TRENDS` with back chevron.
2. Segment control `7D` / `30D`: two 28px pills, active = `COLORS.surface2` background + `COLORS.text` label, inactive = transparent + `COLORS.dim`.
3. Three `Bars` cards: `RECOVERY` (each bar in **its own band colour**), `STRAIN` (`COLORS.strain`), `SLEEP` (`COLORS.sleep`). Each has a dashed 1px `COLORS.dim` baseline at the period mean and min/max labels in `.lbl`.

### 7.15 Client data access — `src/api.js`
```js
export async function getHealth({ refresh } = {})   // GET /api/health[?refresh=1]
export async function getLive()                     // GET /api/live
```
Both must first check the URL: if `new URLSearchParams(location.search).get('mock') === '1'`, return `(await import('./mock.json')).default` (for `getLive`, only its `{generatedAt, latestHr, hrDay}`) **without making any network request**. This is how screenshot QA runs.
401 → `{ needsAuth: true, authUrl }`. Other non-2xx → throw with `.status`.

### 7.16 App shell — `src/App.jsx`
- State: `data, live, loading, error, refreshing, tab` where `tab ∈ 'home'|'recovery'|'strain'|'sleep'|'health'|'trends'`.
- On mount: `getHealth()`. `Skeleton` while loading, `ConnectScreen` when `needsAuth`, `StaleBanner` when `data.stale`.
- **Live polling**: while `document.visibilityState === 'visible'`, call `getLive()` every **60s** and merge `latestHr` + `hrDay` into the rendered data. Clear the interval on `hidden`; on returning to `visible`, poll once immediately and re-call `getHealth()` if `generatedAt` is older than 6h.
- Screens are swapped with `AnimatePresence mode="wait"` (150ms opacity crossfade). `TabBar` is rendered outside the animated region.

## 8. PWA
- `manifest.json`: name "Pulse", `display: standalone`, `background_color`/`theme_color` `#000000`, icons 192/512, `orientation: portrait`.
- `index.html`: `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `viewport-fit=cover`, `user-scalable=no`, apple-touch-icon, and the Google Fonts `<link>`s from §7.2.
- `sw.js` (`CACHE = 'pulse-v2'`, old caches deleted on activate):
  - cache-first for built `dist/` assets and for `https://fonts.gstatic.com/*` font files;
  - stale-while-revalidate for `https://fonts.googleapis.com/css2*`;
  - network-first with cache fallback for `/api/health`;
  - **network-only for `/api/live`** (never cached);
  - navigation requests fall back to the cached `index.html` when offline.
- Registered in `main.jsx`.
- Icons: `npm run icons` (`scripts/icons.mjs`, `sharp`) renders a filled 270° ring on black at 192/512/180.

## 9. Deploy (Lightsail Ubuntu 22.04)
- `Caddyfile`: `carvafit.carvajalgoenaga.com { reverse_proxy localhost:3000 }`.
- `ecosystem.config.cjs`: one app `pulse`, `node server/index.js`, `env_file: .env`.
- `npm run deploy`: `git pull && npm ci && npm run build && pm2 restart pulse`.
- Cron (documented in README, not automated): `0 7 * * * curl -s https://carvafit.carvajalgoenaga.com/api/health?refresh=1 >/dev/null`.

## 10. Dependencies (closed list — unchanged from v1)
express, dotenv, react, react-dom, framer-motion, vite, @vitejs/plugin-react, tailwindcss, postcss, autoprefixer, sharp (dev, icons). Raw `fetch` for Google — no SDK. **Fonts come from a Google Fonts `<link>`, not from npm.** No chart library. Any other package requires stopping and reporting.

## 11. Out of scope v2
Apple Health, Apple Watch, notifications, multi-user, tests beyond `scores.selftest.js`, TypeScript, background sync, a database, light mode.

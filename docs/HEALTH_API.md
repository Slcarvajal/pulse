# Google Health API v4 — verified contract (probed live 2026-09-08 against a Fitbit Air account)

Base: `https://health.googleapis.com/v4/users/me/dataTypes/{dataType}`
Auth: `Authorization: Bearer <access_token>`. Scopes used (all valid):
`googlehealth.activity_and_fitness.readonly`, `googlehealth.health_metrics_and_measurements.readonly`, `googlehealth.sleep.readonly`.

## 1. LIST  `GET .../dataPoints?pageSize=N&filter=<AIP-160>&pageToken=`
`startTime`/`endTime` query params DO NOT EXIST (400). Time range goes in `filter`.
Response: `{ dataPoints: DataPoint[], nextPageToken?: string }`, newest first. pageSize max 10000.
Filter patterns (field name = dataType with `-` → `_`):
- daily summaries: `daily_resting_heart_rate.date >= "2026-09-01" AND daily_resting_heart_rate.date < "2026-09-09"`
- interval types (steps): `steps.interval.civil_start_time >= "2026-09-07" AND steps.interval.civil_start_time < "2026-09-08"`
- samples (heart-rate): `heart_rate.sample_time.civil_time >= "2026-09-07T10:00:00" AND heart_rate.sample_time.civil_time < "2026-09-07T10:05:00"`
- sleep (sessions, by END): `sleep.interval.civil_end_time >= "2026-09-06" AND sleep.interval.civil_end_time < "2026-09-09"`

## 2. DAILY ROLL-UP  `POST .../dataPoints:dailyRollUp`  (use this for steps + HR zones; avoids paging per-minute points)
Body: `{ "range": { "start": { "date": {year,month,day} }, "end": { "date": {year,month,day} } }, "windowSizeDays": 1 }`  (closed-open; max 90 days, but **14 days** for `heart-rate`, `total-calories`, `active-minutes`, `calories-in-heart-rate-zone` — chunk those)
Response: `{ rollupDataPoints: [ { civilStartTime:{date:{year,month,day}}, civilEndTime, <valueKey>: {...} } ] }`

## 3. Data types → real payload shapes (a DataPoint always has `dataSource` + ONE value key)
| dataType | value key | fields (numbers often come as strings — Number() them) |
|---|---|---|
| `daily-resting-heart-rate` | `dailyRestingHeartRate` | `date:{year,month,day}`, `beatsPerMinute:"68"` |
| `daily-heart-rate-variability` | `dailyHeartRateVariability` | `date`, `averageHeartRateVariabilityMilliseconds:33.45` (use this as HRV), `deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds` |
| `daily-oxygen-saturation` | `dailyOxygenSaturation` | `date`, `averagePercentage:94`, lower/upperBoundPercentage |
| `steps` (rollUp) | `steps` | `countSum:"1436"` per day |
| `time-in-heart-rate-zone` (rollUp) | `timeInHeartRateZone` | `timeInHeartRateZones:[{heartRateZone:"LIGHT"|"MODERATE"|"VIGOROUS"|"PEAK", duration:"70200s"}]` — LIGHT ≈ below fat-burn (includes rest, ~19h/day) |
| `heart-rate` (rollUp) | `heartRate` | `beatsPerMinuteAvg`, `beatsPerMinuteMax`, `beatsPerMinuteMin` |
| `sleep` (list) | `sleep` | `interval:{startTime,endTime (RFC3339), startUtcOffset:"-18000s"}`, `type:"STAGES"`, `stages:[{startTime,endTime,type:AWAKE|LIGHT|DEEP|REM|ASLEEP|RESTLESS}]`, `summary:{minutesAsleep,minutesAwake,minutesInSleepPeriod,minutesToFallAsleep,stagesSummary:[{type,minutes,count}]}`, `metadata:{mainSleep:boolean, nap:boolean}` |

Sleep: pick the session with `metadata.mainSleep` (or longest) whose civil end date = the day. In-bed = interval end − start. Asleep = `summary.minutesAsleep`. Stage minutes from `summary.stagesSummary` (fallback: sum `stages[]` durations by type).
Dates: `date` objects are the user's civil day. User is UTC-5; set `TZ` in `.env` so server-side "today" matches.

## 4. v2 data types (all probed live 2026-09-08, status 200)
LIST (`{key}.date` filter, one point/day; strip `dataSource`):
| dataType | value key | fields |
|---|---|---|
| `daily-respiratory-rate` | `dailyRespiratoryRate` | `breathsPerMinute:16.8` |
| `daily-sleep-temperature-derivations` | `dailySleepTemperatureDerivations` | `nightlyTemperatureCelsius:34.49`, `baselineTemperatureCelsius:34.00`, `relativeNightlyStddev30dCelsius:0.32` (skin temp; use nightly − baseline as deviation) |
| `daily-vo2-max` | `dailyVo2Max` | `vo2Max:32.9`, `cardioFitnessLevel:"POOR"|...`, `estimated:true` |
| `daily-heart-rate-zones` | `dailyHeartRateZones` | `heartRateZones:[{heartRateZoneType:LIGHT|MODERATE|VIGOROUS|PEAK, minBeatsPerMinute:"30", maxBeatsPerMinute:"116"}]` (user's personal zone bounds) |
LIST (sample types, `{key}.sample_time.civil_time` filter, `sampleTime:{physicalTime, civilTime:{date,time:{hours,minutes,seconds}}}`):
| `heart-rate-variability` | `heartRateVariability` | `rootMeanSquareOfSuccessiveDifferencesMilliseconds:51.1` (5-min samples during sleep) |
| `oxygen-saturation` | `oxygenSaturation` | `percentage:93.5` |
| `respiratory-rate-sleep-summary` | `respiratoryRateSleepSummary` | `deepSleepStats/lightSleepStats/remSleepStats/fullSleepStats:{breathsPerMinute,standardDeviation}` |
| `heart-rate` | `heartRate` | `beatsPerMinute:"81"` — ~5s cadence, >20k points/day, 21+ pages, 12s. DO NOT list a whole day; use `:rollUp` (see §5) for the 24h chart, and list only the last ~10 min (physical_time filter) for "latest reading". |
LIST (`exercise.interval.civil_start_time` filter): value key `exercise` → `interval:{startTime,endTime}`, `exerciseType:"VOLLEYBALL"`, `displayName`, `activeDuration:"1812s"`, `metricsSummary:{caloriesKcal, distanceMillimeters, steps:"1301", averageHeartRateBeatsPerMinute:"134", activeZoneMinutes:"36", heartRateZoneDurations:{lightTime:"300s",moderateTime:"960s",vigorousTime:"600s",peakTime:"0s"}}`
DAILY ROLL-UP (POST, §2 body):
| `active-zone-minutes` | `activeZoneMinutes` | `sumInFatBurnHeartZone:"2"`, `sumInCardioHeartZone`, `sumInPeakHeartZone` |
| `active-energy-burned` / `total-calories` | `activeEnergyBurned` / `totalCalories` | `kcalSum:166.2` |
| `distance` | `distance` | `millimetersSum:"1048416"` |
| `floors` | `floors` | `countSum:"6"` |
| `sedentary-period` | `sedentaryPeriod` | `durationSum:"38940s"` |
| `active-minutes` | `activeMinutes` | `activeMinutesRollupByActivityLevel:[{activityLevel:"LIGHT", activeMinutesSum:"100"}]` |
| `calories-in-heart-rate-zone` | `caloriesInHeartRateZone` | `caloriesInHeartRateZones:[{heartRateZone, kcal}]` |
NOT AVAILABLE (400): `resting-heart-rate-personal-range`, `heart-rate-variability-personal-range` — compute personal ranges ourselves from 30-day history.

## 5. INTRADAY ROLL-UP  `POST .../dataPoints:rollUp`  (verified: heart-rate, 24h in 5-min buckets = 240 buckets, 0.8s)
Body: `{ "range": { "startTime": "2026-09-07T05:00:00Z", "endTime": "2026-09-08T05:00:00Z" }, "windowSize": "300s", "pageSize": 500 }` (RFC3339 physical times, closed-open; max 14 days for heart-rate)
Response: `{ rollupDataPoints: [ { startTime, endTime, heartRate:{beatsPerMinuteAvg, beatsPerMinuteMax, beatsPerMinuteMin} } ], nextPageToken? }` — buckets with no samples are omitted. Works for every roll-up data type in §4.

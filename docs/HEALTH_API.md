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
Body: `{ "range": { "start": { "date": {year,month,day} }, "end": { "date": {year,month,day} } }, "windowSizeDays": 1 }`  (closed-open; max 90 days, but 14 days for `heart-rate`)
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

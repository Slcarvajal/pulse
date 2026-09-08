# TASKS2 — PULSE v2 build plan

Read `docs/SPEC.md` first; it answers almost everything. `docs/HEALTH_API.md` is the verified upstream contract — **do not re-research the Google Health API**. CLAUDE.md token discipline applies to every task: write each file once and complete, never paste file contents back, summary ≤150 words.

Done-check for every task additionally includes `node --check` on every `.js`/`.jsx` file touched (`.jsx` via `npx vite build` — the build covers it).
Every `ui` task's done-check is **`npm run build` exit 0**.

`src/mock.json` already exists in the full v2 shape (30 days, 4 green / 22 yellow / 4 red, 2 workouts, 25 hypnogram segments, 240 `hrDay` buckets). **Build every UI screen against `?mock=1`.** Do not regenerate it.

## Parallel groups
| group | tasks | may run concurrently |
|---|---|---|
| **G1** | 1, 4, 7 | yes — disjoint files |
| **G2** | 2, 5, 6 | yes |
| **G3** | 3, 8, 9, 10, 11, 12, 13 | yes |
| **G4** | 14 | after G3 |
| **G5** | 15 | after 14 |

---

## Task 1 — Upstream collectors — `builder`
**Depends on:** nothing (`server/google.js` already exports `listRange`, `dailyRollUp`, `rollUp`, `listSamplesPhysical` and the full v2 `DATA_TYPES`).
**Files (2):** `server/collect.js` (new), `server/index.js` (only to delete the fetch/normalise helpers that move out).
**Spec:** §5.3, `docs/HEALTH_API.md` §1-§5.
Write one module that fetches and normalises every v2 data type into day-keyed maps. Export:
- `collectDaily(startDate, endDate)` → `{ hrv, rhr, spo2, respiratoryRate, skinTempDeviation, vo2max, vo2maxLevel }`, each a `{ 'YYYY-MM-DD': number }` map (LIST, `daily-*`, `{key}.date` filter).
- `collectRollups(startDate, endDate)` → `{ steps, zoneMinutes, activeZoneMinutes, activeKcal, totalKcal, distanceKm, floors, sedentaryMin }` (dailyRollUp).
- `collectSleep(startDate, endDate)` → per-day session objects with `start, end, inBedMin, asleepMin, stages, latencyMin, awakeMin, disturbances, hypnogram[], bedtimeMin, wakeMin, nap`. Pick `metadata.mainSleep` (else longest) whose civil **end** date is the day. `disturbances` = count of `AWAKE`/`RESTLESS` segments after sleep onset.
- `collectWorkouts(startDate, endDate)` → `workouts[]` per §5.2 from `exercise` (`heartRateZoneDurations` seconds → `zoneMin`).
- `collectHrZones()` → the latest `daily-heart-rate-zones` point as `[{type,min,max}]`.
- `collectHrDay(dateStr, tzOffset)` → `hrDay[]` via `rollUp('heart-rate', …, '300s')` over local 00:00→24:00.
- `collectLatestHr()` → `{bpm, at}` via `listSamplesPhysical('heart-rate', now-10min, now)`.
Every number goes through `Number()`. Missing day → omit the key (never `0`). One `Promise.all` per group so the fan-out is parallel.
**Done-check:** `node --check server/collect.js`; `node -e "import('./server/collect.js')"` resolves.

## Task 2 — Payload assembly — `builder`
**Depends on:** Task 1.
**Files (1):** `server/payload.js` (new).
**Spec:** §5.2, §6.
Export `buildHealthPayload()` and `buildLivePayload()`. Compose `collect.js` + `scores.js` into exactly the §5.2 shape — same key names, same nesting, same ordering as `src/mock.json`. Use `baselines()`, `recoveryBreakdown()`, `dayStrain()`, `activityStrain()`, `strainTarget()`, `sleepPerformance()`, `sleepEfficiency()`, `sleepConsistency()`, `sleepDebt()`, `sleepNeedV2()`, `personalRange()`, and keep v1 `sleepScore()` for `today.sleepScore`/`history[].sleepScore`. Window = 30 days ending today, `history` oldest first, `sleep.nights` = last 7. `TZ` from env.
**Done-check:** `node --check server/payload.js`, and
`node -e "const a=require('./src/mock.json'); /* compare key sets with a dry-run object */"` — at minimum assert the exported function's result shape matches `Object.keys(mock)`.

## Task 3 — Routes and two-tier cache — `builder`
**Depends on:** Task 2.
**Files (2):** `server/index.js`, `server/cache.js`.
**Spec:** §5.1.
`cache.js`: generalise to `read(name)`, `write(name, payload)`, `isFresh(payload, ttlMs)` over `data/<name>.json`. `index.js`: `/api/health` (6h TTL, `?refresh=1` bypass) and `/api/live` (2m TTL) — `/api/live` must never call the 30-day collectors. `AuthRequiredError` → 401 `{auth:'/api/auth'}`. Any other Google error → cached payload + `stale:true`, or 503 when nothing is cached.
**Done-check:** `node --check server/index.js server/cache.js`; `node server/index.js` starts and `curl -s localhost:3000/api/health` returns 401 JSON with no token.

## Task 4 — Design system + core primitives — `ui`
**Depends on:** nothing.
**Files (6):** `index.html`, `tailwind.config.js`, `src/index.css`, `src/theme.js`, `src/components/Ring.jsx`, `src/components/Card.jsx`.
**Spec:** §7.1, §7.2, §7.3, §7.4, §7.13.
`index.html`: add the two `preconnect`s and the Google Fonts stylesheet `<link>` for `Inter:wght@400;600;700` + `Barlow+Condensed:wght@500;600`, plus `user-scalable=no`. **No npm font package.**
`theme.js`: export `COLORS` (all §7.1 keys **including the v1 aliases**), `TYPE`, `RING`, `MOTION`, `band(score)` returning `{color,name,word}` with words `READY`/`MODERATE`/`REST`, and `rangeState(value, range)` → `'in'|'below'|'above'|'unknown'`.
`tailwind.config.js`: mirror `COLORS` under `theme.extend.colors` with the same key names; add the four numeral sizes and the label size.
`index.css`: `.num-hero .num-card .num-2 .num-3` (Inter 700, tabular-nums, `-0.03em`) and `.lbl .lbl-lg` (Barlow Condensed 600, uppercase, `0.14em`, muted); `pulse` keyframes; `@media (prefers-reduced-motion: reduce)` zeroing durations. Delete the v1 `shimmer` gradient.
`Ring.jsx`: the §7.3 270° gauge — `<g transform="rotate(135 c c)">`, track + value circles, `stroke-dasharray = pct*0.75*C`, round caps, **no gradient**, framer-motion 900ms `cubic-bezier(0.16,1,0.3,1)` on mount, numeral counts up.
`Card.jsx`: §7.4 exactly, with `label` and `right` slots.
**Done-check:** `npm run build` exit 0.

## Task 5 — Data primitives — `ui`
**Depends on:** Task 4.
**Files (6):** `src/components/Sparkline.jsx`, `Delta.jsx`, `MetricCard.jsx`, `DayStrip.jsx`, `RangeBar.jsx`, `StrainBar.jsx`.
**Spec:** §7.5, §7.6, §7.7, §7.10.
Monochrome sparkline (1.5px `muted`, 3px `text` end dot, no axes). `Delta` chip is **monochrome** — never green/red. `DayStrip` uses 28px `Ring`s at stroke 3, today filled at 18% band alpha. `RangeBar` domain `[mean−3sd, mean+3sd]` expanded to contain today's value; dot `text` in range, `red` out (an `accent` prop lets Health pass `COLORS.temp` for skin temperature). `StrainBar` 0-21 with the target band at `rgba(0,147,231,0.22)` and a 2px `text` marker.
**Done-check:** `npm run build` exit 0.

## Task 6 — Chart primitives — `ui`
**Depends on:** Task 4.
**Files (3):** `src/components/Hypnogram.jsx`, `src/components/HRTimeline.jsx`, `src/components/Bars.jsx` (rewrite).
**Spec:** §7.8, §7.9, §7.14 Trends.
`Hypnogram`: 4 lanes AWAKE/REM/LIGHT/DEEP, 18px lanes, 44px label gutter, stage colours exactly as §7.8. `HRTimeline`: 120px, 1.5px `muted` line, **gaps stay gaps** (`hrDay` omits empty buckets — break the path on any run > 2 missing buckets), zone hairlines from `hrZones`, segments at/above `MODERATE.min` overdrawn in `strain`, latest-BPM overlay with the 2s pulsing dot. `Bars`: vertical bars with a per-bar colour callback and a dashed `dim` mean baseline.
**Done-check:** `npm run build` exit 0.

## Task 7 — Client data layer + mock mode — `ui`
**Depends on:** nothing.
**Files (1):** `src/api.js`.
**Spec:** §7.15.
Export `getHealth({refresh})` and `getLive()`. **Both must short-circuit on `?mock=1`** to `(await import('./mock.json')).default` with **no network request** (`getLive` returns only `{generatedAt, latestHr, hrDay}`). 401 → `{needsAuth:true, authUrl}`; other non-2xx → throw with `.status`.
**Done-check:** `npm run build` exit 0.

## Task 8 — Home screen — `ui`
**Depends on:** Tasks 4, 5, 6, 7.
**Files (2):** `src/screens/Home.jsx` (new), `src/screens/Today.jsx` (delete).
**Spec:** §7.14 Home.
Exact top-to-bottom order: header (`PULSE`, trends + refresh icons) → `StaleBanner` → `DayStrip` → hero Recovery ring card (band word then `RECOVERY`) → 2-col Strain/Sleep ring cards → HR timeline card with latest BPM → Health Monitor summary card with 5 dots. Cards stagger in 40ms apart.
**Done-check:** `npm run build` exit 0.

## Task 9 — Recovery screen — `ui`
**Depends on:** Tasks 4, 5.
**Files (1):** `src/screens/Recovery.jsx` (new).
**Spec:** §6.1, §7.14 Recovery.
Hero ring, `INPUTS` section with the five `MetricCard`s in the specified order and units, then the `7-DAY RECOVERY` card (monochrome line, per-point band-coloured dots).
**Done-check:** `npm run build` exit 0.

## Task 10 — Strain screen — `ui`
**Depends on:** Tasks 4, 5.
**Files (1):** `src/screens/Strain.jsx` (new).
**Spec:** §6.2, §6.3, §7.14 Strain.
Hero ring `/21`, `StrainBar` + target caption, workout cards (with the 4-segment zone bar and the empty state), `TIME IN ZONES` bars, and the calories/steps/distance/floors tile row.
**Done-check:** `npm run build` exit 0.

## Task 11 — Sleep screen — `ui`
**Depends on:** Tasks 4, 5, 6.
**Files (1):** `src/screens/Sleep.jsx` (rewrite).
**Spec:** §6.4-§6.8, §7.14 Sleep.
All nine blocks in order: hero performance ring, hours-vs-need bar, `Hypnogram`, stage tile row, latency/awake/disturbances/efficiency row, consistency, need breakdown, last-7-nights bars.
**Done-check:** `npm run build` exit 0.

## Task 12 — Health Monitor screen — `ui`
**Depends on:** Tasks 4, 5.
**Files (1):** `src/screens/Health.jsx` (new).
**Spec:** §6.9, §7.7, §7.14 Health.
Five `RangeBar` cards in order, skin temperature using `COLORS.temp` as its out-of-range accent, then the VO2 max card with its level word and 0-60 position marker.
**Done-check:** `npm run build` exit 0.

## Task 13 — Trends screen — `ui`
**Depends on:** Tasks 4, 6.
**Files (1):** `src/screens/Trends.jsx` (rewrite).
**Spec:** §7.14 Trends.
Back chevron, 7D/30D segment control, three `Bars` cards (Recovery bars coloured per band, Strain, Sleep) each with a dashed mean baseline.
**Done-check:** `npm run build` exit 0.

## Task 14 — App shell, routing, live polling — `ui`
**Depends on:** Tasks 8-13.
**Files (4):** `src/App.jsx`, `src/components/TabBar.jsx`, `src/components/Skeleton.jsx` (new), `src/components/StaleBanner.jsx` (new).
**Spec:** §7.11, §7.12, §7.13, §7.16.
`TabBar`: the 5 tabs with the §7.12 inline thin-stroke icons; active `text`, inactive `dim`. `App`: `tab ∈ home|recovery|strain|sleep|health|trends`, `AnimatePresence mode="wait"` 150ms opacity crossfade, `Skeleton` while loading, `ConnectScreen` on `needsAuth`, `StaleBanner` on `stale`. **Live polling:** `getLive()` every 60s only while `document.visibilityState === 'visible'`; clear on `hidden`; on becoming visible poll once immediately and re-`getHealth()` if `generatedAt` is older than 6h. Delete the old inline `Skeleton`/`StaleBanner` from `App.jsx`.
**Done-check:** `npm run build` exit 0; `dist/index.html` loads at `/?mock=1` and every tab renders.

## Task 15 — PWA polish — `ui`
**Depends on:** Task 14.
**Files (4):** `public/sw.js`, `public/manifest.json`, `scripts/icons.mjs`, `README.md`.
**Spec:** §8.
`sw.js` → `CACHE = 'pulse-v2'`, delete old caches on activate; cache-first for `dist/` assets and `fonts.gstatic.com`; stale-while-revalidate for `fonts.googleapis.com/css2`; network-first for `/api/health`; **network-only for `/api/live`**; navigation falls back to the cached `index.html`. `manifest.json` gains `orientation: portrait`. `icons.mjs` renders the 270° gauge ring mark. `README.md` documents `?mock=1` and `/api/live`.
**Done-check:** `npm run build` exit 0; `node --check public/sw.js scripts/icons.mjs`.

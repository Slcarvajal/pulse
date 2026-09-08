# TASKS — PULSE v1

Read `docs/SPEC.md` and `CLAUDE.md` before starting. Follow CLAUDE.md token discipline.
**ESM everywhere**: `package.json` has `"type": "module"` (task 1). Use `import`/`export` in all `.js`/`.jsx`.
`.cjs` is used only for `ecosystem.config.cjs` (task 11), which pm2 requires in CommonJS.

Already written by @architect — **do not rewrite**:
- `server/scores.js` (SPEC §6) + `server/scores.selftest.js` (`node server/scores.selftest.js` from repo root)
- `server/google.js` — OAuth + `fetchRange(dataType, startDate, endDate)`; its header comment block holds the
  API base URL, our field → dataType mapping and the OAuth read scopes. Do not re-research the Health API.

Build order: `npm run build` must exit 0 after every task from task 2 onward
(task 1 has no `src/`, so its done-check is `npm install`).

## Parallel map
- Task 1 — alone, first.
- **Group A (parallel after 1):** 2, 3, 11
- **Group B (parallel after A):** 4 (needs 3), 5 (needs 2), 10 (needs 2)
- **Group C (parallel after 5):** 6, 7, 8
- Task 9 — after 6, 7, 8.

---

## 1. Scaffold and build config — `builder`
Depends on: nothing. Parallel group: none (must land first).
Files: `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `.env.example`, `.gitignore`
Spec: §3 (repo layout), §4 (env), §9 (scripts), §10 (dependency allow-list — nothing outside it).
- `package.json`: `"type": "module"`, deps exactly from §10 (raw `fetch`, so **no** `googleapis`/`google-auth-library`),
  `sharp` as devDependency. Scripts: `build` (vite build), `start` (`node server/index.js`),
  `icons` (`node scripts/icons.mjs`), `deploy` (§9 string).
- `vite.config.js`: `@vitejs/plugin-react`, `build.outDir: 'dist'`.
- `tailwind.config.js`: content globs `./index.html`, `./src/**/*.{js,jsx}`; extend colors/fonts from SPEC §7.
- `.env.example`: the four §4 keys plus `AGE=30` (SPEC §6 reads `AGE`).
- `.gitignore`: `node_modules`, `dist`, `data`, `.env`.
Done-check: `npm install` exits 0; `node -e "import('./vite.config.js')"` exits 0.

## 2. App shell, theme and API client — `ui`
Depends on: 1. Parallel group A (with 3, 11).
Files: `index.html`, `src/main.jsx`, `src/App.jsx`, `src/index.css`, `src/theme.js`, `src/api.js`
Spec: §7 (colors, fonts, type scale), §8 (iOS meta tags — `apple-mobile-web-app-capable`,
`apple-mobile-web-app-status-bar-style=black-translucent`, `viewport-fit=cover`, apple-touch-icon), §5 (response shape).
- `src/theme.js`: exported colour constants exactly as §7 (`#000`, `#0F1115`, `#F5F7FA`, `#8B93A1`,
  `#16EC06`, `#FFDE00`, `#FF0026`, `#0093E7`, `#7BA1BB`) plus a `band(score)` → colour helper.
- `src/api.js`: `getHealth({refresh}={})` → `fetch('/api/health' + (refresh ? '?refresh=1' : ''))`;
  on 401 return `{ needsAuth: true, authUrl: body.auth }`.
- `src/App.jsx`: black full-height shell, holds `data`/`loading`/`error` state, renders a placeholder for now.
- `src/main.jsx`: React 18 `createRoot`; service-worker registration is added in task 10.
Done-check: `npm run build` exits 0 and `dist/index.html` exists.

## 3. Cache and Express server (auth routes) — `builder`
Depends on: 1. Parallel group A (with 2, 11).
Files: `server/cache.js`, `server/index.js`
Spec: §5 (all three routes, 401 shape, stale rule), §3, §4.
- `server/cache.js`: `read()` / `write(payload)` on `data/health.json`; `isFresh(payload, ttlMs = 6*3600*1000)`.
  Create `data/` if missing. No throw on missing file — return `null`.
- `server/index.js`: `dotenv/config`; `express.static('dist')`; SPA fallback to `dist/index.html`;
  `GET /api/auth` → 302 `google.authUrl()`; `GET /api/auth/callback` → `google.exchangeCode(code)` then 302 `/`;
  `GET /api/health` → for now: cached payload if present, else 401 `{ "auth": "/api/auth" }`
  (`google.AuthRequiredError` → the same 401). Listen on `process.env.PORT || 3000`.
Done-check: `node --check` on both files; with no `data/token.json`,
`node server/index.js` then `curl -si localhost:3000/api/health` returns `401` and body `{"auth":"/api/auth"}`.

## 4. Health payload assembly — `builder`
Depends on: 3. Parallel group B (with 5, 10).
Files: `server/index.js` (edit only the `/api/health` handler)
Spec: §5 (exact payload), §6 (call `scores.js`, never re-implement it), §2.
- Pull 31 days ending today with `google.fetchRange` for `DATA_TYPES.hrv`, `.rhr`, `.spo2`, `.steps`, `.sleep`,
  and `.heartRate` (today only, for strain zones). Normalise each data point into per-day values.
- Build `history` (30 days, **oldest first**), then `baselines(history)`, then today's
  `sleepNeed(yesterday)` → `recovery` → `strain` → `sleepScore`. Round scores and `rhr`/`hrv`/`spo2` to integers,
  `sleepHours` to 1 decimal. `deltas` = `delta(todayValue, baselines[key])` for `rhr`, `hrv`, `sleepHours`.
- `?refresh=1` bypasses the 6h TTL. Any Google error → serve cached JSON with `"stale": true` added;
  no cache and no token → 401 `{ "auth": "/api/auth" }`.
- Age for strain: `Number(process.env.AGE) || 30`.
Done-check: `node --check server/index.js`; `curl -s 'localhost:3000/api/health'` returns either the 401 body
or a payload whose top-level keys are exactly `generatedAt, today, deltas, sleepStages, history`.

## 5. UI primitives — `ui`
Depends on: 2. Parallel group B (with 4, 10).
Files: `src/components/Ring.jsx`, `src/components/Stat.jsx`, `src/components/Delta.jsx`,
`src/components/Bars.jsx`, `src/components/TabBar.jsx`
Spec: §7 (all of it).
- `Ring`: props `{ size, value, max, color, label, children }`. Hand-written SVG circle with
  `strokeDasharray`/`strokeDashoffset`, Framer Motion animating 0 → value over 900ms `easeOut`; numbers count up.
  No chart library.
- `Stat`: label (11px, uppercase, tracking `0.12em`, muted) + big tabular-nums value + optional `Delta`.
- `Delta`: `▲`/`▼` chip, green/red, formats `±n`.
- `Bars`: props `{ data, colorFor, baseline }` — SVG bar chart with a dashed baseline line.
- `TabBar`: 3 items (Today / Sleep / Trends), inline SVG icons + labels, fixed bottom,
  `padding-bottom: env(safe-area-inset-bottom)`.
Done-check: `npm run build` exits 0.

## 6. Today screen — `ui`
Depends on: 5. Parallel group C (with 7, 8).
Files: `src/screens/Today.jsx`, `src/App.jsx` (wire tab state + routing between the three screens)
Spec: §7 "Today".
220px hero Recovery ring coloured by band with `%` centred and band word below (`GREEN · Ready` /
`YELLOW · Moderate` / `RED · Rest`); row of two smaller rings — Strain (blue, `/21`) and Sleep (teal, `%`);
2×2 stat grid RHR / HRV / SpO2 / Steps, each with a `Delta` chip. Refresh icon top-right → `getHealth({refresh:true})`.
Done-check: `npm run build` exits 0.

## 7. Sleep screen — `ui`
Depends on: 5. Parallel group C (with 6, 8).
Files: `src/screens/Sleep.jsx`
Spec: §7 "Sleep".
Hours slept vs need as a horizontal bar; stacked stage bars (deep / rem / light / awake from `sleepStages`);
RHR and HRV hero numbers side by side; 7-night mini bars from the tail of `history`.
Done-check: `npm run build` exits 0.

## 8. Trends screen — `ui`
Depends on: 5. Parallel group C (with 6, 7).
Files: `src/screens/Trends.jsx`
Spec: §7 "Trends".
7D / 30D segmented control; three `Bars` charts — Recovery (bar colour per band), Strain (blue), Sleep (teal) —
each with a dashed baseline at the 30-day mean.
Done-check: `npm run build` exits 0.

## 9. Loading, connect, and stale states — `ui`
Depends on: 6, 7, 8.
Files: `src/App.jsx`, `src/index.css`
Spec: §5 (401 → single "Connect Google" button linking to `/api/auth`; `stale: true`), §7 (skeleton shimmer).
Skeleton shimmer (CSS keyframes in `index.css`) while loading; stale banner when `data.stale`;
error state falls back to the connect button when the response was a 401.
Done-check: `npm run build` exits 0.

## 10. PWA — `builder`
Depends on: 2. Parallel group B (with 4, 5).
Files: `public/manifest.json`, `public/sw.js`, `scripts/icons.mjs`, `index.html` (link manifest + apple-touch-icon),
`src/main.jsx` (register `/sw.js`), `package.json` (`icons` script if task 1 omitted it)
Spec: §8.
- `manifest.json`: name "Pulse", `display: standalone`, `background_color`/`theme_color` `#000000`, icons 192 + 512.
- `sw.js`: cache-first for built assets, network-first for `/api/*`.
- `scripts/icons.mjs`: `sharp` renders an inline SVG (filled ring on black) → `public/icons/icon-192.png`,
  `icon-512.png`, `apple-touch-icon.png` (180). Run once; commit the PNGs.
Done-check: `npm run icons` exits 0 and the three PNGs exist; `npm run build` exits 0; `dist/manifest.json` present.

## 11. Deploy config and README — `builder`
Depends on: 1. Parallel group A (with 2, 3).
Files: `Caddyfile`, `ecosystem.config.cjs`, `README.md`
Spec: §9.
`Caddyfile`: `carvafit.carvajalgoenaga.com { reverse_proxy localhost:3000 }`. `ecosystem.config.cjs` (CommonJS): one app
`pulse`, `script: 'server/index.js'`, `env_file: '.env'`. README documents `.env` setup, the Google consent screen
in Testing mode with the SPEC §5 scopes, `npm run deploy`, and the 7am cron line from §9 (documented, not automated).
Done-check: `node --check ecosystem.config.cjs`; `npm run build` exits 0.

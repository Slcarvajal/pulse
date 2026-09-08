# SPEC — PULSE v1

## 1. Goal
Open an icon on my iPhone home screen → full-screen black dashboard showing Recovery, Strain, Sleep from my Fitbit Air, refreshed on open. Whoop aesthetic. One user (me).

## 2. Data flow
Fitbit Air → Google Health app → Google cloud → `GET health.googleapis.com/v4/...` → `/api/health` (server) → JSON cache → React UI.

Auth: Google OAuth 2.0, authorization-code flow, server-side. Consent screen in *Testing* mode, my account as test user. Refresh token persisted to `data/token.json`.

## 3. Repo layout
```
server/
  index.js          Express: static dist/, /api/auth, /api/auth/callback, /api/health
  google.js         token exchange/refresh, fetch wrappers for Health API
  scores.js         pure functions: recovery(), strain(), sleepScore(), baselines()
  cache.js          read/write data/health.json with 6h TTL, ?refresh=1 bypass
src/
  main.jsx, App.jsx
  api.js            fetch('/api/health')
  screens/Today.jsx, Sleep.jsx, Trends.jsx
  components/Ring.jsx, Stat.jsx, Bars.jsx, TabBar.jsx, Delta.jsx
  theme.js          colors, fonts
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
```

## 5. Server contract
- `GET /api/auth` → 302 to Google consent. Scopes: read-only for sleep, heart rate, resting heart rate, HRV, steps, oxygen saturation, activity/exercise. Use whatever scope strings the Health API docs specify; `access_type=offline`, `prompt=consent`.
- `GET /api/auth/callback?code=` → exchange, save `{refresh_token, access_token, expiry}` to `data/token.json`, redirect `/`.
- `GET /api/health[?refresh=1]` → returns:
```json
{
  "generatedAt": "ISO",
  "today": { "recovery": 0-100, "strain": 0-21, "sleepScore": 0-100,
             "rhr": n, "hrv": n, "spo2": n, "steps": n,
             "sleepHours": n, "sleepNeed": n },
  "deltas": { "rhr": ±n, "hrv": ±n, "sleepHours": ±n },   // vs 30-day mean
  "sleepStages": { "deep": min, "rem": min, "light": min, "awake": min },
  "history": [ { "date": "YYYY-MM-DD", "recovery": n, "strain": n,
                 "sleepScore": n, "rhr": n, "hrv": n, "sleepHours": n } ] // 30 days, oldest first
}
```
- 401 with `{ "auth": "/api/auth" }` when no token; UI shows a single "Connect Google" button.
- Any Google error → serve cached JSON if present, add `"stale": true`.

## 6. Score engine (server/scores.js) — pure, unit-free of I/O
Baselines = 30-day mean and stddev, excluding today.
- **Recovery (0-100)**: z-score of HRV (weight .5, higher is better), z-score of RHR (weight .35, lower is better), sleep hours / sleep need capped at 1 (weight .15). Map weighted z to 0-100 via `50 + 20*z`, clamp. Bands: green ≥67, yellow 34-66, red <34.
- **Strain (0-21)**: minutes in HR zones weighted `z1:1, z2:2, z3:4, z4:8, z5:12` using max HR = 220-age (age from `.env` `AGE`, default 30), summed, then `21 * (1 - e^(-load/600))`. Fallback when no HR series: `21 * (1 - e^(-steps/12000))`.
- **Sleep score (0-100)**: 50% duration ratio (hours / need), 25% efficiency (asleep / in-bed), 25% restorative share ((deep+rem) / asleep vs 0.45 target). Clamp.
- **Sleep need**: 7.5h baseline + 0.5h if yesterday strain > 14 + 0.25h if yesterday recovery < 34. Cap 9.5.

## 7. UI — Whoop language
- Background `#000`. Surface `#0F1115`. Text `#F5F7FA`. Muted `#8B93A1`.
- Recovery green `#16EC06`, yellow `#FFDE00`, red `#FF0026`. Strain blue `#0093E7`. Sleep teal `#7BA1BB`.
- Font: Inter (system fallback). Numbers: `font-variant-numeric: tabular-nums`, weight 700, huge (72px hero, 40px secondary). Labels: 11px, uppercase, tracking 0.12em, muted.
- **Today**: hero Recovery ring (220px) colored by band, % in center, band word below ("GREEN · Ready"). Row of two smaller rings: Strain (blue, /21), Sleep (teal, %). Below: 2x2 stat grid RHR / HRV / SpO2 / Steps each with `Delta` chip (▲▼ vs 30d).
- **Sleep**: hours slept vs need as a horizontal bar; stage bars stacked; RHR and HRV hero numbers side by side; 7-night mini bars.
- **Trends**: segment control 7D / 30D; three bar charts (Recovery colored per band, Strain blue, Sleep teal) with dashed baseline line at 30-day mean.
- Rings animate from 0 to value on mount (Framer Motion, 900ms, easeOut). Numbers count up.
- Bottom `TabBar` with 3 icons + labels, `padding-bottom: env(safe-area-inset-bottom)`.
- Pull-to-refresh not required; a small refresh icon top-right calls `?refresh=1`.
- Skeleton shimmer while loading. Stale banner if `stale: true`.

## 8. PWA
- `manifest.json`: name "Pulse", `display: standalone`, `background_color/theme_color: #000000`, icons 192/512.
- `index.html`: `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `viewport-fit=cover`, apple-touch-icon.
- `sw.js`: cache-first for `dist/` assets, network-first for `/api/*`. Registered in `main.jsx`.
- Icons: generate simple SVG → PNG with `sharp` at build time (`npm run icons`), a filled ring on black.

## 9. Deploy (Lightsail Ubuntu 22.04)
- `Caddyfile`: `carvafit.carvajalgoenaga.com { reverse_proxy localhost:3000 }`.
- `ecosystem.config.cjs`: one app `pulse`, `node server/index.js`, `env_file: .env`.
- `npm run deploy` (script): `git pull && npm ci && npm run build && pm2 restart pulse`.
- Cron (documented in README, not automated): `0 7 * * * curl -s https://carvafit.carvajalgoenaga.com/api/health?refresh=1 >/dev/null`.

## 10. Dependencies (closed list)
express, dotenv, googleapis (or raw fetch — pick one, prefer raw fetch + `google-auth-library`), react, react-dom, framer-motion, vite, @vitejs/plugin-react, tailwindcss, postcss, autoprefixer, sharp (dev, icons).

## 11. Out of scope v1
Apple Health, Apple Watch, notifications, multi-user, tests, TypeScript, background sync.

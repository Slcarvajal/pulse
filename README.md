# PULSE — Whoop-style PWA for Fitbit Air (personal, Lightsail)

Personal single-user health dashboard. Fitbit Air → Google Health API → Express server → React PWA.

## Setup

### 1. Environment
Copy `.env.example` to `.env` and fill in:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
BASE_URL=https://carvafit.carvajalgoenaga.com
PORT=3000
AGE=30
```
`AGE` is used for max-HR based strain calculation (`220 - AGE`). Defaults to 30 if unset.

### 2. Google OAuth consent screen
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Configure the OAuth consent screen in **Testing** mode, and add your own Google account as a test user.
3. Enable the Health API for the project.
4. Create OAuth 2.0 credentials (Web application), with `${BASE_URL}/api/auth/callback` as an authorized redirect URI.
5. Copy the client ID/secret into `.env`.
6. Scopes: read-only for sleep, heart rate, resting heart rate, HRV, steps, oxygen saturation, and activity/exercise (see `docs/SPEC.md` §5 for exact scope strings from the Health API docs).

Visit `/api/auth` once after deploying to complete the consent flow; the refresh token is persisted to `data/token.json`.

### 3. Install and build
```
npm ci
npm run icons   # generates public/icons/*.png (once, commit the output)
npm run build
```

## Deploy (Lightsail, Ubuntu 22.04)
- `Caddyfile` reverse-proxies `carvafit.carvajalgoenaga.com` to `localhost:3000` (edit the domain to match your host).
- `ecosystem.config.cjs` is the pm2 process definition: app `pulse`, runs `server/index.js`, loads `.env` via `env_file`.
- Start once with `pm2 start ecosystem.config.cjs`, then `pm2 save`.
- Subsequent deploys: `npm run deploy`, which runs `git pull && npm ci && npm run build && pm2 restart pulse`.

## Daily refresh cron
Not automated — add manually on the server (`crontab -e`):
```
0 7 * * * curl -s https://carvafit.carvajalgoenaga.com/api/health?refresh=1 >/dev/null
```
This warms the 6h TTL cache each morning before the dashboard is opened.

## Repo layout
See `docs/SPEC.md` §3 for the full repo layout and `docs/SPEC.md` for the single source of truth on data flow, server contract, score engine, and UI.

- `CLAUDE.md`     — rules every agent inherits (token discipline lives here)
- `docs/SPEC.md`  — the single source of truth; agents read this, not chat history
- `.claude/agents/` — subagents: architect (Opus 5), builder (Sonnet 5), ui (Sonnet 5), reviewer (Opus 5)
- `KICKOFF.md`    — the exact prompt to paste into the Fable 5.1 orchestrator session

## Model roles
- Fable 5.1  → orchestrator only. Plans, delegates, never reads source files.
- Opus 5     → architecture decisions, score engine, final review.
- Sonnet 5   → writes ~90% of the code (server, routes, UI, config).
- Haiku 4.5  → optional: lint fixes, package.json edits, Caddyfile/pm2 boilerplate.

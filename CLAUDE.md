# CLAUDE.md — PULSE

Personal Whoop-style health dashboard. Single user. PWA served by one Node process on AWS Lightsail behind Caddy. Data source: Google Health API (Fitbit Air). No HealthKit. No database.

## Stack (fixed — do not propose alternatives)
- Node 20, Express 4, plain JavaScript (ESM). **No TypeScript.** No test framework.
- Front end: Vite + React 18 + Tailwind 3 + Framer Motion. SVG rings, no chart library.
- HTTPS: Caddy. Process: pm2. Storage: `data/token.json`, `data/health.json`.
- One `npm run build` → `dist/` served statically by Express.

## Token discipline (all agents, always)
1. Read `docs/SPEC.md` first. It answers most questions. Do not ask the orchestrator what the spec already says.
2. Never `cat` a whole file you just wrote. Trust the write; verify with `node --check` or `npm run build`.
3. Never paste file contents back in your final message. Report: files touched, one-line status each, blockers. **Max 150 words.**
4. Never re-read a file you edited in the same task unless a tool error forces it.
5. Prefer `grep -n` and `sed -n 'a,bp'` over reading full files.
6. Write a file once, complete. No "skeleton now, fill later".
7. No commentary in code beyond a one-line header per file.
8. No new dependencies beyond `docs/SPEC.md §Dependencies`. If you think you need one, stop and report.
9. Do not run `npm install` more than once per task. Do not run the dev server; use `npm run build`.
10. If a task is ambiguous, pick the simplest option that satisfies the spec and note the choice in your summary.

## Definition of done per task
- `node --check` passes on every JS file touched.
- `npm run build` exits 0 (UI tasks only).
- Summary under 150 words.

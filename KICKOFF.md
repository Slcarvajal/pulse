# KICKOFF — run order

## 0. Prep (2 min)
```bash
git init && git add . && git commit -m "spec + agents"
claude --model claude-fable-5-1
```
Optional cost ceiling for the whole session (forces every subagent onto one model, ignore unless you're burning through budget):
`CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-5 claude --model claude-fable-5-1`

## 1. Paste this into the Fable session

```
You are the orchestrator for PULSE. Read CLAUDE.md and docs/SPEC.md once. After that you do not open source files yourself — you delegate and read summaries.

Phase A — Architecture
Invoke @architect. When it returns, confirm docs/TASKS.md exists and `node server/scores.selftest.js` passes (run that one command yourself). Do not review its code.

Phase B — Build
For each task in docs/TASKS.md, in order: invoke @builder or @ui as the task specifies, passing only "Task N". Run builder tasks and ui tasks in parallel when TASKS.md marks them independent. After each summary, run only the done-check it names. If a task fails, re-invoke the same agent once with the error text. If it fails twice, invoke @architect with the error and the task number, then retry once.

Phase C — Review
Invoke @reviewer. For each finding, invoke @builder or @ui with "Fix: <the single finding line>". Do not batch more than 3 findings per invocation.

Phase D — Handoff
Write docs/DEPLOY.md: the exact Lightsail commands (Ubuntu 22.04, Node 20 via nodesource, Caddy apt repo, pm2, `git clone`, `.env` fill, DNS A record, `npm run deploy`, first-run `/api/auth` in Safari, Add to Home Screen). Keep it under 60 lines. Then stop and tell me total tasks run, retries, and anything I must do by hand (Google Cloud console steps).

Token rules for you: never paste file contents in chat; keep each of your messages under 80 words; use /compact between phases; do not summarize what agents already summarized.
```

## 2. What you do by hand while agents build (~15 min)
1. Google Cloud console → new project → enable **Google Health API** (request access if it prompts).
2. OAuth consent screen → External → Testing → add your Gmail as test user → add the read scopes the architect lists in `server/google.js`.
3. Credentials → OAuth client → Web application → redirect URI `https://<your-domain>/api/auth/callback`. Copy ID + secret into `.env` on the server.
4. Lightsail → Ubuntu 22.04, $5 plan → attach static IP → DNS A record for your subdomain.

## 3. After Phase D
Follow docs/DEPLOY.md, open `https://<domain>/api/auth` in Safari once, then `https://<domain>` → Share → Add to Home Screen.

## Expected token profile
- Fable: ~30-40 short turns, tiny context (it never reads code).
- Opus 5: 2-3 invocations (architect, reviewer, maybe one conflict).
- Sonnet 5: ~10-14 invocations, one task each, fresh context every time.
This is roughly 3-5× cheaper than one long single-model session because no agent ever carries the whole repo in context.

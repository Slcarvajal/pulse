// Express server: static dist/, Google OAuth routes, /api/health and /api/live route handlers.
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import * as google from './google.js';
import * as cache from './cache.js';
import { buildHealthPayload, buildLivePayload } from './payload.js';

const HEALTH_TTL_MS = 6 * 3600 * 1000;
const LIVE_TTL_MS = 2 * 60 * 1000;

const app = express();
const DIST = path.resolve(process.cwd(), 'dist');

app.use(express.static(DIST));

app.get('/api/auth', (req, res) => {
  res.redirect(google.authUrl());
});

app.get('/api/auth/callback', async (req, res) => {
  try {
    await google.exchangeCode(req.query.code);
    res.redirect('/');
  } catch (err) {
    console.error('auth callback error:', err.message);
    res.status(500).send('Auth failed');
  }
});

async function handleCached(req, res, { name, ttlMs, build }) {
  const forceRefresh = req.query.refresh === '1';
  const cached = cache.read(name);
  if (!forceRefresh && cache.isFresh(cached, ttlMs)) {
    if (!google.readToken()) {
      res.status(401).json({ auth: '/api/auth' });
      return;
    }
    res.json(cached);
    return;
  }
  try {
    if (!google.readToken()) throw new google.AuthRequiredError();
    const payload = await build();
    cache.write(name, payload);
    res.json(payload);
  } catch (err) {
    if (err instanceof google.AuthRequiredError) {
      res.status(401).json({ auth: '/api/auth' });
      return;
    }
    if (cached) {
      res.json({ ...cached, stale: true });
      return;
    }
    console.error(`${name} payload error:`, err.message);
    res.status(503).json({ message: 'Failed to load data' });
  }
}

app.get('/api/health', (req, res) => {
  handleCached(req, res, { name: 'health', ttlMs: HEALTH_TTL_MS, build: buildHealthPayload });
});

app.get('/api/live', (req, res) => {
  handleCached(req, res, { name: 'live', ttlMs: LIVE_TTL_MS, build: buildLivePayload });
});

app.get('/api/*', (req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`pulse listening on ${PORT}`);
});

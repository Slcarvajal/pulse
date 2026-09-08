// Read/write JSON cache at data/health.json with a TTL-based freshness check.
import fs from 'node:fs';
import path from 'node:path';

const CACHE_PATH = path.resolve(process.cwd(), 'data', 'health.json');

/** @returns {any|null} */
export function read() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {any} payload
 * @returns {any}
 */
export function write(payload) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(payload, null, 2));
  return payload;
}

/**
 * @param {any} payload
 * @param {number} [ttlMs]
 * @returns {boolean}
 */
export function isFresh(payload, ttlMs = 6 * 3600 * 1000) {
  if (!payload || !payload.generatedAt) return false;
  const age = Date.now() - new Date(payload.generatedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < ttlMs;
}

// Read/write JSON cache at data/<name>.json with a TTL-based freshness check.
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');

function cachePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

/**
 * @param {string} name
 * @returns {any|null}
 */
export function read(name) {
  try {
    return JSON.parse(fs.readFileSync(cachePath(name), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} name
 * @param {any} payload
 * @returns {any}
 */
export function write(name, payload) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(cachePath(name), JSON.stringify(payload, null, 2));
  return payload;
}

/**
 * @param {any} payload
 * @param {number} ttlMs
 * @returns {boolean}
 */
export function isFresh(payload, ttlMs) {
  if (!payload || !payload.generatedAt) return false;
  const age = Date.now() - new Date(payload.generatedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < ttlMs;
}

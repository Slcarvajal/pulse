// Google OAuth 2.0 + Google Health API v4 access. Token persisted to data/token.json.
/*
 ============================================================================
 GOOGLE HEALTH API v4 — LOOKED UP ONCE, DO NOT RE-RESEARCH
 ----------------------------------------------------------------------------
 REST base      : https://health.googleapis.com/v4
 Data points    : GET /v4/users/me/dataTypes/{dataType}/dataPoints
                    ?startTime=<RFC3339>&endTime=<RFC3339>&pageSize=&pageToken=
                  ({dataType} is the kebab-case DataPoint union field name.)
 OAuth endpoints: auth   https://accounts.google.com/o/oauth2/v2/auth
                  token  https://oauth2.googleapis.com/token
 Auth header    : Authorization: Bearer <access_token>
 Paging         : response { dataPoints: [...], nextPageToken?: "..." }

 OAUTH READ SCOPES WE REQUEST (all Restricted; consent screen stays in Testing):
   https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
     -> steps, exercise/activity, heart rate, resting heart rate, HRV
   https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly
     -> oxygen saturation and other vitals
   https://www.googleapis.com/auth/googlehealth.sleep.readonly
     -> sleep sessions and sleep stages
 Auth request also uses access_type=offline & prompt=consent to get a refresh token.

 OUR FIELD -> API dataType MAPPING (SPEC §5 payload fields):
   today.hrv         -> "daily-heart-rate-variability"  (RMSSD ms, one point/day)
   today.rhr         -> "daily-resting-heart-rate"      (bpm, one point/day)
   today.spo2        -> "daily-oxygen-saturation"       (percent, one point/day)
   today.steps       -> "steps"                         (sum count over range)
   today.sleepHours  -> "sleep"                         (session + stages)
   sleepStages.*     -> "sleep"                         (stage types AWAKE|DEEP|REM|LIGHT)
   strain HR series  -> "heart-rate"                    (intraday bpm samples)
   strain fallback   -> "steps"
   exercise sessions -> "exercise"                      (optional, not used by v1 scores)
 Intraday variants also exist: "heart-rate-variability", "oxygen-saturation".
 ============================================================================
*/

import fs from 'node:fs';
import path from 'node:path';

const TOKEN_PATH = path.resolve(process.cwd(), 'data', 'token.json');
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://health.googleapis.com/v4';

export const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly'
];

export const DATA_TYPES = {
  hrv: 'daily-heart-rate-variability',
  rhr: 'daily-resting-heart-rate',
  spo2: 'daily-oxygen-saturation',
  steps: 'steps',
  sleep: 'sleep',
  heartRate: 'heart-rate',
  exercise: 'exercise'
};

/** Thrown when there is no usable token; callers should answer 401 {auth:'/api/auth'}. */
export class AuthRequiredError extends Error {
  constructor(message = 'not authorized') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

/**
 * @typedef {Object} StoredToken
 * @property {string} refresh_token
 * @property {string} [access_token]
 * @property {number} [expiry] epoch ms
 */

function redirectUri() {
  return `${(process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/auth/callback`;
}

/** @returns {StoredToken|null} */
export function readToken() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {StoredToken} token
 * @returns {StoredToken}
 */
export function saveToken(token) {
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
  return token;
}

/**
 * @param {string} [state]
 * @returns {string} Google consent URL
 */
export function authUrl(state) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true'
  });
  if (state) q.set('state', state);
  return `${AUTH_URL}?${q}`;
}

/**
 * @param {Record<string,string>} body
 * @returns {Promise<any>}
 */
async function postToken(body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`token endpoint ${res.status}: ${json.error_description || json.error || 'unknown'}`);
  return json;
}

/**
 * Exchange an authorization code and persist the token.
 * @param {string} code
 * @returns {Promise<StoredToken>}
 */
export async function exchangeCode(code) {
  const t = await postToken({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirect_uri: redirectUri(),
    grant_type: 'authorization_code'
  });
  if (!t.refresh_token) throw new Error('no refresh_token returned; revoke access and retry with prompt=consent');
  return saveToken({
    refresh_token: t.refresh_token,
    access_token: t.access_token,
    expiry: Date.now() + (t.expires_in || 3600) * 1000
  });
}

/**
 * @param {string} refreshToken
 * @returns {Promise<StoredToken>}
 */
export async function refreshAccessToken(refreshToken) {
  const t = await postToken({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    grant_type: 'refresh_token'
  });
  return saveToken({
    refresh_token: t.refresh_token || refreshToken,
    access_token: t.access_token,
    expiry: Date.now() + (t.expires_in || 3600) * 1000
  });
}

/**
 * Valid access token, refreshing and persisting when expired.
 * @returns {Promise<string>}
 * @throws {AuthRequiredError}
 */
export async function getAccessToken() {
  const token = readToken();
  if (!token || !token.refresh_token) throw new AuthRequiredError();
  if (token.access_token && token.expiry && token.expiry - 60000 > Date.now()) return token.access_token;
  const fresh = await refreshAccessToken(token.refresh_token);
  return fresh.access_token;
}

/**
 * @param {string} date YYYY-MM-DD or ISO
 * @param {boolean} endOfDay
 * @returns {string} RFC3339 UTC
 */
function rfc3339(date, endOfDay) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}Z`;
  }
  return new Date(date).toISOString();
}

/**
 * Fetch every data point of one type in a date range (follows nextPageToken).
 * @param {string} dataType kebab-case id, e.g. 'sleep' — see DATA_TYPES
 * @param {string} startDate YYYY-MM-DD (inclusive)
 * @param {string} endDate YYYY-MM-DD (inclusive)
 * @returns {Promise<any[]>} dataPoints
 * @throws {AuthRequiredError}
 */
export async function fetchRange(dataType, startDate, endDate) {
  const accessToken = await getAccessToken();
  /** @type {any[]} */
  const points = [];
  let pageToken;
  do {
    const q = new URLSearchParams({
      startTime: rfc3339(startDate, false),
      endTime: rfc3339(endDate, true),
      pageSize: '1000'
    });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await fetch(`${API_BASE}/users/me/dataTypes/${encodeURIComponent(dataType)}/dataPoints?${q}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
    });
    if (res.status === 401 || res.status === 403) throw new AuthRequiredError(`health api ${res.status}`);
    if (!res.ok) throw new Error(`health api ${res.status} for ${dataType}`);
    const json = await res.json();
    if (Array.isArray(json.dataPoints)) points.push(...json.dataPoints);
    pageToken = json.nextPageToken;
  } while (pageToken);
  return points;
}

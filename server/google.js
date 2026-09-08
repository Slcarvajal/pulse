// Google OAuth 2.0 + Google Health API v4 access. Token persisted to data/token.json.
/*
 ============================================================================
 GOOGLE HEALTH API v4 — VERIFIED LIVE CONTRACT (docs/HEALTH_API.md). DO NOT RE-RESEARCH.
 ----------------------------------------------------------------------------
 Base : https://health.googleapis.com/v4/users/me/dataTypes/{dataType}
 Auth : Authorization: Bearer <access_token>
 OAuth: auth  https://accounts.google.com/o/oauth2/v2/auth
        token https://oauth2.googleapis.com/token   (access_type=offline, prompt=consent)
 Scopes (all valid, Restricted, consent screen in Testing):
   .../auth/googlehealth.activity_and_fitness.readonly
   .../auth/googlehealth.health_metrics_and_measurements.readonly
   .../auth/googlehealth.sleep.readonly

 1. LIST  GET .../dataPoints?pageSize=N&filter=<AIP-160>&pageToken=
    startTime/endTime query params DO NOT EXIST (400). Time range goes in `filter`.
    Response: { dataPoints: DataPoint[], nextPageToken?: string }, newest first. pageSize max 10000.
    Filter patterns (field name = dataType with `-` -> `_`):
      daily summaries : daily_resting_heart_rate.date >= "2026-09-01" AND daily_resting_heart_rate.date < "2026-09-09"
      interval (steps): steps.interval.civil_start_time >= "2026-09-07" AND steps.interval.civil_start_time < "2026-09-08"
      samples (hr)    : heart_rate.sample_time.civil_time >= "2026-09-07T10:00:00" AND heart_rate.sample_time.civil_time < "2026-09-07T10:05:00"
      sleep (by END)  : sleep.interval.civil_end_time >= "2026-09-06" AND sleep.interval.civil_end_time < "2026-09-09"

 2. DAILY ROLL-UP  POST .../dataPoints:dailyRollUp  (steps + HR zones; avoids paging per-minute points)
    Body: { "range": { "start": { "date": {year,month,day} }, "end": { "date": {...} } }, "windowSizeDays": 1 }
    (closed-open; max 90 days, but 14 days for `heart-rate`)
    Response: { rollupDataPoints: [ { civilStartTime:{date:{...}}, civilEndTime, <valueKey>: {...} } ] }

 3. Data types -> payload shapes (a DataPoint has `dataSource` + ONE value key;
    numbers often arrive as strings — Number() them):
      daily-resting-heart-rate     dailyRestingHeartRate     date, beatsPerMinute:"68"
      daily-heart-rate-variability dailyHeartRateVariability date, averageHeartRateVariabilityMilliseconds (= our HRV),
                                                             deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds
      daily-oxygen-saturation      dailyOxygenSaturation     date, averagePercentage, lower/upperBoundPercentage
      steps (rollUp)               steps                     countSum:"1436" per day
      time-in-heart-rate-zone (rollUp) timeInHeartRateZone   timeInHeartRateZones:[{heartRateZone:"LIGHT"|"MODERATE"|
                                                             "VIGOROUS"|"PEAK", duration:"70200s"}]
                                                             LIGHT ~ below fat-burn (includes rest, ~19h/day)
      heart-rate (rollUp)          heartRate                 beatsPerMinuteAvg/Max/Min
      sleep (list)                 sleep                     interval:{startTime,endTime RFC3339,startUtcOffset:"-18000s"},
                                                             type:"STAGES", stages:[{startTime,endTime,type}],
                                                             summary:{minutesAsleep,minutesAwake,minutesInSleepPeriod,
                                                             minutesToFallAsleep,stagesSummary:[{type,minutes,count}]},
                                                             metadata:{mainSleep,nap}
    Sleep: pick the session with metadata.mainSleep (or longest) whose civil end date = the day.
    In-bed = interval end - start. Asleep = summary.minutesAsleep. Stage minutes from summary.stagesSummary
    (fallback: sum stages[] durations by type).
    Dates: `date` objects are the user's civil day. User is UTC-5; set TZ in .env so server "today" matches.

 OUR FIELD -> API dataType MAPPING (SPEC §5 payload fields):
   today.hrv        -> daily-heart-rate-variability     today.rhr   -> daily-resting-heart-rate
   today.spo2       -> daily-oxygen-saturation          today.steps -> steps (rollUp)
   today.sleepHours -> sleep (list)                     sleepStages -> sleep (list)
   strain           -> time-in-heart-rate-zone (rollUp), steps fallback
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
  zones: 'time-in-heart-rate-zone',
  exercise: 'exercise',
  // v2 (HEALTH_API.md §4) — all probed live, status 200.
  respiratoryRate: 'daily-respiratory-rate',
  skinTemp: 'daily-sleep-temperature-derivations',
  vo2max: 'daily-vo2-max',
  hrZones: 'daily-heart-rate-zones',
  hrvSamples: 'heart-rate-variability',
  spo2Samples: 'oxygen-saturation',
  respiratoryRateSleep: 'respiratory-rate-sleep-summary',
  activeZoneMinutes: 'active-zone-minutes',
  activeEnergy: 'active-energy-burned',
  totalCalories: 'total-calories',
  distance: 'distance',
  floors: 'floors',
  sedentary: 'sedentary-period',
  activeMinutes: 'active-minutes',
  caloriesInZone: 'calories-in-heart-rate-zone'
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
 * @param {string} dataType kebab-case id
 * @returns {string} AIP-160 field name (dataType with `-` -> `_`)
 */
function filterField(dataType) {
  return String(dataType).replace(/-/g, '_');
}

/**
 * Time-range filter for one data type family (see header block).
 * @param {string} dataType
 * @param {string} startDate YYYY-MM-DD inclusive
 * @param {string} endExclusive YYYY-MM-DD exclusive
 * @returns {string}
 */
const SAMPLE_TYPES = new Set([
  'heart-rate',
  'heart-rate-variability',
  'oxygen-saturation',
  'respiratory-rate-sleep-summary'
]);

function rangeFilter(dataType, startDate, endExclusive) {
  const f = filterField(dataType);
  let path;
  let suffix = '';
  if (dataType.startsWith('daily-')) path = `${f}.date`;
  else if (dataType === 'sleep') path = `${f}.interval.civil_end_time`;
  else if (SAMPLE_TYPES.has(dataType)) {
    path = `${f}.sample_time.civil_time`;
    suffix = 'T00:00:00';
  } else path = `${f}.interval.civil_start_time`;
  return `${path} >= "${startDate}${suffix}" AND ${path} < "${endExclusive}${suffix}"`;
}

/**
 * @param {string} dateStr YYYY-MM-DD
 * @param {number} n
 * @returns {string} YYYY-MM-DD
 */
function shiftDate(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {string} dateStr YYYY-MM-DD
 * @returns {{year:number,month:number,day:number}}
 */
function civilDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

/**
 * @param {string} url
 * @param {RequestInit} init
 * @param {string} dataType for error messages
 * @returns {Promise<any>}
 * @throws {AuthRequiredError}
 */
async function apiFetch(url, init, dataType) {
  const res = await fetch(url, init);
  if (res.status === 401 || res.status === 403) throw new AuthRequiredError(`health api ${res.status}`);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`health api ${res.status} for ${dataType}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * LIST every data point of one type in a civil-date range (follows nextPageToken).
 * @param {string} dataType kebab-case id, e.g. 'sleep' — see DATA_TYPES
 * @param {string} startDate YYYY-MM-DD (inclusive)
 * @param {string} endDate YYYY-MM-DD (inclusive)
 * @returns {Promise<any[]>} dataPoints
 * @throws {AuthRequiredError}
 */
export async function listRange(dataType, startDate, endDate) {
  const accessToken = await getAccessToken();
  const filter = rangeFilter(dataType, startDate, shiftDate(endDate, 1));
  /** @type {any[]} */
  const points = [];
  let pageToken;
  do {
    const q = new URLSearchParams({ pageSize: '1000', filter });
    if (pageToken) q.set('pageToken', pageToken);
    const json = await apiFetch(
      `${API_BASE}/users/me/dataTypes/${encodeURIComponent(dataType)}/dataPoints?${q}`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
      dataType
    );
    if (Array.isArray(json.dataPoints)) points.push(...json.dataPoints);
    pageToken = json.nextPageToken;
  } while (pageToken);
  return points;
}

/** Back-compat alias — LIST is the default read path. */
export const fetchRange = listRange;

/**
 * POST :dailyRollUp for one type over a civil-date range, chunked to the API limit
 * (14 days for 'heart-rate', 90 otherwise). Range sent closed-open.
 * @param {string} dataType kebab-case id, e.g. 'steps'
 * @param {string} startDate YYYY-MM-DD (inclusive)
 * @param {string} endDate YYYY-MM-DD (inclusive)
 * @returns {Promise<any[]>} rollupDataPoints
 * @throws {AuthRequiredError}
 */
export async function dailyRollUp(dataType, startDate, endDate) {
  const accessToken = await getAccessToken();
  const maxDays = dataType === 'heart-rate' ? 14 : 90;
  const endExclusive = shiftDate(endDate, 1);
  /** @type {any[]} */
  const points = [];
  let chunkStart = startDate;
  while (chunkStart < endExclusive) {
    const next = shiftDate(chunkStart, maxDays);
    const chunkEnd = next < endExclusive ? next : endExclusive;
    const json = await apiFetch(
      `${API_BASE}/users/me/dataTypes/${encodeURIComponent(dataType)}/dataPoints:dailyRollUp`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: { start: { date: civilDate(chunkStart) }, end: { date: civilDate(chunkEnd) } },
          windowSizeDays: 1
        })
      },
      dataType
    );
    if (Array.isArray(json.rollupDataPoints)) points.push(...json.rollupDataPoints);
    chunkStart = chunkEnd;
  }
  return points;
}

/**
 * POST :rollUp — INTRADAY buckets (HEALTH_API.md §5). Physical RFC3339 times, closed-open.
 * Buckets with no samples are omitted by the API. Max 14 days for 'heart-rate'.
 * @param {string} dataType kebab-case id, e.g. 'heart-rate'
 * @param {string} startIso RFC3339 physical time, inclusive
 * @param {string} endIso RFC3339 physical time, exclusive
 * @param {string} [windowSize] bucket size, e.g. '300s'
 * @returns {Promise<any[]>} rollupDataPoints
 * @throws {AuthRequiredError}
 */
export async function rollUp(dataType, startIso, endIso, windowSize = '300s') {
  const accessToken = await getAccessToken();
  /** @type {any[]} */
  const points = [];
  let pageToken;
  do {
    /** @type {Record<string, any>} */
    const body = { range: { startTime: startIso, endTime: endIso }, windowSize, pageSize: 500 };
    if (pageToken) body.pageToken = pageToken;
    const json = await apiFetch(
      `${API_BASE}/users/me/dataTypes/${encodeURIComponent(dataType)}/dataPoints:rollUp`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      dataType
    );
    if (Array.isArray(json.rollupDataPoints)) points.push(...json.rollupDataPoints);
    pageToken = json.nextPageToken;
  } while (pageToken);
  return points;
}

/**
 * LIST raw samples in a PHYSICAL-time window — used for "latest reading" only
 * (never for a whole day; see HEALTH_API.md §4 heart-rate note).
 * @param {string} dataType e.g. 'heart-rate'
 * @param {string} startIso RFC3339, inclusive
 * @param {string} endIso RFC3339, exclusive
 * @param {number} [pageSize]
 * @returns {Promise<any[]>} dataPoints, newest first
 * @throws {AuthRequiredError}
 */
export async function listSamplesPhysical(dataType, startIso, endIso, pageSize = 200) {
  const accessToken = await getAccessToken();
  const f = dataType.replace(/-/g, '_');
  const filter = `${f}.sample_time.physical_time >= "${startIso}" AND ${f}.sample_time.physical_time < "${endIso}"`;
  const q = new URLSearchParams({ pageSize: String(pageSize), filter });
  const json = await apiFetch(
    `${API_BASE}/users/me/dataTypes/${encodeURIComponent(dataType)}/dataPoints?${q}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
    dataType
  );
  return Array.isArray(json.dataPoints) ? json.dataPoints : [];
}

// Hosted TEST zh-Hans Weekly acceptance trigger, run only by
// .github/workflows/integration-weekly-trigger.yml with the stored TEST identity.
//   PHASE=check    read-only: sign-in, GET /session?view=metadata, GET /ai/reports.
//   PHASE=trigger  the same checks, then at most ONE POST /ai/reports/weekly/trigger
//                  for the fixed target below, never retried.
// Identity must match the pre-confirmed TEST owner (INTEGRATION_WEEKLY_OWNER_ID secret)
// and the stored TEST email; anything unconfirmed fails closed. Output is statuses,
// booleans and allowlisted codes only: never email, password, tokens, owner id or content.
import { weeklyPeriodForLocalDate } from '../lib/ai-periods.js';
import { weeklyReportLocale } from '../lib/report-locale.js';

const BACKEND = 'https://petalpal-backend-test.onrender.com';
const WEB_ORIGIN = 'https://petalpal-web-integration.petalpal-jx.workers.dev';
const PROJECT = 'petalpal-integration-test';
// Fixed, reviewed target: the hosted zh-Hans short Weekly report (weekly-short-v1) of week
// 2026-10-19 (UTC owner). Week 2026-10-12 was consumed by the v2 acceptance on 2026-10-19.
export const TARGET_LOCAL_DATE = '2026-10-24';
export const TARGET_PERIOD_KEY = '2026-10-19';
const NOT_BEFORE_UTC = '2026-10-26T00:00:00.000Z';
export const NOT_BEFORE = Date.parse(NOT_BEFORE_UTC);
const CODES = new Set(['REPORT_NARRATIVE_PROVIDER_NOT_CONFIGURED', 'WEEKLY_REPORT_JOB_FAILED', 'AI_QUOTA_EXCEEDED',
  'AI_BUDGET_UNAVAILABLE', 'AI_INFERENCE_ALREADY_RESERVED', 'AI_GATEWAY_DISABLED', 'AI_GATEWAY_CONFIG_INVALID',
  'AI_GATEWAY_TIMEOUT', 'AI_GATEWAY_PROVIDER_FAILED', 'AI_GATEWAY_INVALID_OUTPUT', 'AI_GATEWAY_GROUNDING_FAILED',
  'AI_GATEWAY_REPLAY_BLOCKED', 'REPORT_NARRATIVE_INVALID_INPUT', 'REPORT_SOURCE_STALE', 'AI_FORBIDDEN']);
const allow = (value, set) => (set.has(value) ? value : value === undefined || value === null ? 'none' : 'OTHER');
const EXECUTIONS = new Set(['COMPLETED', 'FAILED', 'ALREADY_RUNNING_OR_FINALIZED', 'ALREADY_FINALIZED', 'QUEUED', 'PENDING_DISPATCH']);
const NARRATIVE = new Set(['GENERATED', 'INSUFFICIENT_EVIDENCE', 'NOT_GENERATED']);

const env = process.env;
const say = line => console.log(line);
const stop = reason => { say(`STOP: ${reason}`); process.exit(2); };

const phase = env.PHASE;
if (!['check', 'trigger'].includes(phase)) stop('PHASE must be check or trigger; nothing was sent');
for (const name of ['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'INTEGRATION_TEST_EMAIL',
  'INTEGRATION_TEST_PASSWORD', 'INTEGRATION_WEEKLY_OWNER_ID']) if (!env[name]) stop(`missing ${name}; nothing was sent`);
if (env.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== PROJECT) stop('not the TEST Firebase project; nothing was sent');
if (!/^[A-Za-z0-9_-]{1,64}$/.test(env.INTEGRATION_WEEKLY_OWNER_ID)) stop('INTEGRATION_WEEKLY_OWNER_ID is malformed; nothing was sent');
if (phase === 'trigger') {
  if (env.GITHUB_REF !== 'refs/heads/main') stop('trigger runs only from main; nothing was sent');
  if (env.GITHUB_RUN_ATTEMPT !== '1') stop('trigger runs only on the first attempt; nothing was sent');
  if (Date.now() < NOT_BEFORE) stop(`the target week is still open (before ${NOT_BEFORE_UTC} UTC); nothing was sent`);
}

const api = async (path, { token, method = 'GET', body } = {}) => {
  const response = await fetch(BACKEND + path, {
    method, redirect: 'manual', signal: AbortSignal.timeout(90000),
    headers: { Origin: WEB_ORIGIN, Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
};

// Wake a sleeping Free instance with an anonymous read (bounded).
for (let i = 0; i < 12; i++) {
  const r = await fetch(BACKEND + '/session', { signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (r && r.status < 500) break;
  await new Promise(done => setTimeout(done, 10000));
}

const signIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.EXPO_PUBLIC_FIREBASE_API_KEY)}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Referer: `${WEB_ORIGIN}/` }, signal: AbortSignal.timeout(30000),
  body: JSON.stringify({ email: env.INTEGRATION_TEST_EMAIL, password: env.INTEGRATION_TEST_PASSWORD, returnSecureToken: true }),
});
const token = (await signIn.json().catch(() => ({}))).idToken;
if (!token) stop(`TEST Firebase sign-in failed (HTTP ${signIn.status})`);
let claims;
try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()); } catch { stop('unreadable TEST token'); }
if (claims.aud !== PROJECT || claims.iss !== `https://securetoken.google.com/${PROJECT}` || claims.email_verified !== true ||
    String(claims.email || '').toLowerCase() !== env.INTEGRATION_TEST_EMAIL.toLowerCase()) stop('token is not the stored, verified TEST identity');

// Read-only: the metadata view never writes (the plain /session view upserts).
const session = await api('/session?view=metadata', { token });
const user = session.json?.user;
if (session.status !== 200 || !user) stop(`TEST owner profile unavailable (status ${session.status})`);
if (user.id !== env.INTEGRATION_WEEKLY_OWNER_ID) stop('identity mismatch: signed-in owner is not the pre-confirmed TEST owner');
let locale;
try { locale = weeklyReportLocale(user.preferredLocale); } catch { locale = 'UNSUPPORTED'; }
if (locale !== 'zh-Hans') stop(`owner Weekly locale is ${locale === 'en' ? 'en' : 'not zh-Hans'}`);
let periodKey;
try { periodKey = weeklyPeriodForLocalDate(TARGET_LOCAL_DATE, user.timezone).periodKey; } catch { periodKey = null; }
if (periodKey !== TARGET_PERIOD_KEY) stop(`target date does not map to week ${TARGET_PERIOD_KEY} in the owner timezone`);
// Memory-consent-gated read: 200 only with all three consents; no write.
const reports = await api('/ai/reports?limit=50', { token });
if (reports.status !== 200 || !Array.isArray(reports.json?.reports)) stop(`memory consent not confirmed (report list status ${reports.status})`);
if (reports.json.reports.some(r => r.type === 'weekly' && r.periodKey === TARGET_PERIOD_KEY)) stop(`a Weekly report already exists for week ${TARGET_PERIOD_KEY}; no trigger`);
say(`CHECK PASS: identity matched; locale zh-Hans; week ${TARGET_PERIOD_KEY}; memory consent on; no existing report for the week`);
if (phase === 'check') process.exit(0);

// Exactly one request; no retry on any outcome.
const trigger = await api('/ai/reports/weekly/trigger', { token, method: 'POST', body: { localDate: TARGET_LOCAL_DATE } });
const body = trigger.json || {};
const narrative = allow(body.report?.narrativeStatus, NARRATIVE);
say(`TRIGGER: status ${trigger.status}; execution ${allow(body.execution, EXECUTIONS)}; errorCode ${allow(body.errorCode, CODES)}; ` +
  `report ${body.report ? 'present' : 'absent'}; narrative ${narrative}; period ${body.periodKey === TARGET_PERIOD_KEY ? TARGET_PERIOD_KEY : 'unexpected'}`);
process.exit(trigger.status === 200 && narrative === 'GENERATED' ? 0 : 1);

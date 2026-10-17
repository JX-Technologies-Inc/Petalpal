// $0 hosted TEST acceptance of the Weekly Reflection trigger boundary, run from a
// GitHub-hosted runner with the existing verified TEST identity. Fixed TEST hosts only.
// The TEST backend is locked to AI_ASYNC_EXECUTION_MODE=manual with zero call limits
// and no Worker/Gateway credentials, so the trigger runs the Weekly job inline and must
// fail closed (REPORT_NARRATIVE_PROVIDER_NOT_CONFIGURED) before any provider call or
// cost reservation. A 200/202 means a provider path exists on TEST and is a FAIL.
// Writes (owner-authorized): AI consent grant then revoke, two synthetic Events
// (idempotent per UTC day), one Weekly AiJob for the previous week.
// Never prints the email, password, tokens or response bodies.
import { randomUUID } from 'node:crypto';
import { AI_DISCLOSURE_VERSION } from '../lib/ai-disclosure.js';

const BACKEND = 'https://petalpal-backend-test.onrender.com';
const WEB_ORIGIN = 'https://petalpal-web-integration.petalpal-jx.workers.dev';
const PROJECT = 'petalpal-integration-test';
const env = process.env;
const stop = message => { console.log(`::error title=weekly acceptance::${message}`); process.exit(1); };
if (env.AUTHORIZATION_PHRASE !== 'WRITE-TEST-WEEKLY-ACCEPTANCE') stop('write authorization phrase missing; nothing was sent');
for (const name of ['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'INTEGRATION_TEST_EMAIL', 'INTEGRATION_TEST_PASSWORD']) {
  if (!env[name]) stop(`missing ${name}`);
}
if (env.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== PROJECT) stop('not the TEST Firebase project');

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`::${ok ? 'notice' : 'error'} title=weekly acceptance::${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); };
const safe = value => (/^[A-Za-z0-9 ._:-]{1,60}$/.test(String(value)) ? String(value) : 'redacted');
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
const api = async (path, { token, body, method = body ? 'POST' : 'GET', headers = {} } = {}) => {
  const response = await fetch(BACKEND + path, {
    method, redirect: 'manual', signal: AbortSignal.timeout(60000),
    headers: { Origin: WEB_ORIGIN, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
};

// Wake a sleeping Free instance (bounded).
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
const c = claims(token);
if (c.aud !== PROJECT || c.iss !== `https://securetoken.google.com/${PROJECT}` || c.email_verified !== true) stop('token is not a verified TEST identity');

const session = await api('/auth/session', { token, body: { deferProfileCreation: true } });
if (session.status !== 200 || session.json?.needsProfile) stop(`BLOCKED: TEST identity has no backend profile (status ${session.status}); none is created`);
const userId = (await api('/session?view=metadata', { token })).json?.user?.id;
if (!userId) stop('BLOCKED: could not resolve the TEST owner');
const own = `/users/${encodeURIComponent(userId)}/ai-consent`;

// Read-only preconditions: anonymous rejection and a revoked consent baseline.
check('anonymous Weekly trigger rejected', (await api('/ai/reports/weekly/trigger', { body: {} })).status === 401);
check('anonymous report list rejected', (await api('/ai/reports')).status === 401);
check('other owner consent forbidden', (await api(`/users/${randomUUID()}/ai-consent`, { token })).status === 403);
const baseline = await api(own, { token });
if (baseline.status !== 200 || baseline.json?.aiProcessing !== false) stop(`BLOCKED: expected revoked AI consent baseline (status ${baseline.status}); no writes made`);
check('Weekly trigger forbidden without memory consent', (await api('/ai/reports/weekly/trigger', { token, body: {} })).status === 403);

const grant = await api(own, { token, method: 'PUT', body: { aiProcessing: true, personalization: true, memoryEnabled: true, disclosureVersion: AI_DISCLOSURE_VERSION } });
check('owner granted AI processing, personalization and memory', grant.status === 200 && grant.json?.memoryEnabled === true, `status ${grant.status}`);
try {
  if (grant.status !== 200) throw new Error('consent grant failed');
  const day = new Date().toISOString().slice(0, 10);
  for (const n of [1, 2]) {
    // No primaryGardenMood: emotion enrichment stays SKIPPED; the memory job stays PENDING in manual mode.
    const event = await api('/events', { token, body: { content: `Synthetic TEST acceptance note ${n}: walked to the library and planned the week.` },
      headers: { 'Idempotency-Key': `weekly-acceptance-${day}-${n}` } });
    // 201 = created with a PENDING memory job; 200 = same-day idempotent replay.
    check(`synthetic Event ${n} stored without AI`, event.json?.emotion?.status === 'SKIPPED' &&
      (event.status === 201 ? event.json?.memoryJob?.status === 'PENDING' : event.status === 200), `status ${event.status}`);
  }

  const trigger = await api('/ai/reports/weekly/trigger', { token, body: {} });
  const periodKey = trigger.json?.periodKey;
  check('Weekly trigger fails closed before any provider call', trigger.status === 502 && trigger.json?.job?.status === 'FAILED' &&
    trigger.json?.report === null && ['REPORT_NARRATIVE_PROVIDER_NOT_CONFIGURED', 'WEEKLY_REPORT_JOB_FAILED'].includes(trigger.json?.errorCode),
  `status ${trigger.status} ${safe(trigger.json?.errorCode ?? 'none')}`);

  const list = await api('/ai/reports?limit=50', { token });
  check('owner report list readable; no Weekly report persisted', list.status === 200 && Array.isArray(list.json?.reports) &&
    !list.json.reports.some(r => r.type === 'weekly' && r.periodKey === periodKey), `status ${list.status}`);
  check('unknown Weekly report id not readable', (await api(`/ai/reports/weekly/${randomUUID()}`, { token })).status === 404);
} catch (error) {
  check('acceptance sequence completed', false, safe(error.message));
} finally {
  const revoke = await api(own, { token, method: 'PUT', body: { aiProcessing: false, personalization: false, memoryEnabled: false } });
  check('consent revoked to baseline', revoke.status === 200 && revoke.json?.aiProcessing === false, `status ${revoke.status}`);
  check('Weekly trigger forbidden again after revoke', (await api('/ai/reports/weekly/trigger', { token, body: {} })).status === 403);
}

const failed = results.filter(ok => !ok).length;
console.log(`::${failed ? 'error' : 'notice'} title=weekly acceptance::${results.length - failed}/${results.length} checks passed; provider calls attempted by this script: 0`);
process.exit(failed ? 1 : 0);

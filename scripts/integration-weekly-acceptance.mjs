// Phase A, read-only hosted TEST preflight of the Weekly Reflection boundary, run from
// a GitHub-hosted runner with the existing verified TEST identity. Fixed TEST hosts.
// Zero writes: no consent change, no Event, no AiJob. Every authenticated Weekly
// trigger request is rejected by validation before the consent transaction, because
// TEST manual mode runs an accepted trigger inline and would leave a terminal job for
// that period. Real generation is a separately approved Phase B.
// Never prints the email, password, tokens or response bodies.
import { randomUUID } from 'node:crypto';

const BACKEND = 'https://petalpal-backend-test.onrender.com';
const WEB_ORIGIN = 'https://petalpal-web-integration.petalpal-jx.workers.dev';
const PROJECT = 'petalpal-integration-test';
const env = process.env;
const stop = message => { console.log(`::error title=weekly preflight::${message}`); process.exit(1); };
for (const name of ['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'INTEGRATION_TEST_EMAIL', 'INTEGRATION_TEST_PASSWORD']) {
  if (!env[name]) stop(`missing ${name}`);
}
if (env.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== PROJECT) stop('not the TEST Firebase project');

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`::${ok ? 'notice' : 'error'} title=weekly preflight::${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); };
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
const api = async (path, { token, body, method = body ? 'POST' : 'GET' } = {}) => {
  const response = await fetch(BACKEND + path, {
    method, redirect: 'manual', signal: AbortSignal.timeout(60000),
    headers: { Origin: WEB_ORIGIN, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  await response.arrayBuffer();
  return response.status;
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

const trigger = '/ai/reports/weekly/trigger';
const unknownReport = `/ai/reports/weekly/${randomUUID()}`;
check('anonymous Weekly trigger rejected', await api(trigger, { body: {} }) === 401);
check('anonymous report list rejected', await api('/ai/reports') === 401);
check('anonymous report read rejected', await api(unknownReport) === 401);
// requireOwnUser rejects before the consent read/upsert, so this writes nothing.
check('other owner AI consent forbidden', await api(`/users/${randomUUID()}/ai-consent`, { token }) === 403);
// Body and period validation both reject before the consent transaction and enqueue.
check('trigger rejects caller-chosen ownership fields', await api(trigger, { token, body: { ownerId: randomUUID() } }) === 400);
// A week ahead is open for every timezone, so the period guard rejects it.
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
check('trigger rejects a still-open period', await api(trigger, { token, body: { localDate: nextWeek } }) === 400);

// Memory-gated private reads: 403 without memory consent; with consent, unknown ids are 404, never readable.
const list = await api('/ai/reports?limit=1', { token });
check('owner report list consent-gated', [200, 403].includes(list), `status ${list}`);
const consent = list === 200 ? 'granted' : 'not granted';
check('unknown Weekly report id not readable', await api(unknownReport, { token }) === (list === 200 ? 404 : 403));

const failed = results.filter(ok => !ok).length;
console.log(`::${failed ? 'error' : 'notice'} title=weekly preflight::${results.length - failed}/${results.length} checks passed; memory consent ${consent}; writes 0; provider calls 0`);
process.exit(failed ? 1 : 0);

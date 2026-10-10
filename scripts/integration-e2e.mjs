// Authenticated end-to-end checks of the isolated integration stack, run from a
// GitHub-hosted runner: TEST Firebase sign-in (email/password), then the TEST
// backend REST + Socket.IO exactly as the protected Cloudflare preview origin
// would call it. Hosts are fixed; tokens, email and response bodies are never printed.
// Creates nothing: the session call uses deferProfileCreation so no user,
// Journal or other row is ever created; a TEST identity without a profile stops
// the run as BLOCKED instead of creating one.
import { io } from 'socket.io-client';

const BACKEND = 'https://petalpal-backend-test.onrender.com';
const WEB_ORIGIN = 'https://petalpal-web-integration.petalpal-jx.workers.dev';
const PROJECT = 'petalpal-integration-test';
const env = process.env;
for (const name of ['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'INTEGRATION_TEST_EMAIL', 'INTEGRATION_TEST_PASSWORD']) {
  if (!env[name]) { console.log(`::error::missing ${name}`); process.exit(1); }
}
if (env.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== PROJECT) { console.log('::error::not the TEST Firebase project'); process.exit(1); }

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`::${ok ? 'notice' : 'error'} title=integration e2e::${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); };
const api = (path, { token, origin = WEB_ORIGIN, ...init } = {}) => fetch(BACKEND + path, {
  ...init, redirect: 'manual', signal: AbortSignal.timeout(30000),
  headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
});
const safe = value => (/^[A-Za-z0-9 ._:-]{1,40}$/.test(String(value)) ? String(value) : 'redacted');
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

// Wake a sleeping Free instance (bounded).
for (let i = 0; i < 12; i++) {
  const r = await fetch(BACKEND + '/session', { signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (r && r.status < 500) break;
  await new Promise(done => setTimeout(done, 10000));
}

const preflight = await api('/auth/session', { method: 'OPTIONS', headers: {
  'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } });
check('preview-origin CORS preflight granted exactly', preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === WEB_ORIGIN, `status ${preflight.status}`);

const signIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.EXPO_PUBLIC_FIREBASE_API_KEY)}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Referer: `${WEB_ORIGIN}/` }, signal: AbortSignal.timeout(30000),
  body: JSON.stringify({ email: env.INTEGRATION_TEST_EMAIL, password: env.INTEGRATION_TEST_PASSWORD, returnSecureToken: true }),
});
const signInBody = await signIn.json().catch(() => ({}));
const token = signInBody.idToken;
check('TEST Firebase email/password sign-in', signIn.ok && Boolean(token), `HTTP ${signIn.status}${signInBody.error?.message ? ` ${safe(String(signInBody.error.message).split(' ')[0])}` : ''}`);
if (!token) process.exit(1);
const c = claims(token);
check('ID token belongs to the TEST project', c.aud === PROJECT && c.iss === `https://securetoken.google.com/${PROJECT}`);
check('test identity email is verified', c.email_verified === true);

const session = await api('/auth/session', { method: 'POST', token, body: JSON.stringify({ deferProfileCreation: true }) });
const sessionBody = await session.json().catch(() => ({}));
check('backend session accepted for preview origin', session.status === 200 && session.headers.get('access-control-allow-origin') === WEB_ORIGIN, `status ${session.status}`);
if (session.status === 200 && sessionBody.needsProfile) {
  console.log('::error title=integration e2e::BLOCKED the TEST identity has no profile; none is created by this run (no writes)');
  process.exit(1);
}

const metadata = await api('/session?view=metadata', { token });
const body = await metadata.json().catch(() => ({}));
const userId = body?.user?.id;
check('authenticated /session uncached for preview origin', metadata.status === 200 && metadata.headers.get('cache-control') === 'no-store' && Boolean(userId), `status ${metadata.status}`);

if (userId) {
  const own = await api(`/users/${encodeURIComponent(userId)}/journals`, { token });
  check('owner can read own Journals', own.status === 200, `status ${own.status}`); await own.arrayBuffer();
  const other = await api('/users/00000000-0000-4000-8000-000000000000/journals', { token });
  check('other owner Journals are forbidden', other.status === 403, `status ${other.status}`); await other.arrayBuffer();
}
const bad = await api('/session?view=metadata', { token, origin: 'https://evil.example' });
check('disallowed origin refused even with valid token', bad.status === 403 && !bad.headers.get('access-control-allow-origin'), `status ${bad.status}`); await bad.arrayBuffer();
const invalid = await api('/session?view=metadata', { token: 'synthetic-invalid' });
check('invalid token rejected', invalid.status === 401, `status ${invalid.status}`); await invalid.arrayBuffer();

const socketCheck = (origin, options) => new Promise(resolve => {
  const s = io(BACKEND, { reconnection: false, timeout: 20000, extraHeaders: { Origin: origin }, auth: { token }, ...options });
  const done = value => { s.disconnect(); resolve(value); };
  s.on('connect_error', error => done({ error: safe(String(error?.message || 'error').slice(0, 40)) }));
  s.on('connect', async () => {
    try {
      if (s.io.engine.transport.name !== 'websocket') await new Promise((ok, no) => { s.io.engine.once('upgrade', ok); setTimeout(() => no(new Error('no upgrade')), 15000); });
      const ack = await s.timeout(10000).emitWithAck('join-user');
      done({ transport: s.io.engine.transport.name, ack: ack?.ok === true });
    } catch (error) { done({ error: safe(String(error?.message).slice(0, 40)) }); }
  });
});
const live = await socketCheck(WEB_ORIGIN, { transports: ['polling', 'websocket'] });
check('Socket.IO polling -> WebSocket upgrade, authenticated join', live.transport === 'websocket' && live.ack, live.error || live.transport);
const direct = await socketCheck(WEB_ORIGIN, { transports: ['websocket'] });
check('Socket.IO direct WebSocket from preview origin', direct.transport === 'websocket' && direct.ack, direct.error || direct.transport);
const evil = await socketCheck('https://evil.example', { transports: ['websocket'] });
check('Socket.IO disallowed origin refused', Boolean(evil.error));

const failed = results.filter(ok => !ok).length;
console.log(`::${failed ? 'error' : 'notice'} title=integration e2e::${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);

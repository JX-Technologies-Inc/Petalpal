// Anonymous, read-only smoke checks for the isolated TEST backend only.
// No credentials, tokens, cookies or request bodies with user data are used;
// output is PASS/FAIL per check with status codes, never response bodies.
const TEST_ORIGIN = 'https://petalpal-backend-test.onrender.com';
const target = process.argv[2] || TEST_ORIGIN;
if (target !== TEST_ORIGIN) throw new Error('Smoke checks are restricted to the isolated TEST backend');

const DISALLOWED = 'https://smoke-disallowed.example';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} (${detail})`); };
const get = (path, init = {}) => fetch(TEST_ORIGIN + path, { redirect: 'manual', ...init, signal: AbortSignal.timeout(30000) });

// Free instances cold-start: wait up to ~3 minutes for the service to answer.
let ready;
for (let attempt = 0; attempt < 18 && !ready; attempt++) {
  try { const r = await get('/session'); if (r.status !== 502 && r.status !== 503) ready = r; else await r.arrayBuffer(); }
  catch { /* not yet reachable */ }
  if (!ready) await new Promise(resolve => setTimeout(resolve, 10000));
}
if (!ready) { console.log('FAIL service reachable (no non-5xx response within timeout)'); process.exit(1); }

const anonymous = ready;
check('anonymous /session is rejected and uncached', anonymous.status === 401 && anonymous.headers.get('cache-control') === 'no-store',
  `status ${anonymous.status}`);
await anonymous.arrayBuffer();

const bad = await get('/session', { headers: { Origin: DISALLOWED } });
check('disallowed Origin is refused without CORS grant', bad.status === 403 && !bad.headers.get('access-control-allow-origin'), `status ${bad.status}`);
await bad.arrayBuffer();

const preflight = await get('/session', { method: 'OPTIONS', headers: {
  Origin: TEST_ORIGIN, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization'
} });
check('own-origin preflight is granted exactly', preflight.status === 204 &&
  preflight.headers.get('access-control-allow-origin') === TEST_ORIGIN, `status ${preflight.status}`);
await preflight.arrayBuffer();

const invalid = await get('/session', { headers: { Authorization: 'Bearer synthetic-invalid-token' } });
check('invalid bearer token is rejected', invalid.status === 401, `status ${invalid.status}`);
await invalid.arrayBuffer();

const docs = await get('/api-docs/');
check('API docs are disabled', docs.status === 404, `status ${docs.status}`);
await docs.arrayBuffer();

const poll = await get('/socket.io/?EIO=4&transport=polling');
const text = await poll.text();
check('native-style Socket.IO polling handshake opens', poll.status === 200 && text.startsWith('0{'), `status ${poll.status}`);
if (poll.status === 200 && text.startsWith('0{')) {
  // Close the synthetic Engine.IO session explicitly.
  const { sid } = JSON.parse(text.slice(1));
  await (await get(`/socket.io/?EIO=4&transport=polling&sid=${encodeURIComponent(sid)}`, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '1'
  })).arrayBuffer();
}

const badSocket = await get('/socket.io/?EIO=4&transport=polling', { headers: { Origin: DISALLOWED } });
check('disallowed Origin Socket.IO handshake is refused', badSocket.status === 403, `status ${badSocket.status}`);
await badSocket.arrayBuffer();

const failed = results.filter(result => !result.ok).length;
console.log(`${results.length - failed}/${results.length} TEST backend smoke checks passed`);
process.exit(failed ? 1 : 0);

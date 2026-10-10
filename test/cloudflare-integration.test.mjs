import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import worker from '../deploy/cloudflare/worker.js';
import previewWorker from '../deploy/cloudflare/preview-worker.js';
import { buildContentSecurityPolicy, resolveHostingConfig } from '../deploy/cloudflare/hosting-config.js';

const ASSETS = { fetch: async () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }) };
const integration = { PETALPAL_ENVIRONMENT: 'integration', API_ORIGIN: 'https://petalpal-backend-test.onrender.com',
  FIREBASE_AUTH_DOMAIN: 'petalpal-integration.firebaseapp.com', ASSETS };
const csp = async env => (await worker.fetch(new Request('https://web.example.test/'), env)).headers.get('content-security-policy');

test('default hosting configuration keeps the exact production policy', async () => {
  const policy = await csp({ ASSETS });
  assert.match(policy, /connect-src 'self' https:\/\/petalpal-v2\.onrender\.com wss:\/\/petalpal-v2\.onrender\.com https:\/\/identitytoolkit\.googleapis\.com https:\/\/securetoken\.googleapis\.com https:\/\/apis\.google\.com https:\/\/petalpal-b212c\.firebaseapp\.com;/);
  assert.match(policy, /frame-src https:\/\/petalpal-b212c\.firebaseapp\.com;/);
});

test('integration Worker allows only its explicit backend and test Firebase domain', async () => {
  const policy = await csp(integration);
  assert.match(policy, /connect-src 'self' https:\/\/petalpal-backend-test\.onrender\.com wss:\/\/petalpal-backend-test\.onrender\.com /);
  assert.match(policy, /https:\/\/petalpal-integration\.firebaseapp\.com/);
  assert.doesNotMatch(policy, /petalpal-v2|petalpal-b212c/);
  assert.match(policy, /'wasm-unsafe-eval'/); assert.doesNotMatch(policy, /'unsafe-eval'/);
});

test('integration Worker fails closed without, or with production, configuration', async () => {
  const bad = [{}, { API_ORIGIN: undefined }, { FIREBASE_AUTH_DOMAIN: undefined }, { API_ORIGIN: 'https://petalpal-v2.onrender.com' },
    { FIREBASE_AUTH_DOMAIN: 'petalpal-b212c.firebaseapp.com' }, { API_ORIGIN: 'http://insecure.example.test' },
    { API_ORIGIN: 'https://x.example.test/path' }, { API_ORIGIN: 'https://x.example.test, https://y.example.test' },
    { FIREBASE_AUTH_DOMAIN: 'evil.test; script-src *' }, { PETALPAL_ENVIRONMENT: 'Integration' }];
  for (const change of bad) {
    const env = { ...integration, ...change };
    for (const [key, value] of Object.entries(change)) if (value === undefined) delete env[key];
    if (Object.keys(change).length === 0) { delete env.API_ORIGIN; delete env.FIREBASE_AUTH_DOMAIN; }
    const r = await worker.fetch(new Request('https://web.example.test/'), env);
    assert.equal(r.status, 503, JSON.stringify(change)); assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(r.headers.get('content-security-policy'), null);
  }
  assert.equal(resolveHostingConfig(integration) !== null, true);
});

test('synthetic preview Worker stays static-only and contacts neither backend nor Firebase', async () => {
  // Non-HTML asset: HTMLRewriter exists only in the Workers runtime, not Node.
  const script = { fetch: async () => new Response('//', { headers: { 'Content-Type': 'text/javascript' } }) };
  const r = await previewWorker.fetch(new Request('https://preview.example.test/app.js'), { STATIC_PREVIEW_ONLY: '1', ASSETS: script });
  const policy = r.headers.get('content-security-policy');
  assert.match(policy, /connect-src 'self';/); assert.match(policy, /frame-src 'none'/);
  assert.doesNotMatch(policy, /onrender|firebaseapp|googleapis/);
});

test('policy builder derives the WebSocket origin from the API origin', () => {
  assert.match(buildContentSecurityPolicy({ apiOrigin: 'https://a.example.test:8443', authDomain: 'f.example.test' }), /wss:\/\/a\.example\.test:8443/);
});

test('integration export refuses production API/Firebase and ambiguous targets before building', () => {
  const run = (args, extra = {}) => spawnSync(process.execPath, ['scripts/build-cloudflare-web.mjs', ...args], {
    cwd: new URL('..', import.meta.url), env: { PATH: process.env.PATH, ...extra }, encoding: 'utf8', timeout: 20000
  });
  const firebase = { EXPO_PUBLIC_FIREBASE_API_KEY: 'x', EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'it.firebaseapp.com',
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'it', EXPO_PUBLIC_FIREBASE_APP_ID: '1:1:web:it' };
  for (const [args, env] of [
    [['--integration'], firebase],
    [['--integration'], { ...firebase, CLOUDFLARE_API_ORIGIN: 'https://petalpal-v2.onrender.com' }],
    [['--integration'], { ...firebase, CLOUDFLARE_API_ORIGIN: 'http://t.example.test' }],
    [['--integration'], { ...firebase, CLOUDFLARE_API_ORIGIN: 'https://t.example.test', EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'petalpal-b212c' }],
    [['--integration'], { ...firebase, CLOUDFLARE_API_ORIGIN: 'https://t.example.test', EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'petalpal-b212c.firebaseapp.com' }],
    [['--integration'], { ...firebase, CLOUDFLARE_API_ORIGIN: 'https://t.example.test', EXPO_PUBLIC_FIREBASE_APP_ID: '1:879846854472:web:02b860eacfaf5bb7616d7d' }],
    [['--integration', '--synthetic'], { ...firebase, CLOUDFLARE_API_ORIGIN: 'https://t.example.test' }]
  ]) {
    const result = run(args, env);
    assert.notEqual(result.status, 0, JSON.stringify(args));
    assert.match(result.stderr, /Integration build|Choose one build target/);
    assert.doesNotMatch(result.stdout, /Exporting Expo Web/);
  }
});

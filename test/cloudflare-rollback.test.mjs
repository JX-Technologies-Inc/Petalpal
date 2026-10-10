import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import worker from '../deploy/cloudflare/rollback-worker.js';
import { checkWranglerConfig } from '../scripts/cloudflare-integration-deploy.mjs';

const fetchWorker = (path, init = {}, host = 'web.example.test') => worker.fetch(new Request(`https://${host}${path}`, init));
const readConfig = file => JSON.parse(readFileSync(new URL(`../deploy/cloudflare/${file}`, import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, ''));

test('first-launch rollback redirects only page navigation to the fixed Vite entry', async () => {
  for (const path of ['/', '/bookhouse', '/reflection', '/feature/daily/', '/visit/synthetic-owner']) {
    for (const method of ['GET', 'HEAD']) {
      for (const navigation of [{}, { 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' }]) {
        const response = await fetchWorker(`${path}?next=https://other.invalid/&code=synthetic`, { method, headers: navigation });
        assert.equal(response.status, 302, path);
        assert.equal(response.headers.get('location'), 'https://petalpal-v2.onrender.com/');
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
        assert.equal(await response.text(), '');
      }
    }
  }
});

test('first-launch rollback never redirects API, Socket, static, missing or unknown requests', async () => {
  for (const path of ['/session', '/auth/session', '/socket.io/', '/socket.io/?EIO=4&transport=polling', '/users/synthetic-owner/journals',
    '/internal/ai-jobs', '/missing.js', '/canvaskit.wasm', '/_expo/static/js/web/entry.js', '/assets/garden.png', '/unknown', '/visit/a%2fb']) {
    const response = await fetchWorker(path, { headers: { 'Sec-Fetch-Mode': 'navigate' } });
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('first-launch rollback never redirects WebSocket upgrades, script fetches or authenticated requests', async () => {
  for (const headers of [{ Upgrade: 'websocket', Connection: 'Upgrade' }, { 'Sec-Fetch-Mode': 'cors' },
    { 'Sec-Fetch-Mode': 'no-cors' }, { 'Sec-Fetch-Mode': 'websocket' }, { Authorization: 'Bearer synthetic-token' },
    { Authorization: 'Bearer synthetic-token', 'Sec-Fetch-Mode': 'navigate' }]) {
    for (const path of ['/', '/socket.io/']) {
      const response = await fetchWorker(path, { headers });
      assert.equal(response.status, 404, JSON.stringify(headers));
      assert.equal(response.headers.get('location'), null);
    }
  }
});

test('first-launch rollback refuses writes and does not reflect their contents', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = await fetchWorker('/', { method, body: method === 'OPTIONS' ? undefined : 'synthetic-private-input' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
    assert.equal(await response.text(), '');
  }
});

test('first-launch rollback cannot loop on the fallback host', async () => {
  const response = await fetchWorker('/', { headers: { 'Sec-Fetch-Mode': 'navigate' } }, 'petalpal-v2.onrender.com');
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('location'), null);
});

test('fallback is disabled by default and isolated from TEST/synthetic Workers', () => {
  const rollback = readConfig('wrangler.rollback.jsonc');
  assert.equal(rollback.name, 'petalpal-web-production');
  assert.equal(rollback.main, 'rollback-worker.js');
  assert.equal(rollback.workers_dev, false); assert.equal(rollback.preview_urls, false);
  assert.deepEqual(rollback.routes, []); assert.equal(rollback.assets, undefined); assert.equal(rollback.vars, undefined);
  // Every normal profile serves the application, never the fallback.
  for (const file of ['wrangler.jsonc', 'wrangler.production.jsonc', 'wrangler.integration.jsonc', 'wrangler.preview.jsonc']) {
    assert.notEqual(readConfig(file).main, 'rollback-worker.js', file);
  }
  // The integration deploy gate rejects the rollback profile (wrong Worker, no assets).
  assert.notDeepEqual(checkWranglerConfig(readFileSync(new URL('../deploy/cloudflare/wrangler.rollback.jsonc', import.meta.url), 'utf8')), []);
  // The fallback never points at TEST or protected preview hosts.
  const source = readFileSync(new URL('../deploy/cloudflare/rollback-worker.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /petalpal-backend-test|workers\.dev|petalpal-integration|synthetic/);
});

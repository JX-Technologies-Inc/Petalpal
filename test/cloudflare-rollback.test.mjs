import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../deploy/cloudflare/rollback-worker.js';

test('first-launch rollback redirects only page navigation to the fixed Vite entry', async () => {
  for (const path of ['/', '/bookhouse', '/reflection', '/visit/synthetic-owner']) {
    for (const method of ['GET', 'HEAD']) {
      const response = await worker.fetch(new Request(`https://web.example.test${path}?next=https://other.invalid/&code=synthetic`, { method }));
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), 'https://petalpal-v2.onrender.com/');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      assert.equal(await response.text(), '');
    }
  }
});

test('first-launch rollback never redirects API, Socket, static or unknown requests', async () => {
  for (const path of ['/session', '/auth/session', '/socket.io/', '/users/synthetic-owner/journals', '/internal/ai-jobs', '/missing.js', '/unknown']) {
    const response = await worker.fetch(new Request(`https://web.example.test${path}`));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('first-launch rollback refuses writes and does not reflect their contents', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = await worker.fetch(new Request('https://web.example.test/', { method, body: 'synthetic-private-input' }));
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
    assert.equal(await response.text(), '');
  }
});

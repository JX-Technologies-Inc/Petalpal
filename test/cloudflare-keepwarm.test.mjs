import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import worker, { KEEPWARM_URL, ping } from '../deploy/cloudflare-keepwarm/worker.js';

test('keep-warm pings only the anonymous production API health path', async () => {
  const calls = [];
  const status = await ping(async (url, options) => { calls.push([url, options]); return new Response('{}', { status: 401 }); });
  assert.equal(status, 401);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://petalpal-v2.onrender.com/healthz');
  assert.equal(calls[0][1].method, 'GET');
  assert.equal(calls[0][1].headers.Authorization, undefined);
  assert.equal(KEEPWARM_URL.startsWith('https://'), true);
  assert.equal(typeof worker.fetch, 'undefined', 'no HTTP handler: cron only');
});

test('keep-warm config exposes no URL and stays inside free hours', () => {
  const text = readFileSync(new URL('../deploy/cloudflare-keepwarm/wrangler.jsonc', import.meta.url), 'utf8');
  const config = JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(config.workers_dev, false); assert.equal(config.preview_urls, false); assert.deepEqual(config.routes, []);
  assert.deepEqual(config.triggers.crons, ['*/10 0-7,14-23 * * *']);
  assert.equal(config.vars, undefined);
  const hoursPerDay = 8 + 10;
  assert.ok(hoursPerDay * 31 < 600, 'leaves Render free hours for TEST');
});

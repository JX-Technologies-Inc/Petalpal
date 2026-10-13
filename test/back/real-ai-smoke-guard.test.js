// New wrapper safety checks only; never imports the smoke runner or calls AI.
import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../../cloudflare-worker/src/real-ai-smoke.js';
const env = { SMOKE_ONLY: '1', RENDER_SHARED_SECRET: 'synthetic-unit-test-only',
  REPORT_NARRATIVE_MODEL: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  AI: { async run() { throw new Error('Must not invoke inference'); } } };
const request = (path, body, authorized = true) => new Request(`https://test.invalid${path}`, {
  method: body ? 'POST' : 'GET', headers: {
    ...(authorized ? { Authorization: 'Bearer synthetic-unit-test-only' } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}) });
test('test Worker denies unauthenticated and production-connected configurations', async () => {
  assert.equal((await worker.fetch(request('/smoke-info', null, false), env)).status, 401);
  assert.equal((await worker.fetch(request('/smoke-info'), { ...env, AI_JOB_EXECUTOR_URL: 'https://example.invalid' })).status, 503);
  assert.equal((await worker.fetch(request('/smoke-info'), { ...env, SMOKE_ONLY: '0' })).status, 503);
});
test('test Worker exposes bounds and refuses unrelated inference routes', async () => {
  const metadata = await (await worker.fetch(request('/smoke-info'), env)).json();
  assert.equal(metadata.maxEmotionOutputTokens, 64);
  assert.equal(metadata.maxReportOutputTokens, 1024);
  assert.equal((await worker.fetch(request('/v1/speech', { audio: 'x' }), env)).status, 404);
});
test('oversized embedding is rejected before the AI binding', async () => {
  let calls = 0;
  const result = await worker.fetch(request('/v1/embedding', { text: 'x'.repeat(2001) }),
    { ...env, AI: { async run() { calls++; throw new Error('Unexpected'); } } });
  assert.ok(result.status >= 400);
  assert.equal(calls, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { speechAdmission, speechTranscriptionHandler } from '../../lib/speech-transcription.js';

const payload = { audio: Buffer.from('\0\0\0\x18ftypM4A \0\0\0\0').toString('base64'), mimeType: 'audio/mp4' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function fixture(t, { fetchImpl = async () => Response.json({ text: 'A moment.' }), ...limits } = {}) {
  const state = { parsed: [], reservations: 0, rejectCost: false };
  const env = { CLOUDFLARE_WORKER_AI_URL: 'https://fixture.invalid', CLOUDFLARE_WORKER_AI_TOKEN: 'synthetic' };
  const app = express();
  app.post('/speech/transcribe', (req, res, next) => {
    const userId = req.get('X-Fixture-Owner');
    if (!userId) return res.sendStatus(401);
    req.auth = { userId }; next();
  }, speechAdmission(limits), (req, _res, next) => { state.onAdmission?.(); next(); }, express.json({ limit: '512b' }), (req, _res, next) => {
    state.parsed.push(req); next();
  }, speechTranscriptionHandler({ env, fetchImpl, costGate: {
    async reserve() { state.reservations++; if (state.rejectCost) throw new Error('synthetic cost failure'); return {}; },
    async checkProcessingConsent() {},
  } }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: 'Invalid upload' }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}/speech/transcribe`;
  const send = (owner = 'owner', body = payload) => fetch(url, { method: 'POST', headers: {
    ...(owner ? { 'X-Fixture-Owner': owner } : {}), 'Content-Type': 'application/json',
  }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { state, env, send, url };
}

test('speech admission bounds owner/global work before parsing or provider reservation', { timeout: 10000 }, async t => {
  const entered = deferred(), release = deferred(); let calls = 0;
  const f = await fixture(t, { fetchImpl: async () => {
    if (++calls === 4) entered.resolve(); await release.promise; return Response.json({ text: 'A moment.' });
  } });
  t.after(() => release.resolve());
  const pending = ['a', 'b', 'c', 'd'].map(owner => f.send(owner)); await entered.promise;
  const own = await f.send('a', '{ malformed'); assert.equal(own.status, 429); assert.equal(own.headers.get('retry-after'), '1');
  assert.equal((await f.send('other')).status, 503);
  assert.equal((await f.send(null)).status, 401);
  assert.equal(f.state.parsed.length, 4); assert.equal(f.state.reservations, 4); assert.equal(calls, 4);
  release.resolve();
  for (const result of await Promise.all(pending)) { assert.equal(result.status, 200); assert.deepEqual(await result.json(), { text: 'A moment.' }); }
  assert.equal((await f.send('a')).status, 200);
  assert.ok(f.state.parsed.every(req => req.body === undefined));
});

test('speech admission releases after parser, validation, configuration, cost and provider failures', { timeout: 10000 }, async t => {
  let fail = false;
  const f = await fixture(t, { fetchImpl: async () => { if (fail) throw new Error('private provider detail'); return Response.json({ text: 'A moment.' }); } });
  assert.equal((await f.send('owner', '{')).status, 400);
  assert.equal((await f.send('owner', { ...payload, extra: 'x'.repeat(600) })).status, 413);
  assert.equal((await f.send('owner', {})).status, 400);
  const token = f.env.CLOUDFLARE_WORKER_AI_TOKEN; f.env.CLOUDFLARE_WORKER_AI_TOKEN = '';
  assert.equal((await f.send()).status, 503); f.env.CLOUDFLARE_WORKER_AI_TOKEN = token;
  f.state.rejectCost = true; assert.equal((await f.send()).status, 502); f.state.rejectCost = false;
  fail = true; const failed = await f.send(); assert.equal(failed.status, 502); assert.equal((await failed.text()).includes('private provider'), false);
  fail = false; assert.equal((await f.send()).status, 200);
  assert.ok(f.state.parsed.every(req => req.body === undefined));
});

test('speech admission releases aborted or timed-out partial uploads without provider work', { timeout: 10000 }, async t => {
  const f = await fixture(t, { uploadTimeoutMs: 1000 });
  for (const abort of [true, false]) {
    const admitted = deferred(); f.state.onAdmission = () => admitted.resolve();
    const request = http.request(f.url, { method: 'POST', headers: {
      'X-Fixture-Owner': 'owner', 'Content-Type': 'application/json', 'Content-Length': '200',
    } });
    const closed = new Promise(resolve => request.once('close', resolve)); request.on('error', () => {});
    request.flushHeaders(); request.write('{'); await admitted.promise; f.state.onAdmission = null;
    const busy = await f.send();
    assert.equal(busy.status, 429);
    assert.equal(f.state.reservations, abort ? 0 : 1);
    if (abort) request.destroy(); await closed;
    let recovered; for (let i = 0; i < 20; i++) { recovered = await f.send(); if (recovered.status === 200) break; await delay(1); }
    assert.equal(recovered.status, 200);
  }
  assert.equal(f.state.parsed.length, 2); assert.equal(f.state.reservations, 2);
});

test('speech admission holds disconnected provider work until settlement and forwards cancellation', { timeout: 10000 }, async t => {
  const entered = deferred(), aborted = deferred(), release = deferred(); let calls = 0;
  const f = await fixture(t, { fetchImpl: async (_url, { signal }) => {
    if (++calls === 1) {
      signal.addEventListener('abort', () => aborted.resolve(), { once: true }); entered.resolve();
      // A provider ignoring cancellation must not permit replacement work early.
      await release.promise;
    }
    return Response.json({ text: 'A moment.' });
  } });
  t.after(() => release.resolve());
  const request = http.request(f.url, { method: 'POST', headers: { 'X-Fixture-Owner': 'owner', 'Content-Type': 'application/json' } });
  request.on('error', () => {}); request.end(JSON.stringify(payload)); await entered.promise;
  request.destroy(); await aborted.promise;
  assert.equal((await f.send()).status, 429); assert.equal(calls, 1); assert.equal(f.state.reservations, 1);
  release.resolve();
  let recovered; for (let i = 0; i < 20; i++) { recovered = await f.send(); if (recovered.status === 200) break; await delay(1); }
  assert.equal(recovered.status, 200); assert.equal(calls, 2);
  assert.ok(f.state.parsed.every(req => req.body === undefined));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { app } from '../../server.js';
import { authenticateFirebaseIdentity, requireOwnUser, setFirebaseTokenVerifierForTests } from '../../lib/auth.js';
import { createRateLimiter } from '../../lib/rate-limit.js';

function capture(t) {
  const original = { log: console.log, info: console.info };
  const calls = [];
  console.log = console.info = (...args) => calls.push(args);
  t.after(() => Object.assign(console, original));
  return calls;
}

async function authenticate(token, path = '/private-path') {
  let result;
  await authenticateFirebaseIdentity({ get: () => `Bearer ${token}`, path }, {
    status(status) { result = { status }; return this; },
    json(body) { result.body = body; }
  }, () => { result = { status: 200 }; });
  return result;
}

async function listen(t, application) {
  const server = application.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('logging privacy: rejected JWT claims and provider messages never reach diagnostics', async t => {
  const logs = capture(t);
  t.after(() => setFirebaseTokenVerifierForTests());
  const token = `header.${Buffer.from(JSON.stringify({
    aud: 'private-email@example.test', iss: 'Bearer private-claim-token', exp: 2_000_000_000
  })).toString('base64url')}.signature`;
  for (const [code, status, reason] of [
    ['auth/invalid-id-token', 401, 'wrong_audience'],
    ['app/invalid-credential', 503, 'admin_credential_unavailable']
  ]) {
    setFirebaseTokenVerifierForTests(async () => {
      throw Object.assign(new Error('private-journal Bearer other-token refreshToken: private-secret'), { code });
    });
    assert.equal((await authenticate(token)).status, status);
    assert.deepEqual(logs.at(-2)[1], { expectedProjectId: process.env.FIREBASE_PROJECT_ID || 'petalpal-b212c', reason });
    assert.equal(JSON.parse(logs.at(-1)[0]).safeReason, reason);
  }
  // Even a short token echoed by a provider is omitted, without regex-dependent redaction.
  setFirebaseTokenVerifierForTests(async () => { throw new Error('tiny private-journal'); });
  assert.equal((await authenticate('tiny')).status, 401);
  assert.doesNotMatch(JSON.stringify(logs), /private-|other-token|tiny|header\.|signature|refreshToken/);
});

test('logging privacy: anonymous HTTP paths and owner parameters are never event route labels', async t => {
  const logs = capture(t);
  const base = await listen(t, app);
  for (const path of ['/users/private-email@example.test/garden', '/users/private-owner/garden', '/session?token=private-query']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Authentication required' });
  }
  const req = { path: '/users/private-owner', route: { path: '/users/:userId' }, auth: { userId: 'actor-fixture' } };
  let status;
  assert.equal(requireOwnUser(req, { status(value) { status = value; return this; }, json() {} }, 'private-owner'), false);
  assert.equal(status, 403);
  const events = logs.map(([line]) => JSON.parse(line));
  assert.deepEqual(events.map(event => event.routeClass), ['unmatched', 'unmatched', 'unmatched', '/users/:userId']);
  assert.doesNotMatch(JSON.stringify(logs), /private-|@example/);
});

test('logging privacy: both limiter denial paths retain safe templates and status contracts', async t => {
  const logs = capture(t);
  const application = express();
  const limiter = createRateLimiter({ limit: 1, windowMs: 60000, maxKeys: 1, key: req => req.params.id, now: () => 0 });
  application.get('/limited/:id', limiter, (_req, res) => res.json({ ok: true }));
  const base = await listen(t, application);
  assert.equal((await fetch(`${base}/limited/private-one`)).status, 200);
  for (const id of ['private-one', 'private-two']) {
    const response = await fetch(`${base}/limited/${id}`);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '60');
    assert.deepEqual(await response.json(), { error: 'Too many requests. Try again later.' });
  }
  const events = logs.map(([line]) => JSON.parse(line));
  assert.equal(events.length, 2);
  assert.ok(events.every(event => event.routeClass === '/limited/:id' && event.eventType === 'rate_limit_exceeded'));
  assert.doesNotMatch(JSON.stringify(logs), /private-/);
});

test('logging privacy: unavailable diagnostic and event sinks preserve authentication rejection', async t => {
  const originals = { log: console.log, info: console.info };
  t.after(() => { Object.assign(console, originals); setFirebaseTokenVerifierForTests(); });
  console.log = console.info = () => { throw new Error('log sink unavailable'); };
  for (const [code, status, message] of [
    ['auth/invalid-id-token', 401, 'Invalid or expired Firebase token'],
    ['app/invalid-credential', 503, 'Authentication service unavailable']
  ]) {
    setFirebaseTokenVerifierForTests(async () => { throw Object.assign(new Error('private-error'), { code }); });
    assert.deepEqual(await authenticate('tiny'), { status, body: { error: message } });
  }
});

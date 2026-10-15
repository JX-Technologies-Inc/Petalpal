import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../../lib/prisma.js';
import { setFirebaseTokenVerifierForTests } from '../../lib/auth.js';

// Synthetic loopback HTTP only. No Firebase, database or AI provider calls.
process.env.RATE_LIMIT_ADMISSION_MAX = '4';
process.env.RATE_LIMIT_GENERAL_MAX = '2';
process.env.RATE_LIMIT_AI_MAX = '1';
process.env.RATE_LIMIT_AUTH_MAX = '2';
process.env.TRUST_PROXY = 'loopback';
process.env.AI_JOB_EXECUTOR_TOKEN = 'synthetic-executor-fixture';
const { app } = await import('../../server.js');

async function fixture(t) {
  const counts = { verification: 0, profiles: 0, reads: 0, writes: 0 };
  const originalTrust = app.get('trust proxy');
  // Prisma model delegates are dynamic proxies, so save/restore assignments as
  // in the existing route fixtures instead of mocking property descriptors.
  const originals = [prisma.user.findUnique, prisma.dailyCheckIn.findMany, prisma.journal.updateMany];
  prisma.user.findUnique = async ({ where }) => {
    counts.profiles++;
    assert.ok(where.firebaseUid.startsWith('valid-'));
    return { id: where.firebaseUid };
  };
  prisma.dailyCheckIn.findMany = async ({ where }) => {
    counts.reads++;
    assert.ok(where.userId.startsWith('valid-'));
    return [];
  };
  prisma.journal.updateMany = async ({ where, data }) => {
    counts.writes++;
    assert.ok(where.userId.startsWith('valid-'));
    assert.equal(where.id, 'journal');
    assert.deepEqual(data, { coverImage: null });
    return { count: 1 };
  };
  setFirebaseTokenVerifierForTests(async token => {
    counts.verification++;
    if (!token.startsWith('valid-')) throw Object.assign(new Error('synthetic'), { code: 'auth/invalid-id-token' });
    return { uid: token, email_verified: true };
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    [prisma.user.findUnique, prisma.dailyCheckIn.findMany, prisma.journal.updateMany] = originals;
    setFirebaseTokenVerifierForTests();
    app.set('trust proxy', originalTrust);
    await new Promise(resolve => server.close(resolve));
  });
  return {
    counts,
    request: async (path, ip, { method = 'GET', token = 'invalid', body } = {}) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip,
          ...(token === null ? {} : { Authorization: 'Bearer ' + token }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      return { status: response.status, body: await response.json(), retry: response.headers.get('retry-after') };
    }
  };
}

const paths = [
  { path: '/speech/transcribe', method: 'POST' },
  { path: '/users/valid-owner/journals/journal/cover', method: 'PUT' },
  { path: '/users/valid-owner/journals/journal/cover', method: 'GET' },
  { path: '/users/valid-owner/check-ins', method: 'GET' }
];

test('each affected path throttles invalid/missing tokens before Firebase and all database work', async t => {
  const f = await fixture(t);
  for (const [i, { path, method }] of paths.entries()) {
    const ip = `192.0.2.${10 + i}`;
    for (let n = 0; n < 4; n++) {
      assert.equal((await f.request(path, ip, { method, token: n === 0 ? null : 'invalid' })).status, 401);
    }
    const before = { ...f.counts };
    const denied = await f.request(path, ip, { method, token: 'valid-owner' });
    assert.equal(denied.status, 429);
    assert.deepEqual(denied.body, { error: 'Too many requests. Try again later.' });
    assert.ok(Number(denied.retry) > 0);
    assert.deepEqual(f.counts, before);
  }
  assert.deepEqual(f.counts, { verification: 12, profiles: 0, reads: 0, writes: 0 });
});

test('route rotation shares one admission budget; concurrent requests cannot over-admit', async t => {
  const f = await fixture(t);
  const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => {
    const { path, method } = paths[i % paths.length];
    return f.request(path, '192.0.2.20', { method });
  }));
  assert.equal(responses.filter(r => r.status === 401).length, 4);
  assert.equal(responses.filter(r => r.status === 429).length, 8);
  assert.deepEqual(f.counts, { verification: 4, profiles: 0, reads: 0, writes: 0 });
});

test('legitimate shared-IP users work; early and general routes count once and successes consume admission', async t => {
  const f = await fixture(t), ip = '192.0.2.30';
  for (const token of ['valid-nat-one', 'valid-nat-two']) {
    const cover = await f.request(`/users/${token}/journals/journal/cover`, ip,
      { method: 'PUT', token, body: { coverImage: null } });
    assert.equal(cover.status, 200); assert.deepEqual(cover.body, { coverImage: null });
    const read = await f.request(`/users/${token}/check-ins`, ip, { token });
    assert.equal(read.status, 200); assert.deepEqual(read.body, []);
  }
  assert.deepEqual(f.counts, { verification: 4, profiles: 4, reads: 2, writes: 2 });
  const before = { ...f.counts };
  assert.equal((await f.request('/users/valid-nat-three/check-ins', ip, { token: 'valid-nat-three' })).status, 429);
  assert.deepEqual(f.counts, before);
});

test('user and AI quotas survive IP rotation; owner isolation still rejects another user', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 3; i++) {
    const read = await f.request('/users/valid-quota/check-ins', `192.0.2.${40 + i}`, { token: 'valid-quota' });
    assert.equal(read.status, i < 2 ? 200 : 429);
  }
  assert.equal(f.counts.reads, 2);
  for (let i = 0; i < 2; i++) {
    const speech = await f.request('/speech/transcribe', `192.0.2.${50 + i}`, { method: 'POST', token: 'valid-ai', body: {} });
    assert.equal(speech.status, i === 0 ? 400 : 429);
  }
  assert.equal((await f.request('/speech/transcribe', '192.0.2.52', { method: 'POST', token: 'valid-ai-other', body: {} })).status, 400);
  assert.equal((await f.request('/users/victim/journals/journal/cover', '192.0.2.53', {
    method: 'PUT', token: 'valid-outsider', body: { coverImage: null }
  })).status, 403);
  assert.equal(f.counts.writes, 0);
});

test('trusted proxy stops at the first untrusted hop; injected forwarding prefixes cannot evade admission', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 5; i++) {
    const result = await f.request('/users/owner/check-ins', `203.0.113.${i + 1}, 198.51.100.10`);
    assert.equal(result.status, i < 4 ? 401 : 429);
  }
  assert.equal(f.counts.verification, 4); assert.equal(f.counts.profiles, 0);
});

test('default untrusted socket ignores arbitrary X-Forwarded-For values', async t => {
  const f = await fixture(t);
  app.set('trust proxy', false);
  for (let i = 0; i < 5; i++) {
    const result = await f.request('/users/owner/check-ins', `203.0.113.${i + 1}`);
    assert.equal(result.status, i < 4 ? 401 : 429);
  }
  assert.equal(f.counts.verification, 4); assert.equal(f.counts.profiles, 0);
});

test('auth/session retains its tighter pre-verification failure budget', async t => {
  const f = await fixture(t);
  for (const [path, method, ip] of [['/auth/session', 'POST', '192.0.2.60'], ['/session', 'GET', '192.0.2.61']]) {
    for (let i = 0; i < 3; i++) {
      assert.equal((await f.request(path, ip, { method })).status, i < 2 ? 401 : 429);
    }
  }
  assert.deepEqual(f.counts, { verification: 4, profiles: 0, reads: 0, writes: 0 });
});

test('service executor traffic does not consume or obey interactive admission', async t => {
  const f = await fixture(t), ip = '192.0.2.70';
  for (let i = 0; i < 5; i++) {
    assert.equal((await f.request('/internal/ai-jobs/dispatchable?invalid=1', ip, { token: 'synthetic-executor-fixture' })).status, 400);
    assert.equal((await f.request('/internal/ai-jobs/job/execute', ip, { method: 'POST', token: 'synthetic-executor-fixture', body: { invalid: true } })).status, 400);
  }
  assert.deepEqual(f.counts, { verification: 0, profiles: 0, reads: 0, writes: 0 });
  for (let i = 0; i < 5; i++) {
    assert.equal((await f.request('/users/owner/check-ins', ip)).status, i < 4 ? 401 : 429);
  }
  assert.equal((await f.request('/internal/ai-jobs/dispatchable?invalid=1', ip, { token: 'synthetic-executor-fixture' })).status, 400);
  assert.equal((await f.request('/internal/ai-jobs/dispatchable', ip)).status, 401);
  assert.equal(f.counts.verification, 4); assert.equal(f.counts.profiles, 0);
});

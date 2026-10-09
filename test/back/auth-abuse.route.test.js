import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../../lib/prisma.js';
import { setFirebaseTokenVerifierForTests } from '../../lib/auth.js';

// Local fixture limits only; no provider verification or database connection.
process.env.RATE_LIMIT_AUTH_MAX = '2';
process.env.RATE_LIMIT_AUTH_ACCOUNT_MAX = '2';
process.env.TRUST_PROXY = 'loopback';
const { app } = await import('../../server.js');

async function fixture(t) {
  const original = prisma.user.findUnique;
  const counts = { verification: 0, profiles: 0 };
  setFirebaseTokenVerifierForTests(async token => {
    counts.verification++;
    if (!token.startsWith('valid-')) throw Object.assign(new Error('synthetic'), { code: 'auth/invalid-id-token' });
    return { uid: token, email: token + '@example.test', email_verified: true };
  });
  prisma.user.findUnique = async ({ where }) => {
    counts.profiles++;
    assert.ok(where.firebaseUid?.startsWith('valid-'));
    return { id: where.firebaseUid, name: 'Synthetic', email: where.firebaseUid + '@example.test' };
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    prisma.user.findUnique = original; setFirebaseTokenVerifierForTests();
    await new Promise(resolve => server.close(resolve));
  });
  return {
    counts,
    request: async (path, ip, token = 'invalid', body = {}) => {
      const post = /^\/auth\/session\/?$/i.test(path);
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        method: post ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'X-Forwarded-For': ip },
        ...(post ? { body: JSON.stringify(body) } : {})
      });
      return { status: response.status, body: await response.json(), retry: response.headers.get('retry-after') };
    }
  };
}

test('session probes are throttled before verification/profile lookup, including IPv6 rotation', async t => {
  const f = await fixture(t);
  for (const path of ['/session?view=metadata', '/auth/session']) {
    const prefix = path.startsWith('/session?') ? '2001:db8:100:1200' : '2001:db8:200:1200';
    assert.equal((await f.request(path, prefix + '::1')).status, 401);
    assert.equal((await f.request(path, prefix + '::2')).status, 401);
    const before = f.counts.verification;
    const blocked = await f.request(path, prefix + '::3');
    assert.equal(blocked.status, 429);
    assert.deepEqual(blocked.body, { error: 'Too many requests. Try again later.' });
    assert.ok(Number(blocked.retry) > 0);
    assert.equal(f.counts.verification, before); assert.equal(f.counts.profiles, 0);
  }
});

test('session UID limit resists IP rotation; submitted victim identity cannot consume victim budget', async t => {
  const f = await fixture(t);
  const body = { deferProfileCreation: true, email: 'victim@example.test', firebaseUid: 'valid-victim' };
  for (const ip of ['192.0.2.1', '192.0.2.2']) assert.equal((await f.request('/auth/session', ip, 'valid-attacker', body)).status, 200);
  const before = f.counts.profiles;
  assert.equal((await f.request('/AUTH/SESSION/', '192.0.2.3', 'valid-attacker', body)).status, 429);
  assert.equal(f.counts.profiles, before);
  assert.equal((await f.request('/auth/session', '192.0.2.4', 'valid-victim', { deferProfileCreation: true })).status, 200);
});

test('successful users sharing one NAT keep independent session budgets', async t => {
  const f = await fixture(t);
  for (const token of ['valid-nat-one', 'valid-nat-two', 'valid-nat-three']) {
    const result = await f.request('/auth/session', '198.51.100.1', token, { deferProfileCreation: true });
    assert.equal(result.status, 200); assert.equal(result.body.user.id, token);
  }
});

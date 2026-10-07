import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../../lib/prisma.js';
import { app } from '../../server.js';
import { setFirebaseTokenVerifierForTests } from '../../lib/auth.js';
import { jsonObjectIssue, allowBodyFields } from '../../lib/http-errors.js';

test('bounded request guard rejects dangerous parsed keys before writes, including early routes', async t => {
  const descriptors = Object.getOwnPropertyDescriptors(Object.prototype);
  const oldFind = prisma.user.findUnique, oldUpdate = prisma.user.update;
  let writes = 0;
  prisma.user.findUnique = async () => ({ id: 'owner', aiConsent: { aiProcessing: true } });
  prisma.user.update = async ({ where, data }) => { writes++; assert.deepEqual(where, { id: 'owner' }); assert.deepEqual(data, { preferredLocale: 'en' }); return { id: 'owner', preferredLocale: 'en' }; };
  setFirebaseTokenVerifierForTests(async () => ({ uid: 'firebase-owner', email_verified: true }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  t.after(async () => { prisma.user.findUnique = oldFind; prisma.user.update = oldUpdate; setFirebaseTokenVerifierForTests(); await new Promise(r => server.close(r)); });
  const send = (body, path = '/users/owner/profile', method = 'PUT') => fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body });
  for (const body of [
    '{"__proto__":{"polluted":true}}', '{"nested":{"__proto__":{"polluted":true}}}',
    '{"constructor":{"prototype":{"polluted":true}}}', '{"prototype":{"polluted":true}}',
    '{"metadata":[{"child":{"constructor":{"polluted":true}}}]}',
  ]) {
    const response = await send(body); assert.equal(response.status, 400); assert.deepEqual(await response.json(), { error: 'Unsafe JSON object keys' });
    assert.equal(({}).polluted, undefined); assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), descriptors);
  }
  for (const [path, method] of [['/speech/transcribe', 'POST'], ['/users/owner/journals/journal/cover', 'PUT']]) {
    assert.equal((await send('{"nested":[{"prototype":true}]}', path, method)).status, 400);
    assert.equal((await send('{"extra":true}', path, method)).status, 400);
  }
  for (const field of ['extra', 'ownerId', 'userId', 'role', 'admin', 'subscription', 'lockedBy', 'attemptCount', 'provenance', 'auditMetadata']) {
    assert.equal((await send(JSON.stringify({ preferredLocale: 'en', [field]: 'forged' }))).status, 400);
  }
  for (const [path, method, body] of [
    ['/users/owner/journals', 'POST', { content: 'fixture', ownerId: 'other' }],
    ['/users/me/garden-privacy', 'PATCH', { allowGardenVisits: true, role: 'admin' }],
    ['/users/owner/ai-consent', 'PUT', { aiProcessing: true, userId: 'other' }],
  ]) assert.equal((await send(JSON.stringify(body), path, method)).status, 400);
  assert.equal(writes, 0);
  assert.equal((await send('{"preferredLocale":"en"}', '/users/owner/profile?constructor=ignored')).status, 200);
  assert.equal(writes, 1);
  assert.equal((await send('{"preferredLocale":"en"}', '/users/constructor/profile')).status, 403);
  let deep = {}; for (let i = 0; i < 21; i++) deep = { child: deep };
  for (const body of [JSON.stringify(deep), JSON.stringify({ items: Array(1001).fill({}) }), JSON.stringify(Object.fromEntries(Array.from({ length: 1001 }, (_, i) => [`k${i}`, true]))), JSON.stringify({ preferredLocale: 'x'.repeat(40000) })]) assert.equal((await send(body)).status, 413);
  assert.equal(writes, 1); assert.equal(({}).polluted, undefined); assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), descriptors);
});
test('null-prototype inputs are supported; key names are rejected, not string values', () => {
  const body = Object.assign(Object.create(null), { content: 'constructor prototype __proto__', nested: [Object.create(null)] });
  assert.equal(jsonObjectIssue(body), null);
  let next = false;
  allowBodyFields(['content', 'nested'])({ body }, { status() { throw Error('valid body rejected'); } }, () => { next = true; });
  assert.equal(next, true);
  Object.defineProperty(body.nested[0], '__proto__', { enumerable: true, value: { polluted: true } });
  assert.equal(jsonObjectIssue(body), 'DANGEROUS_KEYS'); assert.equal(({}).polluted, undefined);
});

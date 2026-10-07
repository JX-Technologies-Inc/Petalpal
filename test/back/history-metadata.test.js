import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../../lib/prisma.js';
import { setFirebaseTokenVerifierForTests } from '../../lib/auth.js';
import { app } from '../../server.js';
import { historyFlowerSelect } from '../../lib/history-metadata.js';

test('owner metadata excludes private detail, preserves navigation and is read-only/no-store', async t => {
  const restore = [];
  const stub = (obj, key, fn) => { const old = obj[key]; restore.push(() => obj[key] = old); obj[key] = fn; };
  const secret = 'PRIVATE_FIXTURE_MUST_NOT_LEAK';
  const flower = { id: 'flower', name: 'Rose', speciesCode: 'rose', createdAt: '2026-10-01', sourceEventId: 'event', dailyCheckInId: 'checkin', journal: { content: secret }, event: secret, generationSeed: secret, messages: [secret], sourceEvent: { text: secret, confidence: 0.9, secondaryEmotions: ['joy'] }, dailyCheckIn: { journal: { content: secret }, emotionResult: { secondaryEmotions: ['calm'], intensity: 9, confidence: 0.9, evidence: secret } } };
  setFirebaseTokenVerifierForTests(async () => ({ uid: 'firebase-owner', email_verified: true }));
  stub(prisma.user, 'findUnique', async () => ({ id: 'owner', name: 'Owner', timezone: 'UTC', accountId: secret }));
  stub(prisma.flower, 'findMany', async ({ where, select }) => { assert.deepEqual(where, { userId: 'owner' }); assert.deepEqual(select, historyFlowerSelect); return [flower]; });
  stub(prisma.fairyState, 'findUnique', async ({ select }) => { assert.deepEqual(Object.keys(select).sort(), ['lastEvent', 'onboardingCompleted', 'onboardingStep', 'unlockedFeatures']); return { onboardingStep: 'DONE', onboardingCompleted: true, unlockedFeatures: [], secret }; });
  stub(prisma.dailyCheckIn, 'findFirst', async ({ where, select }) => { assert.equal(where.userId, 'owner'); assert.deepEqual(select, { id: true, localDate: true }); return { id: 'checkin', localDate: '2026-10-01', journal: { content: secret }, emotionResult: flower.dailyCheckIn.emotionResult }; });
  for (const [obj, key] of [[prisma.fairyState, 'upsert'], [prisma.garden, 'findUnique'], [prisma.garden, 'create']]) stub(obj, key, async () => { throw Error('metadata must not hydrate detail or write'); });
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  t.after(async () => { restore.reverse().forEach(fn => fn()); setFirebaseTokenVerifierForTests(); await new Promise(r => server.close(r)); });
  const request = (path, auth = true) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers: auth ? { Authorization: 'Bearer test' } : {} });
  for (const path of ['/users/owner/garden?view=metadata', '/session?view=metadata']) {
    assert.equal((await request(path, false)).status, 401);
    const response = await request(path); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json(); assert.ok(!JSON.stringify(data).includes(secret));
    if (data.flowers) { assert.equal(data.flowers[0].sourceEventId, 'event'); assert.equal(data.flowers[0].dailyCheckInId, 'checkin'); assert.equal(data.flowers[0].createdAt, '2026-10-01'); assert.deepEqual(data.flowers[0].sourceEvent, { secondaryEmotions: ['joy'] }); assert.deepEqual(data.flowers[0].dailyCheckIn, { emotionResult: { secondaryEmotions: ['calm'] } }); }
    else { assert.deepEqual(data.todayCheckIn, { id: 'checkin', localDate: '2026-10-01' }); assert.equal(data.garden.owner.id, 'owner'); assert.equal(data.user.accountId, undefined); }
  }
  assert.equal((await request('/users/other/garden?view=metadata')).status, 403);
  for (const path of ['/session?view=metadata&ownerId=other', '/users/owner/garden?view=metadata&userId=other', '/session?view=full', '/users/owner/garden?view=full']) assert.equal((await request(path)).status, 400);
});

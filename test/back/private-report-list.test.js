import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../../lib/prisma.js';
import { setFirebaseTokenVerifierForTests } from '../../lib/auth.js';
import { app } from '../../server.js';

test('saved report discovery is authenticated, owner-only, bounded and metadata-only', async t => {
  const restore = [];
  const stub = (object, key, fn) => { const original = object[key]; restore.push(() => object[key] = original); object[key] = fn; };
  const rows = Array.from({ length: 27 }, (_, i) => ({
    id: `report-${String(i).padStart(2, '0')}`, ownerId: 'owner',
    periodKey: '2026-09', periodStartUtc: new Date(Date.UTC(2026, 8, 27 - i)),
    periodEndUtc: new Date('2026-10-01'), createdAt: new Date('2026-10-01'),
    status: 'COMPLETE', summary: 'Must not be returned by discovery',
  }));
  const forbidden = [];
  for (const model of ['weeklyReport', 'monthlyReport', 'aiJob', 'eventMemory']) {
    for (const method of ['create', 'update', 'upsert', 'delete']) stub(prisma[model], method, async () => { forbidden.push(`${model}.${method}`); throw Error('Write forbidden'); });
  }
  setFirebaseTokenVerifierForTests(async () => ({ uid: 'owner-firebase', email_verified: true }));
  stub(prisma.user, 'findUnique', async () => ({ id: 'owner' }));
  const keys = ['createdAt', 'id', 'periodEndUtc', 'periodKey', 'periodStartUtc', 'status'];
  for (const model of ['weeklyReport', 'monthlyReport']) {
    stub(prisma[model], 'findMany', async ({ where, select, orderBy, take }) => {
      assert.equal(where.ownerId, 'owner');
      assert.deepEqual(Object.keys(select).sort(), keys);
      assert.deepEqual(orderBy, [{ periodStartUtc: 'desc' }, { id: 'desc' }]);
      assert.ok(take <= 51);
      return rows.filter(row => !where.OR || where.OR.some(part =>
        part.periodStartUtc?.lt ? row.periodStartUtc < part.periodStartUtc.lt
          : +row.periodStartUtc === +part.periodStartUtc && (part.id?.lt ? row.id < part.id.lt : row.id === part.id)
      )).slice(0, take).map(row => Object.fromEntries(keys.map(key => [key, row[key]])));
    });
    stub(prisma[model], 'findFirst', async ({ where }) => {
      assert.equal(where.ownerId, 'owner');
      return rows.find(row => row.id === where.id) || null;
    });
  }
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { restore.reverse().forEach(fn => fn()); setFirebaseTokenVerifierForTests(); await new Promise(resolve => server.close(resolve)); });
  const request = (path = '', token = true) => fetch(`http://127.0.0.1:${server.address().port}/ai/reports${path}`, { headers: token ? { Authorization: 'Bearer test-token' } : {} });
  assert.equal((await request('', false)).status, 401);
  for (const query of ['?userId=other', '?ownerId=owner', '?limit=51', '?limit=0', '?limit=1.5', '?cursor=bad']) assert.equal((await request(query)).status, 400);
  const first = await (await request()).json();
  assert.equal(first.reports.length, 20);
  assert.ok(first.nextCursor);
  const all = []; let cursor = null;
  do {
    const response = await request(`?limit=7${cursor ? `&cursor=${cursor}` : ''}`);
    assert.equal(response.status, 200);
    const page = await response.json();
    assert.ok(page.reports.length <= 7);
    for (const row of page.reports) assert.deepEqual(Object.keys(row).sort(), [...keys, 'type'].sort());
    all.push(...page.reports); cursor = page.nextCursor;
  } while (cursor);
  assert.equal(all.length, 54);
  assert.equal(new Set(all.map(row => `${row.type}/${row.id}`)).size, 54);
  assert.deepEqual(all.slice(0, 2).map(row => row.type), ['monthly', 'weekly']);
  assert.ok(all.every((row, i) => !i || row.periodStartUtc <= all[i - 1].periodStartUtc));
  for (const type of ['weekly', 'monthly']) {
    assert.equal((await request(`/${type}/report-00`)).status, 200);
    assert.equal((await request(`/${type}/foreign-report`)).status, 404);
  }
  rows.length = 0;
  assert.deepEqual(await (await request()).json(), { reports: [], nextCursor: null });
  assert.deepEqual(forbidden, []);
});

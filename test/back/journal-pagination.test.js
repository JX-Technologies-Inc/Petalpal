import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../../lib/prisma.js';
import { app } from '../../server.js';
import { setFirebaseTokenVerifierForTests } from '../../lib/auth.js';
import { journalPageCursor } from '../../lib/journal-pagination.js';

async function fixture(t) {
  const rows = Array.from({ length: 123 }, (_, i) => ({
    id: `journal-${String(i).padStart(3, '0')}`, userId: 'owner',
    createdAt: new Date(Date.UTC(2026, 0, 1 + Math.floor(i / 3))), content: `Entry ${i}`, dailyCheckIn: null
  }));
  rows.push({ id: 'foreign', userId: 'other', createdAt: new Date('2026-10-01'), content: 'FOREIGN_PRIVATE_TEXT' });
  const calls = [], restore = [];
  const stub = (obj, key, fn) => { const old = obj[key]; restore.push(() => obj[key] = old); obj[key] = fn; };
  stub(prisma.user, 'findUnique', async ({ where }) => where.firebaseUid ? { id: 'owner' } : { timezone: 'UTC' });
  stub(prisma.journal, 'findFirst', async ({ where, select }) => {
    calls.push({ anchor: where }); assert.equal(where.userId, 'owner'); assert.deepEqual(select, { id: true });
    return rows.find(row => row.userId === where.userId && row.id === where.id && +row.createdAt === +where.createdAt) || null;
  });
  stub(prisma.journal, 'findMany', async args => {
    calls.push(args); assert.equal(args.where.userId, 'owner');
    let selected = rows.filter(row => row.userId === args.where.userId);
    if (args.where.OR) {
      const [date, tie] = args.where.OR;
      selected = selected.filter(row => row.createdAt < date.createdAt.lt || (+row.createdAt === +tie.createdAt && row.id < tie.id.lt));
    }
    if (args.take !== undefined) {
      assert.ok(Number.isInteger(args.take) && args.take >= 2 && args.take <= 101);
      assert.deepEqual(args.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
    }
    selected.sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    return args.take === undefined ? selected : selected.slice(0, args.take);
  });
  setFirebaseTokenVerifierForTests(async () => ({ uid: 'owner-firebase', email_verified: true }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  t.after(async () => { restore.reverse().forEach(fn => fn()); setFirebaseTokenVerifierForTests(); await new Promise(r => server.close(r)); });
  const get = async (query = '', user = 'owner', authenticated = true) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/users/${user}/journals${query}`, {
      headers: authenticated ? { Authorization: 'Bearer fixture' } : {}
    });
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  };
  return { rows, calls, get };
}

test('Journal pages authorize before parsing and reject unsafe limits/filters without history reads', async t => {
  const { get, calls } = await fixture(t);
  assert.equal((await get('?view=page', 'owner', false)).status, 401);
  assert.equal((await get('?view=page&limit=999', 'other')).status, 403);
  for (const query of ['limit=0', 'limit=101', 'limit=999999999', 'limit=-1', 'limit=1.5', 'limit=01',
    'limit=2&limit=3', 'offset=99999999', 'ownerId=other', 'userId=other', 'view=wrong', 'cursor=%7B']) {
    const result = await get(`?view=page&${query}`);
    assert.equal(result.status, 400, query);
    assert.deepEqual(result.body, { error: 'Invalid Journal page' });
  }
  assert.equal(calls.length, 0);
});

test('Journal page cursors reject foreign owners, forged anchors and malformed shapes without data or counts', async t => {
  const { get, calls, rows } = await fixture(t);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const anchor = rows[0];
  const base = { owner: 'owner', id: anchor.id, createdAt: anchor.createdAt.toISOString() };
  for (const cursor of [journalPageCursor('other', rows.at(-1)), encode({ ...base, id: 'foreign' }),
    encode({ ...base, createdAt: '2026-10-01T00:00:00.000Z' }), encode({ ...base, extra: 'other' }),
    encode(null), encode({ ...base, createdAt: 'invalid' }), 'x'.repeat(769)]) {
    const result = await get(`?view=page&cursor=${cursor}`);
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { error: 'Invalid Journal page' });
    assert.equal(JSON.stringify(result).includes('FOREIGN_PRIVATE_TEXT'), false);
  }
  assert.ok(calls.every(call => call.anchor));
});

test('Journal keyset pages retain tied-date order with no omissions/duplicates, bounded defaults and empty final pages', async t => {
  const { get, rows, calls } = await fixture(t);
  const expected = rows.filter(row => row.userId === 'owner').sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1)).map(row => row.id);
  const all = []; let cursor = null;
  do {
    const page = await get(`?view=page&limit=7${cursor ? `&cursor=${cursor}` : ''}`);
    assert.equal(page.status, 200); assert.equal(page.cache, 'no-store');
    assert.deepEqual(Object.keys(page.body).sort(), ['journals', 'nextCursor']);
    assert.ok(page.body.journals.length <= 7);
    all.push(...page.body.journals.map(row => row.id)); cursor = page.body.nextCursor;
  } while (cursor);
  assert.deepEqual(all, expected); assert.equal(new Set(all).size, 123);
  assert.equal((await get('?view=page')).body.journals.length, 50);
  assert.equal((await get('?view=page&limit=100')).body.journals.length, 100);
  const last = rows.find(row => row.id === expected.at(-1));
  assert.deepEqual((await get(`?view=page&cursor=${journalPageCursor('owner', last)}`)).body, { journals: [], nextCursor: null });
  rows.length = 0;
  assert.deepEqual((await get('?view=page')).body, { journals: [], nextCursor: null });
  assert.ok(calls.filter(call => !call.anchor).every(call => call.take <= 101));
});

test('legacy Journal consumers retain complete arrays and unchanged entry/navigation fields', async t => {
  const { get, calls, rows } = await fixture(t);
  rows[0].dailyCheckIn = { localDate: '2025-12-31', emotionResult: { label: 'calm' }, flower: { id: 'flower', messages: [{ text: 'existing social message' }] } };
  const legacy = await get();
  assert.equal(legacy.status, 200); assert.ok(Array.isArray(legacy.body)); assert.equal(legacy.body.length, 123);
  const entry = legacy.body.find(row => row.id === rows[0].id);
  assert.deepEqual(Object.keys(entry).sort(), ['createdAt', 'emotionResult', 'flower', 'id', 'journal', 'localDate']);
  assert.equal(entry.localDate, '2025-12-31'); assert.equal(entry.journal.content, 'Entry 0');
  assert.deepEqual(entry.flower.messages, [{ text: 'existing social message' }]);
  assert.equal(calls[0].take, undefined);
});

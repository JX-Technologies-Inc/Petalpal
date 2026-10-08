import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { PGlite } from '@electric-sql/pglite';
import { io as connectSocket } from 'socket.io-client';
import prisma from '../../lib/prisma.js';
import { setFirebaseTokenVerifierForTests } from '../../lib/auth.js';
import { server } from '../../server.js';

const migration = () => readFile(new URL('../../prisma/migrations/202610010001_garden_visit_privacy/migration.sql', import.meta.url), 'utf8');
const baseline = () => readFile(new URL('../../prisma/migrations/202608250000_baseline/migration.sql', import.meta.url), 'utf8');

test('single privacy migration preserves old records, defaults ON, and persists OFF across restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'petalpal-privacy-'));
  let db = new PGlite(directory);
  try {
    await db.exec(await baseline());
    await db.exec(`INSERT INTO "User" (id, name) VALUES ('existing', 'Existing Bloom');
      INSERT INTO "Garden" (id, "ownerId") VALUES ('existing-garden', 'existing');`);
    await db.exec(await migration());
    assert.equal((await db.query('SELECT "allowGardenVisits" FROM "User"')).rows[0].allowGardenVisits, true);
    await db.exec(`INSERT INTO "User" (id, name) VALUES ('new-user', 'New Bloom');
      UPDATE "User" SET "allowGardenVisits" = false WHERE id = 'existing';`);
    await db.close(); db = new PGlite(directory);
    const users = (await db.query('SELECT id, name, "allowGardenVisits" FROM "User" ORDER BY id')).rows;
    assert.deepEqual(users, [
      { id: 'existing', name: 'Existing Bloom', allowGardenVisits: false },
      { id: 'new-user', name: 'New Bloom', allowGardenVisits: true }
    ]);
    assert.equal((await db.query('SELECT id FROM "Garden"')).rows[0].id, 'existing-garden');
  } finally { await db.close(); await rm(directory, { recursive: true, force: true }); }
});

test('persisted privacy enforces confirmed-friend reads, visits, direct access and socket revocation', { timeout: 20000 }, async (t) => {
  const db = new PGlite();
  await db.exec(await baseline()); await db.exec(await migration());
  await db.exec(`INSERT INTO "User" (id, name, "accountId") VALUES
    ('owner', 'Alex Chen', 'PP100'), ('friend', 'Jenny Li', 'PP200'), ('outsider', 'Pending Friend', 'PP300');
    INSERT INTO "Garden" (id, "ownerId") VALUES ('garden-owner', 'owner');
    INSERT INTO "Friendship" (id, "userId", "friendId") VALUES
    ('outbound', 'owner', 'friend'), ('inbound', 'friend', 'owner');
    INSERT INTO "FriendRequest" (id, "senderId", "receiverId", "updatedAt") VALUES
    ('pending', 'outsider', 'owner', CURRENT_TIMESTAMP);`);
  const restore = [], sockets = []; let gardenReads = 0, visitWrites = 0;
  function stub(model, method, implementation) {
    const original = prisma[model][method]; restore.push(() => { prisma[model][method] = original; });
    prisma[model][method] = implementation;
  }
  const transaction = prisma.$transaction, raw = prisma.$queryRawUnsafe;
  restore.push(() => { prisma.$transaction = transaction; prisma.$queryRawUnsafe = raw; });
  // Single-connection fixture; independent PostgreSQL tests prove lock behavior.
  prisma.$transaction = async operation => operation(prisma);
  prisma.$queryRawUnsafe = async () => [];
  const project = (value, select) => select ? Object.fromEntries(Object.keys(select).map(key => [key, value[key]])) : value;
  stub('user', 'findUnique', async ({ where, select, include }) => {
    const id = where.firebaseUid || where.id;
    const row = (await db.query('SELECT * FROM "User" WHERE id = $1', [id])).rows[0];
    if (!row) return null;
    return project({ ...row, ...(include ? { garden: { id: 'garden-owner' } } : {}) }, select);
  });
  stub('user', 'update', async ({ where, data, select }) => {
    assert.deepEqual(Object.keys(data), ['allowGardenVisits']);
    return project((await db.query('UPDATE "User" SET "allowGardenVisits" = $1 WHERE id = $2 RETURNING *',
      [data.allowGardenVisits, where.id])).rows[0], select);
  });
  stub('friendship', 'findUnique', async ({ where }) => {
    const pair = where.userId_friendId;
    return (await db.query('SELECT id FROM "Friendship" WHERE "userId" = $1 AND "friendId" = $2',
      [pair.userId, pair.friendId])).rows[0] || null;
  });
  stub('friendship', 'findMany', async ({ where, include }) => {
    const rows = (await db.query(`SELECT u.* FROM "Friendship" f JOIN "User" u ON u.id = f."friendId" WHERE f."userId" = $1`, [where.userId])).rows;
    return rows.map(friend => ({ friend: project(friend, include.friend.select) }));
  });
  stub('garden', 'findUnique', async ({ include }) => {
    if (include) gardenReads++;
    return { id: 'garden-owner', ownerId: 'owner', flowers: [], visitRecords: [] };
  });
  stub('visitRecord', 'create', async ({ data }) => { visitWrites++; return { id: `visit-${visitWrites}`, ...data }; });
  stub('visitRecord', 'findMany', async () => []);
  setFirebaseTokenVerifierForTests(async token => ({ uid: token, email_verified: true }));
  server.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    sockets.forEach(socket => socket.disconnect());
    await new Promise(resolve => server.close(resolve));
    restore.forEach(fn => fn()); setFirebaseTokenVerifierForTests(); await db.close();
  });
  async function call(path, token = 'friend', method = 'GET', body) {
    const res = await fetch(`${base}${path}`, { method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() };
  }
  assert.deepEqual((await call('/users/me/garden-privacy', 'owner')).body, { allowGardenVisits: true });
  assert.equal((await call('/users/me/garden-privacy', 'owner', 'PATCH', { allowGardenVisits: 'false' })).status, 400);
  const allowed = await call('/users/owner/garden-access');
  assert.deepEqual(allowed.body, { allowGardenVisits: true, canVisit: true });
  const list = await call('/users/friend/friends');
  assert.equal(list.body[0].name, 'Alex Chen'); assert.equal(list.body[0].allowGardenVisits, true);
  assert.equal(gardenReads, 0, 'Permission metadata never reads Garden contents');
  assert.equal((await call('/users/owner/garden')).status, 200);
  assert.equal((await call('/visit', 'friend', 'POST', { hostUserId: 'owner' })).status, 200);
  const writes = visitWrites;
  for (const path of ['/users/owner/garden', '/visit', '/visit/move']) {
    const method = path.startsWith('/visit') ? 'POST' : 'GET';
    assert.equal((await call(path, 'outsider', method, method === 'POST' ? { hostUserId: 'owner', x: 10, y: 10 } : undefined)).status, 403);
  }
  assert.equal((await call('/users/owner/garden-access', 'outsider')).body.canVisit, false, 'Pending requests are not confirmed friends');
  assert.equal(visitWrites, writes);

  async function socketFor(token) {
    const socket = connectSocket(base, { auth: { token }, transports: ['websocket'] }); sockets.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    socket.emit('join-garden', 'owner'); return socket;
  }
  const ownerSocket = await socketFor('owner'), friendSocket = await socketFor('friend'), outsiderSocket = await socketFor('outsider');
  let friendMoves = 0, outsiderMoves = 0;
  friendSocket.on('avatarMoved', () => friendMoves++); outsiderSocket.on('avatarMoved', () => outsiderMoves++);
  await delay(40);
  async function moveOwner() {
    const delivered = new Promise(resolve => ownerSocket.once('avatarMoved', resolve));
    ownerSocket.emit('move-avatar', { gardenOwnerId: 'owner', x: 10, y: 20 });
    await delivered; await delay(20);
  }
  await moveOwner(); assert.equal(friendMoves, 1); assert.equal(outsiderMoves, 0);
  assert.equal((await call('/users/me/garden-privacy', 'owner', 'PATCH', { allowGardenVisits: false, userId: 'friend' })).status, 400);
  assert.equal((await call('/users/me/garden-privacy', 'owner', 'PATCH', { allowGardenVisits: false })).status, 200);
  assert.equal((await call('/users/me/garden-privacy', 'owner')).body.allowGardenVisits, false);
  assert.equal((await call('/users/me/garden-privacy', 'friend')).body.allowGardenVisits, true, 'Body identity cannot change another account');
  assert.equal((await call('/users/friend/friends')).body[0].allowGardenVisits, false);
  assert.equal((await call('/users/owner/garden-access')).body.canVisit, false);
  for (const path of ['/users/owner/garden', '/visit', '/visit/move']) {
    const method = path.startsWith('/visit') ? 'POST' : 'GET';
    assert.equal((await call(path, 'friend', method, method === 'POST' ? { hostUserId: 'owner', x: 10, y: 10, allowGardenVisits: true } : undefined)).status, 403);
  }
  assert.equal(visitWrites, writes, 'Denied entry produces no VisitRecord');
  assert.equal((await call('/users/owner/garden', 'owner')).status, 200, 'Owner access ignores the privacy toggle');
  assert.equal((await call('/users/owner/garden-access', 'owner')).body.canVisit, true);
  await moveOwner(); assert.equal(friendMoves, 1, 'OFF revokes existing visitor subscriptions');
  assert.equal((await call('/leave', 'friend', 'POST', { hostUserId: 'owner' })).status, 200, 'Visitors can leave after revocation');
  assert.equal((await call('/users/me/garden-privacy', 'owner', 'PATCH', { allowGardenVisits: true })).status, 200);
  assert.equal((await call('/users/owner/garden')).status, 200);
});

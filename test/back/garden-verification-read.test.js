import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Existing verification endpoints only. No real identities, DB or provider calls.
test('Garden verification reads with absent Garden cannot create records', async t => {
  const initialCwd = process.cwd(), isolatedCwd = mkdtempSync(join(tmpdir(), 'petalpal-garden-read-'));
  const savedEnv = { ...process.env }, restore = [];
  let listener, resetVerifier;
  const state = { private: true, garden: null, writes: 0, flowerReads: 0, gardenReads: 0 };
  const users = {
    owner: { id: 'owner', firebaseUid: 'fixture-owner', name: 'Owner', avatar: '🌻', timezone: 'UTC' },
    friend: { id: 'friend', firebaseUid: 'fixture-friend', name: 'Friend', avatar: '🦋', timezone: 'UTC' },
    nonfriend: { id: 'nonfriend', firebaseUid: 'fixture-nonfriend', name: 'Nonfriend', avatar: '🦋', timezone: 'UTC' }
  };
  function stub(object, key, fn) { const old = object[key]; object[key] = fn; restore.push(() => { object[key] = old; }); }
  const forbidden = async () => { state.writes++; throw new Error('Verification attempted a write'); };
  try {
    // Dynamic imports from an empty cwd prevent dotenv from loading real secrets.
    for (const key of Object.keys(process.env)) if (!['PATH','HOME','TMPDIR','LANG','TERM','USER'].includes(key)) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: 'test', DEV_DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:9/petalpal_read_test', API_DOCS_ENABLED: 'false' });
    process.chdir(isolatedCwd);
    const { default: prisma } = await import('../../lib/prisma.js');
    const { setFirebaseTokenVerifierForTests } = await import('../../lib/auth.js');
    const { app } = await import('../../server.js');
    resetVerifier = () => setFirebaseTokenVerifierForTests();
    setFirebaseTokenVerifierForTests(async token => {
      assert.ok(users[token]); return { uid: users[token].firebaseUid, email_verified: true };
    });
    // Trap every model mutation and unexpected read; no network DB fallback.
    for (const key of Object.keys(prisma)) {
      const model = prisma[key];
      if (!model || typeof model.create !== 'function') continue;
      for (const method of ['create','createMany','createManyAndReturn','update','updateMany','updateManyAndReturn','upsert','delete','deleteMany']) {
        if (typeof model[method] === 'function') stub(model, method, forbidden);
      }
      for (const method of ['findUnique','findUniqueOrThrow','findFirst','findFirstOrThrow','findMany','count','aggregate','groupBy']) {
        if (typeof model[method] === 'function') stub(model, method, async () => { throw new Error('Unexpected model read'); });
      }
    }
    for (const method of ['$connect','$executeRaw','$executeRawUnsafe','$queryRaw']) stub(prisma, method, forbidden);
    stub(prisma, '$queryRawUnsafe', async sql => { assert.match(sql, /^SELECT (set_config|id FROM "User")/); return []; });
    stub(prisma, '$transaction', async callback => { assert.equal(typeof callback, 'function'); return callback(prisma); });
    stub(prisma.user, 'findUnique', async ({ where }) => {
      const user = where.firebaseUid ? Object.values(users).find(u => u.firebaseUid === where.firebaseUid) : users[where.id];
      return user ? { ...user, allowGardenVisits: state.private, garden: state.garden } : null;
    });
    stub(prisma.friendship, 'findUnique', async ({ where }) => where.userId_friendId.userId === 'owner' && where.userId_friendId.friendId === 'friend' ? { id: 'confirmed-fixture' } : null);
    stub(prisma.flower, 'findMany', async ({ where }) => { state.flowerReads++; assert.deepEqual(where, { userId: 'owner' }); return []; });
    stub(prisma.garden, 'findUnique', async () => { state.gardenReads++; return state.garden; });
    listener = app.listen(0, '127.0.0.1'); await new Promise(resolve => listener.once('listening', resolve));
    async function read(path, actor = 'owner') {
      const r = await fetch(`http://127.0.0.1:${listener.address().port}${path}`, { headers: { Authorization: 'Bearer ' + actor }, redirect: 'error', signal: AbortSignal.timeout(5000) });
      assert.equal(r.headers.get('cache-control'), 'no-store');
      return { status: r.status, body: await r.json() };
    }
    await t.test('owner metadata with no Garden/Flowers returns empty without hydration or writes', async () => {
      const r = await read('/users/owner/garden?view=metadata');
      assert.equal(r.status, 200); assert.deepEqual(r.body, { owner: { id: 'owner' }, flowers: [] });
      assert.equal(state.garden, null); assert.equal(state.gardenReads, 0); assert.equal(state.writes, 0);
    });
    await t.test('cross-owner metadata with no Garden is rejected before data reads or writes', async () => {
      const reads = state.flowerReads;
      const r = await read('/users/owner/garden?view=metadata', 'friend');
      assert.equal(r.status, 403); assert.deepEqual(Object.keys(r.body), ['error']);
      assert.equal(state.flowerReads, reads); assert.equal(state.gardenReads, 0); assert.equal(state.writes, 0); assert.equal(state.garden, null);
    });
    await t.test('Garden policy verification without a Garden handles owner/friend/nonfriend and privacy without creating records', async () => {
      for (const enabled of [true, false]) {
        state.private = enabled;
        for (const actor of ['owner','friend','nonfriend']) {
          const r = await read('/users/owner/garden-access', actor);
          assert.equal(r.status, 200); assert.deepEqual(r.body, { allowGardenVisits: enabled, canVisit: actor === 'owner' || (enabled && actor === 'friend') });
          assert.equal(state.garden, null); assert.equal(state.gardenReads, 0); assert.equal(state.writes, 0);
        }
      }
    });
    await t.test('ordinary full Garden GET retains lazy creation for a missing Garden', async () => {
      state.private = true;
      stub(prisma.garden, 'create', async ({ data }) => { state.writes++; assert.equal(data.ownerId, 'owner'); state.garden = { id: 'created-fixture', ownerId: 'owner', flowers: [], visitRecords: [] }; return state.garden; });
      const r = await read('/users/owner/garden');
      assert.equal(r.status, 200); assert.equal(state.writes, 1); assert.equal(state.garden.id, 'created-fixture');
    });
  } finally {
    if (listener?.listening) await new Promise(resolve => listener.close(resolve));
    restore.reverse().forEach(fn => fn()); resetVerifier?.();
    process.chdir(initialCwd); rmSync(isolatedCwd, { recursive: true });
    for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, savedEnv);
  }
});

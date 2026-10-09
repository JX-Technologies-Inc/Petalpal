import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '../../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { canVisitGarden, withSocialLocks } from '../../lib/garden-access.js';

// Always create our own loopback-only PostgreSQL; accept no external DB/target.
assert.equal(process.env.PETALPAL_DAST_ISOLATED, '1', 'Use npm run test:social-atomic');
assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 20000 }).trim();
const name = 'petalpal-social-atomic-' + randomUUID().slice(0, 8);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
let id, observer, revoker, prisma, server, gate, fault, pid;
let dbPort, httpPort, requests = 0, blockedNetwork = 0;
const realConnect = net.Socket.prototype.connect;
const realFetch = globalThis.fetch;
const timeout = promise => Promise.race([promise, delay(4000).then(() => { throw new Error('Fixture synchronization timeout'); })]);

function instrument(tx) {
  return new Proxy(tx, { get(target, key) {
    if (key === '$queryRawUnsafe') return async (sql, ...args) => {
      const rows = await target.$queryRawUnsafe(sql, ...args);
      if (sql.includes('FOR NO KEY UPDATE') && gate) {
        pid = (await target.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid;
        const current = gate; current.locked.resolve(); await current.release.promise;
      }
      return rows;
    };
    if (key === 'visitRecord' && fault === 'message') return new Proxy(target.visitRecord, { get(delegate, method) {
      if (method === 'create') return () => { throw new Error('Injected visit-record failure'); };
      return delegate[method];
    } });
    if (key === 'flower' && fault === 'support') return new Proxy(target.flower, { get(delegate, method) {
      if (method === 'update') return () => { throw new Error('Injected counter failure'); };
      return delegate[method];
    } });
    return target[key];
  } });
}

// Fixture tables follow the installed client's scalar layout. No app migration
// command or existing database is used. Constraints exercise real FKs/rollback.
async function fixtureSchema() {
  const models = new Set(['User', 'Garden', 'Flower', 'Message', 'VisitRecord', 'Friendship', 'FriendRequest', 'DailyCheckIn', 'Journal', 'EmotionResult', 'Event']);
  const quote = s => '"' + s.replaceAll('"', '""') + '"';
  const schema = await readFile(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
  const enums = new Set([...schema.matchAll(/^enum (\w+)/gm)].map(m => m[1]));
  for (const name of models) {
    const body = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].find(m => m[1] === name)?.[2];
    assert.ok(body, 'Fixture model exists: ' + name);
    const fields = [...body.matchAll(/^\s+(\w+)\s+(\w+)(\[\]|\?)?([^\n]*)/gm)].filter(m =>
      ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'BigInt'].includes(m[2]) || enums.has(m[2]));
    const columns = fields.map(([, field, fieldType, modifier, annotations]) => {
      let type = { Int: 'integer', Float: 'double precision', Boolean: 'boolean', DateTime: 'timestamp(3)', Json: 'jsonb', BigInt: 'bigint' }[fieldType] ?? 'text';
      if (modifier === '[]') type += '[]';
      const defaultValue = annotations.match(/@default\((.*?)\)/)?.[1];
      let def = '';
      if (defaultValue?.startsWith('now(')) def = ' DEFAULT CURRENT_TIMESTAMP';
      else if (/^(true|false|-?\d+(?:\.\d+)?)$/.test(defaultValue ?? '')) def = ' DEFAULT ' + defaultValue;
      else if (defaultValue?.startsWith('"')) def = " DEFAULT '" + JSON.parse(defaultValue).replaceAll("'", "''") + "'";
      else if (enums.has(fieldType) && defaultValue) def = " DEFAULT '" + defaultValue + "'";
      else if (modifier === '[]') def = " DEFAULT '{}'";
      return quote(field) + ' ' + type + (modifier !== '?' ? ' NOT NULL' : '') + (annotations.includes('@id') ? ' PRIMARY KEY' : '') + def;
    });
    await observer.query('CREATE TABLE ' + quote(name) + ' (' + columns.join(',') + ')');
  }
  await observer.query(`
    ALTER TABLE "User" ADD UNIQUE ("firebaseUid");
    ALTER TABLE "Garden" ADD UNIQUE ("ownerId"), ADD FOREIGN KEY ("ownerId") REFERENCES "User" (id);
    ALTER TABLE "Friendship" ADD UNIQUE ("userId", "friendId"),
      ADD FOREIGN KEY ("userId") REFERENCES "User" (id), ADD FOREIGN KEY ("friendId") REFERENCES "User" (id);
    ALTER TABLE "Flower" ADD FOREIGN KEY ("userId") REFERENCES "User" (id), ADD FOREIGN KEY ("gardenId") REFERENCES "Garden" (id);
    ALTER TABLE "Message" ADD FOREIGN KEY ("flowerId") REFERENCES "Flower" (id), ADD FOREIGN KEY ("userId") REFERENCES "User" (id);
    ALTER TABLE "VisitRecord" ADD UNIQUE ("visitorId", "flowerId", "localDate"),
      ADD FOREIGN KEY ("gardenId") REFERENCES "Garden" (id), ADD FOREIGN KEY ("flowerId") REFERENCES "Flower" (id),
      ADD CONSTRAINT visit_actor_fk FOREIGN KEY ("userId") REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
  `);
}
async function seed() {
  gate = undefined; fault = undefined;
  await observer.query(`TRUNCATE "User", "Garden", "Flower", "Message", "VisitRecord", "Friendship", "FriendRequest", "DailyCheckIn", "Journal", "EmotionResult", "Event" CASCADE;
    INSERT INTO "User" (id, name, "firebaseUid") VALUES ('owner','Owner','owner'), ('actor','Actor','actor'), ('outsider','Outsider','outsider');
    INSERT INTO "Garden" (id,"ownerId") VALUES ('garden','owner');
    INSERT INTO "Flower" (id,mood,name,meaning,img,"left","top","userId","gardenId") VALUES ('flower','SUNNY_BLOOM','Sunflower','Joy','🌻',0,0,'owner','garden');
    INSERT INTO "Friendship" (id,"userId","friendId") VALUES ('outbound','owner','actor'), ('inbound','actor','owner');`);
}
async function request(path, method = 'GET', body, actor = 'actor') {
  requests++;
  const r = await fetch(`http://127.0.0.1:${httpPort}${path}`, { method, headers: { Authorization: 'Bearer ' + actor, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000) });
  return { status: r.status, retry: r.headers.get('retry-after'), body: await r.json() };
}
const operations = {
  support: () => request('/users/owner/flowers/flower/support', 'POST', {}),
  message: () => request('/users/owner/flowers/flower/message', 'POST', { text: 'Fixture kindness' }),
  flower: () => request('/users/owner/flowers/flower'),
  garden: () => request('/users/owner/garden'),
  visit: () => request('/visit', 'POST', { hostUserId: 'owner' }),
  move: () => request('/visit/move', 'POST', { hostUserId: 'owner', x: 1, y: 1 })
};
async function counts() {
  return (await observer.query(`SELECT (SELECT count(*)::int FROM "Message") AS messages,
    (SELECT count(*)::int FROM "VisitRecord") AS visits, (SELECT "supportCount" FROM "Flower" WHERE id='flower') AS supports`)).rows[0];
}
async function revoke(kind, hold) {
  return withSocialLocks(revoker, ['owner', 'actor'], async tx => {
    if (kind === 'privacy') await tx.user.update({ where: { id: 'owner' }, data: { allowGardenVisits: false } });
    else await tx.friendship.deleteMany({ where: { OR: [{ userId: 'owner', friendId: 'actor' }, { userId: 'actor', friendId: 'owner' }] } });
    if (hold) { hold.locked.resolve(); await hold.release.promise; }
  });
}
async function waitForLock(application) {
  for (let i = 0; i < 100; i++) {
    const rows = (await observer.query("SELECT pid FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [application])).rows;
    if (rows.length) return rows[0].pid;
    await delay(10);
  }
  throw new Error('No independent PostgreSQL lock wait observed for ' + application);
}

test('isolated independent PostgreSQL social authorization', { timeout: 110000 }, async t => {
  t.after(async () => {
    gate?.release.resolve();
    if (server?.listening) await new Promise(r => server.close(r));
    await prisma?.$disconnect(); await revoker?.$disconnect(); await observer?.end();
    net.Socket.prototype.connect = realConnect; syncBuiltinESMExports(); globalThis.fetch = realFetch;
    if (id) docker('rm', '-f', id); // Only the fixture this test created.
  });
  docker('image', 'inspect', 'postgres:17'); // Cached official image; never pull/install.
  id = docker('run', '-d', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=petalpal_social_atomic_test', '-p', '127.0.0.1::5432', 'postgres:17');
  dbPort = Number(docker('port', id, '5432/tcp').split(':').at(-1));
  const url = `postgresql://postgres@127.0.0.1:${dbPort}/petalpal_social_atomic_test`;
  for (let i = 0; ; i++) {
    try { docker('exec', id, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'); break; } catch { if (i === 30) throw new Error('Fixture PostgreSQL not ready'); await delay(100); }
  }
  observer = new pg.Client({ connectionString: url }); await observer.connect(); await fixtureSchema();
  process.env.DEV_DATABASE_URL = url + '?application_name=petalpal-social-op';
  net.Socket.prototype.connect = function (...args) {
    const normalized = Array.isArray(args[0]) ? args[0] : args;
    const options = normalized[0];
    const host = typeof options === 'object' ? options.host : normalized[1];
    const port = typeof options === 'object' ? options.port : options;
    if (host !== '127.0.0.1' || ![dbPort, httpPort].includes(Number(port))) { blockedNetwork++; throw new Error('Blocked non-fixture connection'); }
    return realConnect.apply(this, args);
  }; syncBuiltinESMExports();
  globalThis.fetch = (input, options) => {
    const u = new URL(input); assert.equal(u.origin, `http://127.0.0.1:${httpPort}`); return realFetch(input, options);
  };
  ({ default: prisma } = await import('../../lib/prisma.js'));
  revoker = new PrismaClient({ adapter: new PrismaPg({ connectionString: url + '?application_name=petalpal-social-revoke', max: 1 }) });
  const originalTransaction = prisma.$transaction.bind(prisma);
  prisma.$transaction = (work, options) => originalTransaction(async tx => {
    const result = await work(instrument(tx));
    if (fault === 'commit') {
      await tx.$executeRawUnsafe('SET CONSTRAINTS visit_actor_fk DEFERRED');
      await tx.$executeRawUnsafe(`UPDATE "VisitRecord" SET "userId"='missing-actor'`);
    }
    return result;
  }, options);
  const { setFirebaseTokenVerifierForTests } = await import('../../lib/auth.js');
  setFirebaseTokenVerifierForTests(async uid => ({ uid, email_verified: true }));
  ({ server } = await import('../../server.js'));
  server.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); httpPort = server.address().port;

  for (const kind of ['privacy', 'friendship']) {
    await t.test('legacy admission/write race reproduced: ' + kind, async () => {
      await seed(); const owner = await revoker.user.findUnique({ where: { id: 'owner' } });
      assert.equal(await canVisitGarden(revoker, owner, 'actor'), true);
      await revoke(kind);
      // The former route did precisely this separate, unfenced create.
      await revoker.message.create({ data: { author: 'Actor', text: 'Legacy race', flowerId: 'flower', userId: 'actor' } });
      assert.equal((await counts()).messages, 1);
    });
    for (const [op, execute] of Object.entries(operations)) {
      for (const first of ['operation', 'revocation']) await t.test(`${op}/${kind}: ${first} commits first`, async () => {
        await seed();
        if (op === 'move') assert.equal((await operations.visit()).status, 200);
        const before = await counts(); const hold = { locked: deferred(), release: deferred() };
        let action, revocation;
        try {
          if (first === 'operation') {
            gate = hold; action = execute(); await timeout(hold.locked.promise);
            revocation = revoke(kind); const waiting = await waitForLock('petalpal-social-revoke');
            assert.notEqual(waiting, pid); hold.release.resolve();
          } else {
            revocation = revoke(kind, hold); await timeout(hold.locked.promise);
            action = execute(); await waitForLock('petalpal-social-op'); hold.release.resolve();
          }
          const result = await action; await revocation;
          assert.equal(result.status, first === 'operation' ? 200 : 403, JSON.stringify(result));
          if (first === 'revocation') assert.deepEqual(await counts(), before);
          else {
            const after = await counts();
            assert.equal(after.messages - before.messages, op === 'message' ? 1 : 0);
            assert.equal(after.supports - before.supports, op === 'support' ? 1 : 0);
            assert.equal(after.visits - before.visits, ['message', 'support', 'visit'].includes(op) ? 1 : 0);
          }
        } finally { hold.release.resolve(); await Promise.allSettled([action, revocation]); gate = undefined; }
      });
    }
  }
  for (const op of ['message', 'support', 'commit']) await t.test(op + ' failure rolls back every write/cache publication', async () => {
    await seed(); const before = await counts(); fault = op;
    const result = await (op === 'commit' ? operations.visit() : operations[op]());
    assert.equal(result.status, 500); assert.deepEqual(await counts(), before); fault = undefined;
    if (op === 'commit') assert.equal((await operations.move()).status, 404);
  });
  await t.test('bounded lock timeout returns safe retryable 503 without mutation', async () => {
    await seed(); const hold = { locked: deferred(), release: deferred() };
    const held = revoke('privacy', hold); await timeout(hold.locked.promise);
    try { const start = Date.now(), result = await operations.support();
      assert.equal(result.status, 503, JSON.stringify(result)); assert.equal(result.retry, '1');
      assert.ok(Date.now() - start < 4000); assert.equal((await counts()).supports, 0);
    } finally { hold.release.resolve(); await held; }
  });
  await t.test('opposite actor/owner order serializes without a deadlock', async () => {
    await seed(); const held = { locked: deferred(), release: deferred() };
    const a = withSocialLocks(prisma, ['actor', 'owner'], async () => { held.locked.resolve(); await held.release.promise; });
    await timeout(held.locked.promise);
    const b = withSocialLocks(revoker, ['owner', 'actor'], tx => tx.user.findUnique({ where: { id: 'owner' } }));
    try { await waitForLock('petalpal-social-revoke'); } finally { held.release.resolve(); }
    assert.equal((await b).id, 'owner'); await a;
  });
  await t.test('real deadlock abort is bounded, mapped to 503, and rolls back', async () => {
    await seed(); const blocker = new pg.Client({ connectionString: url + "?application_name=petalpal-social-blocker" }); await blocker.connect();
    const hold = { locked: deferred(), release: deferred() }; gate = hold;
    let action, blocked;
    try {
      await blocker.query('BEGIN'); await blocker.query("SET LOCAL deadlock_timeout='5s'");
      await blocker.query('SELECT id FROM "Flower" WHERE id=\'flower\' FOR UPDATE');
      action = operations.support(); await timeout(hold.locked.promise);
      blocked = blocker.query('SELECT id FROM "User" WHERE id=\'owner\' FOR NO KEY UPDATE');
      await waitForLock('petalpal-social-blocker');
      // The operation uses PostgreSQL's default 1s deadlock detection; blocker 5s.
      hold.release.resolve(); const result = await action;
      assert.equal(result.status, 503, JSON.stringify(result)); await blocked;
      assert.equal((await counts()).supports, 0); assert.equal((await counts()).visits, 0);
    } finally { hold.release.resolve(); await blocker.query('ROLLBACK'); await blocker.end(); await Promise.allSettled([action, blocked]); gate = undefined; }
  });
  await t.test('privacy/revocation routes evict cached visitors; owner access survives OFF', async () => {
    await seed(); assert.equal((await operations.visit()).status, 200);
    assert.equal((await request('/friends/remove', 'POST', { friendId: 'actor' }, 'owner')).status, 200);
    assert.equal((await operations.move()).status, 403);
    await seed(); assert.equal((await operations.visit()).status, 200);
    assert.equal((await request('/users/me/garden-privacy', 'PATCH', { allowGardenVisits: false }, 'owner')).status, 200);
    assert.equal((await operations.garden()).status, 403);
    assert.equal((await request('/users/owner/garden', 'GET', undefined, 'owner')).status, 200);
    assert.equal((await request('/users/owner/flowers/flower', 'GET', undefined, 'owner')).status, 200);
    assert.equal((await request('/users/owner/flowers/flower/message', 'POST', { text: 'Owner message' }, 'owner')).status, 200);
  });
  assert.equal(blockedNetwork, 0);
  t.diagnostic(`real PostgreSQL independent connections; ${requests} loopback requests; zero external attempts; fixture only`);
});

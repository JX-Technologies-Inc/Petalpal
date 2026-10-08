import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import express from 'express';
import { PrismaClient } from '../../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { createDatabasePool, DATABASE_LIMITS, DATABASE_TRANSACTION_OPTIONS,
  isDatabaseResourceError } from '../../lib/database-resources.js';
import { withSocialLocks, sendSocialError } from '../../lib/garden-access.js';
import { handleHttpError } from '../../lib/http-errors.js';

assert.equal(process.env.PETALPAL_DB_RESOURCE_ISOLATED, '1');
assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

test('isolated PostgreSQL database resource boundaries', { timeout: 60000 }, async t => {
  const name = 'petalpal-db-resource-' + randomUUID().slice(0, 8);
  const database = 'petalpal_db_resource_test';
  let container, pool, observer, prisma;
  const held = [];
  t.after(async () => {
    held.splice(0).forEach(client => client.release());
    await prisma?.$disconnect();
    if (pool && !pool.ending) await pool.end();
    await observer?.end();
    if (container) docker('rm', '-f', container); // Only this newly created fixture.
  });
  docker('image', 'inspect', 'postgres:17'); // Cached image only; no pulls/restarts.
  container = docker('run', '-d', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e', `POSTGRES_DB=${database}`, '-p', '127.0.0.1::5432', 'postgres:17');
  const port = Number(docker('port', container, '5432/tcp').split(':').at(-1));
  assert.ok(Number.isInteger(port) && port > 0);
  for (let i = 0; i < 40; i++) {
    try { docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'); break; }
    catch { if (i === 39) throw new Error('Owned fixture not ready'); await delay(100); }
  }
  const url = `postgresql://postgres@127.0.0.1:${port}/${database}`;
  const target = new URL(url);
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.pathname, '/' + database);
  observer = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  await observer.connect();
  assert.equal((await observer.query('SELECT current_database() AS name')).rows[0].name, database);
  // Deliberately conflicting URL options must not disable application bounds.
  pool = createDatabasePool(url + '?statement_timeout=0&idle_in_transaction_session_timeout=0&options=' +
    encodeURIComponent('-c lock_timeout=0 -c statement_timeout=0 -c application_name=petalpal-resource-fixture'));
  prisma = new PrismaClient({ adapter: new PrismaPg(pool, { disposeExternalPool: true }),
    transactionOptions: DATABASE_TRANSACTION_OPTIONS });
  await prisma.$connect();
  await observer.query('CREATE TABLE resource_fixture (id integer PRIMARY KEY, value integer NOT NULL)');
  await observer.query('INSERT INTO resource_fixture VALUES (1, 0)');

  await t.test('pool capacity, waiter cap, acquisition deadline and saturation recovery', async () => {
    assert.equal(pool.options.max, 10);
    for (let i = 0; i < DATABASE_LIMITS.connections; i++) held.push(await pool.connect());
    const start = performance.now();
    const pending = Array.from({ length: DATABASE_LIMITS.waiting }, () => pool.connect().then(
      client => { client.release(); throw new Error('Saturated connection unexpectedly acquired'); }, error => error));
    assert.equal(pool.waitingCount, DATABASE_LIMITS.waiting);
    await assert.rejects(pool.connect(), error => error.code === '53300');
    await new Promise(resolve => pool.connect(error => { assert.equal(error.code, '53300'); resolve(); }));
    // Both installed adapter entry points must fail safely at the admission bound.
    await assert.rejects(prisma.$queryRawUnsafe('SELECT 1'), isDatabaseResourceError);
    await assert.rejects(withSocialLocks(prisma, ['fixture-owner'], async () => {}),
      error => error.status === 503 && error.message === 'Social access is busy; retry shortly');
    const errors = await Promise.all(pending);
    assert.ok(errors.every(isDatabaseResourceError));
    assert.ok(performance.now() - start < 4000);
    assert.equal(pool.waitingCount, 0);
    assert.equal(pool.totalCount, DATABASE_LIMITS.connections);
    held.splice(0).forEach(client => client.release());
    assert.equal((await prisma.$queryRawUnsafe('SELECT 1 AS ok'))[0].ok, 1);
  });

  await t.test('global lock limits, rollback and interactive transaction lifetime', async () => {
    const settings = (await pool.query(`SELECT current_setting('lock_timeout') AS lock,
      current_setting('statement_timeout') AS statement,
      current_setting('idle_in_transaction_session_timeout') AS idle,
      current_setting('application_name') AS application`)).rows[0];
    assert.deepEqual(settings, { lock: '1500ms', statement: '10s', idle: '10s', application: 'petalpal-resource-fixture' });
    await observer.query('BEGIN');
    try {
      await observer.query('UPDATE resource_fixture SET value = 1 WHERE id = 1');
      await assert.rejects(prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe('INSERT INTO resource_fixture VALUES (2, 0)');
        await tx.$queryRawUnsafe('SELECT * FROM resource_fixture WHERE id = 1 FOR UPDATE');
      }), isDatabaseResourceError);
    } finally { await observer.query('ROLLBACK'); }
    assert.equal((await observer.query('SELECT count(*)::integer AS n FROM resource_fixture WHERE id = 2')).rows[0].n, 0);
    await assert.rejects(prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('INSERT INTO resource_fixture VALUES (3, 0)');
      await delay(DATABASE_TRANSACTION_OPTIONS.timeout + 150);
      await tx.$queryRawUnsafe('SELECT 1');
    }), error => error.code === 'P2028');
    assert.equal((await observer.query('SELECT count(*)::integer AS n FROM resource_fixture WHERE id = 3')).rows[0].n, 0);
    // Acquisition maxWait is explicit; actual pool wait deadline was exercised above.
    assert.equal(DATABASE_TRANSACTION_OPTIONS.maxWait, 2000);
  });

  await t.test('server query cancellation frees capacity and permits a subsequent query', async () => {
    const start = performance.now();
    await assert.rejects(prisma.$queryRawUnsafe('SELECT pg_sleep(11)'), isDatabaseResourceError);
    assert.ok(performance.now() - start < 13000);
    const active = await observer.query(`SELECT count(*)::integer AS n FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()
      AND state = 'active' AND query LIKE '%pg_sleep%'`);
    assert.equal(active.rows[0].n, 0, 'server work, not merely its caller, must stop');
    assert.equal((await prisma.$queryRawUnsafe('SELECT 1 AS ok'))[0].ok, 1);
  });

  await t.test('lost idle connection recovery and safe HTTP/social capacity errors', async () => {
    const idle = await pool.connect();
    const pid = (await idle.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    idle.release();
    const disconnected = new Promise(resolve => pool.once('error', resolve));
    await observer.query('SELECT pg_terminate_backend($1)', [pid]); // Owned fixture backend only.
    await disconnected;
    assert.equal((await prisma.$queryRawUnsafe('SELECT 1 AS ok'))[0].ok, 1);
    const app = express();
    const sensitive = Object.assign(new Error('SQL private password=secret'), { code: '53300' });
    app.get('/resource', (_req, _res, next) => next(sensitive));
    app.get('/social', async (_req, res, next) => {
      try { await withSocialLocks({ $transaction: async () => { throw sensitive; } }, ['owner'], () => {}); }
      catch (error) { if (!sendSocialError(res, error)) next(error); }
    });
    app.use(handleHttpError);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      for (const path of ['/resource', '/social']) {
        const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
        assert.equal(response.status, 503);
        assert.equal(response.headers.get('retry-after'), '1');
        const body = await response.text();
        assert.ok(!/SQL|private|password|secret/.test(body));
      }
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
});

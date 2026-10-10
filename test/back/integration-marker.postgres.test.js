// Real PostgreSQL + the repository's pinned `prisma migrate deploy`, against
// disposable CI databases only. Runs only when PETALPAL_MARKER_PG_ADMIN_URL is
// set (by integration-marker-postgres.yml) and refuses any non-loopback host.
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const admin = process.env.PETALPAL_MARKER_PG_ADMIN_URL;
const skip = !admin && 'PETALPAL_MARKER_PG_ADMIN_URL not set (CI-only real Postgres check)';
const root = new URL('../../', import.meta.url);

function databaseUrl(name) {
  const url = new URL(admin);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Loopback CI database only');
  url.pathname = `/${name}`;
  return url.toString();
}
async function sql(url, text) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try { return (await client.query(text)).rows; } finally { await client.end(); }
}
async function freshDatabase(name) {
  await sql(admin, `DROP DATABASE IF EXISTS ${name}`);
  await sql(admin, `CREATE DATABASE ${name}`);
  return databaseUrl(name);
}
const baseEnv = () => ({
  PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'production',
  DOTENV_CONFIG_PATH: '/dev/null', DOTENV_CONFIG_QUIET: 'true', PRISMA_HIDE_UPDATE_MESSAGE: '1',
});
function guard(url) {
  const result = spawnSync(process.execPath, ['lib/integration-environment.js'], {
    cwd: root, encoding: 'utf8', timeout: 60000, env: {
      ...baseEnv(), PETALPAL_ENVIRONMENT: 'integration', DATABASE_URL: url,
      FIREBASE_PROJECT_ID: 'petalpal-integration-synthetic',
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: 'service_account', project_id: 'petalpal-integration-synthetic' }),
      CORS_ALLOWED_ORIGINS: 'https://web-integration.example.test', AI_ASYNC_EXECUTION_MODE: 'manual',
      AI_USER_DAILY_CALL_LIMIT: '0', AI_GLOBAL_DAILY_CALL_LIMIT: '0', AI_PROVIDER_DAILY_CALL_LIMIT: '0',
    },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}
function migrate(url) {
  const result = spawnSync('npm', ['exec', '--no', '--', 'prisma', 'migrate', 'deploy'], {
    cwd: root, encoding: 'utf8', timeout: 180000, env: { ...baseEnv(), DATABASE_URL: url },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}
const publicTables = async url => (await sql(url,
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")).map(row => row.tablename);
const markerSchema = async url => (await sql(url,
  "SELECT to_regnamespace('petalpal_environment') IS NOT NULL AS present"))[0].present;

test('fresh database: guard creates the marker outside public; first and repeated migrations succeed', { skip, timeout: 300000 }, async () => {
  const url = await freshDatabase('petalpal_integration_fresh');
  let run = guard(url);
  assert.equal(run.status, 0, run.output); assert.match(run.output, /database marker created/);
  assert.deepEqual(await publicTables(url), []);
  run = migrate(url); assert.equal(run.status, 0, run.output);
  run = guard(url); assert.equal(run.status, 0, run.output); assert.match(run.output, /database marker verified/);
  run = migrate(url); assert.equal(run.status, 0, run.output); assert.match(run.output, /No pending migrations/);
  assert.ok((await publicTables(url)).includes('_prisma_migrations'));
});

test('legacy public marker reproduces P3005, then is moved once and migrations succeed', { skip, timeout: 300000 }, async () => {
  const url = await freshDatabase('petalpal_integration_legacy');
  // Exact layout written by the previous guard during the failed TEST deploy.
  await sql(url, `CREATE TABLE public._petalpal_environment (environment text PRIMARY KEY CHECK (environment = 'integration'),
    created_at timestamptz NOT NULL DEFAULT now())`);
  await sql(url, "INSERT INTO public._petalpal_environment (environment) VALUES ('integration')");
  let run = migrate(url);
  assert.notEqual(run.status, 0); assert.match(run.output, /P3005/);
  run = guard(url); assert.equal(run.status, 0, run.output); assert.match(run.output, /database marker migrated/);
  assert.deepEqual(await publicTables(url), []);
  assert.deepEqual(await sql(url, 'SELECT environment FROM petalpal_environment.marker'), [{ environment: 'integration' }]);
  run = migrate(url); assert.equal(run.status, 0, run.output);
  run = guard(url); assert.equal(run.status, 0, run.output); assert.match(run.output, /database marker verified/);
});

test('populated database without a marker (production-like) is rejected with no write', { skip, timeout: 300000 }, async () => {
  const url = await freshDatabase('petalpal_test_production_like');
  let run = migrate(url); assert.equal(run.status, 0, run.output);
  const before = await publicTables(url);
  run = guard(url);
  assert.equal(run.status, 78); assert.match(run.output, /existing tables but no integration marker/);
  assert.equal(await markerSchema(url), false); assert.deepEqual(await publicTables(url), before);
});

test('legacy marker beside another public table is rejected with no change', { skip, timeout: 120000 }, async () => {
  const url = await freshDatabase('petalpal_integration_crowded');
  await sql(url, "CREATE TABLE public._petalpal_environment (environment text PRIMARY KEY CHECK (environment = 'integration'))");
  await sql(url, "INSERT INTO public._petalpal_environment VALUES ('integration')");
  await sql(url, 'CREATE TABLE public.unrelated (id int)');
  const run = guard(url);
  assert.equal(run.status, 78); assert.match(run.output, /only public table/);
  assert.equal(await markerSchema(url), false);
  assert.deepEqual(await publicTables(url), ['_petalpal_environment', 'unrelated']);
});

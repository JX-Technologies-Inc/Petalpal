import assert from 'node:assert/strict';
import test from 'node:test';
import { assertIntegrationEnvironment, assertIntegrationDatabase } from '../../lib/integration-environment.js';

const valid = () => ({
  PETALPAL_ENVIRONMENT: 'integration', NODE_ENV: 'production',
  FIREBASE_PROJECT_ID: 'petalpal-integration-synthetic',
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: 'service_account', project_id: 'petalpal-integration-synthetic' }),
  DATABASE_URL: 'postgresql://u:p@db.example.test:5432/petalpal_integration',
  CORS_ALLOWED_ORIGINS: 'https://web-integration.example.test,https://petalpal-backend-test.onrender.com',
  RENDER_EXTERNAL_URL: 'https://petalpal-backend-test.onrender.com',
  AI_ASYNC_EXECUTION_MODE: 'manual', AI_USER_DAILY_CALL_LIMIT: '0',
  AI_GLOBAL_DAILY_CALL_LIMIT: '0', AI_PROVIDER_DAILY_CALL_LIMIT: '0'
});
const rejects = (change, pattern) => {
  const env = { ...valid(), ...change };
  for (const [key, value] of Object.entries(change)) if (value === undefined) delete env[key];
  assert.throws(() => assertIntegrationEnvironment(env), pattern);
};

test('integration guard is inactive for production and ordinary environments', () => {
  assert.equal(assertIntegrationEnvironment({ NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'petalpal-b212c' }), false);
  assert.equal(assertIntegrationEnvironment({}), false);
});

test('integration guard accepts a fully isolated configuration', () => {
  assert.equal(assertIntegrationEnvironment(valid()), true);
});

test('integration guard rejects production or ambiguous Firebase configuration', () => {
  rejects({ FIREBASE_PROJECT_ID: undefined }, /FIREBASE_PROJECT_ID/);
  rejects({ FIREBASE_PROJECT_ID: 'petalpal-b212c' }, /FIREBASE_PROJECT_ID/);
  rejects({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'petalpal-b212c' }) }, /service-account project/);
  rejects({ FIREBASE_SERVICE_ACCOUNT_JSON: 'not json' }, /not valid JSON/);
  rejects({ FIREBASE_SERVICE_ACCOUNT_JSON: undefined }, /FIREBASE_SERVICE_ACCOUNT_JSON is required/);
  for (const name of ['FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL', 'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_CONFIG']) {
    rejects({ [name]: 'x' }, new RegExp(name));
  }
});

test('integration guard requires a clearly named test database', () => {
  rejects({ DATABASE_URL: undefined }, /DATABASE_URL/);
  rejects({ DATABASE_URL: 'postgresql://u:p@db.example.test/petalpal' }, /integration or test/);
  rejects({ DATABASE_URL: 'postgresql://u:p@db.example.test/contest' }, /integration or test/);
  rejects({ DEV_DATABASE_URL: 'postgresql://u:p@localhost/petalpal_test' }, /DEV_DATABASE_URL/);
});

test('integration guard rejects production and unsafe browser origins', () => {
  rejects({ CORS_ALLOWED_ORIGINS: undefined }, /CORS_ALLOWED_ORIGINS/);
  for (const origin of ['https://petalpal-v2.onrender.com', 'https://app.jastrevia.com', 'http://web.example.test', 'https://*.example.test']) {
    rejects({ CORS_ALLOWED_ORIGINS: `https://web-integration.example.test,${origin}` }, /CORS_ALLOWED_ORIGINS/);
  }
  rejects({ RENDER_EXTERNAL_URL: 'https://petalpal-v2.onrender.com' }, /production origin/);
  rejects({ CORS_ALLOWED_ORIGINS: 'https://web-integration.example.test' }, /own origin/);
});

test('integration guard keeps AI disconnected and kill-switched', () => {
  rejects({ AI_ASYNC_EXECUTION_MODE: 'cloudflare' }, /manual/);
  rejects({ AI_USER_DAILY_CALL_LIMIT: undefined }, /AI_USER_DAILY_CALL_LIMIT/);
  rejects({ AI_GLOBAL_DAILY_CALL_LIMIT: '10000' }, /AI_GLOBAL_DAILY_CALL_LIMIT/);
  rejects({ AI_PROVIDER_DAILY_CALL_LIMIT: undefined }, /AI_PROVIDER_DAILY_CALL_LIMIT/);
  for (const name of ['CLOUDFLARE_WORKER_AI_URL', 'CLOUDFLARE_WORKER_AI_TOKEN', 'AI_JOB_DISPATCH_URL', 'AI_JOB_DISPATCH_TOKEN', 'AI_JOB_EXECUTOR_TOKEN']) {
    rejects({ [name]: 'x' }, new RegExp(name));
  }
  // Without the explicit TEST budget, a single allowed call is still rejected.
  rejects({ AI_USER_DAILY_CALL_LIMIT: '1' }, /AI_USER_DAILY_CALL_LIMIT must be 0$/);
});

const budgeted = () => ({ ...valid(), PETALPAL_TEST_AI_BUDGET: 'weekly-sonnet-v1',
  AI_USER_DAILY_CALL_LIMIT: '2', AI_GLOBAL_DAILY_CALL_LIMIT: '2', AI_PROVIDER_DAILY_CALL_LIMIT: '2', AI_WEEKLY_REPORT_DAILY_LIMIT: '1',
  AI_WEEKLY_REPORT_PROVIDER: 'anthropic', AI_WEEKLY_REPORT_MODEL: 'claude-sonnet-5-5',
  AI_WEEKLY_REFLECTION_CONTRACT: 'weekly-reflection-v2', CLOUDFLARE_AI_GATEWAY_ID: 'petalpal-integration',
  AI_USER_DAILY_USD_LIMIT: '0.05', AI_USER_MONTHLY_USD_LIMIT: '0.05', AI_GLOBAL_DAILY_USD_LIMIT: '0.05',
  AI_GLOBAL_MONTHLY_USD_LIMIT: '0.05', AI_ANTHROPIC_MONTHLY_USD_LIMIT: '0.05' });
const budgetRejects = (change, pattern) => {
  const env = { ...budgeted(), ...change };
  for (const [key, value] of Object.entries(change)) if (value === undefined) delete env[key];
  assert.throws(() => assertIntegrationEnvironment(env), pattern);
};

test('explicit TEST budget allows exactly one bounded Sonnet Weekly v2 call and nothing else', () => {
  assert.equal(assertIntegrationEnvironment(budgeted()), true);
  assert.equal(assertIntegrationEnvironment({ ...budgeted(), AI_USER_DAILY_CALL_LIMIT: '0' }), true);
  budgetRejects({ PETALPAL_TEST_AI_BUDGET: 'unbounded' }, /PETALPAL_TEST_AI_BUDGET/);
  // One Weekly generation reserves 2 calls; 3 is never allowed, and only one generation per day.
  budgetRejects({ AI_GLOBAL_DAILY_CALL_LIMIT: '3' }, /AI_GLOBAL_DAILY_CALL_LIMIT must be 0, 1 or 2/);
  assert.equal(assertIntegrationEnvironment({ ...budgeted(), AI_USER_DAILY_CALL_LIMIT: '1' }), true);
  for (const daily of [undefined, '0', '2', '4']) budgetRejects({ AI_WEEKLY_REPORT_DAILY_LIMIT: daily }, /AI_WEEKLY_REPORT_DAILY_LIMIT must be 1/);
  budgetRejects({ AI_ASYNC_EXECUTION_MODE: 'cloudflare_queue' }, /manual/);
  budgetRejects({ AI_WEEKLY_REPORT_PROVIDER: undefined }, /only Sonnet Weekly reflection v2/);
  budgetRejects({ AI_WEEKLY_REPORT_MODEL: 'claude-opus-5-5' }, /only Sonnet Weekly reflection v2/);
  budgetRejects({ AI_WEEKLY_REFLECTION_CONTRACT: undefined }, /only Sonnet Weekly reflection v2/);
  budgetRejects({ AI_MONTHLY_REPORT_PROVIDER: 'anthropic' }, /AI_MONTHLY_REPORT_PROVIDER/);
  budgetRejects({ AI_EVENT_EMOTION_PROVIDER: 'anthropic' }, /AI_EVENT_EMOTION_PROVIDER/);
  budgetRejects({ CLOUDFLARE_AI_GATEWAY_ID: 'petalpal-production' }, /TEST Gateway/);
  for (const name of ['AI_USER_DAILY_USD_LIMIT', 'AI_USER_MONTHLY_USD_LIMIT', 'AI_GLOBAL_DAILY_USD_LIMIT',
    'AI_GLOBAL_MONTHLY_USD_LIMIT', 'AI_ANTHROPIC_MONTHLY_USD_LIMIT']) {
    budgetRejects({ [name]: undefined }, new RegExp(name));
    budgetRejects({ [name]: '0.051' }, new RegExp(name));
    budgetRejects({ [name]: '5' }, new RegExp(name));
  }
  for (const name of ['CLOUDFLARE_WORKER_AI_URL', 'AI_JOB_DISPATCH_URL', 'AI_JOB_EXECUTOR_TOKEN']) {
    budgetRejects({ [name]: 'x' }, new RegExp(name));
  }
});

test('integration guard errors never echo configured values', () => {
  const secret = 'do-not-echo-secret-value';
  try { assertIntegrationEnvironment({ ...valid(), FIREBASE_PRIVATE_KEY: secret, DATABASE_URL: `postgresql://u:${secret}@h/prod` }); }
  catch (error) { assert.equal(error.message.includes(secret), false); return; }
  assert.fail('expected rejection');
});

test('misspelled environment flag fails closed', () => {
  assert.throws(() => assertIntegrationEnvironment({ PETALPAL_ENVIRONMENT: 'Integration' }), /exactly/);
});

test('Prisma Postgres direct URLs are accepted without a name token; pooled and Accelerate URLs are rejected', () => {
  const direct = 'postgres://synthetic-id:synthetic-key@db.prisma.io:5432/postgres?sslmode=require';
  assert.equal(assertIntegrationEnvironment({ ...valid(), DATABASE_URL: direct }), true);
  assert.equal(assertIntegrationEnvironment({ ...valid(), DATABASE_URL: direct.replace('/postgres?', '/?') }), true);
  rejects({ DATABASE_URL: direct.replace('db.prisma.io', 'pooled.db.prisma.io') }, /direct Prisma Postgres/);
  rejects({ DATABASE_URL: 'prisma+postgres://accelerate.prisma-data.net/?api_key=synthetic' }, /Accelerate/);
  rejects({ DATABASE_URL: direct.replace('?sslmode=require', '') }, /sslmode=require/);
  rejects({ DATABASE_URL: direct.replace('/postgres?', '/other?') }, /unexpected Prisma Postgres database path/);
});

function fakeDatabase({ hasMarker = false, hasLegacy = false, hasSchema = false, tables = 0, rows = [{ environment: 'integration' }], failAt = null } = {}) {
  const sql = [];
  const query = async text => {
    const statement = text.replace(/\s+/g, ' ').trim();
    sql.push(statement);
    if (statement.includes('to_regclass')) return [{ hasMarker, hasLegacy, hasSchema, tables }];
    if (statement.startsWith('SELECT environment')) return rows;
    if (failAt && statement.startsWith(failAt)) throw Object.assign(Error('synthetic'), { code: '42501' });
    return [];
  };
  const writes = () => sql.filter(statement => !statement.startsWith('SELECT'));
  return { sql, query, writes };
}

test('database marker: a new empty database gets the marker in its own schema, never in public', async () => {
  const db = fakeDatabase();
  assert.equal(await assertIntegrationDatabase(db.query), 'created');
  assert.deepEqual(db.writes().map(s => s.split(' ').slice(0, 3).join(' ')),
    ['BEGIN', 'CREATE SCHEMA petalpal_environment', 'CREATE TABLE petalpal_environment.marker', 'INSERT INTO petalpal_environment.marker', 'COMMIT']);
  assert.ok(db.writes().every(s => !/\bpublic\./.test(s)));
});

test('database marker: repeated startup after migrations verifies the marker with no writes', async () => {
  const db = fakeDatabase({ hasMarker: true, hasSchema: true, tables: 30 });
  assert.equal(await assertIntegrationDatabase(db.query), 'verified');
  assert.deepEqual(db.writes(), []);
  assert.ok(db.sql.some(s => s === 'SELECT environment FROM petalpal_environment.marker'));
});

test('database marker: the legacy public marker is verified and moved out of public once', async () => {
  const db = fakeDatabase({ hasLegacy: true, tables: 1 });
  assert.equal(await assertIntegrationDatabase(db.query), 'migrated');
  assert.ok(db.sql.includes('SELECT environment FROM public._petalpal_environment'));
  assert.deepEqual(db.writes(), ['BEGIN', 'CREATE SCHEMA petalpal_environment',
    'ALTER TABLE public._petalpal_environment SET SCHEMA petalpal_environment',
    'ALTER TABLE petalpal_environment._petalpal_environment RENAME TO marker', 'COMMIT']);
  for (const rows of [[], [{ environment: 'production' }]]) {
    const bad = fakeDatabase({ hasLegacy: true, tables: 1, rows });
    await assert.rejects(assertIntegrationDatabase(bad.query), /marker is not integration/); assert.deepEqual(bad.writes(), []);
  }
  const crowded = fakeDatabase({ hasLegacy: true, tables: 2 });
  await assert.rejects(assertIntegrationDatabase(crowded.query), /only public table/); assert.deepEqual(crowded.writes(), []);
});

test('database marker: a populated database without a marker (e.g. production) is rejected with no writes', async () => {
  const db = fakeDatabase({ tables: 25 });
  await assert.rejects(assertIntegrationDatabase(db.query), /existing tables but no integration marker/);
  assert.equal(db.sql.length, 1); assert.deepEqual(db.writes(), []);
});

test('database marker: inconsistent marker state is rejected and failed writes roll back', async () => {
  for (const rows of [[], [{ environment: 'production' }], [{ environment: 'integration' }, { environment: 'integration' }]]) {
    await assert.rejects(assertIntegrationDatabase(fakeDatabase({ hasMarker: true, hasSchema: true, rows }).query), /marker is not integration/);
  }
  await assert.rejects(assertIntegrationDatabase(fakeDatabase({ hasMarker: true, hasSchema: true, hasLegacy: true }).query), /legacy marker present/);
  await assert.rejects(assertIntegrationDatabase(fakeDatabase({ hasSchema: true }).query), /schema exists without a marker/);
  for (const [state, failAt] of [[{}, 'INSERT'], [{ hasLegacy: true, tables: 1 }, 'ALTER TABLE petalpal_environment']]) {
    const db = fakeDatabase({ ...state, failAt });
    await assert.rejects(assertIntegrationDatabase(db.query), /synthetic/);
    assert.equal(db.sql.at(-1), 'ROLLBACK');
  }
});

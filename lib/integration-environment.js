import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Opt-in guard for the isolated backend-only integration service. It is a no-op
// unless PETALPAL_ENVIRONMENT=integration, so production behavior is unchanged.
// It runs BEFORE `prisma migrate deploy` via the service's start command
// (`node lib/integration-environment.js && npm start`) and again in server.js.
// Production identifiers below are public names, never credentials.
export const PRODUCTION_FIREBASE_PROJECT = 'petalpal-b212c';
export const PRODUCTION_ORIGINS = new Set([
  'https://petalpal-v2.onrender.com', 'https://jastrevia.com',
  'https://www.jastrevia.com', 'https://app.jastrevia.com'
]);
// Variables that would connect the service to production AI or job execution.
const FORBIDDEN_AI_VARIABLES = [
  'CLOUDFLARE_WORKER_AI_URL', 'CLOUDFLARE_WORKER_AI_TOKEN', 'AI_JOB_DISPATCH_URL',
  'AI_JOB_DISPATCH_TOKEN', 'AI_JOB_EXECUTOR_TOKEN'
];

// Direct host only: this service runs `prisma migrate deploy` with DATABASE_URL,
// and Prisma documents the direct (not pooled) string for migrations.
export const PRISMA_POSTGRES_HOSTS = new Set(['db.prisma.io']);
// Marker lives outside Prisma's `public` schema; the legacy name is migrated once.
export const MARKER_SCHEMA = 'petalpal_environment';
export const LEGACY_MARKER_TABLE = '_petalpal_environment';

function fail(reason) {
  // Reasons name the variable only; values are never included.
  throw new Error(`Integration environment isolation cannot be confirmed: ${reason}`);
}

export function assertIntegrationEnvironment(env = process.env) {
  if (env.PETALPAL_ENVIRONMENT === undefined) return false;
  if (env.PETALPAL_ENVIRONMENT !== 'integration') fail('PETALPAL_ENVIRONMENT must be exactly "integration"');
  if (env.NODE_ENV !== 'production') fail('NODE_ENV must be production');
  // Firebase: explicit non-production project; no ambient credential routes.
  const project = env.FIREBASE_PROJECT_ID;
  if (!project || project === PRODUCTION_FIREBASE_PROJECT) fail('FIREBASE_PROJECT_ID must be an explicit non-production project');
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) fail('FIREBASE_SERVICE_ACCOUNT_JSON is required');
  for (const name of ['FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_CONFIG', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (env[name]) fail(`${name} must be unset`);
  }
  try {
    const credential = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (credential.project_id !== project) fail('service-account project must match FIREBASE_PROJECT_ID');
  } catch (error) {
    if (String(error?.message).startsWith('Integration environment')) throw error;
    fail('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
  // PostgreSQL. Prisma Postgres URLs never carry the console database name
  // (path is `/postgres` or empty) and production also uses Prisma Postgres, so
  // for those hosts identity is proven by the separate-schema marker checked by
  // assertIntegrationDatabase() before migrations. Other hosts keep the name rule.
  let database;
  try { database = new URL(env.DATABASE_URL); } catch { fail('DATABASE_URL must be a PostgreSQL URL'); }
  if (database.protocol === 'prisma+postgres:') fail('DATABASE_URL must be the direct postgres:// URL, not an Accelerate URL');
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) fail('DATABASE_URL must be a PostgreSQL URL');
  const name = decodeURIComponent(database.pathname.slice(1)).toLowerCase();
  const host = database.hostname.toLowerCase();
  if (host === 'pooled.db.prisma.io') fail('DATABASE_URL must be the direct Prisma Postgres connection string');
  if (PRISMA_POSTGRES_HOSTS.has(host)) {
    if (!['', 'postgres'].includes(name)) fail('DATABASE_URL has an unexpected Prisma Postgres database path');
    if (database.searchParams.get('sslmode') !== 'require') fail('DATABASE_URL must use sslmode=require');
  } else if (!/(?:^|[_-])(integration|test)(?:$|[_-])/.test(name)) {
    fail('DATABASE_URL database name must contain an integration or test token');
  }
  if (env.DEV_DATABASE_URL) fail('DEV_DATABASE_URL must be unset');
  // REST/Socket: exact explicit HTTPS origins, never a production origin.
  const origins = String(env.CORS_ALLOWED_ORIGINS || '').split(',').map(item => item.trim()).filter(Boolean);
  if (!origins.length) fail('CORS_ALLOWED_ORIGINS must list the exact integration origins');
  for (const origin of origins) {
    if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin) || PRODUCTION_ORIGINS.has(origin.toLowerCase())) {
      fail('CORS_ALLOWED_ORIGINS must contain only non-production HTTPS origins');
    }
  }
  if (env.RENDER_EXTERNAL_URL) {
    const own = env.RENDER_EXTERNAL_URL.replace(/\/$/, '').toLowerCase();
    if (PRODUCTION_ORIGINS.has(own)) fail('this service must not be the production origin');
    if (!origins.some(origin => origin.toLowerCase() === own)) fail('CORS_ALLOWED_ORIGINS must include the service own origin');
  }
  // AI: manual mode, kill-switched budgets, no production Worker/job credentials.
  if ((env.AI_ASYNC_EXECUTION_MODE || 'manual') !== 'manual') fail('AI_ASYNC_EXECUTION_MODE must be manual');
  for (const limit of ['AI_USER_DAILY_CALL_LIMIT', 'AI_GLOBAL_DAILY_CALL_LIMIT', 'AI_PROVIDER_DAILY_CALL_LIMIT']) {
    if (env[limit] !== '0') fail(`${limit} must be 0`);
  }
  for (const variable of FORBIDDEN_AI_VARIABLES) if (env[variable]) fail(`${variable} must be unset`);
  return true;
}

// Pre-migration database identity check (runs only from the CLI entry below,
// before `prisma migrate deploy`). The integration database carries a one-row
// marker in its own schema, `petalpal_environment.marker`. Prisma's P3005
// emptiness check lists only ordinary tables in the connection schema (`public`;
// no `schemas` are configured), so this schema never blocks the first migration.
// - New database (no public tables, no marker): marker created in one transaction.
// - Legacy marker `public._petalpal_environment` (written by the 2026-10-09 guard)
//   that is the ONLY public table: verified, then moved into the marker schema in
//   one transaction so `public` is empty again. No other table is touched.
// - Any database with public tables and no marker (for example production) is
//   rejected after read-only catalog queries, with no write.
// `query` is injectable for tests.
export async function assertIntegrationDatabase(query) {
  const [state] = await query(`SELECT to_regclass('${MARKER_SCHEMA}.marker') IS NOT NULL AS "hasMarker",
    to_regclass('public.${LEGACY_MARKER_TABLE}') IS NOT NULL AS "hasLegacy",
    to_regnamespace('${MARKER_SCHEMA}') IS NOT NULL AS "hasSchema",
    (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public')::int AS "tables"`);
  const verifyRows = async table => {
    const rows = await query(`SELECT environment FROM ${table}`);
    if (rows.length !== 1 || rows[0].environment !== 'integration') fail('database marker is not integration');
  };
  if (state?.hasMarker === true) {
    if (state.hasLegacy) fail('legacy marker present alongside the marker schema');
    await verifyRows(`${MARKER_SCHEMA}.marker`);
    return 'verified';
  }
  if (state?.hasSchema) fail('marker schema exists without a marker');
  let statements;
  let outcome;
  if (state?.hasLegacy === true) {
    if (state.tables !== 1) fail('legacy marker is not the only public table');
    await verifyRows(`public.${LEGACY_MARKER_TABLE}`);
    statements = [`CREATE SCHEMA ${MARKER_SCHEMA}`,
      `ALTER TABLE public.${LEGACY_MARKER_TABLE} SET SCHEMA ${MARKER_SCHEMA}`,
      `ALTER TABLE ${MARKER_SCHEMA}.${LEGACY_MARKER_TABLE} RENAME TO marker`];
    outcome = 'migrated';
  } else {
    if (state?.tables !== 0) fail('database has existing tables but no integration marker');
    statements = [`CREATE SCHEMA ${MARKER_SCHEMA}`,
      `CREATE TABLE ${MARKER_SCHEMA}.marker (environment text PRIMARY KEY CHECK (environment = 'integration'),
      created_at timestamptz NOT NULL DEFAULT now())`,
      `INSERT INTO ${MARKER_SCHEMA}.marker (environment) VALUES ('integration')`];
    outcome = 'created';
  }
  await query('BEGIN');
  try {
    for (const statement of statements) await query(statement);
    await query('COMMIT');
  } catch (error) {
    await query('ROLLBACK').catch(() => {});
    throw error;
  }
  return outcome;
}

async function checkDatabase(env) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  await client.connect();
  try { return await assertIntegrationDatabase(async (text) => (await client.query(text)).rows); }
  finally { await client.end().catch(() => {}); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const active = assertIntegrationEnvironment();
    if (!active) {
      console.error('Integration guard inactive');
      process.exitCode = 78; // Fail the start command if used without the flag.
    } else {
      const marker = await checkDatabase(process.env);
      console.log(`Integration environment isolation PASS (database marker ${marker})`);
    }
  } catch (error) {
    // Only guard reasons or a driver error code; never URLs, hosts or values.
    console.error(String(error?.message).startsWith('Integration environment')
      ? error.message : `Integration database check failed (${error?.code || 'unknown error'})`);
    process.exitCode = 78;
  }
}

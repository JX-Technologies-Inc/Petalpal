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
  // PostgreSQL: must be a clearly named integration/test database.
  let database;
  try { database = new URL(env.DATABASE_URL); } catch { fail('DATABASE_URL must be a PostgreSQL URL'); }
  const name = decodeURIComponent(database.pathname.slice(1)).toLowerCase();
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !/(?:^|[_-])(integration|test)(?:$|[_-])/.test(name)) {
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const active = assertIntegrationEnvironment();
    console.log(active ? 'Integration environment isolation PASS' : 'Integration guard inactive');
    if (!active) process.exitCode = 78; // Fail the start command if used without the flag.
  } catch (error) {
    console.error(error.message);
    process.exitCode = 78;
  }
}

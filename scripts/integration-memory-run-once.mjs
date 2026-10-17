// Owner-run, one-shot execution of ONE TEST owner's PENDING MEMORY_EXTRACTION jobs.
// The TEST backend runs AI in manual mode, so these deterministic jobs (no provider
// call) never execute there; Weekly zh-Hans evidence needs the resulting EventMemory.
// Fails closed before any database connection unless every precondition holds, then
// verifies the integration database marker read-only before importing Prisma.
// Only MEMORY_EXTRACTION jobs of OWNER_ID are claimed (claimById is owner/type scoped);
// the EMBEDDING_GENERATION jobs they enqueue stay PENDING. Never prints DATABASE_URL,
// owner data or Event content; output is counts and job statuses only.
//   AUTHORIZATION_PHRASE=RUN-TEST-MEMORY-JOBS-ONCE OWNER_ID=<TEST owner id> \
//   DATABASE_URL=<TEST direct URL, entered by the owner> node scripts/integration-memory-run-once.mjs
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const MEMORY_RUN_PHRASE = 'RUN-TEST-MEMORY-JOBS-ONCE';
export const MAX_JOBS = 10;
// Provider or dispatch credentials have no role here; their presence means the wrong shell.
const PROVIDER_VARIABLES = ['CLOUDFLARE_WORKER_AI_URL', 'CLOUDFLARE_WORKER_AI_TOKEN', 'CLOUDFLARE_AI_GATEWAY_TOKEN',
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'CLOUDFLARE_API_TOKEN', 'AI_JOB_DISPATCH_URL', 'AI_JOB_DISPATCH_TOKEN', 'AI_JOB_EXECUTOR_TOKEN'];

export function memoryRunPreflight(env) {
  if (env.AUTHORIZATION_PHRASE !== MEMORY_RUN_PHRASE) return 'authorization phrase missing';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(env.OWNER_ID || '')) return 'OWNER_ID must be the TEST owner id';
  if (env.DEV_DATABASE_URL) return 'DEV_DATABASE_URL must be unset';
  for (const name of PROVIDER_VARIABLES) if (env[name]) return `${name} must be unset`;
  let database;
  try { database = new URL(env.DATABASE_URL); } catch { return 'DATABASE_URL must be the TEST PostgreSQL URL'; }
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) return 'DATABASE_URL must be the direct TEST PostgreSQL URL';
  return null;
}

// Read-only: unlike the startup guard, this never creates or migrates a marker.
export async function verifyIntegrationMarker(query) {
  const [state] = await query(`SELECT to_regclass('petalpal_environment.marker') IS NOT NULL AS "hasMarker"`);
  if (state?.hasMarker !== true) return false;
  const rows = await query('SELECT environment FROM petalpal_environment.marker');
  return rows.length === 1 && rows[0].environment === 'integration';
}

async function main(env) {
  const blocked = memoryRunPreflight(env);
  if (blocked) { console.log(`STOP: ${blocked}; nothing was connected`); return 2; }
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  await client.connect();
  let jobIds;
  try {
    if (!await verifyIntegrationMarker(async text => (await client.query(text)).rows)) {
      console.log('STOP: database is not the marked integration database; no writes'); return 2;
    }
    jobIds = (await client.query(`SELECT "id" FROM "AIJob" WHERE "ownerId" = $1 AND "jobType" = 'MEMORY_EXTRACTION'
      AND "status" = 'PENDING' ORDER BY "createdAt" LIMIT ${MAX_JOBS + 1}`, [env.OWNER_ID])).rows.map(row => row.id);
  } finally { await client.end().catch(() => {}); }
  if (jobIds.length > MAX_JOBS) { console.log(`STOP: more than ${MAX_JOBS} pending memory jobs; review before running`); return 2; }
  if (!jobIds.length) { console.log('No pending MEMORY_EXTRACTION jobs for this owner'); return 0; }

  // Production-mode Prisma reads DATABASE_URL only; .env is never loaded.
  process.env.NODE_ENV = 'production';
  process.env.DOTENV_CONFIG_PATH = '/dev/null';
  const { default: prisma } = await import('../lib/prisma.js');
  const { createProductionAiWorker } = await import('../lib/ai-worker.js');
  const { AI_JOB_TYPES } = await import('../lib/ai-jobs.js');
  const worker = createProductionAiWorker({ prisma, reportNarrativeProvider: null, workerId: 'test-memory-run-once' });
  const outcomes = {};
  try {
    for (const jobId of jobIds) {
      const result = await worker.runJob({ jobId, ownerId: env.OWNER_ID, jobType: AI_JOB_TYPES.MEMORY_EXTRACTION });
      const status = (await prisma.aiJob.findFirst({ where: { id: jobId, ownerId: env.OWNER_ID }, select: { status: true } }))?.status;
      const key = result.claimed ? status : 'NOT_CLAIMED';
      outcomes[key] = (outcomes[key] || 0) + 1;
    }
  } finally { await prisma.$disconnect(); }
  console.log(`Memory jobs: ${JSON.stringify(outcomes)}; provider calls 0`);
  return outcomes.SUCCEEDED === jobIds.length ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(process.env); }
  catch (error) { console.log(`FAILED (${error?.code || 'unknown error'})`); process.exitCode = 1; }
}

// Owner-run, read-only preflight before scripts/integration-memory-run-once.mjs.
// One READ ONLY transaction of SELECTs, always rolled back: no writes, migrations,
// job execution or provider calls. Prints booleans, counts, local dates and the
// owner timezone and week keys only (incl. EventMemory checks); never DATABASE_URL,
// the owner id or Event or memory content.
//   env -i PATH="$PATH" HOME="$HOME" OWNER_ID=<TEST owner id> \
//   DATABASE_URL=<TEST direct URL, entered by the owner> node scripts/integration-memory-preflight.mjs
import pg from 'pg';
import { weeklyPeriodForLocalDate } from '../lib/ai-periods.js';
import { weeklyReportLocale } from '../lib/report-locale.js';

const { DATABASE_URL: url, OWNER_ID: owner } = process.env;
if (!url || !/^[A-Za-z0-9_-]{1,64}$/.test(owner || '')) {
  console.log('STOP: DATABASE_URL and OWNER_ID are required; nothing was connected');
  process.exit(2);
}
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15000 });
const out = {};
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const q = async (text, params) => (await client.query(text, params)).rows;
  // PostgreSQL itself rejects any write in this transaction.
  out.readOnlyTransaction = (await q('SHOW transaction_read_only'))[0].transaction_read_only === 'on';
  if (!out.readOnlyTransaction) throw Object.assign(new Error('transaction is not read-only'), { stop: true });
  const [{ has }] = await q(`SELECT to_regclass('petalpal_environment.marker') IS NOT NULL AS has`);
  const marker = has ? await q('SELECT * FROM petalpal_environment.marker') : [];
  out.integrationMarker = marker.length === 1 && marker[0].environment === 'integration';
  if (!out.integrationMarker) throw Object.assign(new Error('not the marked integration database'), { stop: true });
  out.markerCreatedDate = marker[0].created_at ? new Date(marker[0].created_at).toISOString().slice(0, 10) : null;
  const [user] = await q('SELECT timezone, "preferredLocale" FROM "User" WHERE id = $1', [owner]);
  out.ownerPresent = Boolean(user);
  out.ownerTimezone = user?.timezone ?? null;
  // Weekly language the Sonnet path would use (en needs embeddings; zh-Hans does not).
  out.ownerWeeklyLocale = user ? (() => { try { return weeklyReportLocale(user.preferredLocale); } catch { return 'UNSUPPORTED'; } })() : null;
  out.totalUsers = (await q('SELECT count(*)::int AS n FROM "User"'))[0].n;
  const [consent] = await q('SELECT "aiProcessing", "personalization", "memoryEnabled" FROM "AiConsent" WHERE "userId" = $1', [owner]);
  out.ownerMemoryConsent = Boolean(consent?.aiProcessing && consent?.personalization && consent?.memoryEnabled);
  out.ownerJobs = await q(`SELECT "jobType"::text AS type, status::text AS status, count(*)::int AS n
    FROM "AIJob" WHERE "ownerId" = $1 GROUP BY 1, 2 ORDER BY 1, 2`, [owner]);
  out.pendingMemoryJobsAllOwners = (await q(`SELECT count(*)::int AS n FROM "AIJob"
    WHERE "jobType" = 'MEMORY_EXTRACTION' AND status = 'PENDING'`))[0].n;
  // Local dates (not content) of the Events behind this owner's pending memory jobs.
  out.pendingJobEventLocalDates = (await q(`SELECT e."localDate" AS d, e."memoryProcessingAllowed" AS allowed
    FROM "AIJob" j JOIN "Event" e ON e.id = j."eventId" AND e."ownerId" = j."ownerId"
    WHERE j."ownerId" = $1 AND j."jobType" = 'MEMORY_EXTRACTION' AND j.status = 'PENDING' ORDER BY e."occurredAt"`, [owner]))
    .map(row => `${row.d}${row.allowed ? '' : ' (memory not allowed)'}`);
  out.ownerWeeklyJobs = (await q(`SELECT count(*)::int AS n FROM "AIJob" WHERE "ownerId" = $1 AND "jobType" = 'WEEKLY_REPORT'`, [owner]))[0].n;
  // EventMemory checks after the memory run: counts, booleans and week keys only.
  const memories = await q(`SELECT m."memoryType" AS type, (e.id IS NOT NULL) AS "sourceOwned",
      (e."occurredAt" = m."eventDate") AS "dateMatches", e."localDate" AS "localDate", e."memoryProcessingAllowed" AS allowed
    FROM "EventMemory" m LEFT JOIN "Event" e ON e.id = m."sourceEventId" AND e."ownerId" = m."ownerId"
    WHERE m."ownerId" = $1`, [owner]);
  out.ownerMemories = memories.length;
  out.memoryTypes = [...new Set(memories.map(row => row.type))].sort();
  out.memoriesWithOwnedSourceEvent = memories.filter(row => row.sourceOwned).length;
  out.memoriesDatedAtEventOccurrence = memories.filter(row => row.dateMatches).length;
  out.memoriesFromConsentedEvents = memories.filter(row => row.allowed).length;
  out.memoryWeekKeys = user ? [...new Set(memories.filter(row => row.localDate)
    .map(row => weeklyPeriodForLocalDate(row.localDate, user.timezone).periodKey))].sort() : [];
  out.succeededMemoryJobsWithoutMemory = (await q(`SELECT count(*)::int AS n FROM "AIJob" j
    WHERE j."ownerId" = $1 AND j."jobType" = 'MEMORY_EXTRACTION' AND j.status = 'SUCCEEDED'
      AND NOT EXISTS (SELECT 1 FROM "EventMemory" m WHERE m."ownerId" = j."ownerId" AND m."sourceEventId" = j."eventId")`, [owner]))[0].n;
  console.log(JSON.stringify(out, null, 1));
} catch (error) {
  console.log(error.stop ? `STOP: ${error.message}; no writes` : `FAILED (${error?.code || 'unknown error'})`);
  process.exitCode = 2;
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end().catch(() => {});
}

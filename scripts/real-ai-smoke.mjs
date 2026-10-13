// Manual-only real provider smoke. No Firebase verifier, emotion, embedding or
// narrative mocks. Weekly-only mode explicitly uses seeded fixtures/retrieval.
// Synthetic Auth Emulator identities; existing app/worker paths.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
// Diagnostics expose fixed codes/enums and booleans only; never exception text.
const ASSERTION_IDS = new Set([
  'AUTH_NOT_ISOLATED', 'CALL_COUNTS_FAILED', 'CALL_LIMIT_OR_RETRY_BLOCKED',
  'CONSENT_FAILED', 'CROSS_OWNER_EVENT_LEAK', 'CROSS_OWNER_REPORT_LEAK',
  'DB_NOT_EMPTY_AND_ISOLATED', 'DB_TARGET_REJECTED', 'EMULATOR_SIGN_IN_FAILED',
  'EVENT_DATE_OR_OWNER_FAILED', 'EVENT_OR_REAL_EMOTION_FAILED', 'EXPECTED_FIVE_JOBS',
  'FALLBACK_NARRATIVE_PRESENT', 'IMPORTANT_EVIDENCE_MISSING', 'JOURNAL_EXCLUSION_FAILED',
  'JOURNAL_PIPELINE_LEAK', 'MEMORY_COUNT_FAILED', 'MEMORY_OR_EMBEDDING_JOB_FAILED',
  'MISSING_AUTH_ACCEPTED', 'MISSING_CONSENT_ACCEPTED', 'MISSING_TEST_PROVIDER_AUTH',
  'MONTHLY_FAILED', 'NARRATIVE_OR_FALLBACK_FAILED', 'NETWORK_TARGET_DENIED',
  'PROVIDER_NOT_DEDICATED_TEST_WORKER', 'PROVIDER_INPUT_REJECTED', 'PROVIDER_ROUTE_DENIED', 'REAL_SEMANTIC_RANKING_OR_OWNER_FAILED',
  'REAL_VECTOR_PROVENANCE_FAILED', 'REPORT_BOUNDARY_FAILED', 'REPORT_COUNTS_FAILED',
  'REPORT_EVIDENCE_LEAK', 'RETRIEVAL_SOURCE_LEAK', 'RUN_NOT_APPROVED',
  'SIMULATED_TIME_GATE_DENIED', 'TEST_WORKER_BOUNDS_MISMATCH', 'TEST_WORKER_PREFLIGHT_FAILED',
  'UNEXPECTED_HOSTED_CONFIGURATION', 'WEEKLY_FAILED',
]);
const safeEnum = (value, allowed) => allowed.includes(value) ? value : 'UNKNOWN';
export function createSmokeDiagnostics() {
  const data = { failedAssertion: null, weekly: [] };
  return { data, check(value, label) {
    if (value) return;
    data.failedAssertion ??= ASSERTION_IDS.has(label) ? label : 'UNCLASSIFIED_FAILURE';
    throw new Error('SMOKE_ASSERTION_FAILED');
  } };
}
export function recordWeeklyApi(diagnostic, response) {
  diagnostic.httpStatus = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
  diagnostic.execution = safeEnum(response.body?.execution, ['COMPLETED', 'FAILED', 'ALREADY_RUNNING_OR_FINALIZED', 'ALREADY_FINALIZED', 'QUEUED', 'PENDING_DISPATCH']);
  const code = response.body?.errorCode;
  diagnostic.errorCode = code == null ? null : safeEnum(code, [
    'REPORT_NARRATIVE_TIMEOUT', 'REPORT_NARRATIVE_INVALID_OUTPUT', 'REPORT_NARRATIVE_GROUNDING_FAILED',
    'REPORT_NARRATIVE_PROVIDER_NOT_CONFIGURED', 'AI_QUOTA_EXCEEDED', 'AI_INFERENCE_ALREADY_RESERVED',
    'AI_BUDGET_UNAVAILABLE', 'AI_FORBIDDEN', 'WEEKLY_REPORT_JOB_FAILED'
  ]);
  if (code === 'REPORT_NARRATIVE_PROVIDER_FAILED') diagnostic.errorCode = 'PROVIDER_ERROR_UNCLASSIFIED';
}
export function weeklyReportSnapshot(report, edges, { spec, period, ownerId, allowed, memories, narrativeAttempts }) {
  const iso = value => value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
  return {
    reportReadStatus: 'READ', persisted: report !== null,
    reportStatus: report ? safeEnum(report.status, ['COMPLETE', 'PARTIAL']) : null,
    narrativeStatus: report ? safeEnum(report.narrativeStatus, ['NOT_GENERATED', 'GENERATED', 'INSUFFICIENT_EVIDENCE']) : null,
    eventCountsMatch: report ? report.eventCount === spec.count && report.trendSignals?.previousEventCount === spec.previous &&
      report.trendSignals?.eventCountChange === spec.count - spec.previous : null,
    periodBoundariesMatch: report ? iso(report.periodStartUtc) === period.startUtc && iso(report.periodEndUtc) === period.endUtc : null,
    evidenceOwnershipValid: report ? edges.every(e => e.ownerId === ownerId && allowed.includes(e.sourceEventId) &&
      memories.some(m => m.id === e.sourceMemoryId && m.sourceEventId === e.sourceEventId && m.ownerId === e.ownerId)) : null,
    evidenceCoverageValid: report ? new Set(edges.map(e => e.sourceEventId)).size === allowed.length : null,
    // Mirrors the runner's acceptance check; does not certify prose truth/quality.
    narrativeValid: report ? report.narrativeStatus === (spec.generated ? 'GENERATED' : 'INSUFFICIENT_EVIDENCE') &&
      narrativeAttempts === Number(spec.generated) : null
  };
}
export async function withWeeklyDiagnostics(diagnostic, action, inspect) {
  try { return await action(); }
  finally {
    try { Object.assign(diagnostic, await inspect()); }
    catch { diagnostic.reportReadStatus = 'UNAVAILABLE'; }
  }
}

export async function runSmoke({ weeklyOnly = false } = {}) {

const manifest = JSON.parse(fs.readFileSync(new URL('../test/fixtures/ai-e2e-manifest.json', import.meta.url), 'utf8'));
const fixtureRefs = ['a04', 'a05', 'a06', 'a08', 'b01'];
const fixtures = fixtureRefs.map(ref => manifest.events.find(event => event.ref === ref));
assert.equal(fixtures.filter(e => e.owner === 'A' && e.membership.includes('M-2026-10')).length, 3);
assert.equal(fixtures.filter(e => e.owner === 'A' && e.membership.includes('W-2026-10-05')).length, 2);
assert.ok(fixtures.every(e => e.content.length < 600));
if (process.argv.includes('--check-plan')) {
  console.log(weeklyOnly ? 'Plan: fixture retrieval; 0 emotion + 0 BGE + 1 narrative request; no inference performed.' : 'Plan: 5 Events; 5 emotion + 9 BGE + 2 narrative requests; no inference performed.');
  process.exit(0);
}
const evidence = { sourceSha: process.env.GITHUB_SHA, status: 'NOT_TESTED', stage: 'preflight',
  calls: { emotion: 0, embedding: 0, narrative: 0 }, events: [], retrieval: [], reports: [],
  quality: 'NOT REVIEWED: citation validity does not prove factual grounding or coverage' };
// Do not emit raw SDK/server/provider exceptions or Auth Emulator identities.
const print = console.log.bind(console);
for (const key of ['log', 'info', 'warn', 'error', 'debug']) console[key] = () => {};
let prisma, server;
const nativeFetch = globalThis.fetch;
const { data: diagnostics, check } = createSmokeDiagnostics();
evidence.diagnostics = diagnostics;
let appOrigin;
if (weeklyOnly) evidence.mode = 'WEEKLY_ONLY_FIXTURE_RETRIEVAL';
try {
  check(process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_RUN_ATTEMPT === '1' &&
    process.env.NODE_ENV === 'test' && process.env.PETALPAL_REAL_AI_APPROVED === '1', 'RUN_NOT_APPROVED');
  if (weeklyOnly) check(process.env.PETALPAL_WEEKLY_ONLY_APPROVED === 'APPROVE-1-WEEKLY-LLM-CALL' &&
    process.env.GITHUB_REF === 'refs/heads/test/real-ai-smoke', 'RUN_NOT_APPROVED');
  check(process.env.FIREBASE_PROJECT_ID === 'demo-petalpal-real-ai' &&
    process.env.FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:9099', 'AUTH_NOT_ISOLATED');
  for (const key of ['DATABASE_URL', 'PETALPAL_ENVIRONMENT', 'RENDER', 'RENDER_SERVICE_ID', 'RENDER_EXTERNAL_URL',
    'NATIVE_SECURITY_TEST', 'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL',
    'AI_JOB_EXECUTOR_URL', 'AI_JOB_EXECUTOR_TOKEN', 'AI_JOB_DISPATCH_TOKEN']) check(process.env[key] === undefined, 'UNEXPECTED_HOSTED_CONFIGURATION');
  const provider = new URL(process.env.CLOUDFLARE_WORKER_AI_URL);
  check(provider.protocol === 'https:' && /^petalpal-real-ai-smoke\.[a-z0-9-]+\.workers\.dev$/.test(provider.hostname) &&
    provider.pathname === '/' && !provider.search && !provider.username && !provider.password && !provider.port,
  'PROVIDER_NOT_DEDICATED_TEST_WORKER');
  check(Boolean(process.env.CLOUDFLARE_WORKER_AI_TOKEN), 'MISSING_TEST_PROVIDER_AUTH');
  const caps = { '/v1/event-emotion': ['emotion', 5, 1000], '/v1/embedding': ['embedding', 9, 3000],
    '/v1/report-narrative': ['narrative', 2, 24000] };
  const sent = new Set();
  const journalDecoy = 'JOURNAL_DECOY_ONLY: I won a lunar sculpture award. Never use this in an AI report.';
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.origin === provider.origin) {
      const rule = caps[url.pathname];
      check(rule && options.method === 'POST', 'PROVIDER_ROUTE_DENIED');
      const [kind, limit, bytes] = rule;
      const body = String(options.body || '');
      check(Buffer.byteLength(body) <= bytes && !body.includes('JOURNAL_DECOY_ONLY'), 'PROVIDER_INPUT_REJECTED');
      const operation = `${evidence.stage}:${url.pathname}:${body}`;
      check(evidence.calls[kind] < limit && !sent.has(operation), 'CALL_LIMIT_OR_RETRY_BLOCKED');
      sent.add(operation);
      evidence.calls[kind] += 1; // Failed/ambiguous attempts are never refunded.
      return nativeFetch(input, { ...options, redirect: 'error' });
    }
    check(url.origin === appOrigin || url.origin === 'http://127.0.0.1:9099', 'NETWORK_TARGET_DENIED');
    return nativeFetch(input, { ...options, redirect: 'error' });
  };
  if (weeklyOnly) {
    const { weeklyOnlyFetch } = await import('./real-ai-weekly-only.mjs');
    evidence.providerAttempt = { httpStatus: null, category: 'NOT_ATTEMPTED' };
    globalThis.fetch = weeklyOnlyFetch({ providerOrigin: provider.origin, appOrigin: () => appOrigin,
      fetchImpl: nativeFetch, calls: evidence.calls, check, diagnostic: evidence.providerAttempt });
  }
  const infoResponse = await nativeFetch(`${provider.origin}/smoke-info`, { redirect: 'error',
    signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_WORKER_AI_TOKEN}` } });
  check(infoResponse.ok, 'TEST_WORKER_PREFLIGHT_FAILED');
  const info = await infoResponse.json();
  check(info.smokeOnly === true && info.maxEmotionOutputTokens === 64 && info.maxReportOutputTokens === 1024 &&
    info.maxReportMessageBytes === 24000 && info.maxEmbeddingCharacters === 2000, 'TEST_WORKER_BOUNDS_MISMATCH');
  assert.deepEqual(info.models, ['@cf/meta/llama-3.1-8b-instruct-fast', '@cf/baai/bge-small-en-v1.5', '@cf/meta/llama-3.3-70b-instruct-fp8-fast']);
  evidence.provider = { models: info.models, smokeOnly: true, maxEmotionOutputTokens: 64,
    maxReportOutputTokens: 1024, maxReportMessageBytes: 24000, maxEmbeddingCharacters: 2000 };
  // Reuse the CI verifier before any fixture writes; independently inspect DB identity.
  const { resolveDatabaseUrl } = await import('../lib/database-isolation.js');
  const db = new URL(resolveDatabaseUrl());
  check(db.hostname === '127.0.0.1' && db.port === '5432' && db.pathname === '/petalpal_ai_e2e_test', 'DB_TARGET_REJECTED');
  prisma = (await import('../lib/prisma.js')).default;
  const [identity] = await prisma.$queryRawUnsafe(`SELECT current_database() AS name,
    (SELECT count(*)::int FROM pg_extension WHERE extname='vector') AS vector`);
  check(identity.name === 'petalpal_ai_e2e_test' && identity.vector === 1 && await prisma.user.count() === 0, 'DB_NOT_EMPTY_AND_ISOLATED');
  evidence.database = { disposable: true, identityVerified: true, pgvector: true };
  const { initializeApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const auth = getAuth(initializeApp({ projectId: 'demo-petalpal-real-ai' }));
  const app = await import('../server.js');
  server = app.app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  appOrigin = `http://127.0.0.1:${server.address().port}`;
  const owners = {}, tokens = {};
  for (const key of ['A', 'B']) {
    const owner = manifest.owners.find(o => o.key === key);
    owners[key] = owner;
    const password = randomBytes(24).toString('base64url');
    await auth.createUser({ uid: owner.firebaseUid, email: owner.email, emailVerified: true, password });
    const login = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: owner.email, password, returnSecureToken: true }) });
    check(login.ok, 'EMULATOR_SIGN_IN_FAILED');
    tokens[key] = (await login.json()).idToken;
    await prisma.user.create({ data: { id: owner.id, name: owner.id, email: owner.email, firebaseUid: owner.firebaseUid,
      timezone: manifest.timezone, preferredLocale: 'en' } });
  }
  const api = async (path, { owner = 'A', method = 'GET', body, headers = {}, authenticated = true, diagnostic } = {}) => {
    const r = await fetch(appOrigin + path, { method, headers: {
      ...(authenticated ? { Authorization: `Bearer ${tokens[owner]}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (diagnostic) recordWeeklyApi(diagnostic, { status: r.status });
    return { status: r.status, body: await r.json() };
  };
  evidence.stage = 'authentication-and-consent';
  check((await api('/events', { method: 'POST', authenticated: false, body: {} })).status === 401, 'MISSING_AUTH_ACCEPTED');
  check((await api('/ai/reports')).status === 403, 'MISSING_CONSENT_ACCEPTED');
  for (const key of ['A', 'B']) check((await api(`/users/${owners[key].id}/ai-consent`, { owner: key, method: 'PUT',
    body: { aiProcessing: true, personalization: true, memoryEnabled: true } })).status === 200, 'CONSENT_FAILED');
  const { simulatedTimeDenial } = await import('../lib/simulated-time.js');
  check(simulatedTimeDenial({ firebase: { email: owners.A.email, emailVerified: true } }) === null, 'SIMULATED_TIME_GATE_DENIED');
  const journal = await api(`/users/${owners.A.id}/flowers`, { method: 'POST', body: { mood: 'SUNNY_BLOOM', journalText: journalDecoy } });
  check([200, 201].includes(journal.status) && await prisma.journal.count() === 1 &&
    await prisma.event.count() === 0 && await prisma.aiJob.count() === 0 && evidence.calls.emotion === 0, 'JOURNAL_EXCLUSION_FAILED');
  const events = new Map();
  if (weeklyOnly) {
    evidence.stage = 'synthetic-fixtures';
    const { seedWeeklyFixtures } = await import('./real-ai-weekly-only.mjs');
    await seedWeeklyFixtures({ prisma, fixtures, owners, timezone: manifest.timezone, events });
  } else {
    evidence.stage = 'real-emotion';
    for (const fixture of fixtures) {
      const r = await api('/events', { owner: fixture.owner, method: 'POST',
        headers: { 'Idempotency-Key': `real-${fixture.ref}`, 'X-PetalPal-Simulated-Time': fixture.occurredAtUtc },
        body: { content: fixture.content, primaryGardenMood: fixture.mood } });
      check(r.status === 201 && r.body.emotion?.status === 'SUCCESS' && r.body.memoryJob?.status === 'PENDING', 'EVENT_OR_REAL_EMOTION_FAILED');
      check(r.body.event.localDate === fixture.localDate && r.body.event.ownerId === owners[fixture.owner].id, 'EVENT_DATE_OR_OWNER_FAILED');
      events.set(fixture.ref, r.body.event.id);
      evidence.events.push({ ref: fixture.ref, eventId: r.body.event.id, owner: fixture.owner, content: fixture.content,
        occurredAt: fixture.occurredAtUtc, primary: fixture.mood, emotions: r.body.emotion.labels });
    }
  }
  const { createProductionAiWorker } = await import('../lib/ai-worker.js');
  const { CloudflareWorkersEmbeddingProvider } = await import('../lib/embedding-provider.js');
  const { CLOUDFLARE_EMBEDDING_PROFILE_KEY } = await import('../lib/embedding-profiles.js');
  const { SemanticEventRetrievalService } = await import('../lib/semantic-retrieval.js');
  const { CloudflareWorkersReportNarrativeProvider, REPORT_NARRATIVE_GENERATION_VERSION } = await import('../lib/report-narrative.js');
  const { PrismaAiJobRepository } = await import('../lib/ai-jobs.js');
  const embedding = new CloudflareWorkersEmbeddingProvider(CLOUDFLARE_EMBEDDING_PROFILE_KEY, { timeoutMs: 60000 });
  const retrieval = weeklyOnly
    ? (await import('./real-ai-weekly-only.mjs')).weeklyFixtureRetrieval({ prisma, eventIds: [...events.values()], check })
    : new SemanticEventRetrievalService({ prisma, provider: embedding });
  const narrative = new CloudflareWorkersReportNarrativeProvider();
  const workerFor = reportAsOf => createProductionAiWorker({ prisma, embeddingProvider: embedding,
    reportNarrativeProvider: narrative, reportNarrativeTimeoutMs: 90000, reportAsOf,
    semanticRetrieval: { async retrieve(args) {
      const rows = await retrieval.retrieve(args);
      check(rows.every(row => row.ownerId === args.identity.userId && [...events.values()].includes(row.sourceEventId)), 'RETRIEVAL_SOURCE_LEAK');
      if (!weeklyOnly) evidence.retrieval.push({ ownerId: args.identity.userId, dateFrom: args.dateFrom, dateTo: args.dateTo,
        rows: rows.map(r => ({ eventId: r.sourceEventId, memoryId: r.id, similarity: r.similarity })) });
      return rows;
    } }, logger: { error() {} } });
  if (!weeklyOnly) {
    evidence.stage = 'memory-and-real-bge';
    for (const jobType of ['MEMORY_EXTRACTION', 'EMBEDDING_GENERATION']) {
      const jobs = await prisma.aiJob.findMany({ where: { jobType, status: 'PENDING' } });
      check(jobs.length === 5, 'EXPECTED_FIVE_JOBS');
      for (const job of jobs) {
        await prisma.aiJob.update({ where: { id: job.id }, data: { maxAttempts: 1 } });
        check((await workerFor(null).runJob({ jobId: job.id, ownerId: job.ownerId, jobType })).succeeded, 'MEMORY_OR_EMBEDDING_JOB_FAILED');
      }
    }
  }
  const memories = await prisma.eventMemory.findMany({ select: { id: true, ownerId: true, sourceEventId: true, summary: true, topics: true } });
  check(memories.length === 5 && memories.every(m => [...events.values()].includes(m.sourceEventId)), 'MEMORY_COUNT_FAILED');
  if (!weeklyOnly) {
    evidence.memories = memories;
    const vectors = await prisma.$queryRawUnsafe(`SELECT "eventMemoryId", "ownerId", "profileKey", "model", "status", vector_dims(embedding) AS dimensions FROM "EventMemoryEmbedding"`);
    check(vectors.length === 5 && vectors.every(v => v.dimensions === 384 && v.profileKey === CLOUDFLARE_EMBEDDING_PROFILE_KEY && v.status === 'GENERATED'), 'REAL_VECTOR_PROVENANCE_FAILED');
    evidence.vectors = vectors;
    evidence.stage = 'semantic-relevance-and-owner-isolation';
    const relevant = await retrieval.retrieve({ identity: { userId: owners.A.id }, query: 'Getting support at work and feeling more at ease', take: 4 });
    check(relevant.length === 4 && relevant[0].sourceEventId === events.get('a08') && relevant.every(r => r.ownerId === owners.A.id), 'REAL_SEMANTIC_RANKING_OR_OWNER_FAILED');
    evidence.semanticRanking = relevant.map(r => ({ eventId: r.sourceEventId, memoryId: r.id, similarity: r.similarity }));
  }
  check((await api(`/events/${events.get('a08')}`, { owner: 'B' })).status === 404, 'CROSS_OWNER_EVENT_LEAK');
  evidence.stage = 'weekly-monthly-and-insufficient';
  app.setWeeklyReportWorkerFactoryForTests(options => workerFor(options.reportAsOf));
  const reportSpecs = [
    { type: 'weekly', periodKey: '2026-10-05', clock: manifest.clocks.CLK_W, count: 2, previous: 2, refs: ['a06', 'a08'], generated: true },
    { type: 'monthly', periodKey: '2026-10', clock: manifest.clocks.CLK_M, count: 3, previous: 1, refs: ['a05', 'a06', 'a08'], generated: true },
    { type: 'weekly', periodKey: '2026-09-21', clock: manifest.clocks.CLK_W_INSUFFICIENT, count: 0, previous: 0, refs: [], generated: false }
  ];
  for (const spec of weeklyOnly ? reportSpecs.slice(0, 1) : reportSpecs) {
    evidence.stage = `${spec.type}-${spec.periodKey}`;
    const before = evidence.calls.narrative;
    const period = manifest.periods[`${spec.type === 'weekly' ? 'W' : 'M'}-${spec.periodKey}`];
    const allowed = spec.refs.map(ref => events.get(ref));
    const diagnostic = { httpStatus: null, execution: null, errorCode: null,
      reportReadStatus: 'NOT_READ', persisted: null };
    let reportSnapshot, edgeSnapshot;
    if (spec.type === 'weekly') diagnostics.weekly.push(diagnostic);
    const reportAttempt = async () => {
    if (spec.type === 'weekly') {
      const r = await api('/ai/reports/weekly/trigger', { method: 'POST',
        headers: { 'X-PetalPal-Simulated-Time': spec.clock }, body: { localDate: spec.periodKey }, diagnostic });
      recordWeeklyApi(diagnostic, r);
      check(r.status === 200 && r.body.execution === 'COMPLETED', 'WEEKLY_FAILED');
    } else {
      const job = await new PrismaAiJobRepository(prisma).enqueue({ identity: { userId: owners.A.id }, jobType: 'MONTHLY_REPORT',
        resourceId: spec.periodKey, processingVersion: REPORT_NARRATIVE_GENERATION_VERSION, maxAttempts: 1 });
      check((await workerFor(new Date(spec.clock)).runJob({ jobId: job.id, ownerId: owners.A.id, jobType: 'MONTHLY_REPORT' })).succeeded, 'MONTHLY_FAILED');
    }
    const r = reportSnapshot = await prisma[`${spec.type}Report`].findUnique({ where: { ownerId_periodKey: { ownerId: owners.A.id, periodKey: spec.periodKey } } });
    check(r?.status === 'COMPLETE' && r.eventCount === spec.count && r.trendSignals.previousEventCount === spec.previous &&
      r.trendSignals.eventCountChange === spec.count - spec.previous, 'REPORT_COUNTS_FAILED');
    check(r.periodStartUtc.toISOString() === period.startUtc && r.periodEndUtc.toISOString() === period.endUtc, 'REPORT_BOUNDARY_FAILED');
    check(r.narrativeStatus === (spec.generated ? 'GENERATED' : 'INSUFFICIENT_EVIDENCE') &&
      evidence.calls.narrative - before === Number(spec.generated), 'NARRATIVE_OR_FALLBACK_FAILED');
    const edges = edgeSnapshot = await prisma.aiEvidence.findMany({ where: { [`${spec.type}ReportId`]: r.id } });
    check(edges.every(e => e.ownerId === owners.A.id && allowed.includes(e.sourceEventId) &&
      memories.some(m => m.id === e.sourceMemoryId && m.sourceEventId === e.sourceEventId && m.ownerId === e.ownerId)), 'REPORT_EVIDENCE_LEAK');
    check(new Set(edges.map(e => e.sourceEventId)).size === allowed.length, 'IMPORTANT_EVIDENCE_MISSING');
    check((await api(`/ai/reports/${spec.type}/${r.id}`, { owner: 'B' })).status === 404, 'CROSS_OWNER_REPORT_LEAK');
    if (!spec.generated) check(r.summary === null, 'FALLBACK_NARRATIVE_PRESENT');
    if (!weeklyOnly) evidence.reports.push({ type: spec.type, periodKey: spec.periodKey, summary: r.summary, sections: r.narrativeSections,
      trends: r.trendSignals, expectedEventIds: allowed, evidence: edges.map(e => ({ eventId: e.sourceEventId, memoryId: e.sourceMemoryId, claimType: e.claimType })) });
    };
    if (spec.type === 'weekly') await withWeeklyDiagnostics(diagnostic, reportAttempt, async () => {
      const report = reportSnapshot === undefined ? await prisma.weeklyReport.findUnique({
        where: { ownerId_periodKey: { ownerId: owners.A.id, periodKey: spec.periodKey } },
        select: { id: true, status: true, narrativeStatus: true, eventCount: true, trendSignals: true,
          periodStartUtc: true, periodEndUtc: true }
      }) : reportSnapshot;
      const edges = edgeSnapshot ?? (report ? await prisma.aiEvidence.findMany({
        where: { weeklyReportId: report.id }, select: { ownerId: true, sourceEventId: true, sourceMemoryId: true }
      }) : []);
      return weeklyReportSnapshot(report, edges, { spec, period, ownerId: owners.A.id, allowed, memories,
        narrativeAttempts: evidence.calls.narrative - before });
    });
    else await reportAttempt();
  }
  check(weeklyOnly
    ? evidence.calls.emotion === 0 && evidence.calls.embedding === 0 && evidence.calls.narrative === 1
    : evidence.calls.emotion === 5 && evidence.calls.embedding === 9 && evidence.calls.narrative === 2, 'CALL_COUNTS_FAILED');
  check(await prisma.event.count() === 5 && await prisma.eventMemory.count() === 5 && await prisma.journal.count() === 1, 'JOURNAL_PIPELINE_LEAK');
  evidence.status = weeklyOnly ? 'WEEKLY_DIAGNOSTICS_PASS' : 'AUTOMATED_CHECKS_PASS_QUALITY_REVIEW_REQUIRED';
} catch {
  evidence.status = 'FAIL'; // Do not serialize raw exceptions or provider content.
  diagnostics.failedAssertion ??= 'UNCLASSIFIED_FAILURE';
  process.exitCode = 1;
} finally {
  // Persist diagnostic state before teardown, including failed Weekly assertions.
  fs.writeFileSync(weeklyOnly ? 'real-ai-weekly-only-evidence.json' : 'real-ai-smoke-evidence.json', JSON.stringify(evidence, null, 2));
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  if (prisma) await prisma.$disconnect().catch(() => {});
  // Only this run's disposable service container is destroyed by Actions; no
  // deleteMany, shared database cleanup, local container or volume operations.
  print(JSON.stringify({ status: evidence.status, stage: evidence.stage, calls: evidence.calls }));
}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runSmoke({ weeklyOnly: process.argv.includes('--weekly-only') }); }
  catch { process.exitCode = 1; process.stderr.write('SMOKE_RUNNER_FAILED\n'); }
}

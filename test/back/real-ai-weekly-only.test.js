// Local only: actual narrative service/provider, mocked HTTP and in-memory DB double.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { seedWeeklyFixtures, weeklyFixtureRetrieval, weeklyOnlyFetch } from '../../scripts/real-ai-weekly-only.mjs';
import { createSmokeDiagnostics, recordWeeklyApi, weeklyReportSnapshot, withWeeklyDiagnostics } from '../../scripts/real-ai-smoke.mjs';
import { ReportInputService } from '../../lib/report-foundation.js';
import { CloudflareWorkersReportNarrativeProvider, GroundedReportNarrativeService } from '../../lib/report-narrative.js';

const manifest = JSON.parse(readFileSync(new URL('../fixtures/ai-e2e-manifest.json', import.meta.url)));
const fixtures = ['a04', 'a05', 'a06', 'a08', 'b01'].map(ref => manifest.events.find(e => e.ref === ref));
const owners = Object.fromEntries(manifest.owners.map(o => [o.key, o]));
const providerOrigin = 'https://petalpal-real-ai-smoke.unit-test.workers.dev';
const marker = 'SYNTHETIC_PRIVATE_CONTENT_DO_NOT_EXPORT';
function databaseDouble() {
  const events = [], memories = [];
  let consent = true;
  const granted = () => ({ aiProcessing: consent, personalization: consent, memoryEnabled: consent, updatedAt: new Date('2026-09-01') });
  const within = (value, range) => value >= range.gte && value < range.lt;
  const db = {
    setConsent(value) { consent = value; },
    async $transaction(fn) { return fn(db); },
    async $queryRawUnsafe(_sql, ownerId) { return [{ userId: ownerId, ...granted() }]; },
    aiConsent: { async findUnique() { return granted(); } },
    user: { async findUnique() { return { timezone: manifest.timezone }; } },
    event: {
      async create({ data }) { const row = { ...data, id: `event-${events.length}`, updatedAt: new Date('2026-10-12') }; events.push(row); return row; },
      async findFirst({ where }) { return events.find(e => e.id === where.id && e.ownerId === where.ownerId); },
      async findMany({ where }) { return events.filter(e => e.ownerId === where.ownerId && e.memoryProcessingAllowed && within(e.occurredAt, where.occurredAt))
        .map(e => ({ ...e, memory: memories.find(m => m.sourceEventId === e.id) })); }
    },
    eventMemory: {
      async findFirst({ where }) { return memories.find(m => m.sourceEventId === where.sourceEventId && m.ownerId === where.ownerId); },
      async create({ data }) { const row = { ...data, id: `memory-${memories.length}`, updatedAt: new Date('2026-10-12'),
        embeddingInputRevision: 1, embeddingStatus: 'NOT_REQUESTED', embeddedInputRevision: null }; memories.push(row); return row; },
      async findMany({ where, take }) { return memories.filter(m => m.ownerId === where.ownerId && m.memoryType === where.memoryType &&
        where.sourceEventId.in.includes(m.sourceEventId) && within(m.eventDate, where.eventDate) &&
        events.find(e => e.id === m.sourceEventId)?.memoryProcessingAllowed).slice(0, take); }
    }, events, memories
  };
  return db;
}
async function setup() {
  const prisma = databaseDouble(), events = new Map();
  const { data, check } = createSmokeDiagnostics();
  await seedWeeklyFixtures({ prisma, fixtures, owners, timezone: manifest.timezone, events });
  const retrieval = weeklyFixtureRetrieval({ prisma, eventIds: [...events.values()], check });
  const input = await new ReportInputService({ prisma, semanticRetrieval: retrieval }).buildWeeklyInput({
    identity: { userId: owners.A.id }, localDate: '2026-10-05', asOf: new Date(manifest.clocks.CLK_W)
  });
  return { prisma, events, retrieval, input, data, check };
}
const validResponse = () => ({ sections: [{ kind: 'RECENT_MOMENTS', claim: 'You recorded 2 Events.', evidenceRefs: [], aggregateRefs: ['eventCount'] }] });

async function narrativeCase(responseFactory) {
  const state = await setup();
  const calls = { emotion: 0, embedding: 0, narrative: 0 }, providerDiagnostic = { httpStatus: null, category: 'NOT_ATTEMPTED' };
  const fetchImpl = weeklyOnlyFetch({ providerOrigin, appOrigin: () => 'http://127.0.0.1:12345', calls, check: state.check,
    diagnostic: providerDiagnostic, fetchImpl: responseFactory });
  const provider = new CloudflareWorkersReportNarrativeProvider({
    env: { CLOUDFLARE_WORKER_AI_URL: providerOrigin, CLOUDFLARE_WORKER_AI_TOKEN: 'synthetic-unit-test-only' }, fetchImpl
  });
  const result = await new GroundedReportNarrativeService({ provider, maxAttempts: 1, timeoutMs: 1000 }).generate(state.input);
  const diagnostic = {}; state.data.weekly.push(diagnostic);
  // Simulated API/persistence boundary; hosted runner uses the actual API and DB.
  const persisted = result.status === 'GENERATED' ? { ...state.input.aggregates, narrativeStatus: result.status } : null;
  const edges = persisted ? state.input.evidenceSelection.evidence.map(e => ({ ownerId: owners.A.id, ...e })) : [];
  try {
    await withWeeklyDiagnostics(diagnostic, async () => {
      recordWeeklyApi(diagnostic, { status: persisted ? 200 : 502, body: {
        execution: persisted ? 'COMPLETED' : 'FAILED', errorCode: result.errorCode, error: marker
      } });
      state.check(Boolean(persisted), 'WEEKLY_FAILED');
    }, async () => weeklyReportSnapshot(persisted, edges, {
      spec: { count: 2, previous: 2, generated: true }, period: manifest.periods['W-2026-10-05'],
      ownerId: owners.A.id, allowed: ['a06', 'a08'].map(ref => state.events.get(ref)), memories: state.prisma.memories,
      narrativeAttempts: calls.narrative
    }));
  } catch { /* Assert only sanitized results below. */ }
  assert.equal(JSON.stringify({ diagnostic, providerDiagnostic, data: state.data }).includes(marker), false);
  assert.deepEqual(calls, { emotion: 0, embedding: 0, narrative: 1 });
  return { result, diagnostic, providerDiagnostic, data: state.data, fetchImpl, calls };
}

test('fixtures supply sufficient closed Weekly evidence, preserve owner/consent boundaries and need no embeddings', async () => {
  const { prisma, events, retrieval, input } = await setup();
  assert.equal(prisma.events.length, 5);
  assert.equal(prisma.memories.length, 5);
  assert.equal(prisma.memories.every(m => m.embeddingStatus === 'NOT_REQUESTED'), true);
  assert.equal(input.evidenceSelection.status, 'READY');
  assert.equal(input.aggregates.eventCount, 2);
  assert.equal(input.aggregates.trendSignals.previousEventCount, 2);
  assert.deepEqual(input.evidenceSelection.evidence.map(e => e.sourceEventId).sort(), ['a06', 'a08'].map(ref => events.get(ref)).sort());
  prisma.setConsent(false);
  await assert.rejects(retrieval.retrieve({ identity: { userId: owners.A.id }, dateFrom: input.period.periodStartUtc,
    dateTo: input.period.periodEndUtc, take: 32 }), { code: 'AI_FORBIDDEN' });
});

test('actual narrative provider interface accepts mocked valid response with safe diagnostics and blocks a second request', async () => {
  const state = await narrativeCase(async () => Response.json(validResponse()));
  assert.equal(state.result.status, 'GENERATED');
  assert.equal(state.providerDiagnostic.category, 'HTTP_OK');
  for (const key of ['persisted', 'eventCountsMatch', 'periodBoundariesMatch', 'evidenceOwnershipValid', 'evidenceCoverageValid', 'narrativeValid'])
    assert.equal(state.diagnostic[key], true);
  await assert.rejects(state.fetchImpl(providerOrigin + '/v1/report-narrative', { method: 'POST', body: '{}' }));
  assert.equal(state.data.failedAssertion, 'CALL_LIMIT_OR_RETRY_BLOCKED');
  assert.equal(state.calls.narrative, 1);
});

test('upstream failure categories are allowlisted, unknown/transport errors remain unclassified, without retries', async () => {
  for (const code of ['AI_RUN_FAILED', 'JSON_PARSE_FAILED', 'SCHEMA_VALIDATION_FAILED', marker]) {
    const state = await narrativeCase(async () => Response.json({ code, error: marker }, { status: 502 }));
    assert.equal(state.data.failedAssertion, 'WEEKLY_FAILED');
    assert.equal(state.diagnostic.persisted, false);
    assert.equal(state.diagnostic.errorCode, 'PROVIDER_ERROR_UNCLASSIFIED');
    assert.equal(state.providerDiagnostic.category, code === marker ? 'PROVIDER_ERROR_UNCLASSIFIED' : code);
  }
  const state = await narrativeCase(async () => { throw new Error(marker); });
  assert.equal(state.providerDiagnostic.category, 'PROVIDER_ERROR_UNCLASSIFIED');
  assert.equal(state.providerDiagnostic.httpStatus, null);
});

test('HTTP success with invalid JSON or unsupported claim is distinct from upstream HTTP failure', async () => {
  for (const [response, code] of [
    [() => new Response(marker), 'REPORT_NARRATIVE_INVALID_OUTPUT'],
    [() => Response.json({ sections: [{ ...validResponse().sections[0], claim: 'You recorded 99 Events.' }] }), 'REPORT_NARRATIVE_GROUNDING_FAILED']
  ]) {
    const state = await narrativeCase(async () => response());
    assert.equal(state.providerDiagnostic.category, 'HTTP_OK');
    assert.equal(state.diagnostic.errorCode, code);
    assert.equal(state.diagnostic.persisted, false);
  }
});

test('emotion, embeddings, external hosts, oversized input and Journal text never reach transport', async () => {
  for (const [url, body, expected] of [
    [providerOrigin + '/v1/event-emotion', '{}', 'PROVIDER_ROUTE_DENIED'],
    [providerOrigin + '/v1/embedding', '{}', 'PROVIDER_ROUTE_DENIED'],
    ['https://production.invalid/v1/report-narrative', '{}', 'NETWORK_TARGET_DENIED'],
    [providerOrigin + '/v1/report-narrative', 'x'.repeat(24001), 'PROVIDER_INPUT_REJECTED'],
    [providerOrigin + '/v1/report-narrative', 'JOURNAL_DECOY_ONLY', 'PROVIDER_INPUT_REJECTED']
  ]) {
    const { data, check } = createSmokeDiagnostics();
    const calls = { emotion: 0, embedding: 0, narrative: 0 };
    const guarded = weeklyOnlyFetch({ providerOrigin, appOrigin: () => undefined, calls, check, diagnostic: {},
      fetchImpl: async () => assert.fail('Transport must not be reached') });
    await assert.rejects(guarded(url, { method: 'POST', body }));
    assert.equal(data.failedAssertion, expected);
    assert.deepEqual(calls, { emotion: 0, embedding: 0, narrative: 0 });
  }
});

test('Weekly-only runner writes separate sanitized evidence when explicit approval is missing', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'petalpal-weekly-diagnostic-'));
  try {
    const run = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/real-ai-smoke.mjs', import.meta.url)), '--weekly-only'], {
      cwd, encoding: 'utf8', env: { NODE_ENV: 'test', GITHUB_ACTIONS: 'true', GITHUB_RUN_ATTEMPT: '1', PETALPAL_REAL_AI_APPROVED: '1' }
    });
    assert.equal(run.status, 1);
    const evidence = JSON.parse(readFileSync(join(cwd, 'real-ai-weekly-only-evidence.json')));
    assert.equal(evidence.diagnostics.failedAssertion, 'RUN_NOT_APPROVED');
    assert.deepEqual(evidence.calls, { emotion: 0, embedding: 0, narrative: 0 });
    assert.equal(evidence.mode, 'WEEKLY_ONLY_FIXTURE_RETRIEVAL');
    assert.equal(run.stderr, '');
    assert.equal(fixtures.some(f => JSON.stringify(evidence).includes(f.content)), false);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

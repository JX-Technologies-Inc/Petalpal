// Local synthetic diagnostics only: no application server, database or provider.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createSmokeDiagnostics, recordWeeklyApi, weeklyReportSnapshot,
  withWeeklyDiagnostics } from '../../scripts/real-ai-smoke.mjs';

const marker = 'SYNTHETIC_SECRET_PROMPT_RESPONSE_STACK_DO_NOT_EXPORT';
const context = {
  spec: { count: 2, previous: 2, generated: true },
  period: { startUtc: '2026-10-05T07:00:00.000Z', endUtc: '2026-10-12T07:00:00.000Z' },
  ownerId: 'synthetic-a', allowed: ['event-a'],
  memories: [{ id: 'memory-a', sourceEventId: 'event-a', ownerId: 'synthetic-a' }], narrativeAttempts: 1
};
const report = () => ({ status: 'COMPLETE', narrativeStatus: 'GENERATED', eventCount: 2,
  trendSignals: { previousEventCount: 2, eventCountChange: 0 },
  periodStartUtc: new Date(context.period.startUtc), periodEndUtc: new Date(context.period.endUtc),
  summary: marker, narrativeSections: [marker] });
const edges = () => [{ sourceEventId: 'event-a', sourceMemoryId: 'memory-a', ownerId: 'synthetic-a' }];

test('generic provider failure retains Weekly status, assertion and absent report', async () => {
  const { data, check } = createSmokeDiagnostics();
  const diagnostic = {}; data.weekly.push(diagnostic);
  await assert.rejects(withWeeklyDiagnostics(diagnostic, async () => {
    const response = { status: 502, body: { execution: 'FAILED', errorCode: 'REPORT_NARRATIVE_PROVIDER_FAILED', error: marker } };
    recordWeeklyApi(diagnostic, response);
    check(response.status === 200, 'WEEKLY_FAILED');
  }, async () => weeklyReportSnapshot(null, [], context)), /SMOKE_ASSERTION_FAILED/);
  assert.equal(data.failedAssertion, 'WEEKLY_FAILED');
  assert.equal(diagnostic.httpStatus, 502);
  assert.equal(diagnostic.execution, 'FAILED');
  assert.equal(diagnostic.errorCode, 'PROVIDER_ERROR_UNCLASSIFIED');
  assert.equal(diagnostic.persisted, false);
  assert.equal(diagnostic.narrativeValid, null);
  assert.ok(!JSON.stringify(data).includes(marker));
});

test('completed API with persisted report distinguishes each report assertion failure', async () => {
  for (const [label, field, change] of [
    ['REPORT_COUNTS_FAILED', 'eventCountsMatch', r => { r.eventCount = 3; }],
    ['REPORT_BOUNDARY_FAILED', 'periodBoundariesMatch', r => { r.periodEndUtc = new Date('2026-10-13T07:00:00Z'); }],
    ['REPORT_EVIDENCE_LEAK', 'evidenceOwnershipValid', (r, e) => { e[0].ownerId = 'synthetic-b'; }],
    ['IMPORTANT_EVIDENCE_MISSING', 'evidenceCoverageValid', (r, e) => { e.length = 0; }],
    ['NARRATIVE_OR_FALLBACK_FAILED', 'narrativeValid', r => { r.narrativeStatus = 'NOT_GENERATED'; }]
  ]) {
    const { data, check } = createSmokeDiagnostics();
    const diagnostic = {}; data.weekly.push(diagnostic);
    const r = report(), e = edges(); change(r, e);
    await assert.rejects(withWeeklyDiagnostics(diagnostic, async () => {
      recordWeeklyApi(diagnostic, { status: 200, body: { execution: 'COMPLETED' } });
      check(false, label);
    }, async () => weeklyReportSnapshot(r, e, context)), /SMOKE_ASSERTION_FAILED/);
    assert.equal(data.failedAssertion, label);
    assert.equal(diagnostic.httpStatus, 200);
    assert.equal(diagnostic.persisted, true);
    assert.equal(diagnostic.errorCode, null);
    assert.equal(diagnostic[field], false);
    assert.ok(!JSON.stringify(data).includes(marker));
  }
});

test('untrusted codes, enums and exception details cannot enter diagnostics', async () => {
  const { data, check } = createSmokeDiagnostics();
  assert.throws(() => check(false, marker), /SMOKE_ASSERTION_FAILED/);
  const diagnostic = {}; data.weekly.push(diagnostic);
  recordWeeklyApi(diagnostic, { status: marker, body: { execution: marker, errorCode: marker } });
  assert.equal(diagnostic.httpStatus, null);
  assert.equal(diagnostic.execution, 'UNKNOWN');
  assert.equal(diagnostic.errorCode, 'UNKNOWN');
  Object.assign(diagnostic, weeklyReportSnapshot({ ...report(), status: marker, narrativeStatus: marker }, edges(), context));
  assert.equal(diagnostic.reportStatus, 'UNKNOWN');
  assert.equal(diagnostic.narrativeStatus, 'UNKNOWN');
  assert.equal(data.failedAssertion, 'UNCLASSIFIED_FAILURE');
  assert.ok(!JSON.stringify(data).includes(marker));
});

test('diagnostic read failure never masks original assertion or exports its exception', async () => {
  const { data, check } = createSmokeDiagnostics();
  const diagnostic = { persisted: null }; data.weekly.push(diagnostic);
  await assert.rejects(withWeeklyDiagnostics(diagnostic, async () => check(false, 'WEEKLY_FAILED'),
    async () => { throw new Error(marker); }), /SMOKE_ASSERTION_FAILED/);
  assert.equal(data.failedAssertion, 'WEEKLY_FAILED');
  assert.equal(diagnostic.reportReadStatus, 'UNAVAILABLE');
  assert.equal(diagnostic.persisted, null);
  assert.ok(!JSON.stringify(data).includes(marker));
});

test('real runner writes sanitized evidence on guarded local failure with zero provider attempts', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'petalpal-smoke-diagnostics-'));
  try {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/real-ai-smoke.mjs', import.meta.url))],
      { cwd, env: { NODE_ENV: 'test', GITHUB_ACTIONS: 'false' }, encoding: 'utf8' });
    assert.equal(result.status, 1);
    const evidence = JSON.parse(readFileSync(join(cwd, 'real-ai-smoke-evidence.json'), 'utf8'));
    assert.equal(evidence.status, 'FAIL');
    assert.equal(evidence.diagnostics.failedAssertion, 'RUN_NOT_APPROVED');
    assert.deepEqual(evidence.calls, { emotion: 0, embedding: 0, narrative: 0 });
    assert.equal(result.stderr, '');
    assert.ok(!result.stdout.includes('Error:'));
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

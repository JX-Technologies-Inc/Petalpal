// Deterministic mocks only. No Anthropic Models, Count Tokens or Messages request leaves this process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATEWAY_MODELS } from '../../lib/ai-gateway-config.js';
import { acceptancePlan as v1Plan, assertPinnedSources as assertV1Pinned, liveLedgerPath as v1LedgerPath } from './acceptance.mjs';
import { anthropicV2Transport } from './anthropic-v2.mjs';
import { APPROVED_PROMPT_COMMIT, APPROVED_SCENARIOS, BOUNDS, MATRIX_ID, MODELS, assertV2PinnedSources,
  runV2Live, runV2Mock, v2AcceptancePlan, v2LiveLedgerPath } from './acceptance-v2.mjs';
import { VERSION, systemPromptV2 } from './experiment-v2.mjs';
import { prepareAllV2 } from './prepare-v2.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CANARY = 'synthetic-secret-canary';
const WEEKLY_RESERVATION = 40_960_000;
const MONTHLY_RESERVATION = 163_840_000;
const ledgerPath = () => join(mkdtempSync(join(tmpdir(), 'petalpal-v2-acceptance-')), 'ledger.jsonl');
const entries = path => readFileSync(path, 'utf8').trim().split('\n').map(JSON.parse);
const reply = (status, value) => ({ status, headers: { 'x-api-key': CANARY },
  body: new Response(typeof value === 'string' ? value : JSON.stringify(value)).body });

function message(request, overrides = {}) {
  const body = JSON.parse(request.body), packet = JSON.parse(body.messages[0].content);
  const references = packet.evidence.map((_, index) => ({ excerpt: `Synthetic fixture excerpt ${index + 1}.`,
    sources: [`E${index + 1}`] }));
  const envelope = { version: VERSION, reportType: packet.reportType, locale: packet.locale, state: 'reflection',
    reason: 'none', reflection: references.map(r => r.excerpt).join(' '), references };
  return { id: 'msg_mock_v2', type: 'message', role: 'assistant', model: body.model, stop_reason: 'end_turn',
    content: [{ type: 'thinking', thinking: CANARY, signature: CANARY },
      { type: 'text', text: JSON.stringify(envelope) }],
    usage: { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0, service_tier: 'standard' }, ...overrides };
}

function gateway(override = () => undefined) {
  const calls = [];
  let active = 0, maxActive = 0;
  const transport = async (request, options) => {
    const kind = request.path.endsWith('/count_tokens') ? 'count' : request.method === 'GET' ? 'metadata' : 'inference';
    const index = calls.filter(c => c.kind === kind).length;
    calls.push({ kind, request, options });
    maxActive = Math.max(maxActive, ++active);
    try {
      const custom = await override(kind, index, request, options);
      if (custom) return custom;
      if (kind === 'metadata') return reply(200, { type: 'model', id: request.path.split('/').pop() });
      return kind === 'count' ? reply(200, { input_tokens: 1000 }) : reply(200, message(request));
    } finally { active--; }
  };
  return { calls, transport, maxActive: () => maxActive };
}

async function mockRun(override, options = {}) {
  const path = ledgerPath(), gw = gateway(override), priorFetch = globalThis.fetch;
  globalThis.fetch = () => { throw Error('Network forbidden in v2 acceptance tests'); };
  try { return { path, gw, summary: await runV2Mock({ transport: gw.transport, mockLedgerPath: path, ...options }) }; }
  finally { globalThis.fetch = priorFetch; }
}

test('plan is exactly negation and mixed-work across two report types and three locales', () => {
  const plan = v2AcceptancePlan(), prepared = prepareAllV2();
  const expected = APPROVED_SCENARIOS.flatMap(s => ['WEEKLY', 'MONTHLY'].flatMap(t =>
    ['en', 'zh-Hans', 'zh-Hant'].map(l => `${s}/${t}/${l}`)));
  assert.deepEqual(plan.cases.map(c => c.id), expected);
  assert.equal(plan.cases.length, 12);
  assert.equal(new Set(plan.cases.map(c => c.id)).size, 12);
  assert.deepEqual([...new Set(plan.cases.map(c => c.locale))], ['en', 'zh-Hans', 'zh-Hant']);
  assert.equal(plan.cases.filter(c => c.type === 'WEEKLY' && c.model === MODELS.WEEKLY).length, 6);
  assert.equal(plan.cases.filter(c => c.type === 'MONTHLY' && c.model === MODELS.MONTHLY).length, 6);
  for (const c of plan.cases) {
    const reference = prepared.find(r => r.scenario === c.scenario && r.type === c.type && r.locale === c.locale);
    assert.deepEqual(c.prepared.request, reference.request);
    const packet = JSON.parse(c.prepared.request.body.messages[0].content);
    assert.equal(packet.promptVersion, `${c.type.toLowerCase()}-reflection-prompt-v2`);
    assert.equal(c.prepared.request.body.system, systemPromptV2(c.type));
  }
  assert.equal(plan.reservedNanoUsd, 1_228_800_000);
  assert.ok(plan.reservedNanoUsd <= BOUNDS.ceilingNanoUsd);
  assert.deepEqual({ sonnetInput: GATEWAY_MODELS[MODELS.WEEKLY].inputRate,
    sonnetOutput: GATEWAY_MODELS[MODELS.WEEKLY].outputRate,
    opusInput: GATEWAY_MODELS[MODELS.MONTHLY].inputRate,
    opusOutput: GATEWAY_MODELS[MODELS.MONTHLY].outputRate },
  { sonnetInput: 2000, sonnetOutput: 10000, opusInput: 4000, opusOutput: 20000 });
  assertV2PinnedSources();
  assertV1Pinned();
  assert.equal(v1Plan().cases.length, 36);
});

test('successful mock is serial, attempt-before-result, sanitized, and records all 12 outcomes', async () => {
  const v1Path = v1LedgerPath(), v1Before = existsSync(v1Path) ? statSync(v1Path) : null;
  const { path, gw, summary } = await mockRun();
  assert.deepEqual(summary.calls, { metadata: 2, count: 12, inference: 12 });
  assert.deepEqual(summary.outcomes, { STRUCTURE_CHECKED: 12 });
  assert.equal(summary.status, 'COMPLETED');
  assert.equal(summary.mode, 'MOCK');
  assert.equal(summary.matrixId, MATRIX_ID);
  assert.equal(summary.reservedNanoUsd, 1_228_800_000);
  assert.equal(summary.ceilingNanoUsd, 1_500_000_000);
  assert.equal(summary.knownCostNanoUsd, 6 * 7_000_000 + 6 * 14_000_000);
  assert.equal(summary.worstCaseCostNanoUsd, summary.knownCostNanoUsd);
  assert.equal(gw.maxActive(), 1);
  assert.deepEqual(gw.calls.map(c => c.kind), [...Array(2).fill('metadata'), ...Array(12).fill('count'),
    ...Array(12).fill('inference')]);
  const log = entries(path), inference = log.filter(e => e.entry === 'result' && e.call === 'inference');
  assert.equal(inference.length, 12);
  assert.ok(inference.every(e => e.promptVersion.endsWith('-prompt-v2') && e.factualReview === 'PENDING' &&
    e.writingReview === 'PENDING' && e.structural.productionEligible === false));
  for (const result of log.filter(e => e.entry === 'result')) {
    assert.deepEqual(log[log.indexOf(result) - 1], { entry: 'attempt', call: result.call, id: result.id });
  }
  assert.equal(statSync(path).mode & 0o777, 0o600);
  const text = readFileSync(path, 'utf8');
  for (const forbidden of [CANARY, 'thinking', 'signature', 'x-api-key', 'anthropic-version'])
    assert.equal(text.includes(forbidden), false, forbidden);
  assert.equal(existsSync(v1Path), Boolean(v1Before));
  if (v1Before) assert.deepEqual(statSync(v1Path), v1Before);
});

test('inference bodies are the exact reviewed v2 requests and token preflight keeps 25% headroom', async () => {
  const { gw, summary } = await mockRun((kind, _index, request) => kind === 'count'
    ? reply(200, { input_tokens: JSON.parse(request.body).model === MODELS.WEEKLY ? 6553 : 13107 }) : undefined);
  assert.equal(summary.status, 'COMPLETED');
  const plan = v2AcceptancePlan(), counts = gw.calls.filter(c => c.kind === 'count');
  const inference = gw.calls.filter(c => c.kind === 'inference');
  plan.cases.forEach((c, index) => {
    const { max_tokens: _, ...countBody } = c.prepared.request.body;
    assert.equal(counts[index].request.body, JSON.stringify(countBody));
    assert.equal(inference[index].request.body, JSON.stringify(c.prepared.request.body));
  });
});

test('existing or interrupted mock ledger blocks replay without another dispatch', async () => {
  const first = await mockRun((kind, index) => kind === 'inference' && index === 0 ? reply(500, {}) : undefined);
  const second = gateway();
  await assert.rejects(runV2Mock({ transport: second.transport, mockLedgerPath: first.path }),
    /V2_ACCEPTANCE_LEDGER_UNAVAILABLE/);
  assert.equal(second.calls.length, 0);
});

test('LIVE ledger identity ignores HOME, accepts no path override, and differs from consumed v1 identity', async () => {
  const originalHome = process.env.HOME, fixed = v2LiveLedgerPath();
  process.env.HOME = mkdtempSync(join(tmpdir(), 'different-home-'));
  try { assert.equal(v2LiveLedgerPath(), fixed); }
  finally { if (originalHome === undefined) delete process.env.HOME; else process.env.HOME = originalHome; }
  assert.notEqual(fixed, v1LedgerPath());
  assert.match(fixed, new RegExp(`${MATRIX_ID}-${APPROVED_PROMPT_COMMIT}\\.jsonl$`));
  const gw = gateway();
  await assert.rejects(runV2Live({ transport: gw.transport, mockLedgerPath: ledgerPath() }),
    /V2_ACCEPTANCE_CONFIG_REJECTED/);
  assert.equal(gw.calls.length, 0);
});

test('real Anthropic adapter cannot send in MOCK and missing credentials fail before fetch', async () => {
  let fetchCalls = 0;
  const transport = anthropicV2Transport(`sk-ant-${CANARY}`, async () => { fetchCalls++; return new Response('{}'); });
  const path = ledgerPath(), summary = await runV2Mock({ transport, mockLedgerPath: path });
  assert.equal(summary.stopReason, 'PREFLIGHT_MODEL_UNCONFIRMED');
  assert.deepEqual(summary.calls, { metadata: 1, count: 0, inference: 0 });
  assert.equal(fetchCalls, 0);
  assert.equal(readFileSync(path, 'utf8').includes(CANARY), false);
  for (const key of [undefined, '', ' sk-ant-x', 'sk-ant-x\n'])
    assert.throws(() => anthropicV2Transport(key, async () => {}), /V2_ANTHROPIC_TRANSPORT_CONFIG_REJECTED/);
});

for (const [name, override, stopReason, unknownCost] of [
  ['provider failure', (kind, i) => kind === 'inference' && i === 0 ? reply(500, { error: CANARY }) : undefined,
    'PROVIDER_HTTP_ERROR', true],
  ['uncertain usage', (kind, i, request) => kind === 'inference' && i === 0
    ? reply(200, message(request, { usage: undefined })) : undefined, 'USAGE_UNCERTAIN', true],
  ['cache usage', (kind, i, request) => kind === 'inference' && i === 0
    ? reply(200, message(request, { usage: { input_tokens: 1000, output_tokens: 500,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 1, service_tier: 'standard' } }))
    : undefined, 'USAGE_UNCERTAIN', true],
  ['non-standard service tier', (kind, i, request) => kind === 'inference' && i === 0
    ? reply(200, message(request, { usage: { input_tokens: 1000, output_tokens: 500,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0, service_tier: 'priority' } }))
    : undefined, 'USAGE_UNCERTAIN', true],
  ['malformed envelope', (kind, i, request) => kind === 'inference' && i === 0
    ? reply(200, message(request, { content: [{ type: 'text', text: '{}' }] })) : undefined, 'INVALID_RESPONSE', false],
  ['oversized response', (kind, i) => kind === 'inference' && i === 0
    ? reply(200, 'x'.repeat(BOUNDS.responseBytes + 1)) : undefined, 'AMBIGUOUS_RESPONSE_TOO_LARGE', true]
]) test(`${name} stops after one inference with no retry`, async () => {
  const { path, gw, summary } = await mockRun(override);
  assert.equal(summary.status, 'STOPPED');
  assert.equal(summary.stopReason, stopReason);
  assert.equal(summary.calls.inference, 1);
  assert.equal(gw.calls.filter(c => c.kind === 'inference').length, 1);
  assert.equal(summary.worstCaseCostNanoUsd - summary.knownCostNanoUsd, unknownCost ? WEEKLY_RESERVATION : 0);
  assert.ok(summary.worstCaseCostNanoUsd <= BOUNDS.ceilingNanoUsd);
  assert.equal(readFileSync(path, 'utf8').includes(CANARY), false);
});

test('timeout covers response completion, consumes one attempt and discards late completion', async () => {
  let signal;
  const { path, summary } = await mockRun(async (kind, index, request, options) => {
    if (kind !== 'inference' || index !== 0) return undefined;
    signal = options.signal;
    await new Promise(resolve => setTimeout(resolve, 100));
    return reply(200, message(request));
  }, { callTimeoutMs: 10 });
  const settled = readFileSync(path, 'utf8');
  assert.equal(summary.stopReason, 'AMBIGUOUS_TIMEOUT');
  assert.equal(summary.calls.inference, 1);
  assert.equal(signal.aborted, true);
  assert.equal(summary.worstCaseCostNanoUsd, WEEKLY_RESERVATION);
  await new Promise(resolve => setTimeout(resolve, 140));
  assert.equal(readFileSync(path, 'utf8'), settled);
});

test('model mismatch and token-count overage stop before inference', async () => {
  for (const override of [
    (kind, i) => kind === 'metadata' && i === 0 ? reply(200, { type: 'model', id: 'different' }) : undefined,
    (kind, i) => kind === 'count' && i === 0 ? reply(200, { input_tokens: 6554 }) : undefined
  ]) {
    const { summary } = await mockRun(override);
    assert.match(summary.stopReason, /^PREFLIGHT_/);
    assert.equal(summary.calls.inference, 0);
    assert.equal(summary.worstCaseCostNanoUsd, 0);
  }
});

test('configuration and CLI fail closed; CLI only prints an unauthorized zero-call plan', async () => {
  await assert.rejects(runV2Mock(), /V2_ACCEPTANCE_CONFIG_REJECTED/);
  await assert.rejects(runV2Mock({ transport: gateway().transport, mockLedgerPath: '', callTimeoutMs: 20_001 }),
    /V2_ACCEPTANCE_CONFIG_REJECTED/);
  const script = 'experiments/prompt-first-reflection/acceptance-v2.mjs';
  const plan = JSON.parse(execFileSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8' }));
  assert.deepEqual({ status: plan.status, cases: plan.cases.length, metadata: plan.maximumCalls.metadata,
    counts: plan.maximumCalls.count, inference: plan.maximumCalls.inference, reservedUsd: plan.reservedUsd,
    ceilingUsd: plan.ceilingUsd, calls: plan.providerCalls, transport: plan.transport },
  { status: 'PREPARED_NOT_AUTHORIZED', cases: 12, metadata: 2, counts: 12, inference: 12,
    reservedUsd: 1.2288, ceilingUsd: 1.5, calls: 0, transport: 'none' });
  assert.throws(() => execFileSync(process.execPath, [script, '--send'], { cwd: ROOT, stdio: 'ignore' }));
});

test('v2 adapter has no credential lookup or executable live CLI', () => {
  const adapter = readFileSync(new URL('./anthropic-v2.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(adapter, /process\.env|PETALPAL_CLAUDE_EVAL_API_KEY\]/);
  assert.doesNotMatch(adapter, /runV2Live|fileURLToPath/);
  assert.match(adapter, /https:\/\/api\.anthropic\.com/);
  assert.match(adapter, /redirect: 'error'/);
});

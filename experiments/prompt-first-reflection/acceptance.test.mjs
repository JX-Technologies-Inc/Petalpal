// Mocked Gateway only: no metadata, token-count or inference request leaves the process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPROVED_COMMIT, APPROVED_SCENARIOS, BOUNDS, MODELS, acceptancePlan, assertPinnedSources, liveLedgerPath,
  runAcceptance } from './acceptance.mjs';
import { anthropicTransport } from './live-anthropic.mjs';
import { TYPES, VERSION } from './experiment.mjs';
import { prepareAll } from './prepare.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CANARY = 'synthetic-canary-not-a-credential';
const WEEKLY_RESERVATION = 40960000, CASE_COST = { WEEKLY: 7000000, MONTHLY: 14000000 };
const ORDINALS = ['first', 'second', 'third', 'fourth'];
const ledgerPath = () => join(mkdtempSync(join(tmpdir(), 'petalpal-acceptance-')), 'ledger.jsonl');
const read = path => readFileSync(path, 'utf8');
const entries = path => read(path).trim().split('\n').map(line => JSON.parse(line));
const reply = (status, value) => ({ status, headers: { 'x-api-key': CANARY },
  body: new Response(typeof value === 'string' ? value : JSON.stringify(value)).body });
function message(request, overrides = {}) {
  const body = JSON.parse(request.body), packet = JSON.parse(body.messages[0].content);
  const references = packet.evidence.map((e, i) => ({ excerpt: `You noted the ${ORDINALS[i]} moment.`, sources: [e.alias] }));
  const envelope = { version: VERSION, reportType: packet.reportType, locale: packet.locale, state: 'reflection', reason: 'none',
    reflection: references.map(r => r.excerpt).join(' '), references };
  return { id: 'msg_synthetic', type: 'message', role: 'assistant', model: body.model, stop_reason: 'end_turn',
    content: [{ type: 'thinking', thinking: CANARY, signature: CANARY }, { type: 'text', text: JSON.stringify(envelope) }],
    usage: { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, service_tier: 'standard' },
    ...overrides };
}
const envelopeOf = request => JSON.parse(message(request).content[1].text);
// `override(kind, index, request, signal)` may return a custom reply or throw; otherwise a valid default reply.
function gateway(override = () => undefined) {
  const calls = [];
  let active = 0, maxActive = 0;
  const transport = async (request, { signal }) => {
    const kind = request.path.endsWith('/count_tokens') ? 'count' : request.method === 'GET' ? 'metadata' : 'inference';
    const index = calls.filter(c => c.kind === kind).length;
    calls.push({ kind, request });
    maxActive = Math.max(maxActive, ++active);
    try {
      await new Promise(resolve => setTimeout(resolve, 1));
      const custom = await override(kind, index, request, signal);
      if (custom) return custom;
      if (kind === 'metadata') return reply(200, { type: 'model', id: request.path.split('/').pop(), display_name: 'synthetic' });
      return kind === 'count' ? reply(200, { input_tokens: 1000 }) : reply(200, message(request));
    } finally { active--; }
  };
  return { transport, calls, maxActive: () => maxActive };
}
async function run(override, options = {}) {
  const path = ledgerPath(), gw = gateway(override), priorFetch = globalThis.fetch;
  globalThis.fetch = () => { throw Error('Network is forbidden in acceptance tests'); };
  try { return { path, gw, summary: await runAcceptance({ transport: gw.transport, mockLedgerPath: path, ...options }) }; }
  finally { globalThis.fetch = priorFetch; }
}

test('plan is exactly the approved 36 cases, reusing unchanged PR #51 requests under the $4 ceiling', () => {
  const plan = acceptancePlan(), prepared = prepareAll();
  assert.equal(plan.cases.length, 36);
  assert.deepEqual([...new Set(plan.cases.map(c => c.scenario))], APPROVED_SCENARIOS);
  for (const type of TYPES) assert.equal(plan.cases.filter(c => c.type === type && c.model === MODELS[type]).length, 18);
  for (const c of plan.cases) {
    const reference = prepared.find(r => r.scenario === c.scenario && r.type === c.type && r.locale === c.locale);
    assert.deepEqual(c.prepared.request, reference.request);
  }
  assert.equal(plan.reservedNanoUsd, 3686400000);
  assert.ok(plan.reservedNanoUsd <= BOUNDS.ceilingNanoUsd);
  assertPinnedSources();
  assert.throws(() => assertPinnedSources('ba867045c0c044a25b04e99dee93c53f10351506'), /ACCEPTANCE_SOURCE_PIN_FAILED/);
});

test('mocked run: exact model and count preflight, then 36 serial single attempts with a sanitized durable ledger', async () => {
  // Counts sit exactly on the 25% headroom boundary: ceil(6553 * 1.25) = 8192, ceil(13107 * 1.25) = 16384.
  const { path, gw, summary } = await run((kind, i, request) => kind === 'count'
    ? reply(200, { input_tokens: JSON.parse(request.body).model === MODELS.WEEKLY ? 6553 : 13107 }) : undefined);
  assert.equal(summary.status, 'COMPLETED');
  assert.deepEqual(summary.calls, { metadata: 2, count: 36, inference: 36 });
  assert.deepEqual(summary.outcomes, { STRUCTURE_CHECKED: 36 });
  assert.equal(summary.knownCostNanoUsd, 18 * CASE_COST.WEEKLY + 18 * CASE_COST.MONTHLY);
  assert.equal(summary.worstCaseCostNanoUsd, summary.knownCostNanoUsd);
  assert.equal(summary.productionEligible, false);
  assert.equal(summary.mode, 'MOCK');
  assert.deepEqual(gw.calls.map(c => c.kind), [...Array(2).fill('metadata'), ...Array(36).fill('count'), ...Array(36).fill('inference')]);
  assert.equal(gw.maxActive(), 1);
  assert.deepEqual(gw.calls.slice(0, 2).map(c => c.request.path), Object.values(MODELS).map(m => `/anthropic/v1/models/${m}`));
  const plan = acceptancePlan(), counts = gw.calls.filter(c => c.kind === 'count'), sent = gw.calls.filter(c => c.kind === 'inference');
  plan.cases.forEach((c, i) => {
    const { max_tokens: _, ...countBody } = c.prepared.request.body;
    assert.equal(counts[i].request.body, JSON.stringify(countBody));
    assert.equal(sent[i].request.body, JSON.stringify(c.prepared.request.body));
    assert.deepEqual(sent[i].request.headers, c.prepared.request.headers);
    assert.equal(Object.keys(sent[i].request.headers).some(k => /authorization|api-key|cf-aig-authorization/i.test(k)), false);
  });
  const log = entries(path), text = read(path), results = log.filter(e => e.entry === 'result');
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.equal(log[0].entry, 'run');
  assert.equal(log[0].mode, 'MOCK');
  assert.equal(log.at(-1).entry, 'summary');
  assert.equal(results.length, 74);
  for (const r of results) assert.deepEqual(log[log.indexOf(r) - 1], { entry: 'attempt', call: r.call, id: r.id });
  for (const r of results.filter(e => e.call === 'count')) assert.equal(r.inputTokens, r.id.includes('/WEEKLY/') ? 6553 : 13107);
  for (const r of results.filter(e => e.call === 'inference')) {
    assert.ok(r.report.reflection);
    assert.equal(r.structural.productionEligible, false);
    assert.equal(r.factualReview, 'PENDING');
    assert.equal(r.writingReview, 'PENDING');
  }
  for (const forbidden of [CANARY, 'thinking', 'signature', 'x-api-key', 'anthropic-version', 'synthetic-prompt-owner']) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});

test('an existing, interrupted or completed ledger is never resumed or replayed', async () => {
  const first = await run(kind => kind === 'metadata' ? reply(401, { error: CANARY }) : undefined);
  assert.equal(first.summary.stopReason, 'PREFLIGHT_MODEL_UNCONFIRMED');
  const interrupted = ledgerPath(), crashed = JSON.stringify({ entry: 'attempt', call: 'inference', id: 'mixed-work/WEEKLY/en' }) + '\n';
  writeFileSync(interrupted, crashed);
  for (const path of [first.path, interrupted]) {
    const gw = gateway();
    await assert.rejects(runAcceptance({ transport: gw.transport, mockLedgerPath: path }), /ACCEPTANCE_LEDGER_UNAVAILABLE/);
    assert.equal(gw.calls.length, 0);
  }
  assert.equal(read(interrupted), crashed);
});

for (const [name, kind, index, respond, calls] of [
  ['model ID resolves to another ID', 'metadata', 0, () => reply(200, { type: 'model', id: `${MODELS.WEEKLY}-20261001` }), [1, 0]],
  ['Models API unavailable', 'metadata', 1, () => reply(404, { error: CANARY }), [2, 0]],
  ['token count rejected', 'count', 0, () => reply(400, { error: CANARY }), [2, 1]],
  ['token count not an integer', 'count', 0, () => reply(200, { input_tokens: '900' }), [2, 1]],
  ['Weekly count lacks 25% headroom', 'count', 0, () => reply(200, { input_tokens: 6554 }), [2, 1]],
  ['Monthly count lacks 25% headroom', 'count', 3, () => reply(200, { input_tokens: 13108 }), [2, 4]]
]) test(`preflight stops before any inference: ${name}`, async () => {
  const { path, gw, summary } = await run((k, i) => k === kind && i === index ? respond() : undefined);
  assert.equal(summary.status, 'STOPPED');
  assert.match(summary.stopReason, /^PREFLIGHT_/);
  assert.deepEqual(summary.calls, { metadata: calls[0], count: calls[1], inference: 0 });
  assert.equal(gw.calls.some(c => c.kind === 'inference'), false);
  assert.equal(summary.worstCaseCostNanoUsd, 0);
  assert.equal(read(path).includes(CANARY), false);
});

test('billed refusal, max_tokens, malformed and insufficient samples are terminal, kept and never retried', async () => {
  const replies = [
    r => message(r, { stop_reason: 'refusal', content: [{ type: 'text', text: CANARY }] }),
    r => message(r, { stop_reason: 'max_tokens', usage: { input_tokens: 1000, output_tokens: 2048 } }),
    r => message(r, { content: [{ type: 'text', text: JSON.stringify({ ...envelopeOf(r), extra: CANARY }) }] }),
    r => message(r, { content: [{ type: 'text', text: '{}' }, { type: 'text', text: '{}' }] }),
    r => message(r, { content: [{ type: 'text', text: JSON.stringify({ ...envelopeOf(r), state: 'insufficient',
      reason: 'insufficient_evidence', reflection: '', references: [] }) }] })
  ];
  const { path, gw, summary } = await run((kind, i, request) => kind === 'inference' && replies[i] ? reply(200, replies[i](request)) : undefined);
  assert.equal(summary.status, 'COMPLETED');
  assert.deepEqual(summary.outcomes, { PROVIDER_REFUSAL: 1, MAX_TOKENS: 1, FAILED_SAMPLE: 2, ENVELOPE_INSUFFICIENT: 1, STRUCTURE_CHECKED: 31 });
  assert.equal(summary.knownCostNanoUsd, 18 * CASE_COST.WEEKLY + 18 * CASE_COST.MONTHLY + 2048 * 10000 - 500 * 10000);
  assert.equal(summary.worstCaseCostNanoUsd, summary.knownCostNanoUsd);
  const log = entries(path), attempts = log.filter(e => e.entry === 'attempt' && e.call === 'inference').map(e => e.id);
  const results = log.filter(e => e.entry === 'result' && e.call === 'inference');
  assert.equal(gw.calls.filter(c => c.kind === 'inference').length, 36);
  assert.equal(new Set(attempts).size, 36);
  assert.equal(results[0].report, undefined);
  assert.deepEqual(results.slice(2, 4).map(r => r.failure), ['EVAL_RESPONSE_REJECTED', 'RESPONSE_SHAPE_REJECTED']);
  assert.equal(read(path).includes(CANARY), false);
});

for (const [name, respond, outcome, stopReason, costKnown] of [
  ['network failure', () => { throw Error(CANARY); }, 'AMBIGUOUS_TRANSPORT', 'AMBIGUOUS_TRANSPORT', false],
  ['HTTP 500', () => reply(500, { error: CANARY }), 'PROVIDER_HTTP_500', 'PROVIDER_HTTP_ERROR', false],
  ['HTTP 401', () => reply(401, { error: CANARY }), 'PROVIDER_HTTP_401', 'PROVIDER_HTTP_ERROR', false],
  ['HTTP 429', () => reply(429, { error: CANARY }), 'PROVIDER_HTTP_429', 'PROVIDER_HTTP_ERROR', false],
  ['unparseable body', () => reply(200, `not json ${CANARY}`), 'USAGE_UNCERTAIN', 'USAGE_UNCERTAIN', false],
  ['missing usage', r => reply(200, message(r, { usage: undefined })), 'USAGE_UNCERTAIN', 'USAGE_UNCERTAIN', false],
  ['cache usage', r => reply(200, message(r, { usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 5 } })),
    'USAGE_UNCERTAIN', 'USAGE_UNCERTAIN', false],
  ['non-standard service tier', r => reply(200, message(r, { usage: { input_tokens: 1000, output_tokens: 500, service_tier: 'priority' } })),
    'USAGE_UNCERTAIN', 'USAGE_UNCERTAIN', false],
  ['oversized response', () => reply(200, 'x'.repeat(BOUNDS.responseBytes + 1)), 'AMBIGUOUS_RESPONSE_TOO_LARGE', 'AMBIGUOUS_RESPONSE_TOO_LARGE', false],
  ['model substitution', r => reply(200, message(r, { model: `${MODELS.WEEKLY}-20261001` })), 'RESPONSE_IDENTITY_MISMATCH',
    'RESPONSE_IDENTITY_MISMATCH', true],
  ['usage above allowance', r => reply(200, message(r, { usage: { input_tokens: 1000, output_tokens: 5000 } })), 'USAGE_OVER_ALLOWANCE',
    'USAGE_OVER_ALLOWANCE', true]
]) test(`inference stops the batch without retry on ${name}`, async () => {
  const { path, gw, summary } = await run((kind, i, request) => kind === 'inference' && i === 2 ? respond(request) : undefined);
  const last = entries(path).filter(e => e.entry === 'result' && e.call === 'inference').at(-1);
  assert.equal(summary.status, 'STOPPED');
  assert.equal(summary.stopReason, stopReason);
  assert.equal(last.outcome, outcome);
  assert.equal(summary.calls.inference, 3);
  assert.equal(gw.calls.filter(c => c.kind === 'inference').length, 3);
  assert.equal(summary.worstCaseCostNanoUsd - summary.knownCostNanoUsd, costKnown ? 0 : WEEKLY_RESERVATION);
  assert.ok(summary.worstCaseCostNanoUsd <= BOUNDS.ceilingNanoUsd);
  assert.equal(read(path).includes(CANARY), false);
});

test('per-call deadline covers body reads; timeout aborts, stops and discards the late completion', async () => {
  const delayed = async request => { await new Promise(resolve => setTimeout(resolve, 120)); return reply(200, message(request)); };
  const stalled = () => ({ status: 200, body: new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('{"type":'));
    setTimeout(() => controller.close(), 120);
  } }) });
  for (const respond of [delayed, stalled]) {
    let seen;
    const { path, summary } = await run((kind, i, request, signal) => {
      if (kind !== 'inference' || i !== 0) return undefined;
      seen = signal;
      return respond(request);
    }, { callTimeoutMs: 40 });
    const settled = read(path);
    assert.equal(summary.stopReason, 'AMBIGUOUS_TIMEOUT');
    assert.equal(summary.calls.inference, 1);
    assert.equal(seen.aborted, true);
    assert.equal(summary.worstCaseCostNanoUsd, WEEKLY_RESERVATION);
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(read(path), settled);
  }
  for (const callTimeoutMs of [0, 1.5, BOUNDS.callTimeoutMs + 1]) {
    await assert.rejects(runAcceptance({ transport: gateway().transport, mockLedgerPath: ledgerPath(), callTimeoutMs }), /ACCEPTANCE_CONFIG_REJECTED/);
  }
  await assert.rejects(runAcceptance({ mockLedgerPath: ledgerPath() }), /ACCEPTANCE_CONFIG_REJECTED/);
});

test('whole-run 20-minute deadline stops before a call could finish after it', async () => {
  let clock = 0;
  const { summary } = await run((kind, i) => {
    if (kind === 'inference' && i === 1) clock = BOUNDS.runDeadlineMs - BOUNDS.callTimeoutMs + 1;
  }, { now: () => clock });
  assert.equal(summary.stopReason, 'RUN_DEADLINE');
  assert.equal(summary.calls.inference, 2);
});

test('runner ships no transport, environment, network, database or send mode', () => {
  const source = read(fileURLToPath(new URL('./acceptance.mjs', import.meta.url)));
  assert.deepEqual([...source.matchAll(/^import .* from '([^']+)';$/gm)].map(m => m[1]).sort(), ['../../lib/ai-gateway-config.js',
    './experiment.mjs', './fixtures.mjs', 'node:child_process', 'node:fs', 'node:os', 'node:path', 'node:url']);
  assert.doesNotMatch(source, /\bfetch\b|process\.env|prisma|node:https?|node:net|node:dns|WebSocket/);
  const script = 'experiments/prompt-first-reflection/acceptance.mjs';
  const plan = JSON.parse(execFileSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8' }));
  assert.equal(plan.cases.length, 36);
  assert.equal(plan.providerCalls, 0);
  assert.equal(plan.reservedUsd, 3.6864);
  assert.equal(plan.transport, 'none');
  assert.throws(() => execFileSync(process.execPath, [script, '--send'], { cwd: ROOT, stdio: 'ignore' }));
});

test('live mode has one fixed per-commit ledger: no path or option override, and a consumed run blocks every rerun', () => {
  // Isolated HOME in a child process, so this never touches the real live ledger. The transport is still a mock.
  const home = mkdtempSync(join(tmpdir(), 'petalpal-acceptance-home-'));
  const script = `import { readFileSync } from 'node:fs';
import { liveLedgerPath, runAcceptance } from ${JSON.stringify(new URL('./acceptance.mjs', import.meta.url).href)};
const calls = [], transport = async request => { calls.push(request.path); return { status: 401, body: new Response('{}').body }; };
const first = await runAcceptance({ transport }), consumed = readFileSync(liveLedgerPath(), 'utf8'), reruns = [];
for (const options of [{ transport }, { transport, ledgerPath: ${JSON.stringify(join(home, 'other.jsonl'))} }, { transport, now: () => 0 }]) {
  reruns.push(await runAcceptance(options).then(() => 'RAN', error => error.message));
}
console.log(JSON.stringify({ path: liveLedgerPath(), first: [first.mode, first.stopReason], calls: calls.length, reruns,
  unchanged: readFileSync(liveLedgerPath(), 'utf8') === consumed }));`;
  const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script],
    { cwd: ROOT, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: home } }));
  assert.deepEqual(result, { path: join(home, '.petalpal-acceptance', `${APPROVED_COMMIT}.jsonl`),
    first: ['LIVE', 'PREFLIGHT_MODEL_UNCONFIRMED'], calls: 1, unchanged: true,
    reruns: ['ACCEPTANCE_LEDGER_UNAVAILABLE', 'ACCEPTANCE_CONFIG_REJECTED', 'ACCEPTANCE_CONFIG_REJECTED'] });
});

test('direct Anthropic adapter: refused in MOCK runs, exact official endpoints in LIVE, key never in the ledger', async () => {
  const KEY = `sk-ant-${CANARY}`, seen = [], priorHome = process.env.HOME, priorFetch = globalThis.fetch;
  const fetchMock = async (url, init) => {
    seen.push({ url, init });
    const { pathname } = new URL(url);
    if (init.method === 'GET') return new Response(JSON.stringify({ type: 'model', id: pathname.split('/').pop() }));
    return new Response(JSON.stringify(pathname.endsWith('/count_tokens') ? { input_tokens: 1000 } : message({ body: init.body })));
  };
  let captured;
  const real = anthropicTransport(KEY, fetchMock), wrapped = (request, options) => { captured = options.grant; return real(request, options); };
  process.env.HOME = mkdtempSync(join(tmpdir(), 'petalpal-acceptance-home-'));
  globalThis.fetch = () => { throw Error('Only the injected fetch may be used'); };
  try {
    const mock = await runAcceptance({ transport: real, mockLedgerPath: ledgerPath() });
    assert.deepEqual([mock.mode, mock.stopReason, seen.length], ['MOCK', 'PREFLIGHT_MODEL_UNCONFIRMED', 0]);
    const live = await runAcceptance({ transport: wrapped });
    assert.deepEqual([live.mode, live.status, live.calls], ['LIVE', 'COMPLETED', { metadata: 2, count: 36, inference: 36 }]);
    assert.deepEqual(seen.map(s => s.url), [...Object.values(MODELS).map(m => `https://api.anthropic.com/v1/models/${m}`),
      ...Array(36).fill('https://api.anthropic.com/v1/messages/count_tokens'), ...Array(36).fill('https://api.anthropic.com/v1/messages')]);
    for (const { init } of seen) {
      assert.equal(init.redirect, 'error');
      assert.ok(init.signal instanceof AbortSignal);
      assert.deepEqual(init.headers, { 'x-api-key': KEY, 'anthropic-version': acceptancePlan().cases[0].prepared.request.headers['anthropic-version'],
        ...(init.method === 'POST' ? { 'content-type': 'application/json' } : {}) });
    }
    acceptancePlan().cases.forEach((c, i) => assert.equal(seen[38 + i].init.body, JSON.stringify(c.prepared.request.body)));
    assert.equal(read(liveLedgerPath()).includes(CANARY), false);
    await assert.rejects(real({ method: 'POST', path: '/anthropic/v1/messages', body: '{}' }, { grant: captured }),
      /ANTHROPIC_TRANSPORT_LIVE_RUN_REQUIRED/);
    assert.equal(seen.length, 74);
  } finally {
    if (priorHome === undefined) delete process.env.HOME; else process.env.HOME = priorHome;
    globalThis.fetch = priorFetch;
  }
});

test('live CLI fails closed without an injected key: no request and no ledger', () => {
  const home = mkdtempSync(join(tmpdir(), 'petalpal-acceptance-home-'));
  let stderr = '';
  try {
    execFileSync(process.execPath, ['experiments/prompt-first-reflection/live-anthropic.mjs'],
      { cwd: ROOT, env: { PATH: process.env.PATH, HOME: home }, stdio: 'pipe' });
  } catch (error) { stderr = String(error.stderr); }
  assert.match(stderr, /ANTHROPIC_TRANSPORT_CONFIG_REJECTED/);
  assert.equal(existsSync(join(home, '.petalpal-acceptance')), false);
  for (const key of ['', ' sk-ant-x', 'sk-ant-x\n']) assert.throws(() => anthropicTransport(key, async () => {}), /CONFIG_REJECTED/);
});

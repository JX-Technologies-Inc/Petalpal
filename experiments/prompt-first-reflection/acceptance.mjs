// Approval-gated runner for the 36-case first acceptance batch in docs/ai/PROMPT_FIRST_REFLECTION.md.
// Ships no transport, credential, environment access, database, user Event or report persistence. A trusted
// caller injects `transport(request, { signal, grant })` -> `{ status, body: AsyncIterable<Uint8Array> }`; only
// that transport binds the provider origin and credentials (see live-anthropic.mjs).
import { execFileSync } from 'node:child_process';
import { closeSync, fsyncSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATEWAY_MODELS } from '../../lib/ai-gateway-config.js';
import { LIMITS, LOCALES, TYPES, prepareExperiment } from './experiment.mjs';
import { fixture, scenarios } from './fixtures.mjs';

export const APPROVED_COMMIT = 'c569975829c5aa8b9413cbccb0faf04b9f41f94c';
export const APPROVED_SCENARIOS = Object.freeze(['mixed-work', 'relationship', 'negation', 'cause', 'injection', 'sparse']);
export const MODELS = Object.freeze({ WEEKLY: 'claude-sonnet-5-5', MONTHLY: 'claude-opus-5-5' });
export const BOUNDS = Object.freeze({ cases: 36, perType: 18, ceilingNanoUsd: 4e9, countHeadroom: 1.25,
  callTimeoutMs: 20000, runDeadlineMs: 20 * 60000, responseBytes: 65536 });
// Request-construction inputs that must remain identical to the approved commit.
const PINNED = ['experiments/prompt-first-reflection/experiment.mjs', 'experiments/prompt-first-reflection/fixtures.mjs',
  'experiments/prompt-first-reflection/prompts', 'lib/ai-gateway-config.js', 'lib/ai-gateway-schema.js'];
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ALLOWED_BLOCKS = new Set(['text', 'thinking', 'redacted_thinking']);
class Stop { constructor(reason) { this.reason = reason; } }
const parse = text => { try { return JSON.parse(text); } catch { return undefined; } };

export function assertPinnedSources(commit = APPROVED_COMMIT) {
  try { execFileSync('git', ['diff', '--quiet', commit, '--', ...PINNED], { cwd: ROOT, stdio: 'ignore' }); }
  catch { throw Error('ACCEPTANCE_SOURCE_PIN_FAILED'); }
}

export function acceptancePlan() {
  const cases = APPROVED_SCENARIOS.flatMap(id => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) throw Error('ACCEPTANCE_PLAN_REJECTED');
    return TYPES.flatMap(type => LOCALES.map(locale => {
      const current = () => fixture(scenario, type, locale), prepared = prepareExperiment(current());
      const { model, messages } = prepared.request.body;
      return { id: `${id}/${type}/${locale}`, scenario: id, type, locale, model,
        promptVersion: JSON.parse(messages[0].content).promptVersion, prepared, current };
    }));
  });
  const reservedNanoUsd = cases.reduce((n, c) => n + c.prepared.reservation.reservedNanoUsd, 0);
  if (cases.length !== BOUNDS.cases || new Set(cases.map(c => c.id)).size !== BOUNDS.cases ||
      TYPES.some(t => cases.filter(c => c.type === t && c.model === MODELS[t]).length !== BOUNDS.perType) ||
      reservedNanoUsd > BOUNDS.ceilingNanoUsd) throw Error('ACCEPTANCE_PLAN_REJECTED');
  return { cases, reservedNanoUsd };
}

// One HTTP attempt. The deadline covers the transport call and every body read; late results are discarded.
async function exchange(transport, request, timeoutMs, grant) {
  const controller = new AbortController();
  let timer;
  const expired = new Promise(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve({ error: 'AMBIGUOUS_TIMEOUT' }); }, timeoutMs);
  });
  const attempt = (async () => {
    try {
      const response = await transport(request, { signal: controller.signal, grant }), status = response?.status, chunks = [];
      if (!Number.isSafeInteger(status) || status < 100 || status > 599 ||
          typeof response.body?.[Symbol.asyncIterator] !== 'function') return { error: 'AMBIGUOUS_TRANSPORT' };
      let bytes = 0;
      for await (const chunk of response.body) {
        if (!(chunk instanceof Uint8Array)) return { error: 'AMBIGUOUS_TRANSPORT' };
        if ((bytes += chunk.byteLength) > BOUNDS.responseBytes) return { error: 'AMBIGUOUS_RESPONSE_TOO_LARGE' };
        chunks.push(chunk);
      }
      return { status, text: Buffer.concat(chunks).toString('utf8') };
    } catch { return { error: 'AMBIGUOUS_TRANSPORT' }; }
  })();
  try { return await Promise.race([attempt, expired]); } finally { clearTimeout(timer); }
}

// Billed outcomes are terminal samples. Anything without verifiable standard usage is uncertain expenditure.
function assess(c, r) {
  if (r.error) return { outcome: r.error, stop: r.error };
  if (r.status !== 200) return { outcome: `PROVIDER_HTTP_${r.status}`, stop: 'PROVIDER_HTTP_ERROR' };
  const m = parse(r.text), u = m?.usage;
  if (![u?.input_tokens, u?.output_tokens].every(n => Number.isSafeInteger(n) && n >= 0) ||
      (u.cache_creation_input_tokens ?? 0) !== 0 || (u.cache_read_input_tokens ?? 0) !== 0 ||
      (u.service_tier ?? 'standard') !== 'standard') return { outcome: 'USAGE_UNCERTAIN', stop: 'USAGE_UNCERTAIN' };
  const rate = GATEWAY_MODELS[c.model], usage = { inputTokens: u.input_tokens, outputTokens: u.output_tokens };
  const billed = { usage, costNanoUsd: usage.inputTokens * rate.inputRate + usage.outputTokens * rate.outputRate,
    stopReason: typeof m.stop_reason === 'string' && /^[a-z_]{1,40}$/.test(m.stop_reason) ? m.stop_reason : 'unrecognized' };
  if (m.type !== 'message' || m.role !== 'assistant' || m.model !== c.model)
    return { ...billed, outcome: 'RESPONSE_IDENTITY_MISMATCH', stop: 'RESPONSE_IDENTITY_MISMATCH' };
  if (usage.inputTokens > LIMITS[c.type].input || usage.outputTokens > LIMITS[c.type].output)
    return { ...billed, outcome: 'USAGE_OVER_ALLOWANCE', stop: 'USAGE_OVER_ALLOWANCE' };
  if (m.stop_reason === 'refusal') return { ...billed, outcome: 'PROVIDER_REFUSAL' };
  if (m.stop_reason === 'max_tokens') return { ...billed, outcome: 'MAX_TOKENS' };
  const blocks = Array.isArray(m.content) ? m.content : [], text = blocks.filter(b => b?.type === 'text');
  if (m.stop_reason !== 'end_turn' || text.length !== 1 || typeof text[0].text !== 'string' ||
      !blocks.every(b => ALLOWED_BLOCKS.has(b?.type))) return { ...billed, outcome: 'FAILED_SAMPLE', failure: 'RESPONSE_SHAPE_REJECTED' };
  // Thinking blocks are never read or saved; only the single JSON text block is evaluated.
  const envelope = parse(text[0].text), reflection = typeof envelope?.reflection === 'string' ? envelope.reflection : undefined;
  try {
    const structural = c.prepared.evaluate(envelope, c.current());
    return { ...billed, outcome: structural.status === 'STRUCTURE_CHECKED_UNVERIFIED_PROSE' ? 'STRUCTURE_CHECKED'
      : `ENVELOPE_${structural.status.toUpperCase()}`, report: { state: envelope.state, reason: envelope.reason, reflection,
      references: envelope.references }, structural, factualReview: 'PENDING', writingReview: 'PENDING' };
  } catch (error) {
    if (error?.message === 'EVAL_SOURCE_CHANGED') return { ...billed, outcome: 'SOURCE_CHANGED', stop: 'SOURCE_CHANGED' };
    return { ...billed, outcome: 'FAILED_SAMPLE', reflection,
      failure: /^EVAL_[A-Z_]+$/.test(error?.message) ? error.message : 'EVAL_REJECTED' };
  }
}

// A live run (no mockLedgerPath) always uses this fixed per-commit ledger and accepts no other option, so choosing
// another path cannot start a second live run. Mocked runs must name their own ledger and are labelled MOCK.
// Local only: NOT cross-machine replay prevention. A MOCK run never authorizes real or paid calls.
export const liveLedgerPath = () => join(homedir(), '.petalpal-acceptance', `${APPROVED_COMMIT}.jsonl`);
// Real transports must refuse unless called by an active LIVE run. MOCK runs never hold a grant; revoked at run end.
const liveGrants = new WeakSet();
export const isLiveGrant = grant => liveGrants.has(grant);

export async function runAcceptance({ transport, mockLedgerPath, ...mockOptions } = {}) {
  const mode = mockLedgerPath === undefined ? 'LIVE' : 'MOCK', ledgerPath = mode === 'LIVE' ? liveLedgerPath() : mockLedgerPath;
  const { now = Date.now, callTimeoutMs = BOUNDS.callTimeoutMs, ...unknown } = mockOptions;
  if (typeof transport !== 'function' || (mode === 'LIVE' && Object.keys(mockOptions).length) || Object.keys(unknown).length ||
      typeof ledgerPath !== 'string' || !ledgerPath || typeof now !== 'function' ||
      !Number.isSafeInteger(callTimeoutMs) || callTimeoutMs < 1 || callTimeoutMs > BOUNDS.callTimeoutMs) {
    throw Error('ACCEPTANCE_CONFIG_REJECTED');
  }
  assertPinnedSources();
  const plan = acceptancePlan();
  let fd;
  try { // Single run: an existing ledger, even empty or partial, is never resumed or replayed.
    if (mode === 'LIVE') mkdirSync(dirname(ledgerPath), { recursive: true, mode: 0o700 });
    fd = openSync(ledgerPath, 'wx', 0o600);
    const dir = openSync(dirname(ledgerPath), 'r');
    try { fsyncSync(dir); } finally { closeSync(dir); }
  } catch {
    if (fd !== undefined) closeSync(fd);
    throw Error('ACCEPTANCE_LEDGER_UNAVAILABLE');
  }
  const write = entry => { writeSync(fd, JSON.stringify(entry) + '\n'); fsyncSync(fd); };
  const started = now(), calls = { metadata: 0, count: 0, inference: 0 }, outcomes = {}, grant = Object.freeze({});
  if (mode === 'LIVE') liveGrants.add(grant);
  let knownNanoUsd = 0, uncertainNanoUsd = 0;
  const finish = stopReason => {
    const summary = { mode, status: stopReason ? 'STOPPED' : 'COMPLETED', stopReason, calls: { ...calls }, outcomes: { ...outcomes },
      knownCostNanoUsd: knownNanoUsd, worstCaseCostNanoUsd: knownNanoUsd + uncertainNanoUsd,
      reservedNanoUsd: plan.reservedNanoUsd, ceilingNanoUsd: BOUNDS.ceilingNanoUsd, productionEligible: false };
    write({ entry: 'summary', ...summary });
    return summary;
  };
  const send = async (call, id, request) => {
    if (now() - started + callTimeoutMs > BOUNDS.runDeadlineMs) throw new Stop('RUN_DEADLINE');
    calls[call]++;
    write({ entry: 'attempt', call, id }); // Durable before dispatch: a crash or unknown outcome consumes it.
    const begin = now(), result = await exchange(transport, request, callTimeoutMs, grant);
    return { ...result, latencyMs: now() - begin };
  };
  const { 'Content-Type': _, ...getHeaders } = plan.cases[0].prepared.request.headers;
  try {
    write({ entry: 'run', mode, commit: APPROVED_COMMIT, cases: plan.cases.map(c => c.id),
      reservedNanoUsd: plan.reservedNanoUsd, ceilingNanoUsd: BOUNDS.ceilingNanoUsd });
    for (const model of Object.values(MODELS)) {
      const r = await send('metadata', model, { method: 'GET', path: `/anthropic/v1/models/${model}`, headers: { ...getHeaders } });
      const m = r.status === 200 ? parse(r.text) : undefined;
      const outcome = r.error ?? (r.status !== 200 ? `HTTP_${r.status}`
        : m?.type === 'model' && m.id === model ? 'MODEL_CONFIRMED' : 'MODEL_MISMATCH');
      write({ entry: 'result', call: 'metadata', id: model, outcome, latencyMs: r.latencyMs });
      if (outcome !== 'MODEL_CONFIRMED') throw new Stop('PREFLIGHT_MODEL_UNCONFIRMED');
    }
    for (const c of plan.cases) {
      const { model, system, messages, output_config } = c.prepared.request.body;
      const r = await send('count', c.id, { method: 'POST', path: '/anthropic/v1/messages/count_tokens',
        headers: { ...c.prepared.request.headers }, body: JSON.stringify({ model, system, messages, output_config }) });
      const n = r.status === 200 ? parse(r.text)?.input_tokens : undefined, counted = Number.isSafeInteger(n) && n > 0;
      const outcome = r.error ?? (r.status !== 200 ? `HTTP_${r.status}` : !counted ? 'COUNT_INVALID'
        : Math.ceil(n * BOUNDS.countHeadroom) <= LIMITS[c.type].input ? 'WITHIN_ALLOWANCE' : 'OVER_ALLOWANCE');
      write({ entry: 'result', call: 'count', id: c.id, outcome, inputTokens: counted ? n : null, latencyMs: r.latencyMs });
      if (outcome !== 'WITHIN_ALLOWANCE') throw new Stop('PREFLIGHT_TOKEN_COUNT_REJECTED');
    }
    for (const c of plan.cases) {
      try { c.prepared.assertCurrent(c.current()); } catch { throw new Stop('SOURCE_CHANGED'); }
      const r = await send('inference', c.id, { ...c.prepared.request, headers: { ...c.prepared.request.headers },
        body: JSON.stringify(c.prepared.request.body) });
      const { stop, ...result } = assess(c, r);
      if (result.costNanoUsd === undefined) uncertainNanoUsd += c.prepared.reservation.reservedNanoUsd;
      else knownNanoUsd += result.costNanoUsd;
      outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1;
      write({ entry: 'result', call: 'inference', id: c.id, scenario: c.scenario, type: c.type, locale: c.locale,
        model: c.model, promptVersion: c.promptVersion, latencyMs: r.latencyMs, ...result });
      if (stop) throw new Stop(stop);
      if (knownNanoUsd + uncertainNanoUsd > BOUNDS.ceilingNanoUsd) throw new Stop('BUDGET_CEILING');
    }
    return finish(null);
  } catch (error) {
    if (error instanceof Stop) return finish(error.reason);
    finish('RUNNER_ERROR');
    throw Error('ACCEPTANCE_RUNNER_ERROR');
  } finally { liveGrants.delete(grant); closeSync(fd); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) throw Error('No arguments are supported; there is no send mode');
  assertPinnedSources();
  const { cases, reservedNanoUsd } = acceptancePlan();
  console.log(JSON.stringify({ approvedCommit: APPROVED_COMMIT, cases: cases.map(c => c.id), models: MODELS,
    maximumCalls: { metadata: 2, count: cases.length, inference: cases.length }, reservedUsd: reservedNanoUsd / 1e9,
    ceilingUsd: BOUNDS.ceilingNanoUsd / 1e9, liveLedger: liveLedgerPath(), providerCalls: 0, transport: 'none' }, null, 2));
}

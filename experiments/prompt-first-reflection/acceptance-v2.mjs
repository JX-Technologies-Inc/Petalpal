// Approval-ready runner for the proposed 12-case v2 batch. This module has no transport, credential lookup,
// environment access, database, user Event or report persistence, and its CLI can only print an offline plan.
import { execFileSync } from 'node:child_process';
import { closeSync, fsyncSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATEWAY_MODELS } from '../../lib/ai-gateway-config.js';
import { LIMITS, LOCALES, TYPES, prepareExperimentV2 } from './experiment-v2.mjs';
import { fixture, scenarios } from './fixtures.mjs';

export const APPROVED_PROMPT_COMMIT = '1e3b538fbda09a59f7d38c3c7c0f4973cc5014da';
export const MATRIX_ID = 'v2-negation-mixed-work-12';
export const APPROVED_SCENARIOS = Object.freeze(['negation', 'mixed-work']);
export const MODELS = Object.freeze({ WEEKLY: 'claude-sonnet-5-5', MONTHLY: 'claude-opus-5-5' });
export const BOUNDS = Object.freeze({ cases: 12, perType: 6, ceilingNanoUsd: 1_500_000_000, countHeadroom: 1.25,
  callTimeoutMs: 20_000, runDeadlineMs: 20 * 60_000, responseBytes: 65_536 });
const PINNED = ['experiments/prompt-first-reflection/experiment.mjs', 'experiments/prompt-first-reflection/fixtures.mjs',
  'experiments/prompt-first-reflection/prompts', 'experiments/prompt-first-reflection/experiment-v2.mjs',
  'experiments/prompt-first-reflection/prompts-v2', 'lib/ai-gateway-config.js', 'lib/ai-gateway-schema.js'];
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ALLOWED_BLOCKS = new Set(['text', 'thinking', 'redacted_thinking']);
const liveGrants = new WeakSet();
class Stop { constructor(reason) { this.reason = reason; } }
const parse = text => { try { return JSON.parse(text); } catch { return undefined; } };

export function assertV2PinnedSources(commit = APPROVED_PROMPT_COMMIT) {
  try { execFileSync('git', ['diff', '--quiet', commit, '--', ...PINNED], { cwd: ROOT, stdio: 'ignore' }); }
  catch { throw Error('V2_ACCEPTANCE_SOURCE_PIN_FAILED'); }
}

export function v2AcceptancePlan() {
  const cases = APPROVED_SCENARIOS.flatMap(id => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) throw Error('V2_ACCEPTANCE_PLAN_REJECTED');
    return TYPES.flatMap(type => LOCALES.map(locale => {
      const current = () => fixture(scenario, type, locale), prepared = prepareExperimentV2(current());
      const { model, messages } = prepared.request.body;
      return { id: `${id}/${type}/${locale}`, scenario: id, type, locale, model,
        promptVersion: JSON.parse(messages[0].content).promptVersion, prepared, current };
    }));
  });
  const reservedNanoUsd = cases.reduce((sum, c) => sum + c.prepared.reservation.reservedNanoUsd, 0);
  if (cases.length !== BOUNDS.cases || new Set(cases.map(c => c.id)).size !== BOUNDS.cases ||
      TYPES.some(type => cases.filter(c => c.type === type && c.model === MODELS[type]).length !== BOUNDS.perType) ||
      cases.some(c => c.promptVersion !== `${c.type.toLowerCase()}-reflection-prompt-v2`) ||
      reservedNanoUsd > BOUNDS.ceilingNanoUsd) throw Error('V2_ACCEPTANCE_PLAN_REJECTED');
  return { cases, reservedNanoUsd };
}

// HOME and caller input cannot move this ledger: it lives in this checkout's Git common directory and its fixed
// identity includes both the reviewed prompt commit and exact matrix. A separate clone/machine remains a human
// authorization boundary; no local file can provide cross-machine replay prevention.
export function v2LiveLedgerPath() {
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (!common) throw Error('V2_ACCEPTANCE_LEDGER_UNAVAILABLE');
  return join(common, 'petalpal-acceptance', `${MATRIX_ID}-${APPROVED_PROMPT_COMMIT}.jsonl`);
}

export const isV2LiveGrant = grant => liveGrants.has(grant);

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

function assess(c, response) {
  if (response.error) return { outcome: response.error, stop: response.error };
  if (response.status !== 200) return { outcome: `PROVIDER_HTTP_${response.status}`, stop: 'PROVIDER_HTTP_ERROR' };
  const message = parse(response.text), usageWire = message?.usage;
  if (![usageWire?.input_tokens, usageWire?.output_tokens].every(n => Number.isSafeInteger(n) && n >= 0) ||
      (usageWire.cache_creation_input_tokens ?? 0) !== 0 || (usageWire.cache_read_input_tokens ?? 0) !== 0 ||
      (usageWire.service_tier ?? 'standard') !== 'standard') return { outcome: 'USAGE_UNCERTAIN', stop: 'USAGE_UNCERTAIN' };
  const rates = GATEWAY_MODELS[c.model], usage = { inputTokens: usageWire.input_tokens, outputTokens: usageWire.output_tokens };
  const billed = { usage, costNanoUsd: usage.inputTokens * rates.inputRate + usage.outputTokens * rates.outputRate,
    stopReason: typeof message.stop_reason === 'string' && /^[a-z_]{1,40}$/.test(message.stop_reason)
      ? message.stop_reason : 'unrecognized' };
  if (message.type !== 'message' || message.role !== 'assistant' || message.model !== c.model)
    return { ...billed, outcome: 'RESPONSE_IDENTITY_MISMATCH', stop: 'RESPONSE_IDENTITY_MISMATCH' };
  if (usage.inputTokens > LIMITS[c.type].input || usage.outputTokens > LIMITS[c.type].output)
    return { ...billed, outcome: 'USAGE_OVER_ALLOWANCE', stop: 'USAGE_OVER_ALLOWANCE' };
  if (message.stop_reason === 'refusal') return { ...billed, outcome: 'PROVIDER_REFUSAL' };
  if (message.stop_reason === 'max_tokens') return { ...billed, outcome: 'MAX_TOKENS' };
  const blocks = Array.isArray(message.content) ? message.content : [], textBlocks = blocks.filter(b => b?.type === 'text');
  if (message.stop_reason !== 'end_turn' || textBlocks.length !== 1 || typeof textBlocks[0].text !== 'string' ||
      !blocks.every(b => ALLOWED_BLOCKS.has(b?.type)))
    return { ...billed, outcome: 'FAILED_SAMPLE', failure: 'RESPONSE_SHAPE_REJECTED', stop: 'INVALID_RESPONSE' };
  const envelope = parse(textBlocks[0].text), reflection = typeof envelope?.reflection === 'string' ? envelope.reflection : undefined;
  try {
    const structural = c.prepared.evaluate(envelope, c.current());
    return { ...billed, outcome: structural.status === 'STRUCTURE_CHECKED_UNVERIFIED_PROSE' ? 'STRUCTURE_CHECKED'
      : `ENVELOPE_${structural.status.toUpperCase()}`, report: { state: envelope.state, reason: envelope.reason, reflection,
      references: envelope.references }, structural, factualReview: 'PENDING', writingReview: 'PENDING' };
  } catch (error) {
    if (error?.message === 'EVAL_SOURCE_CHANGED')
      return { ...billed, outcome: 'SOURCE_CHANGED', stop: 'SOURCE_CHANGED' };
    return { ...billed, outcome: 'FAILED_SAMPLE', failure: /^EVAL_[A-Z_]+$/.test(error?.message)
      ? error.message : 'EVAL_REJECTED', stop: 'INVALID_RESPONSE' };
  }
}

async function run({ mode, transport, ledgerPath, now, callTimeoutMs }) {
  assertV2PinnedSources();
  const plan = v2AcceptancePlan();
  let fd;
  try {
    if (mode === 'LIVE') mkdirSync(dirname(ledgerPath), { recursive: true, mode: 0o700 });
    fd = openSync(ledgerPath, 'wx', 0o600);
    const directory = openSync(dirname(ledgerPath), 'r');
    try { fsyncSync(directory); } finally { closeSync(directory); }
  } catch {
    if (fd !== undefined) closeSync(fd);
    throw Error('V2_ACCEPTANCE_LEDGER_UNAVAILABLE');
  }
  const write = entry => { writeSync(fd, JSON.stringify(entry) + '\n'); fsyncSync(fd); };
  const started = now(), calls = { metadata: 0, count: 0, inference: 0 }, outcomes = {};
  const grant = mode === 'LIVE' ? Object.freeze({}) : undefined;
  if (grant) liveGrants.add(grant);
  let knownNanoUsd = 0, uncertainNanoUsd = 0;
  const finish = stopReason => {
    const summary = { mode, matrixId: MATRIX_ID, status: stopReason ? 'STOPPED' : 'COMPLETED', stopReason,
      calls: { ...calls }, outcomes: { ...outcomes }, knownCostNanoUsd: knownNanoUsd,
      worstCaseCostNanoUsd: knownNanoUsd + uncertainNanoUsd, reservedNanoUsd: plan.reservedNanoUsd,
      ceilingNanoUsd: BOUNDS.ceilingNanoUsd, productionEligible: false };
    write({ entry: 'summary', ...summary });
    return summary;
  };
  const send = async (call, id, request) => {
    if (now() - started + callTimeoutMs > BOUNDS.runDeadlineMs) throw new Stop('RUN_DEADLINE');
    calls[call]++;
    write({ entry: 'attempt', call, id });
    const begin = now(), result = await exchange(transport, request, callTimeoutMs, grant);
    return { ...result, latencyMs: now() - begin };
  };
  const { 'Content-Type': _, ...getHeaders } = plan.cases[0].prepared.request.headers;
  try {
    write({ entry: 'run', mode, matrixId: MATRIX_ID, promptCommit: APPROVED_PROMPT_COMMIT,
      cases: plan.cases.map(c => c.id), reservedNanoUsd: plan.reservedNanoUsd, ceilingNanoUsd: BOUNDS.ceilingNanoUsd });
    for (const model of Object.values(MODELS)) {
      const response = await send('metadata', model,
        { method: 'GET', path: `/anthropic/v1/models/${model}`, headers: { ...getHeaders } });
      const metadata = response.status === 200 ? parse(response.text) : undefined;
      const outcome = response.error ?? (response.status !== 200 ? `HTTP_${response.status}`
        : metadata?.type === 'model' && metadata.id === model ? 'MODEL_CONFIRMED' : 'MODEL_MISMATCH');
      write({ entry: 'result', call: 'metadata', id: model, outcome, latencyMs: response.latencyMs });
      if (outcome !== 'MODEL_CONFIRMED') throw new Stop('PREFLIGHT_MODEL_UNCONFIRMED');
    }
    for (const c of plan.cases) {
      const { model, system, messages, output_config } = c.prepared.request.body;
      const response = await send('count', c.id, { method: 'POST', path: '/anthropic/v1/messages/count_tokens',
        headers: { ...c.prepared.request.headers }, body: JSON.stringify({ model, system, messages, output_config }) });
      const inputTokens = response.status === 200 ? parse(response.text)?.input_tokens : undefined;
      const counted = Number.isSafeInteger(inputTokens) && inputTokens > 0;
      const outcome = response.error ?? (response.status !== 200 ? `HTTP_${response.status}` : !counted ? 'COUNT_INVALID'
        : Math.ceil(inputTokens * BOUNDS.countHeadroom) <= LIMITS[c.type].input ? 'WITHIN_ALLOWANCE' : 'OVER_ALLOWANCE');
      write({ entry: 'result', call: 'count', id: c.id, outcome, inputTokens: counted ? inputTokens : null,
        latencyMs: response.latencyMs });
      if (outcome !== 'WITHIN_ALLOWANCE') throw new Stop('PREFLIGHT_TOKEN_COUNT_REJECTED');
    }
    for (const c of plan.cases) {
      if (knownNanoUsd + uncertainNanoUsd + c.prepared.reservation.reservedNanoUsd > BOUNDS.ceilingNanoUsd)
        throw new Stop('BUDGET_CEILING');
      try { c.prepared.assertCurrent(c.current()); } catch { throw new Stop('SOURCE_CHANGED'); }
      const response = await send('inference', c.id, { ...c.prepared.request,
        headers: { ...c.prepared.request.headers }, body: JSON.stringify(c.prepared.request.body) });
      const { stop, ...result } = assess(c, response);
      if (result.costNanoUsd === undefined) uncertainNanoUsd += c.prepared.reservation.reservedNanoUsd;
      else knownNanoUsd += result.costNanoUsd;
      outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1;
      write({ entry: 'result', call: 'inference', id: c.id, scenario: c.scenario, type: c.type, locale: c.locale,
        model: c.model, promptVersion: c.promptVersion, latencyMs: response.latencyMs, ...result });
      if (knownNanoUsd + uncertainNanoUsd > BOUNDS.ceilingNanoUsd) throw new Stop('BUDGET_CEILING');
      if (stop) throw new Stop(stop);
    }
    return finish(null);
  } catch (error) {
    if (error instanceof Stop) return finish(error.reason);
    finish('RUNNER_ERROR');
    throw Error('V2_ACCEPTANCE_RUNNER_ERROR');
  } finally {
    if (grant) liveGrants.delete(grant);
    closeSync(fd);
  }
}

export async function runV2Mock({ transport, mockLedgerPath, now = Date.now,
  callTimeoutMs = BOUNDS.callTimeoutMs, ...unknown } = {}) {
  if (Object.keys(unknown).length || typeof transport !== 'function' || typeof mockLedgerPath !== 'string' ||
      !mockLedgerPath || typeof now !== 'function' || !Number.isSafeInteger(callTimeoutMs) || callTimeoutMs < 1 ||
      callTimeoutMs > BOUNDS.callTimeoutMs) throw Error('V2_ACCEPTANCE_CONFIG_REJECTED');
  return run({ mode: 'MOCK', transport, ledgerPath: mockLedgerPath, now, callTimeoutMs });
}

export async function runV2Live({ transport, ...unknown } = {}) {
  if (Object.keys(unknown).length || typeof transport !== 'function') throw Error('V2_ACCEPTANCE_CONFIG_REJECTED');
  return run({ mode: 'LIVE', transport, ledgerPath: v2LiveLedgerPath(), now: Date.now,
    callTimeoutMs: BOUNDS.callTimeoutMs });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) throw Error('No arguments are supported; there is no send mode');
  assertV2PinnedSources();
  const { cases, reservedNanoUsd } = v2AcceptancePlan();
  console.log(JSON.stringify({ status: 'PREPARED_NOT_AUTHORIZED', promptCommit: APPROVED_PROMPT_COMMIT,
    matrixId: MATRIX_ID, cases: cases.map(c => c.id), models: MODELS,
    maximumCalls: { metadata: 2, count: cases.length, inference: cases.length }, reservedUsd: reservedNanoUsd / 1e9,
    ceilingUsd: BOUNDS.ceilingNanoUsd / 1e9, ledgerIdentity: `${MATRIX_ID}-${APPROVED_PROMPT_COMMIT}`,
    providerCalls: 0, transport: 'none' }, null, 2));
}

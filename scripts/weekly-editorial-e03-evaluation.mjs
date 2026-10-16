// Fresh, isolated four-call Weekly editorial OFF/ON comparison on frozen synthetic E03.
// Default/check is offline. No database, service, production, retry, repair, resume or reset.
// Reuses the editorial-freedom runner's fail-closed controls; only plan/arms differ.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLedger, GATEWAY_ATTESTATION, SCOPE_ATTESTATION,
  MAX_RESPONSE_BYTES, MAX_JSON_BYTES } from "./reflection-v2-editorial-evaluation.mjs";
import { GATEWAY_MODELS, GATEWAY_TASK_LIMITS, gatewayQuote, usdLimitNano } from "../lib/ai-gateway-config.js";
import { REFLECTION_V2, REFLECTION_V2_INSTRUCTIONS, REFLECTION_V2_SCHEMAS, validateReflectionV2 } from "../lib/reflection-v2.js";
import { compileGatewaySchema } from "../lib/ai-gateway-schema.js";
import { SONNET_WEEKLY_MODEL, buildWeeklyReflectionV2Packet } from "../lib/sonnet-weekly.js";
import { selectWeeklyEvidenceV2 } from "../lib/weekly-evidence-selector-v2.js";
import { weeklyEditorialSettings, weeklyEditorialInstructions, weeklyEditorialPacket,
  WEEKLY_RETROSPECTIVE_INSTRUCTIONS } from "../lib/weekly-editorial.js";
import { corpus, inputFor, selectorArgs } from "../experiments/weekly-editorial-quality-v1/fixtures.mjs";
import { reflectionV2ValidationCode } from "./reflection-v2-validation-diagnostics.mjs";

export { GATEWAY_ATTESTATION, SCOPE_ATTESTATION };
export const REVISION = "45af54bd1e96c56361ab7d0f5c271513a804c1ae";
export const BRANCH = "eval/weekly-editorial-e03-sonnet-45af54bd";
export const BATCH = "weekly-editorial-e03-off-on-45af54bd";
export const APPROVAL = "APPROVE-4-WEEKLY-EDITORIAL-E03-45AF54BD-OFF-ON-EN-ZH-CALLS";
export const MAX_NANO_USD = 163_840_000; // 4 × US$0.04096 padded reservation = US$0.16384
export const LOCALES = Object.freeze(["en", "zh-Hans"]);
// Literal server-side settings per arm. Baseline = unset (default OFF); candidate = both ON.
export const ARMS = Object.freeze({
  baseline: Object.freeze({}),
  candidate: Object.freeze({ AI_WEEKLY_REFLECTION_RECORD_DAYS_SEPARATED: "true", AI_WEEKLY_REFLECTION_RETROSPECTIVE: "true" })
});
const MAX_OUTPUT_TOKENS = 2048;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trimEnd();
const P = "PETALPAL_WEEKLY_EDITORIAL_EVAL_";
const allowedEnv = new Set(["PATH", "TERM", "LANG", "LC_ALL", "TMPDIR", "NODE_ENV",
  `${P}APPROVAL`, `${P}COMMIT`, `${P}BUDGET_USD`, `${P}GATEWAY_VERIFIED`, `${P}SCOPE_VERIFIED`]);
const CODES = new Set(["ENVIRONMENT_NOT_ISOLATED", "DOTENV_PRESENT", "TTY_REQUIRED", "APPROVAL_REQUIRED", "COMMIT_MISMATCH",
  "WORKTREE_NOT_CLEAN", "BUDGET_INVALID", "BUDGET_EXHAUSTED", "GATEWAY_UNVERIFIED", "SCOPE_UNVERIFIED", "LEDGER_CONSUMED",
  "ARTIFACTS_EXIST", "PLAN_MISMATCH", "CREDENTIALS_INVALID", "LEDGER_UNAVAILABLE", "ARTIFACT_WRITE_FAILED", "INTERRUPTED",
  "TIMEOUT", "TRANSPORT_FAILED", "HTTP_FAILED", "INVALID_RESPONSE", "RESPONSE_TOO_LARGE", "USAGE_INVALID",
  "CACHE_USAGE_UNEXPECTED", "VALIDATION_FAILED", "REPLAY_BLOCKED", "CHECKOUT_CHANGED", "EVALUATION_FAILED"]);
function fail(code) { throw Object.assign(new Error(code), { code }); }
const safeCode = error => CODES.has(error?.code) ? error.code : "EVALUATION_FAILED";

export function preparePlan() {
  assert.equal(git(["branch", "--show-current"]), BRANCH);
  git(["merge-base", "--is-ancestor", REVISION, "HEAD"]);
  // Runtime, frozen benchmarks/selector evidence, ledger helper and diagnostics must match the pinned revision.
  assert.equal(git(["diff", REVISION, "--", "lib", "server.js", "experiments", "scripts/reflection-v2-editorial-evaluation.mjs",
    "scripts/reflection-v2-validation-diagnostics.mjs", "scripts/reflection-v2-editorial-plan.mjs"]), "",
  "runtime and historical evidence must match the pinned revision exactly");
  const model = SONNET_WEEKLY_MODEL, limits = GATEWAY_TASK_LIMITS.WEEKLY_REPORT;
  assert.equal(model, "claude-sonnet-5-5");
  assert.equal(limits.input, 8192); assert.equal(limits.timeoutMs, 20000);
  assert.equal(GATEWAY_MODELS[model].inputRate, 2000); assert.equal(GATEWAY_MODELS[model].outputRate, 10000);
  const quote = gatewayQuote({ model, action: "WEEKLY_REPORT", inputTokens: limits.input, maxOutputTokens: MAX_OUTPUT_TOKENS });
  assert.equal(quote.reservedNanoUsd, 40_960_000, "changed rates require a new reviewed budget");
  const { wireSchema } = compileGatewaySchema(REFLECTION_V2_SCHEMAS.WEEKLY);
  const e03 = corpus.cases.find(c => c.id === "E03");
  assert.ok(e03, "frozen E03 benchmark case");
  const cases = LOCALES.map(locale => {
    // Selector V2 is held constant for both arms; only the two editorial flags vary.
    const selection = selectWeeklyEvidenceV2(selectorArgs(e03, locale)), input = inputFor(e03, locale, selection);
    const base = buildWeeklyReflectionV2Packet(input);
    const arms = Object.entries(ARMS).map(([arm, flags]) => {
      const settings = weeklyEditorialSettings(flags, REFLECTION_V2.WEEKLY);
      const built = weeklyEditorialPacket(base, settings, MAX_OUTPUT_TOKENS);
      const body = { model, system: weeklyEditorialInstructions(settings),
        messages: [{ role: "user", content: JSON.stringify(built.packet) }], max_tokens: MAX_OUTPUT_TOKENS,
        output_config: { effort: "low", format: { type: "json_schema", schema: wireSchema } } };
      assert.ok(Buffer.byteLength(JSON.stringify(body)) + 1024 <= limits.input, "existing Gateway byte admission");
      return { arm, flags: { ...flags }, settings, built, body };
    });
    const [off, on] = arms;
    // Baseline is exactly the default-OFF runtime request.
    assert.equal(off.built, base); assert.equal(off.body.system, REFLECTION_V2_INSTRUCTIONS.WEEKLY);
    assert.deepEqual(off.settings, { recordDaysSeparated: false, retrospective: false });
    // Candidate must have BOTH factors active; a budget fallback would confound the comparison.
    assert.deepEqual(on.settings, { recordDaysSeparated: true, retrospective: true });
    assert.equal(on.body.system, WEEKLY_RETROSPECTIVE_INSTRUCTIONS);
    assert.ok(Array.isArray(on.built.packet.recordDays) && !on.built.packet.evidence.some(e => "day" in e), "separated format active");
    // Same retained sources, order, text, refs and validator map in both arms.
    assert.equal(on.built.refs, base.refs);
    assert.deepEqual(on.built.packet.evidence, base.packet.evidence.map(({ day, ...e }) => e));
    assert.deepEqual(on.built.packet.recordDays, base.packet.evidence.map(({ ref, day }) => ({ ref, day })));
    return { id: `E03-${locale}`, caseId: "E03", type: "WEEKLY", locale, model, timeoutMs: limits.timeoutMs,
      reservationNanoUsd: quote.reservedNanoUsd, base, arms };
  });
  const calls = cases.reduce((n, c) => n + c.arms.length, 0);
  const budgetNanoUsd = cases.reduce((sum, c) => sum + c.reservationNanoUsd * c.arms.length, 0);
  assert.equal(calls, 4); assert.equal(budgetNanoUsd, MAX_NANO_USD);
  return { batch: BATCH, cases, calls, budgetNanoUsd };
}
export function validatePlan(plan) {
  try { assert.deepEqual(plan, preparePlan()); } catch { fail("PLAN_MISMATCH"); }
}
// Per case: independent random A/B labels and dispatch order. Mapping is persisted
// to operator metadata before any dispatch; review files carry only A/B labels.
export function makeSchedule(plan, bit = () => randomInt(2)) {
  const schedule = [], mapping = [];
  for (const c of plan.cases) {
    const labelBit = bit(), orderBit = bit();
    if (![0, 1].includes(labelBit) || ![0, 1].includes(orderBit)) fail("PLAN_MISMATCH");
    mapping.push({ caseId: c.id, A: c.arms[labelBit].arm, B: c.arms[1 - labelBit].arm, firstArm: c.arms[orderBit].arm });
    for (const index of [orderBit, 1 - orderBit]) schedule.push({ c, arm: c.arms[index], label: index === labelBit ? "A" : "B" });
  }
  return { schedule, mapping };
}
export function attemptBudget(cap, callLimit = 4) {
  if (!Number.isSafeInteger(cap) || cap < 0 || cap > MAX_NANO_USD) fail("BUDGET_INVALID");
  if (callLimit !== 4) fail("PLAN_MISMATCH");
  let reservedNanoUsd = 0; const seen = new Set();
  return { get reservedNanoUsd() { return reservedNanoUsd; }, get attempts() { return seen.size; },
    reserve(c, arm) {
      const id = `${c.id}/${arm.arm}`;
      if (seen.has(id) || seen.size >= callLimit) fail("REPLAY_BLOCKED");
      if (!Number.isSafeInteger(c.reservationNanoUsd) || c.reservationNanoUsd <= 0 || reservedNanoUsd + c.reservationNanoUsd > cap) fail("BUDGET_EXHAUSTED");
      seen.add(id); reservedNanoUsd += c.reservationNanoUsd;
    }
  };
}
export const batchPaths = state => ({ parent: path.join(state.common, "petalpal-acceptance"),
  ledger: path.join(state.common, "petalpal-acceptance", `${BATCH}.jsonl`),
  artifacts: path.join(state.common, "petalpal-acceptance", BATCH) });
export function batchState(state) {
  const p = batchPaths(state);
  return { ...state, ledgerExists: existsSync(p.ledger), artifactsExist: existsSync(p.artifacts) };
}
export function checkoutState() {
  return batchState({ head: git(["rev-parse", "HEAD"]), branch: git(["branch", "--show-current"]),
    clean: git(["status", "--porcelain"]) === "", common: git(["rev-parse", "--path-format=absolute", "--git-common-dir"]),
    dotenv: existsSync(path.join(root, ".env")) });
}
export function preflight({ plan, env, state, tty }) {
  if (plan?.batch !== BATCH || plan.calls !== 4 || plan.budgetNanoUsd !== MAX_NANO_USD) return "PLAN_MISMATCH";
  // macOS adds this text-encoding metadata even after env -i; allow only this exact name on Darwin.
  if (env.NODE_ENV !== "test" || Object.keys(env).some(key => !allowedEnv.has(key) &&
      !(process.platform === "darwin" && key === "__CF_USER_TEXT_ENCODING"))) return "ENVIRONMENT_NOT_ISOLATED";
  if (state?.dotenv) return "DOTENV_PRESENT";
  if (!tty) return "TTY_REQUIRED";
  if (env[`${P}APPROVAL`] !== APPROVAL) return "APPROVAL_REQUIRED";
  if (!/^[a-f0-9]{40}$/.test(env[`${P}COMMIT`] || "") || state?.head !== env[`${P}COMMIT`] || state.branch !== BRANCH) return "COMMIT_MISMATCH";
  if (!state.clean) return "WORKTREE_NOT_CLEAN";
  let cap; try { cap = usdLimitNano(env, `${P}BUDGET_USD`); } catch { return "BUDGET_INVALID"; }
  if (cap !== MAX_NANO_USD) return "BUDGET_INVALID";
  if (env[`${P}GATEWAY_VERIFIED`] !== GATEWAY_ATTESTATION) return "GATEWAY_UNVERIFIED";
  if (env[`${P}SCOPE_VERIFIED`] !== SCOPE_ATTESTATION) return "SCOPE_UNVERIFIED";
  if (state.ledgerExists !== false) return "LEDGER_CONSUMED";
  if (state.artifactsExist !== false) return "ARTIFACTS_EXIST";
  return null;
}

function syncDirectory(dir) { const fd = openSync(dir, "r"); try { fsyncSync(fd); } finally { closeSync(fd); } }
function privateDirectory(dir, existing = false) {
  try { mkdirSync(dir, { mode: 0o700 }); syncDirectory(path.dirname(dir)); }
  catch (error) { if (!existing || error.code !== "EEXIST") throw error; }
  const stat = lstatSync(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid()) throw Error();
}
function save(file, value) {
  let fd;
  try {
    fd = openSync(file, "wx", 0o600);
    writeFileSync(fd, typeof value === "string" ? value : JSON.stringify(value, null, 2));
    fsyncSync(fd); syncDirectory(path.dirname(file));
  } catch { fail("ARTIFACT_WRITE_FAILED"); }
  finally { if (fd !== undefined) closeSync(fd); }
}

async function boundedJson(response, signal, active) {
  if (!response.body || !/application\/json/i.test(response.headers.get("content-type") || "")) fail("INVALID_RESPONSE");
  const reader = response.body.getReader(), chunks = []; let bytes = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read(); active();
      if (done) break;
      bytes += value.byteLength; if (bytes > MAX_RESPONSE_BYTES) fail("RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { fail("INVALID_RESPONSE"); }
  } finally { signal.removeEventListener("abort", cancel); cancel(); }
}
function normalize(raw, c, arm, receipt) {
  const input = raw?.usage?.input_tokens, output = raw?.usage?.output_tokens;
  const read = raw?.usage?.cache_read_input_tokens ?? 0, write = raw?.usage?.cache_creation_input_tokens ?? 0;
  if (![input, output, read, write].every(v => Number.isSafeInteger(v) && v >= 0 && v <= 1_000_000)) fail("USAGE_INVALID");
  receipt.usage = { inputTokens: input, outputTokens: output, cachedReadTokens: read, cachedWriteTokens: write };
  if (read || write) fail("CACHE_USAGE_UNEXPECTED");
  const rates = GATEWAY_MODELS[c.model];
  receipt.estimatedCostNanoUsd = input * rates.inputRate + output * rates.outputRate;
  if (input > GATEWAY_TASK_LIMITS.WEEKLY_REPORT.input || output > arm.body.max_tokens) fail("USAGE_INVALID");
  if (raw.model !== c.model || raw.type !== "message" || raw.role !== "assistant" || raw.stop_reason !== "end_turn" ||
      !Array.isArray(raw.content) || raw.content.some(b => !b || !["text", "thinking", "redacted_thinking"].includes(b.type))) fail("INVALID_RESPONSE");
  const blocks = raw.content.filter(b => b.type === "text");
  if (blocks.length !== 1 || typeof blocks[0].text !== "string") fail("INVALID_RESPONSE");
  if (Buffer.byteLength(blocks[0].text) > MAX_JSON_BYTES) fail("RESPONSE_TOO_LARGE");
  let data; try { data = JSON.parse(blocks[0].text); } catch { fail("INVALID_RESPONSE"); }
  let rendered;
  // Unchanged production validator against this arm's exact prepared packet/ref map.
  try { rendered = validateReflectionV2(data, { type: c.type, locale: c.locale, built: arm.built, model: c.model }); }
  catch {
    receipt.validationCode = reflectionV2ValidationCode(data, { type: c.type, locale: c.locale, built: arm.built });
    fail("VALIDATION_FAILED");
  }
  return { data, narrative: rendered.narrative };
}

async function requestOnce({ c, arm, send, url, headers, signal, receipt, onDispatch }) {
  const controller = new AbortController(), deadline = performance.now() + c.timeoutMs;
  let timer, interrupt;
  const active = () => {
    if (signal?.aborted) fail("INTERRUPTED");
    if (controller.signal.aborted || performance.now() >= deadline) fail("TIMEOUT");
  };
  const stopped = new Promise((_, reject) => {
    interrupt = () => { controller.abort(); reject(Object.assign(new Error(), { code: "INTERRUPTED" })); };
    signal?.addEventListener("abort", interrupt, { once: true });
    timer = setTimeout(() => { controller.abort(); reject(Object.assign(new Error(), { code: "TIMEOUT" })); }, c.timeoutMs);
  });
  try {
    return await Promise.race([stopped, (async () => {
      active(); onDispatch();
      let response;
      try { response = await send(url, { method: "POST", headers, body: JSON.stringify(arm.body), signal: controller.signal, redirect: "error" }); }
      catch { active(); fail("TRANSPORT_FAILED"); }
      try { active(); } catch (error) { void response.body?.cancel().catch(() => {}); throw error; }
      receipt.httpStatus = response.status;
      if (!response.ok) { void response.body?.cancel().catch(() => {}); fail("HTTP_FAILED"); }
      const raw = await boundedJson(response, controller.signal, active); active();
      const result = normalize(raw, c, arm, receipt); active(); return result;
    })()]);
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", interrupt); controller.abort(); }
}

export async function executeBatch({ plan, env, readState, tty, credentials, send, signal, bit }) {
  const state = readState(), blocked = preflight({ plan, env, state, tty }); if (blocked) fail(blocked);
  validatePlan(plan); plan = structuredClone(plan); // Caller mutation cannot change scheduled bodies during awaits.
  if (typeof send !== "function" || !/^[a-f0-9]{32}$/.test(credentials?.account || "") ||
      ![credentials?.token, credentials?.key].every(s => typeof s === "string" && /^[\x21-\x7e]{1,4096}$/.test(s))) fail("CREDENTIALS_INVALID");
  const url = `https://gateway.ai.cloudflare.com/v1/${credentials.account}/petalpal-integration/anthropic/v1/messages`;
  const headers = { "Content-Type": "application/json", "cf-aig-authorization": `Bearer ${credentials.token}`, "x-api-key": credentials.key,
    "anthropic-version": "2023-06-01", "cf-aig-max-attempts": "1", "cf-aig-skip-cache": "true",
    "cf-aig-collect-log": "false", "cf-aig-collect-log-payload": "false", "cf-aig-request-timeout": "19900" };
  const budget = attemptBudget(usdLimitNano(env, `${P}BUDGET_USD`), plan.calls), p = batchPaths(state);
  const { schedule, mapping } = makeSchedule(plan, bit);
  let ledger, completed = 0, dispatched = 0, current = null, started = null, receipt = {};
  try {
    try { privateDirectory(p.parent, true); } catch { fail("LEDGER_UNAVAILABLE"); }
    ledger = createLedger(p.ledger); // Exclusive create: consumed even if setup later fails or the process dies.
    ledger.write({ entry: "run", batch: BATCH, caseIds: plan.cases.map(c => c.id), runnerCommit: state.head, revision: REVISION,
      plannedCalls: plan.calls, plannedReservationNanoUsd: plan.budgetNanoUsd, capNanoUsd: usdLimitNano(env, `${P}BUDGET_USD`) });
    try {
      for (const dir of [p.artifacts, path.join(p.artifacts, "review"), ...["prose", "claims", "evidence"].map(d => path.join(p.artifacts, "review", d))]) privateDirectory(dir);
    } catch { fail("ARTIFACT_WRITE_FAILED"); }
    save(path.join(p.artifacts, "operator-metadata.json"), { runnerCommit: state.head, revision: REVISION, mapping,
      arms: Object.fromEntries(Object.entries(ARMS).map(([k, v]) => [k, { ...v }])) });
    // Arm-neutral evidence (original weekday format) for grounded human review.
    for (const c of plan.cases) save(path.join(p.artifacts, "review", "evidence", `${c.id}.json`), { caseId: c.id, packet: c.base.packet });
    for (const item of schedule) {
      current = item; receipt = {}; started = performance.now();
      const next = readState();
      if (next.head !== state.head || next.branch !== BRANCH || !next.clean || next.dotenv || next.common !== state.common) fail("CHECKOUT_CHANGED");
      if (signal?.aborted) fail("INTERRUPTED");
      budget.reserve(item.c, item.arm);
      // Ledger records blind labels only; the arm mapping lives in operator metadata.
      ledger.write({ entry: "attempt", ordinal: budget.attempts, caseId: item.c.id, label: item.label,
        model: item.c.model, maxOutputTokens: item.arm.body.max_tokens, reservationNanoUsd: item.c.reservationNanoUsd,
        cumulativeReservationNanoUsd: budget.reservedNanoUsd, startedAt: new Date().toISOString() });
      const result = await requestOnce({ ...item, send, url, headers, signal, receipt, onDispatch: () => { dispatched++; } });
      if (signal?.aborted) fail("INTERRUPTED");
      // Store only validated synthetic prose/claims. No thinking, raw envelope, error body or credentials.
      const name = `${item.c.id}-${item.label}`;
      save(path.join(p.artifacts, "review", "prose", `${name}.txt`), result.narrative);
      save(path.join(p.artifacts, "review", "claims", `${name}.json`), { caseId: item.c.id, label: item.label, ...result.data });
      ledger.write({ entry: "result", caseId: item.c.id, label: item.label, status: "VALIDATED", durationMs: Math.round(performance.now() - started), ...receipt });
      completed++;
    }
    if (completed !== plan.calls || dispatched !== plan.calls || budget.reservedNanoUsd !== plan.budgetNanoUsd) fail("PLAN_MISMATCH");
    ledger.write({ entry: "complete", completed, dispatched, reservedNanoUsd: budget.reservedNanoUsd });
    return { status: "COMPLETE", completed, dispatched, attempts: budget.attempts, reservedNanoUsd: budget.reservedNanoUsd };
  } catch (error) {
    const code = safeCode(error);
    // Never retry a failed ledger write or spend another attempt; the exclusive ledger blocks replay.
    try { ledger?.write({ entry: "stopped", code, caseId: current?.c.id ?? null, label: current?.label ?? null,
      durationMs: started === null ? null : Math.round(performance.now() - started), completed, dispatched,
      reservedNanoUsd: budget.reservedNanoUsd, ...receipt }); } catch {}
    return { status: "STOP", code, ...(receipt.validationCode ? { validationCode: receipt.validationCode } : {}),
      completed, dispatched, attempts: budget.attempts, reservedNanoUsd: budget.reservedNanoUsd };
  } finally { ledger?.close(); }
}

async function privateInput(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) fail("TTY_REQUIRED");
  process.stdout.write(`${label} (hidden, integration only): `);
  process.stdin.setRawMode(true); process.stdin.setEncoding("utf8"); process.stdin.resume();
  try {
    return await new Promise((resolve, reject) => {
      let value = "";
      const cancelled = () => done(Object.assign(new Error(), { code: "INTERRUPTED" }));
      const done = (error, result) => { process.stdin.off("data", data); process.off("SIGTERM", cancelled); error ? reject(error) : resolve(result); };
      const data = chunk => {
        for (const ch of chunk) {
          if (ch === "\u0003" || ch === "\u0004") return done(Object.assign(new Error(), { code: "INTERRUPTED" }));
          if (ch === "\r" || ch === "\n") return done(null, value.trim());
          if (ch === "\u007f") value = value.slice(0, -1); else value += ch;
          if (value.length > 4096) return done(Object.assign(new Error(), { code: "CREDENTIALS_INVALID" }));
        }
      };
      process.stdin.on("data", data);
      process.once("SIGTERM", cancelled);
    });
  } finally { process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n"); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !["check", "live"].includes(args[0]))) fail("PLAN_MISMATCH");
  const plan = preparePlan();
  if (args[0] !== "live") {
    const state = checkoutState(), p = batchPaths(state);
    return { status: "OFFLINE_PREPARATION_PASS", providerCalls: 0, batch: BATCH, revision: REVISION,
      runnerCommit: state.head, plannedCalls: plan.calls, maximumUsd: plan.budgetNanoUsd / 1e9,
      cases: plan.cases.map(c => ({ id: c.id, locale: c.locale, arms: c.arms.map(a => a.arm),
        sources: c.base.packet.evidence.length })),
      approval: APPROVAL, ledger: p.ledger, artifacts: p.artifacts, ledgerAbsent: !state.ledgerExists, artifactsAbsent: !state.artifactsExist };
  }
  const env = Object.freeze({ ...process.env }), tty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const blocked = preflight({ plan, env, state: checkoutState(), tty }); if (blocked) fail(blocked);
  const credentials = { account: await privateInput("Cloudflare account ID"), token: await privateInput("petalpal-integration Gateway token"),
    key: await privateInput("PetalPal-Integration Anthropic API key") };
  const controller = new AbortController(), interrupt = () => controller.abort();
  process.on("SIGINT", interrupt); process.on("SIGTERM", interrupt);
  try { return await executeBatch({ plan, env, readState: checkoutState, tty, credentials,
    send: (url, options) => fetch(url, options), signal: controller.signal }); }
  finally { process.off("SIGINT", interrupt); process.off("SIGTERM", interrupt); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = await main(); console.log(JSON.stringify(result)); if (result.status === "STOP") process.exitCode = 2; }
  catch (error) { console.log(JSON.stringify({ status: "STOP", code: safeCode(error) })); process.exitCode = 2; }
}

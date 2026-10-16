// FINAL Weekly editorial acceptance: 8 fixed Claude calls, synthetic evidence only.
// Exp 1 (prompt, identical evidence): E03 en/zh; A original v2 prompt vs B final narrative-thread prompt;
//   Selector V2 ON, significance OFF, byte-identical packets.
// Exp 2 (selection, final prompt held constant): F (40 Events) en/zh; Selector V2 significance OFF vs ON.
// Default/`check` is offline. No database, service, production, retry, repair, resume or reset.
// Controls are reused from the prior isolated runners; only the plan differs.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLedger, GATEWAY_ATTESTATION, SCOPE_ATTESTATION,
  MAX_RESPONSE_BYTES, MAX_JSON_BYTES } from "./reflection-v2-editorial-evaluation.mjs";
import { GATEWAY_MODELS, GATEWAY_TASK_LIMITS, gatewayQuote, usdLimitNano } from "../lib/ai-gateway-config.js";
import { REFLECTION_V2, REFLECTION_V2_INSTRUCTIONS, REFLECTION_V2_SCHEMAS, validateReflectionV2 } from "../lib/reflection-v2.js";
import { compileGatewaySchema } from "../lib/ai-gateway-schema.js";
import { SONNET_WEEKLY_MODEL, buildWeeklyReflectionV2Packet } from "../lib/sonnet-weekly.js";
import { selectWeeklyEvidenceV2, weeklySignificanceCandidates } from "../lib/weekly-evidence-selector-v2.js";
import { REPORT_EVIDENCE_LIMITS } from "../lib/report-foundation.js";
import { weeklyEditorialSettings, weeklyEditorialInstructions, weeklyEditorialPacket,
  WEEKLY_NARRATIVE_THREAD_INSTRUCTIONS } from "../lib/weekly-editorial.js";
import { corpus, inputFor, selectorArgs } from "../experiments/weekly-editorial-quality-v1/fixtures.mjs";
import { CASES as STRESS, weeklyArgs, weeklyInput, week } from "../experiments/weekly-selective-reflection-v1/stress.mjs";
import { reflectionV2ValidationCode } from "./reflection-v2-validation-diagnostics.mjs";

export { GATEWAY_ATTESTATION, SCOPE_ATTESTATION };
export const REVISION = "45145ceb54f07b944e8e4e479daaf2af78d652b3";
export const BRANCH = "eval/weekly-final-acceptance-45145ceb";
export const BATCH = "weekly-final-acceptance-45145ceb";
export const MAX_NANO_USD = 327_680_000; // 8 × US$0.04096 padded reservation = US$0.32768
export const APPROVAL = "APPROVE-8-WEEKLY-FINAL-ACCEPTANCE-45145CEB-E03-F-EN-ZH-USD-0.32768";
// Prior batches and approvals; this runner never opens their ledgers and rejects their phrases.
export const PRIOR_BATCHES = Object.freeze(["weekly-editorial-e03-off-on-45af54bd", "reflection-v2-weekly-editorial-freedom-ab523996",
  "reflection-v2-editorial-paired-c2d7a9d9"]);
export const ROUTE = "https://gateway.ai.cloudflare.com/v1/<account>/petalpal-integration/anthropic/v1/messages";
const MAX_OUTPUT_TOKENS = 2048, LOCALES = ["en", "zh-Hans"];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trimEnd();
const P = "PETALPAL_FINAL_ACCEPTANCE_";
const allowedEnv = new Set(["PATH", "TERM", "LANG", "LC_ALL", "TMPDIR", "NODE_ENV",
  `${P}APPROVAL`, `${P}COMMIT`, `${P}BUDGET_USD`, `${P}GATEWAY_VERIFIED`, `${P}SCOPE_VERIFIED`]);
const CODES = new Set(["ENVIRONMENT_NOT_ISOLATED", "DOTENV_PRESENT", "TTY_REQUIRED", "APPROVAL_REQUIRED", "COMMIT_MISMATCH",
  "WORKTREE_NOT_CLEAN", "BUDGET_INVALID", "BUDGET_EXHAUSTED", "GATEWAY_UNVERIFIED", "SCOPE_UNVERIFIED", "LEDGER_CONSUMED",
  "ARTIFACTS_EXIST", "PLAN_MISMATCH", "CREDENTIALS_INVALID", "LEDGER_UNAVAILABLE", "ARTIFACT_WRITE_FAILED", "INTERRUPTED",
  "TIMEOUT", "TRANSPORT_FAILED", "HTTP_FAILED", "INVALID_RESPONSE", "RESPONSE_TOO_LARGE", "USAGE_INVALID",
  "CACHE_USAGE_UNEXPECTED", "VALIDATION_FAILED", "REPLAY_BLOCKED", "CHECKOUT_CHANGED", "EVALUATION_FAILED"]);
function fail(code) { throw Object.assign(new Error(code), { code }); }
const safeCode = error => CODES.has(error?.code) ? error.code : "EVALUATION_FAILED";

function request(settings, packet, wireSchema) {
  return { model: SONNET_WEEKLY_MODEL, system: weeklyEditorialInstructions(settings),
    messages: [{ role: "user", content: JSON.stringify(packet) }], max_tokens: MAX_OUTPUT_TOKENS,
    output_config: { effort: "low", format: { type: "json_schema", schema: wireSchema } } };
}
const sourceIds = built => [...built.refs.values()].map(r => r.source.sourceEventId);

export function preparePlan() {
  assert.equal(git(["branch", "--show-current"]), BRANCH);
  git(["merge-base", "--is-ancestor", REVISION, "HEAD"]);
  // Runtime, frozen fixtures, ledger helper and diagnostics are byte-identical to the verified revision.
  assert.equal(git(["diff", REVISION, "--", "lib", "server.js", "prisma", "experiments", "scripts/reflection-v2-editorial-evaluation.mjs",
    "scripts/reflection-v2-validation-diagnostics.mjs", "scripts/reflection-v2-editorial-plan.mjs"]), "",
  "runtime and historical evidence must match the verified revision exactly");
  const model = SONNET_WEEKLY_MODEL, limits = GATEWAY_TASK_LIMITS.WEEKLY_REPORT;
  assert.equal(model, "claude-sonnet-5-5"); assert.equal(GATEWAY_MODELS[model].provider, "ANTHROPIC");
  assert.equal(limits.input, 8192); assert.equal(limits.timeoutMs, 20000);
  assert.equal(GATEWAY_MODELS[model].inputRate, 2000); assert.equal(GATEWAY_MODELS[model].outputRate, 10000);
  const quote = gatewayQuote({ model, action: "WEEKLY_REPORT", inputTokens: limits.input, maxOutputTokens: MAX_OUTPUT_TOKENS });
  assert.equal(quote.reservedNanoUsd, 40_960_000, "changed rates require a new reviewed budget");
  const { wireSchema } = compileGatewaySchema(REFLECTION_V2_SCHEMAS.WEEKLY);
  const original = weeklyEditorialSettings({}, REFLECTION_V2.WEEKLY);
  const thread = weeklyEditorialSettings({ AI_WEEKLY_REFLECTION_NARRATIVE_THREAD: "true" }, REFLECTION_V2.WEEKLY);
  assert.equal(weeklyEditorialInstructions(original), REFLECTION_V2_INSTRUCTIONS.WEEKLY);
  assert.equal(weeklyEditorialInstructions(thread), WEEKLY_NARRATIVE_THREAD_INSTRUCTIONS);
  const arm = (name, flags, settings, built) => {
    const presented = weeklyEditorialPacket(built, settings, MAX_OUTPUT_TOKENS);
    assert.equal(presented, built, "no presentation change (record-day separation stays OFF)");
    const body = request(settings, built.packet, wireSchema);
    assert.ok(Buffer.byteLength(JSON.stringify(body)) + 1024 <= limits.input, "existing Gateway byte admission");
    return { arm: name, flags: { ...flags }, built, body, requestBytes: Buffer.byteLength(JSON.stringify(body)) };
  };
  const e03 = corpus.cases.find(c => c.id === "E03"), F = STRESS.find(c => c.id === "F");
  assert.ok(e03 && F);
  const cases = [];
  for (const locale of LOCALES) {
    // Experiment 1: identical Selector V2 (significance OFF) evidence for both prompts.
    const built = buildWeeklyReflectionV2Packet(inputFor(e03, locale, selectWeeklyEvidenceV2(selectorArgs(e03, locale))));
    const arms = [arm("original-prompt", { AI_WEEKLY_EVIDENCE_SELECTOR_V2: "true" }, original, built),
      arm("narrative-thread-prompt", { AI_WEEKLY_EVIDENCE_SELECTOR_V2: "true", AI_WEEKLY_REFLECTION_NARRATIVE_THREAD: "true" }, thread, built)];
    assert.equal(arms[0].body.messages[0].content, arms[1].body.messages[0].content, "byte-identical evidence packet");
    assert.deepEqual({ ...arms[0].body, system: null }, { ...arms[1].body, system: null }, "only the system prompt differs");
    cases.push({ id: `X1-E03-${locale}`, experiment: 1, fixture: "E03", locale, arms });
  }
  for (const locale of LOCALES) {
    // Experiment 2: final prompt constant; production-shaped candidate pools differ.
    const { args, rows } = weeklyArgs(F, locale), count = rows.length;
    const offSel = selectWeeklyEvidenceV2(structuredClone(args));
    const pool = weeklySignificanceCandidates(rows.map(({ meaningful, ...row }) => row), { locale, timezone: week.timezone,
      take: REPORT_EVIDENCE_LIMITS.WEEKLY.candidateTake });
    const onSel = selectWeeklyEvidenceV2({ ...structuredClone(args), candidates: structuredClone(pool), significance: true });
    assert.equal(offSel.status, "READY"); assert.equal(onSel.status, "READY");
    const arms = [arm("significance-off", { AI_WEEKLY_EVIDENCE_SELECTOR_V2: "true", AI_WEEKLY_REFLECTION_NARRATIVE_THREAD: "true" },
      thread, buildWeeklyReflectionV2Packet(weeklyInput(offSel, locale, count))),
    arm("significance-on", { AI_WEEKLY_EVIDENCE_SELECTOR_V2: "true", AI_WEEKLY_EVIDENCE_SIGNIFICANCE: "true", AI_WEEKLY_REFLECTION_NARRATIVE_THREAD: "true" },
      thread, buildWeeklyReflectionV2Packet(weeklyInput(onSel, locale, count)))];
    assert.equal(arms[0].body.system, arms[1].body.system, "final prompt held constant");
    // Review annotation (never input): F's meaningful Events are #2 (early) and #38 (late).
    const meaningful = rows.filter(r => r.meaningful).map(r => r.sourceEventId);
    for (const a of arms) a.meaningfulDelivered = meaningful.filter(id => sourceIds(a.built).includes(id));
    assert.equal(arms[1].meaningfulDelivered.length, 2, "significance ON delivers both meaningful Events");
    assert.equal(arms[0].meaningfulDelivered.length, 1, "significance OFF delivers one");
    cases.push({ id: `X2-F-${locale}`, experiment: 2, fixture: "F", locale, arms });
  }
  for (const c of cases) Object.assign(c, { type: "WEEKLY", model, timeoutMs: limits.timeoutMs, reservationNanoUsd: quote.reservedNanoUsd });
  const calls = cases.reduce((n, c) => n + c.arms.length, 0);
  const budgetNanoUsd = cases.reduce((sum, c) => sum + c.reservationNanoUsd * c.arms.length, 0);
  assert.equal(calls, 8); assert.equal(budgetNanoUsd, MAX_NANO_USD);
  return { batch: BATCH, cases, calls, budgetNanoUsd };
}
export function validatePlan(plan) {
  try { assert.deepEqual(plan, preparePlan()); } catch { fail("PLAN_MISMATCH"); }
}
// Independent random A/B label and dispatch order per case. The mapping is written only
// to operator/mapping.json before dispatch; review files and the ledger carry labels only.
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
export function attemptBudget(cap, callLimit = 8) {
  if (!Number.isSafeInteger(cap) || cap < 0 || cap > MAX_NANO_USD) fail("BUDGET_INVALID");
  if (callLimit !== 8) fail("PLAN_MISMATCH");
  let reservedNanoUsd = 0; const seen = new Set();
  return { get reservedNanoUsd() { return reservedNanoUsd; }, get attempts() { return seen.size; },
    reserve(c, arm) {
      const id = `${c.id}/${arm.arm}`;
      if (seen.has(id) || seen.size >= callLimit) fail("REPLAY_BLOCKED");
      if (!Number.isSafeInteger(c.reservationNanoUsd) || c.reservationNanoUsd <= 0 || reservedNanoUsd + c.reservationNanoUsd > cap) fail("BUDGET_EXHAUSTED");
      seen.add(id); reservedNanoUsd += c.reservationNanoUsd;
    } };
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
  if (plan?.batch !== BATCH || plan.calls !== 8 || plan.budgetNanoUsd !== MAX_NANO_USD) return "PLAN_MISMATCH";
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
  // Usage × configured gateway rates; not an invoice. Provider billing is authoritative.
  const rates = GATEWAY_MODELS[c.model];
  receipt.estimatedCostAtConfiguredRatesNanoUsd = input * rates.inputRate + output * rates.outputRate;
  if (input > GATEWAY_TASK_LIMITS.WEEKLY_REPORT.input || output > arm.body.max_tokens) fail("USAGE_INVALID");
  if (raw.model !== c.model || raw.type !== "message" || raw.role !== "assistant" || raw.stop_reason !== "end_turn" ||
      !Array.isArray(raw.content) || raw.content.some(b => !b || !["text", "thinking", "redacted_thinking"].includes(b.type))) fail("INVALID_RESPONSE");
  const blocks = raw.content.filter(b => b.type === "text");
  if (blocks.length !== 1 || typeof blocks[0].text !== "string") fail("INVALID_RESPONSE");
  if (Buffer.byteLength(blocks[0].text) > MAX_JSON_BYTES) fail("RESPONSE_TOO_LARGE");
  let data; try { data = JSON.parse(blocks[0].text); } catch { fail("INVALID_RESPONSE"); }
  // Unchanged production validator against this arm's exact packet/ref map.
  try { return { status: "VALIDATED", data, narrative: validateReflectionV2(data, { type: c.type, locale: c.locale, built: arm.built, model: c.model }).narrative }; }
  catch {
    receipt.validationCode = reflectionV2ValidationCode(data, { type: c.type, locale: c.locale, built: arm.built });
    return { status: "REJECTED", data }; // Recorded as an editorial outcome; never retried or repaired.
  }
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
  validatePlan(plan); plan = structuredClone(plan);
  if (typeof send !== "function" || !/^[a-f0-9]{32}$/.test(credentials?.account || "") ||
      ![credentials?.token, credentials?.key].every(s => typeof s === "string" && /^[\x21-\x7e]{1,4096}$/.test(s))) fail("CREDENTIALS_INVALID");
  const url = ROUTE.replace("<account>", credentials.account);
  const headers = { "Content-Type": "application/json", "cf-aig-authorization": `Bearer ${credentials.token}`, "x-api-key": credentials.key,
    "anthropic-version": "2023-06-01", "cf-aig-max-attempts": "1", "cf-aig-skip-cache": "true",
    "cf-aig-collect-log": "false", "cf-aig-collect-log-payload": "false", "cf-aig-request-timeout": "19900" };
  const budget = attemptBudget(usdLimitNano(env, `${P}BUDGET_USD`), plan.calls), p = batchPaths(state);
  const { schedule, mapping } = makeSchedule(plan, bit);
  let ledger, completed = 0, rejected = 0, dispatched = 0, current = null, started = null, receipt = {};
  try {
    try { privateDirectory(p.parent, true); } catch { fail("LEDGER_UNAVAILABLE"); }
    ledger = createLedger(p.ledger); // Exclusive create: the batch is consumed even if setup later fails.
    ledger.write({ entry: "run", batch: BATCH, caseIds: plan.cases.map(c => c.id), runnerCommit: state.head, revision: REVISION,
      plannedCalls: plan.calls, plannedReservationNanoUsd: plan.budgetNanoUsd, capNanoUsd: usdLimitNano(env, `${P}BUDGET_USD`) });
    try {
      for (const dir of [p.artifacts, path.join(p.artifacts, "operator"), path.join(p.artifacts, "review"),
        ...["prose", "claims", "evidence", "rejected"].map(d => path.join(p.artifacts, "review", d))]) privateDirectory(dir);
    } catch { fail("ARTIFACT_WRITE_FAILED"); }
    // Private mapping, separate from review files. Do not open before human review is complete.
    save(path.join(p.artifacts, "operator", "mapping.json"), { runnerCommit: state.head, revision: REVISION, mapping,
      arms: plan.cases.map(c => ({ caseId: c.id, arms: c.arms.map(a => ({ arm: a.arm, flags: a.flags })) })) });
    // Frozen evidence per label: packet text plus source IDs per ref (synthetic only).
    for (const item of schedule) save(path.join(p.artifacts, "review", "evidence", `${item.c.id}-${item.label}.json`),
      { caseId: item.c.id, label: item.label, packet: item.arm.built.packet,
        refs: Object.fromEntries([...item.arm.built.refs].map(([ref, r]) => [ref, r.source.sourceEventId])) });
    for (const item of schedule) {
      current = item; receipt = {}; started = performance.now();
      const next = readState();
      if (next.head !== state.head || next.branch !== BRANCH || !next.clean || next.dotenv || next.common !== state.common) fail("CHECKOUT_CHANGED");
      if (signal?.aborted) fail("INTERRUPTED");
      budget.reserve(item.c, item.arm); // Admission before dispatch; never exceeds the exact cap.
      ledger.write({ entry: "attempt", ordinal: budget.attempts, caseId: item.c.id, label: item.label, model: item.c.model,
        maxOutputTokens: item.arm.body.max_tokens, requestBytes: item.arm.requestBytes, reservationNanoUsd: item.c.reservationNanoUsd,
        cumulativeReservationNanoUsd: budget.reservedNanoUsd, startedAt: new Date().toISOString() });
      const result = await requestOnce({ ...item, send, url, headers, signal, receipt, onDispatch: () => { dispatched++; } });
      if (signal?.aborted) fail("INTERRUPTED");
      const name = `${item.c.id}-${item.label}`;
      // Only schema/claim JSON and validated prose. No thinking, envelope, error body or credentials.
      if (result.status === "VALIDATED") {
        save(path.join(p.artifacts, "review", "prose", `${name}.txt`), result.narrative);
        save(path.join(p.artifacts, "review", "claims", `${name}.json`), { caseId: item.c.id, label: item.label, ...result.data });
        completed++;
      } else {
        save(path.join(p.artifacts, "review", "rejected", `${name}.json`), { caseId: item.c.id, label: item.label,
          validationCode: receipt.validationCode, output: result.data });
        rejected++;
      }
      ledger.write({ entry: "result", caseId: item.c.id, label: item.label, status: result.status,
        durationMs: Math.round(performance.now() - started), ...receipt });
    }
    if (completed + rejected !== plan.calls || dispatched !== plan.calls || budget.reservedNanoUsd !== plan.budgetNanoUsd) fail("PLAN_MISMATCH");
    ledger.write({ entry: "complete", completed, rejected, dispatched, reservedNanoUsd: budget.reservedNanoUsd });
    return { status: "COMPLETE", completed, rejected, dispatched, attempts: budget.attempts, reservedNanoUsd: budget.reservedNanoUsd };
  } catch (error) {
    const code = safeCode(error);
    try { ledger?.write({ entry: "stopped", code, caseId: current?.c.id ?? null, label: current?.label ?? null,
      durationMs: started === null ? null : Math.round(performance.now() - started), completed, rejected, dispatched,
      reservedNanoUsd: budget.reservedNanoUsd, ...receipt }); } catch {}
    return { status: "STOP", code, completed, rejected, dispatched, attempts: budget.attempts, reservedNanoUsd: budget.reservedNanoUsd };
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
      process.stdin.on("data", data); process.once("SIGTERM", cancelled);
    });
  } finally { process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n"); }
}
export function summary(plan, state) {
  const p = batchPaths(state), limits = GATEWAY_TASK_LIMITS.WEEKLY_REPORT;
  return { status: "OFFLINE_PREPARATION_PASS", providerCalls: 0, batch: BATCH, revision: REVISION, runnerCommit: state.head,
    model: SONNET_WEEKLY_MODEL, route: ROUTE, settings: { effort: "low", maxOutputTokens: MAX_OUTPUT_TOKENS, timeoutMs: limits.timeoutMs,
      gatewayHeaders: { "cf-aig-max-attempts": "1", "cf-aig-skip-cache": "true", "cf-aig-collect-log": "false", "cf-aig-collect-log-payload": "false" } },
    reservationPerCall: { inputTokensAssumed: limits.input, outputTokensMax: MAX_OUTPUT_TOKENS,
      formula: "ceil(8192 × 2000 × 1.25) + 2048 × 10000 nano-USD", usd: 0.04096 },
    plannedCalls: plan.calls, maximumUsd: plan.budgetNanoUsd / 1e9,
    cells: plan.cases.flatMap(c => c.arms.map(a => ({ case: c.id, experiment: c.experiment, locale: c.locale, arm: a.arm, flags: a.flags,
      requestBytes: a.requestBytes, sources: a.built.packet.evidence.length,
      ...(a.meaningfulDelivered ? { reviewMeaningfulDelivered: a.meaningfulDelivered.length } : {}) }))),
    approval: APPROVAL, ledger: p.ledger, artifacts: p.artifacts, ledgerAbsent: !state.ledgerExists, artifactsAbsent: !state.artifactsExist };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !["check", "live"].includes(args[0]))) fail("PLAN_MISMATCH");
  const plan = preparePlan();
  if (args[0] !== "live") return summary(plan, checkoutState());
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
  try { const result = await main(); console.log(JSON.stringify(result, null, 2)); if (result.status === "STOP") process.exitCode = 2; }
  catch (error) { console.log(JSON.stringify({ status: "STOP", code: safeCode(error) })); process.exitCode = 2; }
}

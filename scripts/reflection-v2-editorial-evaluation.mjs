// Standalone synthetic editorial evaluation. Default/check is network-free.
// Live requires a separately owner-approved clean runner commit and private TTY.
// No database, production service changes, retries, resume or ledger reset.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { constants, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASELINE, CANDIDATE, prepareEvaluation } from "./reflection-v2-editorial-plan.mjs";
import { GATEWAY_ATTESTATION } from "./zh-reflection-v2-weekly-gates.mjs";
import { GATEWAY_MODELS, GATEWAY_TASK_LIMITS, usdLimitNano } from "../lib/ai-gateway-config.js";
import { validateReflectionV2 } from "../lib/reflection-v2.js";

export { GATEWAY_ATTESTATION };
export const APPROVAL = "APPROVE-24-PAIRED-REFLECTION-V2-CALLS";
export const SCOPE_ATTESTATION = "integration-only-credentials-direct-model-routing-standard-rates-verified";
export const BRANCH = "codex/reflection-v2-editorial-quality";
export const BATCH = "reflection-v2-editorial-paired-c2d7a9d9";
export const TOTAL_NANO_USD = 2_457_600_000, MAX_NANO_USD = 2_460_000_000;
export const MAX_RESPONSE_BYTES = 512 * 1024, MAX_JSON_BYTES = 32 * 1024;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowedEnv = new Set(["PATH", "TERM", "LANG", "LC_ALL", "TMPDIR", "NODE_ENV",
  "PETALPAL_EDITORIAL_APPROVAL", "PETALPAL_EDITORIAL_COMMIT", "PETALPAL_EDITORIAL_BUDGET_USD",
  "PETALPAL_EDITORIAL_GATEWAY_VERIFIED", "PETALPAL_EDITORIAL_SCOPE_VERIFIED"]);
const CODES = new Set(["ENVIRONMENT_NOT_ISOLATED", "DOTENV_PRESENT", "TTY_REQUIRED", "APPROVAL_REQUIRED", "COMMIT_MISMATCH",
  "WORKTREE_NOT_CLEAN", "BUDGET_INVALID", "BUDGET_EXHAUSTED", "GATEWAY_UNVERIFIED", "SCOPE_UNVERIFIED", "LEDGER_CONSUMED",
  "ARTIFACTS_EXIST", "PLAN_MISMATCH", "CREDENTIALS_INVALID", "LEDGER_UNAVAILABLE", "ARTIFACT_WRITE_FAILED", "INTERRUPTED",
  "TIMEOUT", "TRANSPORT_FAILED", "HTTP_FAILED", "INVALID_RESPONSE", "RESPONSE_TOO_LARGE", "USAGE_INVALID",
  "CACHE_USAGE_UNEXPECTED", "VALIDATION_FAILED", "REPLAY_BLOCKED", "CHECKOUT_CHANGED", "EVALUATION_FAILED"]);
function fail(code) { throw Object.assign(new Error(code), { code }); }
const safeCode = error => CODES.has(error?.code) ? error.code : "EVALUATION_FAILED";
const paths = state => ({ parent: path.join(state.common, "petalpal-acceptance"),
  ledger: path.join(state.common, "petalpal-acceptance", `${BATCH}.jsonl`),
  artifacts: path.join(state.common, "petalpal-acceptance", BATCH) });

export function checkoutState() {
  const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const state = { head: git(["rev-parse", "HEAD"]), branch: git(["branch", "--show-current"]),
    clean: git(["status", "--porcelain"]) === "", common: git(["rev-parse", "--path-format=absolute", "--git-common-dir"]),
    dotenv: existsSync(path.join(root, ".env")) };
  const p = paths(state);
  return { ...state, ledgerExists: existsSync(p.ledger), artifactsExist: existsSync(p.artifacts) };
}

export function preflight({ env, state, tty }) {
  if (env.NODE_ENV !== "test" || Object.keys(env).some(key => !allowedEnv.has(key))) return "ENVIRONMENT_NOT_ISOLATED";
  if (state?.dotenv) return "DOTENV_PRESENT";
  if (!tty) return "TTY_REQUIRED";
  if (env.PETALPAL_EDITORIAL_APPROVAL !== APPROVAL) return "APPROVAL_REQUIRED";
  if (!/^[a-f0-9]{40}$/.test(env.PETALPAL_EDITORIAL_COMMIT || "") || state?.head !== env.PETALPAL_EDITORIAL_COMMIT || state.branch !== BRANCH) return "COMMIT_MISMATCH";
  if (!state.clean) return "WORKTREE_NOT_CLEAN";
  let cap; try { cap = usdLimitNano(env, "PETALPAL_EDITORIAL_BUDGET_USD"); } catch { return "BUDGET_INVALID"; }
  if (cap < TOTAL_NANO_USD || cap > MAX_NANO_USD) return "BUDGET_INVALID";
  if (env.PETALPAL_EDITORIAL_GATEWAY_VERIFIED !== GATEWAY_ATTESTATION) return "GATEWAY_UNVERIFIED";
  if (env.PETALPAL_EDITORIAL_SCOPE_VERIFIED !== SCOPE_ATTESTATION) return "SCOPE_UNVERIFIED";
  if (state.ledgerExists) return "LEDGER_CONSUMED";
  if (state.artifactsExist) return "ARTIFACTS_EXIST";
  return null;
}

export function validatePlan(plan) {
  try {
    assert.deepEqual(plan, prepareEvaluation()); // Includes exact fixtures, refs, case IDs, schemas, settings and prompts.
    assert.equal(plan.calls, 24); assert.equal(plan.budgetNanoUsd, TOTAL_NANO_USD);
    for (const c of plan.cases) {
      assert.equal(c.model, c.type === "WEEKLY" ? "claude-sonnet-5-5" : "claude-opus-5-5");
      assert.equal(c.timeoutMs, 20000);
    }
  } catch { fail("PLAN_MISMATCH"); }
}

// Existing exclusive/fsync ledger pattern, additionally opened O_APPEND for the
// batch. Never read, truncate, overwrite or resume an existing ledger.
function syncDirectory(dir) { const fd = openSync(dir, "r"); try { fsyncSync(fd); } finally { closeSync(fd); } }
function privateDirectory(dir, existing = false) {
  try { mkdirSync(dir, { mode: 0o700 }); syncDirectory(path.dirname(dir)); }
  catch (error) { if (!existing || error.code !== "EEXIST") throw error; }
  const stat = lstatSync(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid()) throw Error();
}
export function createLedger(file) {
  let fd;
  try {
    fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_APPEND, 0o600);
    fsyncSync(fd); syncDirectory(path.dirname(file));
  } catch { if (fd !== undefined) closeSync(fd); fail("LEDGER_UNAVAILABLE"); }
  return { write(entry) {
    try { writeFileSync(fd, `${JSON.stringify(entry)}\n`); fsyncSync(fd); } catch { fail("LEDGER_UNAVAILABLE"); }
  }, close() { closeSync(fd); } };
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

export function makeSchedule(plan, bit = () => randomInt(2)) {
  const schedule = [], mapping = [];
  for (let i = 0; i < 12; i += 2) {
    const labelBit = bit(), orderBit = bit();
    if (![0, 1].includes(labelBit) || ![0, 1].includes(orderBit)) fail("PLAN_MISMATCH");
    for (let j = 0; j < 2; j++) {
      const c = plan.cases[i + j], a = labelBit ^ j, first = orderBit ^ j;
      mapping.push({ caseId: c.id, A: c.arms[a].arm, B: c.arms[1 - a].arm, firstArm: c.arms[first].arm });
      for (const index of [first, 1 - first]) schedule.push({ c, arm: c.arms[index], label: index === a ? "A" : "B" });
    }
  }
  return { schedule, mapping }; // Persist before dispatch; replaying this map reproduces all labels/order without regenerating.
}

export function attemptBudget(cap) {
  if (!Number.isSafeInteger(cap) || cap < 0 || cap > MAX_NANO_USD) fail("BUDGET_INVALID");
  let reservedNanoUsd = 0; const seen = new Set();
  return { get reservedNanoUsd() { return reservedNanoUsd; }, get attempts() { return seen.size; },
    reserve(c, arm) {
      const id = `${c.id}/${arm.arm}`;
      if (seen.has(id) || seen.size >= 24) fail("REPLAY_BLOCKED");
      if (!Number.isSafeInteger(c.reservationNanoUsd) || c.reservationNanoUsd <= 0 || reservedNanoUsd + c.reservationNanoUsd > cap) fail("BUDGET_EXHAUSTED");
      seen.add(id); reservedNanoUsd += c.reservationNanoUsd;
    }
  };
}

// Mirrors the unchanged Gateway transport/Anthropic envelope bounds. The
// production client itself requires a Prisma cost/consent database; this runner
// uses the one-time batch ledger and only synthetic fixtures instead.
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
  if (input > GATEWAY_TASK_LIMITS[`${c.type}_REPORT`].input || output > arm.body.max_tokens) fail("USAGE_INVALID");
  if (raw.model !== c.model || raw.type !== "message" || raw.role !== "assistant" || raw.stop_reason !== "end_turn" ||
      !Array.isArray(raw.content) || raw.content.some(b => !b || !["text", "thinking", "redacted_thinking"].includes(b.type))) fail("INVALID_RESPONSE");
  const blocks = raw.content.filter(b => b.type === "text");
  if (blocks.length !== 1 || typeof blocks[0].text !== "string") fail("INVALID_RESPONSE");
  if (Buffer.byteLength(blocks[0].text) > MAX_JSON_BYTES) fail("RESPONSE_TOO_LARGE");
  let data; try { data = JSON.parse(blocks[0].text); } catch { fail("INVALID_RESPONSE"); }
  let rendered;
  try { rendered = validateReflectionV2(data, { type: c.type, locale: c.locale, built: c.built, model: c.model }); }
  catch { fail("VALIDATION_FAILED"); }
  const refs = new Set(data.paragraphs.flatMap(p => p.sentences.flatMap(s => s.refs)));
  receipt.editorialCoverage = c.type !== "WEEKLY" || c.scenario !== "mixed-negation" ||
    (refs.has("E1") && ["E2", "E3", "E4", "E5"].some(ref => refs.has(ref))) ? "ASSESSED" : "UNASSESSED";
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

// Dependency-injected core: no default transport. Only main's approved live
// branch supplies native fetch; tests must supply mocks and private temp paths.
export async function executeBatch({ plan, env, readState, tty, credentials, send, signal, bit }) {
  const state = readState(), blocked = preflight({ env, state, tty }); if (blocked) fail(blocked);
  validatePlan(plan); plan = structuredClone(plan); // Caller mutation cannot change scheduled bodies during awaits.
  if (typeof send !== "function" || !/^[a-f0-9]{32}$/.test(credentials?.account || "") ||
      ![credentials?.token, credentials?.key].every(s => typeof s === "string" && /^[\x21-\x7e]{1,4096}$/.test(s))) fail("CREDENTIALS_INVALID");
  const url = `https://gateway.ai.cloudflare.com/v1/${credentials.account}/petalpal-integration/anthropic/v1/messages`;
  const headers = { "Content-Type": "application/json", "cf-aig-authorization": `Bearer ${credentials.token}`, "x-api-key": credentials.key,
    "anthropic-version": "2023-06-01", "cf-aig-max-attempts": "1", "cf-aig-skip-cache": "true",
    "cf-aig-collect-log": "false", "cf-aig-collect-log-payload": "false", "cf-aig-request-timeout": "19900" };
  const budget = attemptBudget(usdLimitNano(env, "PETALPAL_EDITORIAL_BUDGET_USD")), p = paths(state);
  const { schedule, mapping } = makeSchedule(plan, bit);
  let ledger, completed = 0, dispatched = 0, current = null, started = null, receipt = {};
  try {
    try { privateDirectory(p.parent, true); } catch { fail("LEDGER_UNAVAILABLE"); }
    ledger = createLedger(p.ledger); // Consumed even if setup later fails or the process dies before its first send.
    ledger.write({ entry: "run", runnerCommit: state.head, baseline: BASELINE, candidate: CANDIDATE,
      plannedCalls: 24, plannedReservationNanoUsd: TOTAL_NANO_USD, capNanoUsd: usdLimitNano(env, "PETALPAL_EDITORIAL_BUDGET_USD") });
    try {
      for (const dir of [p.artifacts, path.join(p.artifacts, "review"), ...["prose", "claims", "evidence"].map(d => path.join(p.artifacts, "review", d))]) privateDirectory(dir);
    } catch { fail("ARTIFACT_WRITE_FAILED"); }
    save(path.join(p.artifacts, "operator-mapping.json"), { runnerCommit: state.head, baseline: BASELINE, candidate: CANDIDATE, mapping });
    for (const c of plan.cases) save(path.join(p.artifacts, "review", "evidence", `${c.id}.json`), { caseId: c.id, packet: c.built.packet });
    for (const item of schedule) {
      current = item; receipt = {}; started = performance.now();
      const next = readState();
      if (next.head !== state.head || next.branch !== BRANCH || !next.clean || next.dotenv || next.common !== state.common) fail("CHECKOUT_CHANGED");
      if (signal?.aborted) fail("INTERRUPTED");
      budget.reserve(item.c, item.arm);
      ledger.write({ entry: "attempt", ordinal: budget.attempts, caseId: item.c.id, arm: item.arm.arm, label: item.label,
        model: item.c.model, maxOutputTokens: item.arm.body.max_tokens, reservationNanoUsd: item.c.reservationNanoUsd,
        cumulativeReservationNanoUsd: budget.reservedNanoUsd, startedAt: new Date().toISOString() });
      const result = await requestOnce({ ...item, send, url, headers, signal, receipt, onDispatch: () => { dispatched++; } });
      if (signal?.aborted) fail("INTERRUPTED");
      // Store only validated synthetic prose/claims. No thinking blocks, raw
      // provider envelope, error body, authorization header or credentials.
      const name = `${item.c.id}-${item.label}`;
      save(path.join(p.artifacts, "review", "prose", `${name}.txt`), result.narrative);
      save(path.join(p.artifacts, "review", "claims", `${name}.json`), { caseId: item.c.id, label: item.label, ...result.data });
      ledger.write({ entry: "result", caseId: item.c.id, label: item.label, status: "VALIDATED", durationMs: Math.round(performance.now() - started), ...receipt });
      completed++;
    }
    if (completed !== 24 || dispatched !== 24 || budget.reservedNanoUsd !== TOTAL_NANO_USD) fail("PLAN_MISMATCH");
    ledger.write({ entry: "complete", completed, dispatched, reservedNanoUsd: budget.reservedNanoUsd });
    return { status: "COMPLETE", completed, dispatched, attempts: budget.attempts, reservedNanoUsd: budget.reservedNanoUsd };
  } catch (error) {
    const code = safeCode(error);
    // If the disk is unavailable, the existing exclusive ledger still blocks
    // replay. Never retry a failed ledger write or spend another attempt.
    try { ledger?.write({ entry: "stopped", code, caseId: current?.c.id ?? null, label: current?.label ?? null,
      durationMs: started === null ? null : Math.round(performance.now() - started), completed, dispatched,
      reservedNanoUsd: budget.reservedNanoUsd, ...receipt }); } catch {}
    return { status: "STOP", code, completed, dispatched, attempts: budget.attempts, reservedNanoUsd: budget.reservedNanoUsd };
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
  if (args[0] !== "live") {
    const plan = prepareEvaluation(); validatePlan(plan);
    return { status: "OFFLINE_PREPARATION_PASS", providerCalls: 0, plannedCalls: 24, reservationUsd: TOTAL_NANO_USD / 1e9 };
  }
  const env = Object.freeze({ ...process.env }), tty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const blocked = preflight({ env, state: checkoutState(), tty }); if (blocked) fail(blocked);
  const plan = prepareEvaluation(); validatePlan(plan);
  const credentials = { account: await privateInput("Cloudflare account ID"), token: await privateInput("petalpal-integration Gateway token"),
    key: await privateInput("PetalPal-Integration Anthropic API key") };
  const controller = new AbortController(), interrupt = () => controller.abort();
  process.on("SIGINT", interrupt); process.on("SIGTERM", interrupt);
  try { return await executeBatch({ plan, env, readState: checkoutState, tty, credentials, send: (url, options) => fetch(url, options), signal: controller.signal }); }
  finally { process.off("SIGINT", interrupt); process.off("SIGTERM", interrupt); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = await main(); console.log(JSON.stringify(result)); if (result.status === "STOP") process.exitCode = 2; }
  catch (error) { console.log(JSON.stringify({ status: "STOP", code: safeCode(error) })); process.exitCode = 2; }
}

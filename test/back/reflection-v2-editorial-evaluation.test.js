// OFFLINE ONLY. Every dispatch is an injected mock; native fetch is trapped.
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BASELINE, CANDIDATE, STAGES, prepareEvaluation, prepareStage } from "../../scripts/reflection-v2-editorial-plan.mjs";
import { approvalFor, REVIEW, stageState, BRANCH, BATCH, GATEWAY_ATTESTATION, SCOPE_ATTESTATION, TOTAL_NANO_USD, MAX_NANO_USD,
  MAX_RESPONSE_BYTES, MAX_JSON_BYTES, preflight, validatePlan, createLedger, makeSchedule, attemptBudget, executeBatch }
  from "../../scripts/reflection-v2-editorial-evaluation.mjs";

let nativeCalls = 0;
test.before(() => test.mock.method(globalThis, "fetch", () => { nativeCalls++; throw Error("REAL_NETWORK_FORBIDDEN"); }));
test.after(() => { assert.equal(nativeCalls, 0, "ZERO real provider calls"); test.mock.restoreAll(); });
const fullPlan = prepareEvaluation(), plan = prepareStage("stage1"), monthly = prepareStage("stage2"), head = "a".repeat(40);
const env = { NODE_ENV: "test", PETALPAL_EDITORIAL_APPROVAL: approvalFor(plan), PETALPAL_EDITORIAL_COMMIT: head,
  PETALPAL_EDITORIAL_BUDGET_USD: "0.24576", PETALPAL_EDITORIAL_GATEWAY_VERIFIED: GATEWAY_ATTESTATION,
  PETALPAL_EDITORIAL_SCOPE_VERIFIED: SCOPE_ATTESTATION };
const credentials = { account: "0".repeat(32), token: "synthetic-gateway-secret", key: "synthetic-provider-secret" };
const clean = { head, branch: BRANCH, clean: true, dotenv: false, ledgerExists: false, artifactsExist: false, legacyExists: false,
  prior: Object.fromEntries(Object.keys(STAGES).map(stage => [stage, { exists: false, complete: false }])) };
const lines = file => readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
function stageEnv(selection) {
  return { ...env, PETALPAL_EDITORIAL_APPROVAL: approvalFor(selection),
    PETALPAL_EDITORIAL_BUDGET_USD: String(selection.budgetNanoUsd / 1e9),
    ...(REVIEW[selection.stage] ? { PETALPAL_EDITORIAL_REVIEW: REVIEW[selection.stage] } : {}) };
}
function seedCompletedStage1(parent) {
  mkdirSync(parent, { mode: 0o700 });
  const ledger = createLedger(path.join(parent, `${BATCH}-stage1.jsonl`));
  ledger.write({ entry: "run", stage: "stage1", caseIds: STAGES.stage1.ids, runnerCommit: head, baseline: BASELINE, candidate: CANDIDATE,
    plannedCalls: 6, plannedReservationNanoUsd: plan.budgetNanoUsd });
  let ordinal = 0;
  for (const c of plan.cases) for (const arm of c.arms) {
    const label = arm.arm === "baseline" ? "A" : "B";
    ledger.write({ entry: "attempt", ordinal: ++ordinal, caseId: c.id, arm: arm.arm, label });
    ledger.write({ entry: "result", caseId: c.id, label, status: "VALIDATED", editorialCoverage: "ASSESSED" });
  }
  ledger.write({ entry: "complete", completed: 6, dispatched: 6, reservedNanoUsd: plan.budgetNanoUsd }); ledger.close();
}
function fixture(t, selection = plan, sharedCommon) {
  const common = sharedCommon ?? mkdtempSync(path.join(tmpdir(), "petalpal-editorial-mock-"));
  if (!sharedCommon) t.after(() => rmSync(common, { recursive: true, force: true })); // Only this test's synthetic temp files.
  const parent = path.join(common, "petalpal-acceptance"), ledger = path.join(parent, `${BATCH}-${selection.stage}.jsonl`), artifacts = path.join(parent, `${BATCH}-${selection.stage}`);
  if (!sharedCommon && selection.stage !== "stage1") seedCompletedStage1(parent);
  const readState = () => stageState({ ...clean, common }, selection.stage);
  const options = { plan: selection, env: stageEnv(selection), readState, tty: true, credentials, bit: () => 0 };
  return { common, parent, ledger, artifacts, options };
}
function envelope(body) {
  const packet = JSON.parse(body.messages[0].content);
  return { model: body.model, type: "message", role: "assistant", stop_reason: "end_turn",
    content: [{ type: "thinking", thinking: "SYNTHETIC_THINKING_DO_NOT_SAVE" }, { type: "text", text: JSON.stringify({
      version: packet.version, locale: packet.locale,
      paragraphs: packet.evidence.map(e => ({ sentences: [{ text: `“${e.text}”`, refs: [e.ref] }] }))
        // <=3 Weekly / <=4 Monthly paragraphs, retaining every source/week.
        .reduce((out, p, i) => { if (i < 2) out.push(p); else out[out.length - 1].sentences.push(...p.sentences); return out; }, [])
    }) }], usage: { input_tokens: 600, output_tokens: 150 } };
}
const reply = options => Response.json(envelope(JSON.parse(options.body)));

test("offline planning pins all 12 pairs, models, schema, evidence, settings and the full budget", () => {
  validatePlan(fullPlan); validatePlan(plan); validatePlan(monthly);
  assert.equal(fullPlan.calls, 24); assert.equal(fullPlan.budgetNanoUsd, TOTAL_NANO_USD);
  assert.equal(fullPlan.cases.filter(c => c.type === "WEEKLY").reduce((sum, c) => sum + 2 * c.reservationNanoUsd, 0), 491_520_000);
  assert.equal(fullPlan.cases.filter(c => c.type === "MONTHLY").reduce((sum, c) => sum + 2 * c.reservationNanoUsd, 0), 1_966_080_000);
  for (const mutate of [p => p.cases.pop(), p => p.cases.reverse(), p => p.cases[0].id = "C99",
    p => p.cases[0].arms[0].body.model = "other-model", p => p.cases[0].arms[0].body.max_tokens++,
    p => p.cases[0].arms[0].body.system += "changed", p => p.cases[0].arms[0].body.output_config.effort = "high",
    p => p.cases[0].arms.forEach(a => a.body.messages[0].content = "{}"),
    p => p.cases[0].arms.forEach(a => a.body.output_config.format.schema = {}),
    p => p.cases[0].timeoutMs = 21000, p => p.cases[0].reservationNanoUsd--]) {
    const modified = structuredClone(plan); mutate(modified); assert.throws(() => validatePlan(modified), { code: "PLAN_MISMATCH" });
  }
});

test("stages retain complementary scenarios, exact paired requests and separately bounded selections", () => {
  assert.deepEqual(plan.cases.map(c => c.id), ["C01", "C04", "C05"]);
  assert.deepEqual(monthly.cases.map(c => c.id), ["C08", "C09", "C12"]);
  assert.equal(plan.calls, 6); assert.equal(plan.budgetNanoUsd, 245_760_000);
  assert.equal(monthly.calls, 6); assert.equal(monthly.budgetNanoUsd, 983_040_000);
  for (const c of [...plan.cases, ...monthly.cases]) assert.deepEqual(c, fullPlan.cases.find(other => other.id === c.id));
  for (const locale of ["en", "zh-Hans", "zh-Hant"]) {
    assert.deepEqual(new Set([...plan.cases, ...monthly.cases].filter(c => c.locale === locale).map(c => c.scenario)), new Set(["mixed-negation", "ordinary"]));
  }
  for (const ids of [undefined, [], ["C01"], ["C08"], ["C02", "C02"], ["C03", "C02"], ["C99"]]) assert.throws(() => prepareStage("stage3", ids));
  const extra = prepareStage("stage3", ["C02"]); validatePlan(extra);
  assert.equal(extra.calls, 2); assert.equal(extra.budgetNanoUsd, 81_920_000);
  assert.equal(prepareStage("stage3", ["C07"]).budgetNanoUsd, 327_680_000);
  const expansion = prepareStage("stage3", [...STAGES.stage3.ids]);
  assert.equal(plan.budgetNanoUsd + monthly.budgetNanoUsd + expansion.budgetNanoUsd, TOTAL_NANO_USD);
  assert.equal(preflight({ plan: fullPlan, env, state: clean, tty: true }), "PLAN_MISMATCH");
  assert.equal(preflight({ plan, env: { ...env, PETALPAL_EDITORIAL_APPROVAL: "APPROVE-24-PAIRED-REFLECTION-V2-CALLS" }, state: clean, tty: true }), "APPROVAL_REQUIRED");
  const six = attemptBudget(MAX_NANO_USD, 6);
  for (const c of plan.cases) for (const arm of c.arms) six.reserve(c, arm);
  assert.throws(() => six.reserve(fullPlan.cases[1], fullPlan.cases[1].arms[0]), { code: "REPLAY_BLOCKED" });
  const { mapping, schedule } = makeSchedule(plan, () => 0);
  assert.equal(mapping.length, 3); assert.equal(schedule.length, 6);
  assert.ok([1, 2].includes(mapping.filter(m => m.A === "baseline").length));
});

test("three separate approvals can cover the optional full matrix without stage continuation or replay", async t => {
  const first = fixture(t); let calls = 0;
  const send = async (_, options) => { calls++; return reply(options); };
  assert.equal((await executeBatch({ ...first.options, send })).dispatched, 6);
  assert.equal(calls, 6);
  const firstBytes = readFileSync(first.ledger);
  const second = fixture(t, monthly, first.common);
  assert.equal(existsSync(second.ledger), false);
  await assert.rejects(executeBatch({ ...second.options, env: { ...second.options.env, PETALPAL_EDITORIAL_REVIEW: undefined }, send }), { code: "HUMAN_REVIEW_REQUIRED" });
  await assert.rejects(executeBatch({ ...second.options, env: { ...second.options.env, PETALPAL_EDITORIAL_APPROVAL: approvalFor(plan) }, send }), { code: "APPROVAL_REQUIRED" });
  assert.equal(calls, 6); assert.equal(existsSync(second.ledger), false);
  assert.equal((await executeBatch({ ...second.options, send })).dispatched, 6);
  assert.equal(calls, 12); assert.deepEqual(readFileSync(first.ledger), firstBytes);
  const extra = prepareStage("stage3", [...STAGES.stage3.ids]), third = fixture(t, extra, first.common);
  assert.equal(existsSync(third.ledger), false);
  await assert.rejects(executeBatch({ ...third.options, env: { ...third.options.env, PETALPAL_EDITORIAL_REVIEW: REVIEW.stage2 }, send }), { code: "HUMAN_REVIEW_REQUIRED" });
  assert.equal((await executeBatch({ ...third.options, send })).dispatched, 12);
  assert.equal(calls, 24);
  const attempts = [first, second, third].flatMap(f => lines(f.ledger).filter(e => e.entry === "attempt"));
  assert.equal(new Set(attempts.map(e => `${e.caseId}/${e.arm}`)).size, 24);
  assert.equal(attempts.reduce((sum, a) => sum + a.reservationNanoUsd, 0), TOTAL_NANO_USD);
  const another = fixture(t, prepareStage("stage3", ["C02"]), first.common);
  await assert.rejects(executeBatch({ ...another.options, send }), { code: "LEDGER_CONSUMED" });
  assert.equal(calls, 24);
});

test("an early targeted follow-up spends only one approved pair and cannot unlock Monthly", async t => {
  const extra = prepareStage("stage3", ["C03"]), f = fixture(t, extra); let calls = 0;
  const send = async (_, options) => { calls++; return reply(options); };
  const otherApproval = approvalFor(prepareStage("stage3", ["C02"]));
  await assert.rejects(executeBatch({ ...f.options, env: { ...f.options.env, PETALPAL_EDITORIAL_APPROVAL: otherApproval }, send }), { code: "APPROVAL_REQUIRED" });
  await assert.rejects(executeBatch({ ...f.options, env: { ...f.options.env, PETALPAL_EDITORIAL_BUDGET_USD: "1.2288" }, send }), { code: "BUDGET_INVALID" });
  assert.equal((await executeBatch({ ...f.options, send })).dispatched, 2); assert.equal(calls, 2);
  const second = fixture(t, monthly, f.common);
  await assert.rejects(executeBatch({ ...second.options, send }), { code: "STAGE_ORDER_BLOCKED" });
  assert.equal(existsSync(second.ledger), false); assert.equal(calls, 2);
});

test("missing, partial, corrupt, wrong-commit and unassessed predecessors cannot unlock later stages; legacy evidence stays untouched", async t => {
  for (const change of [() => "", () => "broken", rows => JSON.stringify(rows[0]),
    rows => rows.map((r, i) => JSON.stringify(i === 0 ? { ...r, runnerCommit: "b".repeat(40) } : r)).join("\n"),
    rows => rows.map(r => JSON.stringify(r.entry === "result" ? { ...r, editorialCoverage: "UNASSESSED" } : r)).join("\n"),
    rows => rows.filter((_, i) => i !== 2).map(r => JSON.stringify(r)).join("\n")]) {
    const f = fixture(t, monthly), predecessor = path.join(f.parent, `${BATCH}-stage1.jsonl`);
    writeFileSync(predecessor, change(lines(predecessor)));
    const before = readFileSync(predecessor);
    await assert.rejects(executeBatch({ ...f.options, send: () => assert.fail("no dispatch") }), { code: "PRIOR_STAGE_INCOMPLETE" });
    assert.equal(existsSync(f.ledger), false); assert.deepEqual(readFileSync(predecessor), before);
  }
  const empty = fixture(t), second = fixture(t, monthly, empty.common);
  await assert.rejects(executeBatch({ ...second.options, send: () => assert.fail("no dispatch") }), { code: "PRIOR_STAGE_INCOMPLETE" });
  const legacy = fixture(t); mkdirSync(legacy.parent, { mode: 0o700 });
  const old = path.join(legacy.parent, `${BATCH}.jsonl`); writeFileSync(old, "synthetic historical marker");
  await assert.rejects(executeBatch({ ...legacy.options, send: () => assert.fail("no dispatch") }), { code: "LEDGER_CONSUMED" });
  assert.equal(readFileSync(old, "utf8"), "synthetic historical marker"); assert.equal(existsSync(legacy.ledger), false);
});

test("preflight fails closed on absent approval, wrong commit/branch, dirty state, credentials/env, TTY, caps, attestation and consumed state", () => {
  const gate = (e = {}, state = {}, tty = true) => preflight({ plan, env: { ...env, ...e }, state: { ...clean, ...state }, tty });
  assert.equal(gate(), null);
  for (const [change, code] of [
    [{ PETALPAL_EDITORIAL_APPROVAL: undefined }, "APPROVAL_REQUIRED"], [{ PETALPAL_EDITORIAL_COMMIT: "b".repeat(40) }, "COMMIT_MISMATCH"],
    [{ PETALPAL_EDITORIAL_GATEWAY_VERIFIED: "yes" }, "GATEWAY_UNVERIFIED"], [{ PETALPAL_EDITORIAL_SCOPE_VERIFIED: "yes" }, "SCOPE_UNVERIFIED"],
    ...["0", "0.245759999", "0.245760001", "2.46", "NaN", undefined].map(v => [{ PETALPAL_EDITORIAL_BUDGET_USD: v }, "BUDGET_INVALID"]),
    ...["ANTHROPIC_API_KEY", "DATABASE_URL", "DEV_DATABASE_URL", "NODE_OPTIONS", "CI", "GITHUB_ACTIONS", "AI_GATEWAY_ENABLED"].map(k => [{ [k]: "synthetic" }, "ENVIRONMENT_NOT_ISOLATED"])
  ]) assert.equal(gate(change), code);
  for (const [state, code] of [[{ branch: "main" }, "COMMIT_MISMATCH"], [{ clean: false }, "WORKTREE_NOT_CLEAN"],
    [{ dotenv: true }, "DOTENV_PRESENT"], [{ ledgerExists: true }, "LEDGER_CONSUMED"], [{ artifactsExist: true }, "ARTIFACTS_EXIST"]]) assert.equal(gate({}, state), code);
  assert.equal(gate({}, {}, false), "TTY_REQUIRED");
  assert.equal(gate({ PETALPAL_EDITORIAL_BUDGET_USD: "0.24576" }), null);
});

test("one-time attempt accounting refuses duplicates, a 25th slot and exhausted funds without refund", () => {
  const budget = attemptBudget(plan.cases[0].reservationNanoUsd);
  budget.reserve(plan.cases[0], plan.cases[0].arms[0]);
  assert.throws(() => budget.reserve(plan.cases[0], plan.cases[0].arms[0]), { code: "REPLAY_BLOCKED" });
  assert.throws(() => budget.reserve(plan.cases[0], plan.cases[0].arms[1]), { code: "BUDGET_EXHAUSTED" });
  assert.equal(budget.attempts, 1); assert.equal(budget.reservedNanoUsd, 40_960_000);
  const full = attemptBudget(MAX_NANO_USD);
  for (const c of fullPlan.cases) for (const arm of c.arms) full.reserve(c, arm);
  assert.equal(full.reservedNanoUsd, TOTAL_NANO_USD); assert.equal(full.attempts, 24);
  assert.throws(() => full.reserve({ ...plan.cases[0], id: "extra" }, plan.cases[0].arms[0]), { code: "REPLAY_BLOCKED" });
});

test("balanced random labels and independent order have a stored reproducible mapping", () => {
  let n = 0; const { mapping, schedule } = makeSchedule(fullPlan, () => (n++ % 3 === 0 ? 1 : 0));
  assert.equal(mapping.filter(m => m.A === "baseline").length, 6);
  assert.equal(mapping.filter(m => m.firstArm === "baseline").length, 6);
  for (let i = 0; i < 12; i += 2) {
    assert.notEqual(mapping[i].A, mapping[i + 1].A); assert.notEqual(mapping[i].firstArm, mapping[i + 1].firstArm);
  }
  for (const { c, arm, label } of schedule) assert.equal(mapping.find(m => m.caseId === c.id)[label], arm.arm);
});

test("six mocked Stage 1 sends stop without continuation, record attempts durably before dispatch and save blinded synthetic outputs without secrets", async t => {
  const f = fixture(t); let calls = 0, active = 0, maximum = 0;
  const result = await executeBatch({ ...f.options, send: async (url, options) => {
    calls++; maximum = Math.max(maximum, ++active);
    assert.equal(url, `https://gateway.ai.cloudflare.com/v1/${credentials.account}/petalpal-integration/anthropic/v1/messages`);
    assert.equal(options.redirect, "error"); assert.equal(options.headers["cf-aig-max-attempts"], "1");
    assert.equal(options.headers["cf-aig-skip-cache"], "true"); assert.equal(options.headers["cf-aig-request-timeout"], "19900");
    assert.equal(options.headers["cf-aig-collect-log-payload"], "false");
    const attempt = lines(f.ledger).at(-1);
    assert.equal(attempt.entry, "attempt"); assert.equal(attempt.ordinal, calls);
    assert.ok(attempt.cumulativeReservationNanoUsd <= MAX_NANO_USD);
    assert.ok(existsSync(path.join(f.artifacts, "operator-mapping.json")));
    await Promise.resolve(); active--; return reply(options);
  } });
  assert.deepEqual(result, { status: "COMPLETE", completed: 6, dispatched: 6, attempts: 6, reservedNanoUsd: plan.budgetNanoUsd });
  assert.equal(calls, 6); assert.equal(maximum, 1);
  assert.equal(lines(f.ledger).at(-1).entry, "complete");
  assert.equal(lines(f.ledger).filter(x => x.entry === "result" && x.usage && x.estimatedCostNanoUsd > 0 && x.durationMs >= 0).length, 6);
  assert.equal(statSync(f.ledger).mode & 0o777, 0o600);
  assert.equal(statSync(f.artifacts).mode & 0o777, 0o700);
  const review = path.join(f.artifacts, "review");
  assert.equal(readdirSync(path.join(review, "prose")).length, 6);
  assert.equal(readdirSync(path.join(review, "claims")).length, 6);
  const allFiles = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? allFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  const saved = [f.ledger, ...allFiles(f.artifacts)].map(p => readFileSync(p, "utf8")).join("\n");
  for (const secret of [credentials.key, credentials.token, credentials.account, "SYNTHETIC_THINKING_DO_NOT_SAVE", "x-api-key", "cf-aig-authorization"]) assert.equal(saved.includes(secret), false);
  const blind = allFiles(review).map(p => readFileSync(p, "utf8")).join("\n");
  for (const hint of ["baseline", "candidate", "claude-", "estimatedCost", "durationMs", "runnerCommit"]) assert.equal(blind.includes(hint), false);
  await assert.rejects(executeBatch({ ...f.options, send: () => assert.fail("no replay") }), { code: "LEDGER_CONSUMED" });
});

test("empty or partial ledgers survive interrupted setup and cannot be resumed, overwritten or reset", async t => {
  for (const partial of [false, true]) {
    const f = fixture(t); mkdirSync(f.parent, { mode: 0o700 }); const ledger = createLedger(f.ledger);
    if (partial) ledger.write({ entry: "attempt", ordinal: 1 }); ledger.close();
    const before = readFileSync(f.ledger);
    assert.throws(() => createLedger(f.ledger), { code: "LEDGER_UNAVAILABLE" });
    await assert.rejects(executeBatch({ ...f.options, send: () => assert.fail("consumed ledger must not dispatch") }), { code: "LEDGER_CONSUMED" });
    assert.deepEqual(readFileSync(f.ledger), before);
  }
});

test("mid-batch transport error stops at that attempt; raw errors/credentials never enter receipts", async t => {
  const f = fixture(t); let calls = 0;
  const result = await executeBatch({ ...f.options, send: async (_, options) => {
    if (++calls === 3) throw Error(credentials.key); return reply(options);
  } });
  assert.equal(calls, 3); assert.equal(result.code, "TRANSPORT_FAILED"); assert.equal(result.completed, 2);
  assert.equal(result.reservedNanoUsd, 3 * 40_960_000);
  assert.equal(lines(f.ledger).at(-1).entry, "stopped"); assert.equal(readFileSync(f.ledger, "utf8").includes(credentials.key), false);
  await assert.rejects(executeBatch({ ...f.options, send: () => assert.fail("no resume") }), { code: "LEDGER_CONSUMED" });
});

test("an attempt fsync failure prevents network dispatch and leaves the ledger consumed", async t => {
  const f = fixture(t), original = fs.fsyncSync;
  t.mock.method(fs, "fsyncSync", fd => {
    if (existsSync(f.ledger) && fs.fstatSync(fd).ino === statSync(f.ledger).ino && readFileSync(f.ledger, "utf8").includes('"entry":"attempt"')) throw Error("synthetic disk failure");
    return original(fd);
  });
  syncBuiltinESMExports(); t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const result = await executeBatch({ ...f.options, send: () => assert.fail("fsync must succeed before any send") });
  assert.equal(result.code, "LEDGER_UNAVAILABLE"); assert.equal(result.dispatched, 0); assert.equal(result.attempts, 1);
  assert.ok(existsSync(f.ledger));
});

test("invalid envelopes, schema/grounding, usage, cache and HTTP responses all stop without repair", async t => {
  const changes = [
    [raw => { raw.model = "wrong-model"; }, "INVALID_RESPONSE"], [raw => { raw.stop_reason = "max_tokens"; }, "INVALID_RESPONSE"],
    [raw => { raw.content[1].text = "not json"; }, "INVALID_RESPONSE"],
    [raw => { raw.content[1].text = JSON.stringify({ version: "bad" }); }, "VALIDATION_FAILED"],
    [raw => { const data = JSON.parse(raw.content[1].text); data.paragraphs[0].sentences[0].text = "999 unsupported."; raw.content[1].text = JSON.stringify(data); }, "VALIDATION_FAILED"],
    [raw => { raw.usage.input_tokens = 8193; }, "USAGE_INVALID"], [raw => { raw.usage.output_tokens = 2049; }, "USAGE_INVALID"],
    [raw => { raw.usage.cache_read_input_tokens = 1; }, "CACHE_USAGE_UNEXPECTED"],
    [raw => { raw.content[1].text = "x".repeat(MAX_JSON_BYTES + 1); }, "RESPONSE_TOO_LARGE"]
  ];
  for (const [mutate, code] of changes) {
    const f = fixture(t); let calls = 0;
    const result = await executeBatch({ ...f.options, send: async (_, options) => {
      calls++; const raw = envelope(JSON.parse(options.body)); mutate(raw); return Response.json(raw);
    } });
    assert.equal(result.code, code); assert.equal(calls, 1); assert.equal(result.completed, 0);
  }
  for (const response of [new Response(credentials.key, { status: 503 }), new Response("not json", { headers: { "Content-Type": "application/json" } }),
    new Response("{}", { headers: { "Content-Type": "text/html" } }), new Response("x".repeat(MAX_RESPONSE_BYTES + 1), { headers: { "Content-Type": "application/json" } })]) {
    const f = fixture(t); let calls = 0;
    const result = await executeBatch({ ...f.options, send: async () => { calls++; return response; } });
    assert.equal(result.status, "STOP"); assert.equal(calls, 1); assert.equal(result.completed, 0);
    assert.equal(readFileSync(f.ledger, "utf8").includes(credentials.key), false);
  }
});

for (const type of ["WEEKLY", "MONTHLY"]) test(`${type} retains 20-second deadline; noncooperative late response cannot be read, saved or followed by another call`, async t => {
  const f = fixture(t, type === "WEEKLY" ? plan : monthly); let release, arrived, calls = 0, reads = 0;
  const started = new Promise(resolve => { arrived = resolve; });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const running = executeBatch({ ...f.options, send: async (_, options) => {
    calls++; const body = JSON.parse(options.body);
    if (body.model !== (type === "WEEKLY" ? "claude-sonnet-5-5" : "claude-opus-5-5")) return reply(options);
    const response = reply(options), original = response.body.getReader.bind(response.body);
    response.body.getReader = (...args) => { reads++; return original(...args); };
    arrived(); return new Promise(resolve => { release = () => resolve(response); });
  } });
  await started; t.mock.timers.tick(19999); await Promise.resolve();
  assert.equal(lines(f.ledger).at(-1).entry, "attempt");
  t.mock.timers.tick(1); const result = await running;
  assert.equal(result.code, "TIMEOUT"); assert.equal(calls, 1);
  const saved = readFileSync(f.ledger, "utf8"); release(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads, 0); assert.equal(readFileSync(f.ledger, "utf8"), saved); assert.equal(result.completed, calls - 1);
});

test("deadline also bounds a response body that never finishes", async t => {
  const f = fixture(t); let arrived;
  const started = new Promise(resolve => { arrived = resolve; });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const running = executeBatch({ ...f.options, send: async () => {
    arrived(); return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("{")); } }), { headers: { "Content-Type": "application/json" } });
  } });
  await started; t.mock.timers.tick(20000);
  assert.equal((await running).code, "TIMEOUT");
});

test("Monthly enforces its existing 4096 output-token limit without enlarging the reservation", async t => {
  const f = fixture(t, monthly); let calls = 0;
  const result = await executeBatch({ ...f.options, send: async (_, options) => {
    calls++; const body = JSON.parse(options.body), raw = envelope(body);
    if (body.model === "claude-opus-5-5") { assert.equal(body.max_tokens, 4096); raw.usage.output_tokens = 4097; }
    return Response.json(raw);
  } });
  assert.equal(result.code, "USAGE_INVALID"); assert.equal(calls, 1); assert.equal(result.completed, 0);
  assert.equal(result.reservedNanoUsd, 163_840_000);
});

test("interruption before or during dispatch stops the batch and consumes its ledger", async t => {
  for (const before of [true, false]) {
    const f = fixture(t), controller = new AbortController(); let calls = 0;
    if (before) controller.abort();
    const result = await executeBatch({ ...f.options, signal: controller.signal, send: async () => {
      calls++; controller.abort(); return new Promise(() => {});
    } });
    assert.equal(result.code, "INTERRUPTED"); assert.equal(calls, before ? 0 : 1);
    assert.ok(existsSync(f.ledger));
    await assert.rejects(executeBatch({ ...f.options, send: () => assert.fail("no replay") }), { code: "LEDGER_CONSUMED" });
  }
});

test("changed checkout and insufficient approval stop before the next network attempt", async t => {
  const f = fixture(t); let calls = 0, changed = false;
  const result = await executeBatch({ ...f.options, readState: () => ({ ...f.options.readState(), clean: !changed }), send: async (_, options) => {
    calls++; changed = true; return reply(options);
  } });
  assert.equal(calls, 1); assert.equal(result.code, "CHECKOUT_CHANGED");
  const second = fixture(t);
  await assert.rejects(executeBatch({ ...second.options, env: { ...env, PETALPAL_EDITORIAL_BUDGET_USD: "0.24575" }, send: () => assert.fail("no spend") }), { code: "BUDGET_INVALID" });
  assert.equal(existsSync(second.ledger), false);
});

test("CLI offline/check paths make zero provider calls; live without authorization never prompts or sends", t => {
  const f = fixture(t), guard = path.join(f.common, "network-guard.mjs");
  writeFileSync(guard, 'globalThis.fetch = () => { throw new Error("NETWORK_FORBIDDEN"); };');
  for (const args of [[], ["check"], ["check", "stage1"], ["check", "stage2"], ["check", "stage3", "C02"]]) {
    const result = spawnSync(process.execPath, ["--import", guard, "scripts/reflection-v2-editorial-evaluation.mjs", ...args], { encoding: "utf8", env: { PATH: process.env.PATH } });
    assert.equal(result.status, 0); assert.equal(JSON.parse(result.stdout).providerCalls, 0);
  }
  for (const args of [["live"], ["live", "stage1"], ["live", "stage2"], ["live", "stage3"], ["live", "full"], ["live", "stage1", "C02"]]) {
  const live = spawnSync(process.execPath, ["--import", guard, "scripts/reflection-v2-editorial-evaluation.mjs", ...args], { encoding: "utf8", env: { NODE_ENV: "test", PATH: process.env.PATH } });
  assert.equal(live.status, 2); assert.equal(JSON.parse(live.stdout).status, "STOP"); assert.equal(live.stdout.includes("hidden"), false);
  }
  assert.equal(nativeCalls, 0);
});

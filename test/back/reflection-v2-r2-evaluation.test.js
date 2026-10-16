// OFFLINE ONLY: disposable synthetic ledgers; injected sends; native fetch trapped.
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { preparePlan, validatePlan, preflight, batchState, batchPaths, executeBatch, PREVIOUS, R2,
  BRANCH, BATCH, APPROVAL, MAX_NANO_USD, GATEWAY_ATTESTATION, SCOPE_ATTESTATION, checkoutState } from "../../scripts/reflection-v2-r2-evaluation.mjs";
import { createLedger, makeSchedule, attemptBudget, MAX_RESPONSE_BYTES, MAX_JSON_BYTES } from "../../scripts/reflection-v2-editorial-evaluation.mjs";
import { MIXED_NEGATION, ORDINARY } from "../../scripts/reflection-v2-editorial-plan.mjs";

let nativeCalls = 0;
test.before(() => test.mock.method(globalThis, "fetch", () => { nativeCalls++; throw Error("REAL_NETWORK_FORBIDDEN"); }));
test.after(() => { assert.equal(nativeCalls, 0); test.mock.restoreAll(); });
const plan = preparePlan(), head = "a".repeat(40);
const env = { NODE_ENV: "test", PETALPAL_R2_EVAL_APPROVAL: APPROVAL, PETALPAL_R2_EVAL_COMMIT: head,
  PETALPAL_R2_EVAL_BUDGET_USD: "0.24576", PETALPAL_R2_EVAL_GATEWAY_VERIFIED: GATEWAY_ATTESTATION,
  PETALPAL_R2_EVAL_SCOPE_VERIFIED: SCOPE_ATTESTATION };
const credentials = { account: "0".repeat(32), token: "synthetic-gateway-secret", key: "synthetic-provider-secret" };
const clean = { head, branch: BRANCH, clean: true, dotenv: false, ledgerExists: false, artifactsExist: false };
const lines = file => readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
function fixture(t) {
  const common = mkdtempSync(path.join(tmpdir(), "petalpal-r2-mock-"));
  t.after(() => rmSync(common, { recursive: true, force: true }));
  const paths = batchPaths({ common }), readState = () => batchState({ ...clean, common });
  return { common, ...paths, options: { plan, env, readState, tty: true, credentials, bit: () => 0 } };
}
function envelope(body) {
  const packet = JSON.parse(body.messages[0].content);
  return { model: body.model, type: "message", role: "assistant", stop_reason: "end_turn",
    content: [{ type: "thinking", thinking: "SYNTHETIC_THINKING_DO_NOT_SAVE" }, { type: "text", text: JSON.stringify({
      version: packet.version, locale: packet.locale,
      paragraphs: [{ sentences: packet.evidence.map(e => ({ text: `“${e.text}”`, refs: [e.ref] })) }]
    }) }], usage: { input_tokens: 600, output_tokens: 150 } };
}
const reply = options => Response.json(envelope(JSON.parse(options.body)));
const allFiles = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? allFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);

test("only six fixed Weekly calls compare exact previous/R2 pins with identical frozen packets and settings", () => {
  validatePlan(plan);
  assert.equal(PREVIOUS, "c2d7a9d9a7d06f8291de5be7d890988fcdb5b9a8");
  assert.equal(R2, "99f471cb4345868cfc29de0395e52d7e93f17d43");
  assert.equal(plan.calls, 6); assert.equal(plan.budgetNanoUsd, MAX_NANO_USD);
  assert.deepEqual(plan.cases.map(c => [c.id, c.locale]), [["C01", "en"], ["C04", "zh-Hans"], ["C05", "zh-Hant"]]);
  for (const c of plan.cases) {
    assert.equal(c.type, "WEEKLY"); assert.equal(c.model, "claude-sonnet-5-5"); assert.equal(c.timeoutMs, 20000);
    assert.equal(c.reservationNanoUsd, 40_960_000);
    assert.deepEqual(c.built.packet.evidence.map(e => e.text), c.id === "C04" ? ORDINARY["zh-Hans"] : MIXED_NEGATION);
    assert.deepEqual(c.built.packet.evidence.map(e => e.day), c.id === "C04" ? ["Mon", "Wed", "Fri", "Sun"] : ["Mon", "Tue", "Wed", "Fri", "Sun"]);
    assert.deepEqual(c.arms.map(a => [a.arm, a.promptCommit]), [["previous", PREVIOUS], ["r2", R2]]);
    const { system: first, ...a } = c.arms[0].body, { system: second, ...b } = c.arms[1].body;
    assert.notEqual(first, second); assert.deepEqual(a, b); assert.equal(a.max_tokens, 2048); assert.equal(a.output_config.effort, "low");
  }
  for (const mutate of [p => p.cases.pop(), p => p.cases.reverse(), p => p.calls = 12, p => p.batch += "-new",
    p => p.cases[0].arms[0].promptCommit = R2, p => p.cases[0].arms[1].body.system += "changed",
    p => p.cases[0].arms[0].body.max_tokens++, p => p.cases[0].type = "MONTHLY", p => p.cases[0].model = "claude-opus-5-5",
    p => p.cases[0].arms[0].body.messages[0].content = "{}", p => p.cases[0].timeoutMs++, p => p.budgetNanoUsd--]) {
    const changed = structuredClone(plan); mutate(changed);
    assert.throws(() => validatePlan(changed), { code: "PLAN_MISMATCH" });
  }
});

test("preflight rejects old approvals, wrong commit/branch, nonisolated env, TTY, cap and consumed artifacts", () => {
  const gate = (e = {}, s = {}, tty = true) => preflight({ plan, env: { ...env, ...e }, state: { ...clean, ...s }, tty });
  assert.equal(gate(), null);
  for (const [e, s, expected] of [
    [{ PETALPAL_R2_EVAL_APPROVAL: undefined }, {}, "APPROVAL_REQUIRED"],
    [{ PETALPAL_R2_EVAL_APPROVAL: "APPROVE-STAGE1-6-REFLECTION-V2-CALLS-C01-C04-C05" }, {}, "APPROVAL_REQUIRED"],
    [{ PETALPAL_R2_EVAL_COMMIT: R2 }, {}, "COMMIT_MISMATCH"], [{}, { branch: "codex/reflection-v2-editorial-quality" }, "COMMIT_MISMATCH"],
    [{}, { clean: false }, "WORKTREE_NOT_CLEAN"], [{}, { dotenv: true }, "DOTENV_PRESENT"],
    [{ PETALPAL_R2_EVAL_BUDGET_USD: "0.25" }, {}, "BUDGET_INVALID"], [{ PETALPAL_R2_EVAL_BUDGET_USD: "0.24575" }, {}, "BUDGET_INVALID"],
    [{ PETALPAL_R2_EVAL_GATEWAY_VERIFIED: undefined }, {}, "GATEWAY_UNVERIFIED"],
    [{ PETALPAL_R2_EVAL_SCOPE_VERIFIED: undefined }, {}, "SCOPE_UNVERIFIED"],
    [{}, { ledgerExists: true }, "LEDGER_CONSUMED"], [{}, { artifactsExist: true }, "ARTIFACTS_EXIST"]
  ]) assert.equal(gate(e, s), expected);
  for (const key of ["CI", "GITHUB_ACTIONS", "DATABASE_URL", "ANTHROPIC_API_KEY", "NODE_OPTIONS", "PETALPAL_EDITORIAL_APPROVAL"])
    assert.equal(gate({ [key]: "synthetic" }), "ENVIRONMENT_NOT_ISOLATED");
  assert.equal(gate({}, {}, false), "TTY_REQUIRED");
});

test("macOS exception permits only the exact text-encoding name on Darwin without mutating the environment", () => {
  const original = Object.getOwnPropertyDescriptor(process, "platform");
  const environment = Object.freeze({ ...env, __CF_USER_TEXT_ENCODING: "synthetic-platform-metadata" });
  try {
    for (const platform of ["darwin", "linux", "win32"]) {
      Object.defineProperty(process, "platform", { value: platform });
      const gate = e => preflight({ plan, env: e, state: clean, tty: true });
      assert.equal(gate(environment), platform === "darwin" ? null : "ENVIRONMENT_NOT_ISOLATED");
      for (const key of ["__CF_USER_TEXT_ENCODING_EXTRA", "__CF_USER_TEXT_ENCODIN", "__cf_user_text_encoding",
        "__CF_OTHER", "CI", "GITHUB_ACTIONS", "DATABASE_URL", "AI_WEEKLY_REPORT_PROVIDER", "ANTHROPIC_API_KEY",
        "CLOUDFLARE_AI_GATEWAY_TOKEN", "NODE_OPTIONS", "NODE_PATH", "DYLD_INSERT_LIBRARIES", "UNEXPECTED_VARIABLE"])
        assert.equal(gate({ ...environment, [key]: "synthetic" }), "ENVIRONMENT_NOT_ISOLATED");
    }
  } finally { Object.defineProperty(process, "platform", original); }
  assert.equal(environment.__CF_USER_TEXT_ENCODING, "synthetic-platform-metadata");
});

test("macOS text-encoding exception preserves approval, commit, budget, TTY and evidence gates", () => {
  const original = Object.getOwnPropertyDescriptor(process, "platform");
  try {
    Object.defineProperty(process, "platform", { value: "darwin" });
    const gate = (e = {}, s = {}, tty = true) => preflight({ plan,
      env: { ...env, __CF_USER_TEXT_ENCODING: "synthetic-platform-metadata", ...e }, state: { ...clean, ...s }, tty });
    for (const [e, s, expected] of [
      [{ NODE_ENV: "production" }, {}, "ENVIRONMENT_NOT_ISOLATED"],
      [{ PETALPAL_R2_EVAL_APPROVAL: undefined }, {}, "APPROVAL_REQUIRED"],
      [{ PETALPAL_R2_EVAL_COMMIT: "21b87fac94e404d9b86f05854ab627a6d72de23e" }, {}, "COMMIT_MISMATCH"],
      [{}, { branch: "other" }, "COMMIT_MISMATCH"], [{}, { clean: false }, "WORKTREE_NOT_CLEAN"],
      [{}, { dotenv: true }, "DOTENV_PRESENT"],
      [{ PETALPAL_R2_EVAL_BUDGET_USD: "0.25" }, {}, "BUDGET_INVALID"],
      [{ PETALPAL_R2_EVAL_BUDGET_USD: "0.24575" }, {}, "BUDGET_INVALID"],
      [{ PETALPAL_R2_EVAL_GATEWAY_VERIFIED: undefined }, {}, "GATEWAY_UNVERIFIED"],
      [{ PETALPAL_R2_EVAL_SCOPE_VERIFIED: undefined }, {}, "SCOPE_UNVERIFIED"],
      [{}, { ledgerExists: true }, "LEDGER_CONSUMED"], [{}, { artifactsExist: true }, "ARTIFACTS_EXIST"]
    ]) assert.equal(gate(e, s), expected);
    assert.equal(gate({}, {}, false), "TTY_REQUIRED");
  } finally { Object.defineProperty(process, "platform", original); }
});

test("new ledger namespace ignores and preserves consumed historical evidence", async t => {
  const f = fixture(t); mkdirSync(f.parent, { mode: 0o700 });
  const historical = path.join(f.parent, "reflection-v2-editorial-paired-c2d7a9d9-stage1.jsonl");
  writeFileSync(historical, "synthetic consumed historical marker", { mode: 0o600 });
  assert.equal(f.options.readState().ledgerExists, false);
  const result = await executeBatch({ ...f.options, send: async (_, options) => reply(options) });
  assert.equal(result.completed, 6); assert.equal(readFileSync(historical, "utf8"), "synthetic consumed historical marker");
  assert.notEqual(f.ledger, historical);
});

test("labels/order are blinded and reproducible; six-call budget refuses duplicate, seventh and underfunded slots", () => {
  const { schedule, mapping } = makeSchedule(plan, () => 0);
  assert.equal(schedule.length, 6); assert.equal(mapping.length, 3);
  assert.deepEqual(mapping.map(m => m.A), ["previous", "r2", "previous"]);
  assert.deepEqual(mapping.map(m => m.firstArm), ["previous", "r2", "previous"]);
  assert.equal(new Set(schedule.map(s => `${s.c.id}/${s.arm.arm}`)).size, 6);
  const budget = attemptBudget(MAX_NANO_USD, 6);
  for (const s of schedule) budget.reserve(s.c, s.arm);
  assert.equal(budget.reservedNanoUsd, MAX_NANO_USD);
  assert.throws(() => budget.reserve(schedule[0].c, schedule[0].arm), { code: "REPLAY_BLOCKED" });
  assert.throws(() => budget.reserve({ ...schedule[0].c, id: "C99" }, schedule[0].arm), { code: "REPLAY_BLOCKED" });
  assert.throws(() => attemptBudget(0, 6).reserve(schedule[0].c, schedule[0].arm), { code: "BUDGET_EXHAUSTED" });
});

test("six sequential mock sends fsync attempts before dispatch, store private blind artifacts and cannot replay", async t => {
  const f = fixture(t); let calls = 0, active = 0, maximum = 0;
  const result = await executeBatch({ ...f.options, send: async (url, options) => {
    calls++; maximum = Math.max(maximum, ++active);
    assert.equal(url, `https://gateway.ai.cloudflare.com/v1/${credentials.account}/petalpal-integration/anthropic/v1/messages`);
    assert.equal(options.redirect, "error");
    for (const [key, value] of Object.entries({ "cf-aig-max-attempts": "1", "cf-aig-skip-cache": "true",
      "cf-aig-collect-log": "false", "cf-aig-collect-log-payload": "false", "cf-aig-request-timeout": "19900" })) assert.equal(options.headers[key], value);
    const attempt = lines(f.ledger).at(-1);
    assert.equal(attempt.entry, "attempt"); assert.equal(attempt.ordinal, calls);
    assert.ok(attempt.cumulativeReservationNanoUsd <= MAX_NANO_USD);
    assert.ok(existsSync(path.join(f.artifacts, "operator-mapping.json")));
    await Promise.resolve(); active--; return reply(options);
  } });
  assert.deepEqual(result, { status: "COMPLETE", completed: 6, dispatched: 6, attempts: 6, reservedNanoUsd: MAX_NANO_USD });
  assert.equal(calls, 6); assert.equal(maximum, 1);
  const entries = lines(f.ledger); assert.equal(entries.at(-1).entry, "complete");
  assert.equal(entries[0].previous, PREVIOUS); assert.equal(entries[0].r2, R2);
  assert.equal(entries.filter(e => e.entry === "result" && e.status === "VALIDATED" && e.editorialCoverage === "ASSESSED").length, 6);
  assert.equal(statSync(f.ledger).mode & 0o777, 0o600); assert.equal(statSync(f.artifacts).mode & 0o777, 0o700);
  const review = path.join(f.artifacts, "review"); assert.equal(readdirSync(path.join(review, "prose")).length, 6);
  const saved = [f.ledger, ...allFiles(f.artifacts)].map(p => readFileSync(p, "utf8")).join("\n");
  for (const secret of [credentials.key, credentials.token, credentials.account, "SYNTHETIC_THINKING_DO_NOT_SAVE", "x-api-key"]) assert.equal(saved.includes(secret), false);
  const blind = allFiles(review).map(p => readFileSync(p, "utf8")).join("\n");
  for (const hint of ["previous", "r2", "claude-", "estimatedCost", "runnerCommit", PREVIOUS, R2]) assert.equal(blind.includes(hint), false);
  await assert.rejects(executeBatch({ ...f.options, send: () => assert.fail("no replay") }), { code: "LEDGER_CONSUMED" });
});

test("empty/partial ledgers and preexisting artifacts cannot be resumed, overwritten or reset", async t => {
  for (const partial of [false, true]) {
    const f = fixture(t); mkdirSync(f.parent, { mode: 0o700 }); const ledger = createLedger(f.ledger);
    if (partial) ledger.write({ entry: "attempt", ordinal: 1 }); ledger.close();
    const before = readFileSync(f.ledger);
    await assert.rejects(executeBatch({ ...f.options, send: () => assert.fail("no dispatch") }), { code: "LEDGER_CONSUMED" });
    assert.deepEqual(readFileSync(f.ledger), before);
  }
  const f = fixture(t); mkdirSync(f.parent, { mode: 0o700 }); mkdirSync(f.artifacts, { mode: 0o700 });
  await assert.rejects(executeBatch({ ...f.options, send: () => assert.fail("no dispatch") }), { code: "ARTIFACTS_EXIST" });
  assert.equal(existsSync(f.ledger), false);
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

test("validation diagnostics persist only a fixed code and stop each frozen locale without rejected content", async t => {
  const marker = "SYNTHETIC_REJECTED_PERSONAL_CONTENT_DO_NOT_RETAIN";
  for (const [caseId, expectedCalls, expectedCode] of [
    ["C01", 1, "REFLECTION_V2_DIGIT_UNSUPPORTED"],
    ["C04", 3, "REFLECTION_V2_SCHEMA_ADDITIONAL_PROPERTY"],
    ["C05", 5, "REFLECTION_V2_QUOTE_UNSUPPORTED"]
  ]) {
    const f = fixture(t); let calls = 0;
    const result = await executeBatch({ ...f.options, send: async (_, options) => {
      calls++; const raw = envelope(JSON.parse(options.body));
      if (calls === expectedCalls) {
        const data = JSON.parse(raw.content[1].text);
        data.paragraphs[0].sentences[0].text = `${marker} 999`;
        if (caseId === "C04") data[marker] = marker;
        if (caseId === "C05") data.paragraphs[0].sentences[0].text = `“${marker}”`;
        // A response-provided field must never be forwarded as a diagnostic.
        raw.validationCode = marker;
        raw.content[1].text = JSON.stringify(data);
      }
      return Response.json(raw);
    } });
    assert.equal(result.code, "VALIDATION_FAILED"); assert.equal(result.validationCode, expectedCode);
    assert.equal(result.dispatched, expectedCalls); assert.equal(result.completed, expectedCalls - 1);
    const stopped = lines(f.ledger).at(-1);
    assert.equal(stopped.caseId, caseId); assert.equal(stopped.httpStatus, 200);
    assert.equal(stopped.validationCode, result.validationCode);
    const saved = [JSON.stringify(result), readFileSync(f.ledger, "utf8"), ...allFiles(f.artifacts).map(p => readFileSync(p, "utf8"))].join("\n");
    for (const forbidden of [marker, credentials.key, credentials.token, "SYNTHETIC_THINKING_DO_NOT_SAVE"])
      assert.equal(saved.includes(forbidden), false);
    const failedName = `${caseId}-${stopped.label}`;
    assert.equal(existsSync(path.join(f.artifacts, "review", "prose", `${failedName}.txt`)), false);
    assert.equal(existsSync(path.join(f.artifacts, "review", "claims", `${failedName}.json`)), false);
    await assert.rejects(executeBatch({ ...f.options, send: () => assert.fail("no resume") }), { code: "LEDGER_CONSUMED" });
  }
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
    assert.equal(Object.hasOwn(result, "validationCode"), code === "VALIDATION_FAILED");
  }
  for (const response of [new Response(credentials.key, { status: 503 }), new Response("not json", { headers: { "Content-Type": "application/json" } }),
    new Response("{}", { headers: { "Content-Type": "text/html" } }), new Response("x".repeat(MAX_RESPONSE_BYTES + 1), { headers: { "Content-Type": "application/json" } })]) {
    const f = fixture(t); let calls = 0;
    const result = await executeBatch({ ...f.options, send: async () => { calls++; return response; } });
    assert.equal(result.status, "STOP"); assert.equal(calls, 1); assert.equal(result.completed, 0);
    assert.equal(readFileSync(f.ledger, "utf8").includes(credentials.key), false);
  }
});

test(`Weekly retains 20-second deadline; noncooperative late response cannot be read, saved or followed by another call`, async t => {
  const f = fixture(t); let release, arrived, calls = 0, reads = 0;
  const started = new Promise(resolve => { arrived = resolve; });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const running = executeBatch({ ...f.options, send: async (_, options) => {
    calls++; const body = JSON.parse(options.body);
    assert.equal(body.model, "claude-sonnet-5-5");
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
  await assert.rejects(executeBatch({ ...second.options, env: { ...env, PETALPAL_R2_EVAL_BUDGET_USD: "0.24575" }, send: () => assert.fail("no spend") }), { code: "BUDGET_INVALID" });
  assert.equal(existsSync(second.ledger), false);
});

test("CLI defaults/check are network-free and refuse live without approval or any stage expansion", t => {
  const f = fixture(t), guard = path.join(f.common, "network-guard.mjs");
  writeFileSync(guard, 'globalThis.fetch = () => { throw new Error("NETWORK_FORBIDDEN"); };');
  const stateBefore = checkoutState();
  for (const args of [[], ["check"]]) {
    const result = spawnSync(process.execPath, ["--import", guard, "scripts/reflection-v2-r2-evaluation.mjs", ...args], { encoding: "utf8", env: { PATH: process.env.PATH } });
    assert.equal(result.status, 0); const output = JSON.parse(result.stdout);
    assert.equal(output.providerCalls, 0); assert.equal(output.plannedCalls, 6); assert.equal(output.maximumUsd, 0.24576);
    assert.equal(output.ledgerAbsent, !stateBefore.ledgerExists); assert.equal(output.artifactsAbsent, !stateBefore.artifactsExist);
  }
  for (const args of [["live"], ["live", "stage1"], ["live", "stage2"], ["check", "C02"], ["resume"], ["reset"]]) {
    const result = spawnSync(process.execPath, ["--import", guard, "scripts/reflection-v2-r2-evaluation.mjs", ...args], { encoding: "utf8", env: { NODE_ENV: "test", PATH: process.env.PATH } });
    assert.equal(result.status, 2); assert.equal(JSON.parse(result.stdout).status, "STOP");
    assert.equal(result.stdout.includes("hidden"), false);
  }
  assert.equal(nativeCalls, 0);
});

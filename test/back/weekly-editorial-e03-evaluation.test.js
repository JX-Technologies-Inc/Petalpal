// OFFLINE ONLY: disposable synthetic ledgers; injected sends; native fetch trapped.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { preparePlan, validatePlan, preflight, batchState, batchPaths, executeBatch, makeSchedule, attemptBudget,
  REVISION, BRANCH, BATCH, APPROVAL, MAX_NANO_USD, ARMS, GATEWAY_ATTESTATION, SCOPE_ATTESTATION } from "../../scripts/weekly-editorial-e03-evaluation.mjs";
import { REFLECTION_V2_INSTRUCTIONS } from "../../lib/reflection-v2.js";
import { WEEKLY_RETROSPECTIVE_INSTRUCTIONS } from "../../lib/weekly-editorial.js";
import { targets } from "../../experiments/weekly-editorial-quality-v1/fixtures.mjs";

let nativeCalls = 0;
test.before(() => test.mock.method(globalThis, "fetch", () => { nativeCalls++; throw Error("REAL_NETWORK_FORBIDDEN"); }));
test.after(() => { assert.equal(nativeCalls, 0); test.mock.restoreAll(); });
const plan = preparePlan(), head = "b".repeat(40), P = "PETALPAL_WEEKLY_EDITORIAL_EVAL_";
const env = { NODE_ENV: "test", [`${P}APPROVAL`]: APPROVAL, [`${P}COMMIT`]: head, [`${P}BUDGET_USD`]: "0.16384",
  [`${P}GATEWAY_VERIFIED`]: GATEWAY_ATTESTATION, [`${P}SCOPE_VERIFIED`]: SCOPE_ATTESTATION };
const credentials = { account: "0".repeat(32), token: "synthetic-gateway-secret", key: "synthetic-provider-secret" };
const clean = { head, branch: BRANCH, clean: true, dotenv: false, ledgerExists: false, artifactsExist: false };
const lines = file => readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const allFiles = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? allFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);
function fixture(t) {
  const common = mkdtempSync(path.join(tmpdir(), "petalpal-weekly-editorial-mock-"));
  t.after(() => rmSync(common, { recursive: true, force: true }));
  return { common, ...batchPaths({ common }), options: { plan, env, readState: () => batchState({ ...clean, common }), tty: true, credentials } };
}
// Handcrafted provisional E03 targets as test doubles (not generations).
function envelope(body) {
  const packet = JSON.parse(body.messages[0].content);
  const target = targets.targets.find(t => t.caseId === "E03" && t.locale === packet.locale);
  return { model: body.model, type: "message", role: "assistant", stop_reason: "end_turn",
    content: [{ type: "thinking", thinking: "SYNTHETIC_THINKING_DO_NOT_SAVE" },
      { type: "text", text: JSON.stringify({ version: target.version, locale: target.locale, paragraphs: target.paragraphs }) }],
    usage: { input_tokens: 1800, output_tokens: 400 } };
}

test("pinned plan: E03 en/zh-Hans × baseline OFF / candidate ON = 4 calls, US$0.16384, same Selector V2 sources", () => {
  validatePlan(plan);
  assert.equal(REVISION, "45af54bd1e96c56361ab7d0f5c271513a804c1ae");
  assert.equal(plan.calls, 4); assert.equal(plan.budgetNanoUsd, MAX_NANO_USD); assert.equal(MAX_NANO_USD, 163_840_000);
  assert.deepEqual(plan.cases.map(c => [c.id, c.locale]), [["E03-en", "en"], ["E03-zh-Hans", "zh-Hans"]]);
  assert.deepEqual(ARMS.baseline, {});
  for (const c of plan.cases) {
    assert.equal(c.model, "claude-sonnet-5-5"); assert.equal(c.reservationNanoUsd, 40_960_000); assert.equal(c.timeoutMs, 20000);
    const [off, on] = c.arms;
    assert.deepEqual(c.arms.map(a => a.arm), ["baseline", "candidate"]);
    assert.equal(off.body.system, REFLECTION_V2_INSTRUCTIONS.WEEKLY); assert.equal(on.body.system, WEEKLY_RETROSPECTIVE_INSTRUCTIONS);
    assert.deepEqual(JSON.parse(off.body.messages[0].content), c.base.packet);
    const onPacket = JSON.parse(on.body.messages[0].content);
    assert.deepEqual(onPacket.evidence.map(e => [e.ref, e.text]), c.base.packet.evidence.map(e => [e.ref, e.text]));
    assert.deepEqual(onPacket.recordDays, c.base.packet.evidence.map(({ ref, day }) => ({ ref, day })));
    for (const a of c.arms) { assert.equal(a.body.max_tokens, 2048); assert.equal(a.body.output_config.effort, "low"); }
  }
  for (const mutate of [p => p.cases.pop(), p => p.cases.reverse(), p => p.calls = 5, p => p.batch += "-new", p => p.budgetNanoUsd++,
    p => p.cases[0].arms.pop(), p => p.cases[0].arms.push(structuredClone(p.cases[0].arms[1])),
    p => p.cases[0].arms[1].body.system = REFLECTION_V2_INSTRUCTIONS.WEEKLY, p => p.cases[0].arms[0].body.max_tokens++,
    p => p.cases[0].model = "claude-opus-5-5", p => p.cases[0].type = "MONTHLY", p => p.cases[1].locale = "zh-Hant",
    p => p.cases[0].arms[1].body.messages[0].content = "{}", p => p.cases[0].arms[1].flags = {}]) {
    const changed = structuredClone(plan); mutate(changed);
    assert.throws(() => validatePlan(changed), { code: "PLAN_MISMATCH" });
  }
});

test("preflight fails closed on approval, commit/branch, isolation, TTY, cap, attestations and consumed ledgers", () => {
  const gate = (e = {}, s = {}, tty = true) => preflight({ plan, env: { ...env, ...e }, state: { ...clean, ...s }, tty });
  assert.equal(gate(), null);
  for (const [e, s, expected] of [
    [{ [`${P}APPROVAL`]: undefined }, {}, "APPROVAL_REQUIRED"],
    [{ [`${P}APPROVAL`]: "APPROVE-2-WEEKLY-EDITORIAL-FREEDOM-AB523996-C01-C04-CALLS" }, {}, "APPROVAL_REQUIRED"],
    [{ [`${P}COMMIT`]: REVISION }, {}, "COMMIT_MISMATCH"], [{}, { branch: "wip/weekly-editorial-kiro-handoff" }, "COMMIT_MISMATCH"],
    [{}, { clean: false }, "WORKTREE_NOT_CLEAN"], [{}, { dotenv: true }, "DOTENV_PRESENT"],
    [{ [`${P}BUDGET_USD`]: "0.2" }, {}, "BUDGET_INVALID"], [{ [`${P}BUDGET_USD`]: "0.16383" }, {}, "BUDGET_INVALID"],
    [{ [`${P}GATEWAY_VERIFIED`]: undefined }, {}, "GATEWAY_UNVERIFIED"], [{ [`${P}SCOPE_VERIFIED`]: undefined }, {}, "SCOPE_UNVERIFIED"],
    [{}, { ledgerExists: true }, "LEDGER_CONSUMED"], [{}, { artifactsExist: true }, "ARTIFACTS_EXIST"]
  ]) assert.equal(gate(e, s), expected);
  for (const key of ["CI", "DATABASE_URL", "ANTHROPIC_API_KEY", "NODE_OPTIONS", "AI_WEEKLY_REFLECTION_RETROSPECTIVE",
    "AI_WEEKLY_REFLECTION_RECORD_DAYS_SEPARATED", "AI_WEEKLY_EVIDENCE_SELECTOR", "PETALPAL_FREEDOM_EVAL_APPROVAL"])
    assert.equal(gate({ [key]: "synthetic" }), "ENVIRONMENT_NOT_ISOLATED");
  assert.equal(gate({}, {}, false), "TTY_REQUIRED");
});

test("budget allows exactly four distinct reservations within US$0.16384", () => {
  const b = attemptBudget(MAX_NANO_USD), [c1, c2] = plan.cases;
  for (const [c, a] of [[c1, c1.arms[0]], [c1, c1.arms[1]], [c2, c2.arms[0]], [c2, c2.arms[1]]]) b.reserve(c, a);
  assert.equal(b.reservedNanoUsd, MAX_NANO_USD);
  assert.throws(() => b.reserve(c1, c1.arms[0]), { code: "REPLAY_BLOCKED" });
  const small = attemptBudget(MAX_NANO_USD - 1); for (const a of c1.arms) small.reserve(c1, a); small.reserve(c2, c2.arms[0]);
  assert.throws(() => small.reserve(c2, c2.arms[1]), { code: "BUDGET_EXHAUSTED" });
  assert.throws(() => attemptBudget(MAX_NANO_USD + 1), { code: "BUDGET_INVALID" });
  assert.throws(() => attemptBudget(MAX_NANO_USD, 5), { code: "PLAN_MISMATCH" });
});

test("mock run: four single-attempt sends, blind private artifacts, no secrets/thinking, ledger blocks replay", async t => {
  const f = fixture(t), sent = [];
  const send = async (url, options) => { sent.push({ url, ...options }); return Response.json(envelope(JSON.parse(options.body))); };
  const result = await executeBatch({ ...f.options, send, bit: () => 1 });
  assert.deepEqual(result, { status: "COMPLETE", completed: 4, dispatched: 4, attempts: 4, reservedNanoUsd: MAX_NANO_USD });
  assert.equal(sent.length, 4);
  for (const s of sent) {
    assert.match(s.url, /\/petalpal-integration\/anthropic\/v1\/messages$/); assert.equal(s.redirect, "error");
    assert.equal(s.headers["cf-aig-max-attempts"], "1"); assert.equal(s.headers["cf-aig-skip-cache"], "true");
    assert.equal(s.headers["cf-aig-collect-log"], "false"); assert.equal(s.headers["cf-aig-collect-log-payload"], "false");
  }
  const systems = sent.map(s => JSON.parse(s.body).system);
  assert.equal(systems.filter(x => x === WEEKLY_RETROSPECTIVE_INSTRUCTIONS).length, 2);
  assert.equal(systems.filter(x => x === REFLECTION_V2_INSTRUCTIONS.WEEKLY).length, 2);
  const meta = JSON.parse(readFileSync(path.join(f.artifacts, "operator-metadata.json"), "utf8"));
  assert.deepEqual(meta.mapping.map(m => [m.A, m.B]), [["candidate", "baseline"], ["candidate", "baseline"]]);
  const review = allFiles(path.join(f.artifacts, "review"));
  assert.equal(review.length, 2 + 4 + 4);
  for (const file of [...review, f.ledger, path.join(f.artifacts, "operator-metadata.json")]) {
    const text = readFileSync(file, "utf8");
    for (const secret of ["synthetic-gateway-secret", "synthetic-provider-secret", "SYNTHETIC_THINKING_DO_NOT_SAVE"]) assert.ok(!text.includes(secret));
    assert.equal(statSync(file).mode & 0o077, 0);
  }
  for (const file of review) { const text = readFileSync(file, "utf8"); assert.ok(!/baseline|candidate|retrospective/i.test(text), file); }
  assert.ok(!/baseline|candidate/.test(readFileSync(f.ledger, "utf8")));
  assert.deepEqual(lines(f.ledger).map(l => l.entry), ["run", "attempt", "result", "attempt", "result", "attempt", "result", "attempt", "result", "complete"]);
  await assert.rejects(executeBatch({ ...f.options, send }), { code: "LEDGER_CONSUMED" }); assert.equal(sent.length, 4);
});

test("first failure stops the batch with no retry; the consumed ledger blocks a rerun", async t => {
  for (const [reply, code] of [[() => new Response("{}", { status: 500, headers: { "content-type": "application/json" } }), "HTTP_FAILED"],
    [body => { const e = envelope(body); e.content[1].text = JSON.stringify({ ...JSON.parse(e.content[1].text), paragraphs: [] }); return Response.json(e); }, "VALIDATION_FAILED"],
    [body => Response.json({ ...envelope(body), usage: { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 5 } }), "CACHE_USAGE_UNEXPECTED"]]) {
    const f = fixture(t); let sends = 0;
    const send = async (_url, options) => { sends++; return reply(JSON.parse(options.body)); };
    const result = await executeBatch({ ...f.options, send });
    assert.equal(result.status, "STOP"); assert.equal(result.code, code);
    assert.equal(sends, 1); assert.equal(result.dispatched, 1); assert.equal(result.attempts, 1);
    assert.equal(lines(f.ledger).at(-1).entry, "stopped");
    await assert.rejects(executeBatch({ ...f.options, send }), { code: "LEDGER_CONSUMED" }); assert.equal(sends, 1);
  }
});

test("schedule labels/order are per-case randomized and every arm runs exactly once", () => {
  for (const bits of [[0, 0, 0, 0], [1, 0, 0, 1], [1, 1, 1, 1]]) {
    let i = 0; const { schedule, mapping } = makeSchedule(plan, () => bits[i++]);
    assert.equal(schedule.length, 4); assert.equal(mapping.length, 2);
    assert.equal(new Set(schedule.map(s => `${s.c.id}/${s.arm.arm}`)).size, 4);
    for (const m of mapping) assert.deepEqual([m.A, m.B].sort(), ["baseline", "candidate"]);
  }
  assert.throws(() => makeSchedule(plan, () => 2), { code: "PLAN_MISMATCH" });
  assert.equal(BATCH, "weekly-editorial-e03-off-on-45af54bd");
});

// OFFLINE ONLY: disposable synthetic ledgers; injected sends; native fetch trapped.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { preparePlan, validatePlan, preflight, batchState, batchPaths, executeBatch, makeSchedule, attemptBudget, summary,
  REVISION, BRANCH, BATCH, APPROVAL, MAX_NANO_USD, PRIOR_BATCHES, ROUTE, GATEWAY_ATTESTATION, SCOPE_ATTESTATION } from "../../scripts/weekly-final-acceptance-evaluation.mjs";
import { REFLECTION_V2_INSTRUCTIONS } from "../../lib/reflection-v2.js";
import { WEEKLY_NARRATIVE_THREAD_INSTRUCTIONS } from "../../lib/weekly-editorial.js";
import { exemplars } from "../../experiments/weekly-narrative-thread-v1/fixtures.mjs";

let nativeCalls = 0;
test.before(() => test.mock.method(globalThis, "fetch", () => { nativeCalls++; throw Error("REAL_NETWORK_FORBIDDEN"); }));
test.after(() => { assert.equal(nativeCalls, 0); test.mock.restoreAll(); });
const plan = preparePlan(), head = "c".repeat(40), P = "PETALPAL_FINAL_ACCEPTANCE_";
const env = { NODE_ENV: "test", [`${P}APPROVAL`]: APPROVAL, [`${P}COMMIT`]: head, [`${P}BUDGET_USD`]: "0.32768",
  [`${P}GATEWAY_VERIFIED`]: GATEWAY_ATTESTATION, [`${P}SCOPE_VERIFIED`]: SCOPE_ATTESTATION };
const credentials = { account: "0".repeat(32), token: "synthetic-gateway-secret", key: "synthetic-provider-secret" };
const clean = { head, branch: BRANCH, clean: true, dotenv: false, ledgerExists: false, artifactsExist: false };
const lines = file => readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const allFiles = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? allFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);
function fixture(t) {
  const common = mkdtempSync(path.join(tmpdir(), "petalpal-final-acceptance-mock-"));
  t.after(() => rmSync(common, { recursive: true, force: true }));
  return { common, ...batchPaths({ common }), options: { plan, env, readState: () => batchState({ ...clean, common }), tty: true, credentials } };
}
// Handcrafted test doubles, not generations: E03 exemplar; F packets quoted in short paragraphs.
function data(body) {
  const packet = JSON.parse(body.messages[0].content);
  if (packet.evidence.length === 4 && packet.evidence[0].text.includes(packet.locale === "en" ? "harbour" : "港口")) {
    const e = exemplars.find(x => x.caseId === "E03" && x.locale === packet.locale);
    return structuredClone({ version: e.version, locale: e.locale, paragraphs: e.paragraphs });
  }
  const sentences = packet.evidence.map(item => ({ text: `“${item.text}”`, refs: [item.ref] }));
  return { version: packet.version, locale: packet.locale, paragraphs: [sentences.slice(0, 3), sentences.slice(3, 6), sentences.slice(6)].filter(s => s.length).map(s => ({ sentences: s })) };
}
const envelope = (body, text = JSON.stringify(data(body))) => ({ model: body.model, type: "message", role: "assistant", stop_reason: "end_turn",
  content: [{ type: "thinking", thinking: "SYNTHETIC_THINKING_DO_NOT_SAVE" }, { type: "text", text }], usage: { input_tokens: 1900, output_tokens: 420 } });

test("8-cell plan: Exp1 isolates the prompt on byte-identical E03 evidence; Exp2 holds the final prompt and varies selection", () => {
  validatePlan(plan);
  assert.equal(REVISION, "45145ceb54f07b944e8e4e479daaf2af78d652b3"); assert.equal(plan.calls, 8);
  assert.equal(MAX_NANO_USD, 327_680_000); assert.equal(plan.budgetNanoUsd, MAX_NANO_USD);
  assert.deepEqual(plan.cases.map(c => c.id), ["X1-E03-en", "X1-E03-zh-Hans", "X2-F-en", "X2-F-zh-Hans"]);
  for (const c of plan.cases) {
    assert.equal(c.model, "claude-sonnet-5-5"); assert.equal(c.reservationNanoUsd, 40_960_000); assert.equal(c.timeoutMs, 20000);
    for (const a of c.arms) { assert.equal(a.body.max_tokens, 2048); assert.equal(a.body.output_config.effort, "low");
      assert.ok(a.requestBytes + 1024 <= 8192); assert.ok(!("recordDays" in a.built.packet)); }
    const [a, b] = c.arms;
    if (c.experiment === 1) {
      assert.equal(a.body.system, REFLECTION_V2_INSTRUCTIONS.WEEKLY); assert.equal(b.body.system, WEEKLY_NARRATIVE_THREAD_INSTRUCTIONS);
      assert.equal(a.body.messages[0].content, b.body.messages[0].content);
      assert.ok(!("AI_WEEKLY_EVIDENCE_SIGNIFICANCE" in a.flags) && !("AI_WEEKLY_EVIDENCE_SIGNIFICANCE" in b.flags));
    } else {
      assert.equal(a.body.system, WEEKLY_NARRATIVE_THREAD_INSTRUCTIONS); assert.equal(b.body.system, WEEKLY_NARRATIVE_THREAD_INSTRUCTIONS);
      assert.notEqual(a.body.messages[0].content, b.body.messages[0].content, "Exp2 packets intentionally differ");
      assert.deepEqual([a.meaningfulDelivered.length, b.meaningfulDelivered.length], [1, 2]);
      for (const hidden of ["meaningful", "synthetic-stress-owner", "stress-F-event", "importanceScore", "similarity"])
        assert.ok(!a.body.messages[0].content.includes(hidden) && !b.body.messages[0].content.includes(hidden), hidden);
    }
  }
  for (const mutate of [p => p.cases.pop(), p => p.cases.reverse(), p => p.calls = 9, p => p.batch += "-new", p => p.budgetNanoUsd++,
    p => p.cases[0].arms.pop(), p => p.cases[0].arms[1].body.system = REFLECTION_V2_INSTRUCTIONS.WEEKLY,
    p => p.cases[2].arms[1].body.messages[0].content = p.cases[2].arms[0].body.messages[0].content,
    p => p.cases[0].arms[0].body.max_tokens++, p => p.cases[0].model = "claude-opus-5-5", p => p.cases[1].locale = "zh-Hant"]) {
    const changed = structuredClone(plan); mutate(changed);
    assert.throws(() => validatePlan(changed), { code: "PLAN_MISMATCH" });
  }
  const s = summary(plan, { ...clean, common: "/synthetic" });
  assert.equal(s.cells.length, 8); assert.equal(s.maximumUsd, 0.32768); assert.equal(s.route, ROUTE); assert.equal(s.providerCalls, 0);
});

test("preflight fails closed: approval, prior phrases, commit/branch, isolation, TTY, exact cap, attestations, consumed ledger", () => {
  const gate = (e = {}, s = {}, tty = true) => preflight({ plan, env: { ...env, ...e }, state: { ...clean, ...s }, tty });
  assert.equal(gate(), null);
  for (const [e, s, expected] of [
    [{ [`${P}APPROVAL`]: undefined }, {}, "APPROVAL_REQUIRED"],
    [{ [`${P}APPROVAL`]: "APPROVE-4-WEEKLY-EDITORIAL-E03-45AF54BD-OFF-ON-EN-ZH-CALLS" }, {}, "APPROVAL_REQUIRED"],
    [{ [`${P}COMMIT`]: REVISION }, {}, "COMMIT_MISMATCH"], [{}, { branch: "feat/weekly-evidence-significance" }, "COMMIT_MISMATCH"],
    [{}, { clean: false }, "WORKTREE_NOT_CLEAN"], [{}, { dotenv: true }, "DOTENV_PRESENT"],
    [{ [`${P}BUDGET_USD`]: "0.4" }, {}, "BUDGET_INVALID"], [{ [`${P}BUDGET_USD`]: "0.32767" }, {}, "BUDGET_INVALID"],
    [{ [`${P}GATEWAY_VERIFIED`]: undefined }, {}, "GATEWAY_UNVERIFIED"], [{ [`${P}SCOPE_VERIFIED`]: undefined }, {}, "SCOPE_UNVERIFIED"],
    [{}, { ledgerExists: true }, "LEDGER_CONSUMED"], [{}, { artifactsExist: true }, "ARTIFACTS_EXIST"]
  ]) assert.equal(gate(e, s), expected);
  for (const key of ["CI", "DATABASE_URL", "ANTHROPIC_API_KEY", "NODE_OPTIONS", "AI_WEEKLY_EVIDENCE_SIGNIFICANCE",
    "AI_WEEKLY_REFLECTION_NARRATIVE_THREAD", "PETALPAL_WEEKLY_EDITORIAL_EVAL_APPROVAL"]) assert.equal(gate({ [key]: "synthetic" }), "ENVIRONMENT_NOT_ISOLATED");
  assert.equal(gate({}, {}, false), "TTY_REQUIRED");
  assert.ok(!PRIOR_BATCHES.includes(BATCH));
  for (const prior of PRIOR_BATCHES) assert.ok(!batchPaths({ common: "/x" }).ledger.includes(prior));
});

test("budget admits exactly eight distinct reservations up to US$0.32768 and blocks replay", () => {
  const b = attemptBudget(MAX_NANO_USD);
  for (const c of plan.cases) for (const a of c.arms) b.reserve(c, a);
  assert.equal(b.reservedNanoUsd, MAX_NANO_USD);
  assert.throws(() => b.reserve(plan.cases[0], plan.cases[0].arms[0]), { code: "REPLAY_BLOCKED" });
  const small = attemptBudget(MAX_NANO_USD - 1); let n = 0;
  assert.throws(() => { for (const c of plan.cases) for (const a of c.arms) { small.reserve(c, a); n++; } }, { code: "BUDGET_EXHAUSTED" });
  assert.equal(n, 7);
  assert.throws(() => attemptBudget(MAX_NANO_USD + 1), { code: "BUDGET_INVALID" });
});

test("mock run: eight single sends, blind private artifacts, mapping separate, no secrets/thinking, consumed ledger", async t => {
  const f = fixture(t), sent = [];
  const send = async (url, options) => { sent.push({ url, ...options }); return Response.json(envelope(JSON.parse(options.body))); };
  const result = await executeBatch({ ...f.options, send, bit: () => 1 });
  assert.deepEqual(result, { status: "COMPLETE", completed: 8, rejected: 0, dispatched: 8, attempts: 8, reservedNanoUsd: MAX_NANO_USD });
  assert.equal(sent.length, 8);
  for (const s of sent) {
    assert.match(s.url, /\/petalpal-integration\/anthropic\/v1\/messages$/); assert.equal(s.redirect, "error");
    for (const [h, v] of [["cf-aig-max-attempts", "1"], ["cf-aig-skip-cache", "true"], ["cf-aig-collect-log", "false"], ["cf-aig-collect-log-payload", "false"]])
      assert.equal(s.headers[h], v);
  }
  const mapping = JSON.parse(readFileSync(path.join(f.artifacts, "operator", "mapping.json"), "utf8"));
  assert.equal(mapping.mapping.length, 4);
  const review = allFiles(path.join(f.artifacts, "review"));
  assert.equal(review.length, 8 + 8 + 8);
  const armWords = /original-prompt|narrative-thread|significance|AI_WEEKLY|baseline|candidate/i;
  for (const file of review) assert.ok(!armWords.test(readFileSync(file, "utf8")), file);
  assert.ok(!armWords.test(readFileSync(f.ledger, "utf8")));
  for (const file of [...review, f.ledger, path.join(f.artifacts, "operator", "mapping.json")]) {
    const text = readFileSync(file, "utf8");
    for (const secret of ["synthetic-gateway-secret", "synthetic-provider-secret", "SYNTHETIC_THINKING_DO_NOT_SAVE"]) assert.ok(!text.includes(secret));
    assert.equal(statSync(file).mode & 0o077, 0);
  }
  const results = lines(f.ledger).filter(l => l.entry === "result");
  assert.equal(results.length, 8);
  assert.ok(results.every(r => r.usage && Number.isSafeInteger(r.estimatedCostAtConfiguredRatesNanoUsd)));
  await assert.rejects(executeBatch({ ...f.options, send }), { code: "LEDGER_CONSUMED" }); assert.equal(sent.length, 8);
});

test("a rejected output is recorded and never retried; transport/HTTP failure stops the batch; reruns are blocked", async t => {
  const f = fixture(t); let sends = 0;
  const send = async (_url, options) => { sends++; const body = JSON.parse(options.body);
    if (sends === 1) { const d = data(body); d.paragraphs[0].sentences[0].text = "“A quotation the user never wrote.”"; return Response.json(envelope(body, JSON.stringify(d))); }
    return Response.json(envelope(body)); };
  const result = await executeBatch({ ...f.options, send, bit: () => 0 });
  assert.equal(result.status, "COMPLETE"); assert.equal(result.rejected, 1); assert.equal(result.completed, 7); assert.equal(sends, 8);
  assert.equal(readdirSync(path.join(f.artifacts, "review", "rejected")).length, 1);
  const rejected = lines(f.ledger).find(l => l.status === "REJECTED"); assert.ok(rejected.validationCode);
  for (const reply of [() => new Response("{}", { status: 500, headers: { "content-type": "application/json" } }),
    body => Response.json({ ...envelope(body), usage: { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 5 } })]) {
    const g = fixture(t); let n = 0;
    const stop = await executeBatch({ ...g.options, send: async (_u, o) => { n++; return reply(JSON.parse(o.body)); } });
    assert.equal(stop.status, "STOP"); assert.equal(n, 1); assert.equal(stop.dispatched, 1);
    await assert.rejects(executeBatch({ ...g.options, send: async () => { n++; } }), { code: "LEDGER_CONSUMED" }); assert.equal(n, 1);
  }
});

test("schedule randomizes A/B label and order per case; each arm runs exactly once", () => {
  for (const bits of [[0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 1, 1, 1, 0, 1]]) {
    let i = 0; const { schedule, mapping } = makeSchedule(plan, () => bits[i++]);
    assert.equal(schedule.length, 8); assert.equal(new Set(schedule.map(s => `${s.c.id}/${s.arm.arm}`)).size, 8);
    for (const m of mapping) assert.notEqual(m.A, m.B);
  }
  assert.throws(() => makeSchedule(plan, () => 2), { code: "PLAN_MISMATCH" });
  assert.equal(BATCH, "weekly-final-acceptance-45145ceb");
});

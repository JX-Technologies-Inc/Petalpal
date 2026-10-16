// Preparation only: no network, credentials, database, ledger writes or live mode.
// Reuse frozen production packet/schema code; both arms get identical JSON.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { REFLECTION_V2_INSTRUCTIONS, REFLECTION_V2_SCHEMAS, buildReflectionV2 } from "../lib/reflection-v2.js";
import { compileGatewaySchema } from "../lib/ai-gateway-schema.js";
import { gatewayQuote, GATEWAY_TASK_LIMITS } from "../lib/ai-gateway-config.js";
import { monthlyWeek } from "../lib/monthly-evidence.js";
import { SONNET_WEEKLY_MODEL } from "../lib/sonnet-weekly.js";
import { OPUS_MONTHLY_MODEL } from "../lib/opus-monthly.js";

export const BASELINE = "d80ab522d77c0c8483b45a7827e2fbf5561f5ee0";
export const CANDIDATE = "c2d7a9d9a7d06f8291de5be7d890988fcdb5b9a8";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trimEnd();

// Existing Prompt-First Events from test/back/reflection-v2.test.js, verbatim.
// These independent Events do not identify the result, destination or drawing.
export const MIXED_NEGATION = Object.freeze([
  "I finally fixed the bug today, but I'm still worried about tomorrow's demo. I tested the login screen twice; the demo has not happened yet.",
  "I was not a little happy about the result.",
  "我不是不想去，只是还没决定。",
  "I did not say I stopped drawing.",
  "我沒有覺得事情變好了。"
]);
// Existing localized ordinary Events from test/back/opus-monthly.test.js,
// verbatim. No same-drawing or same-friend link is established between Events.
export const ORDINARY = Object.freeze({
  en: ["I finished a sketch. It was a quiet afternoon.", "I shared my drawing with a friend.", "I tried charcoal in the studio.", "I kept the drawing on my desk."],
  "zh-Hans": ["今天画完了一幅素描。那个下午很安静。", "我把画分享给朋友，聊了彼此的近况。", "在画室试用了炭笔。", "把画留在了书桌上。"],
  "zh-Hant": ["今天畫完了一幅素描。那個下午很安靜。", "我把畫分享給朋友，聊了彼此的近況。", "在畫室試用了炭筆。", "把畫留在了書桌上。"]
});
Object.values(ORDINARY).forEach(Object.freeze);

function frozenPrompts() {
  assert.equal(git(["branch", "--show-current"]), "codex/reflection-v2-editorial-quality");
  // A later reviewed preparation-only commit may contain this runner; runtime
  // code must still match CANDIDATE exactly. Live execution must pin that runner
  // commit separately, rather than treating ancestry as owner authorization.
  git(["merge-base", "--is-ancestor", CANDIDATE, "HEAD"]);
  const baseline = git(["show", `${BASELINE}:lib/reflection-v2.js`]);
  const candidate = git(["show", `${CANDIDATE}:lib/reflection-v2.js`]);
  assert.equal(readFileSync(path.join(root, "lib/reflection-v2.js"), "utf8").trimEnd(), candidate, "candidate prompt must stay frozen");
  assert.equal(git(["diff", CANDIDATE, "--", "lib"]), "", "runtime dependencies must stay frozen");
  assert.equal(baseline.split("function schemaFor(type)")[1], candidate.split("function schemaFor(type)")[1], "same schema/packet/validation code");
  // Evaluate only the literal prompt definitions from the pinned, trusted Git
  // source, with no imports or host capabilities. Do not copy/edit baseline text.
  const start = baseline.indexOf("const shared = type =>"), end = baseline.indexOf("\nfunction schemaFor(type)");
  assert.ok(start >= 0 && end > start);
  const block = baseline.slice(start, end).replace("export const REFLECTION_V2_INSTRUCTIONS", "const REFLECTION_V2_INSTRUCTIONS");
  const old = runInNewContext(`${block}\nREFLECTION_V2_INSTRUCTIONS`, Object.create(null), { timeout: 100 });
  return { baseline: old, candidate: REFLECTION_V2_INSTRUCTIONS };
}

export function prepareEvaluation() {
  const prompts = frozenPrompts(), cases = [];
  for (const type of ["WEEKLY", "MONTHLY"]) {
    const model = type === "WEEKLY" ? SONNET_WEEKLY_MODEL : OPUS_MONTHLY_MODEL;
    const action = `${type}_REPORT`, limits = GATEWAY_TASK_LIMITS[action];
    const maxOutputTokens = type === "WEEKLY" ? 2048 : 4096;
    const quote = gatewayQuote({ model, action, inputTokens: limits.input, maxOutputTokens });
    for (const locale of ["en", "zh-Hans", "zh-Hant"]) for (const scenario of ["mixed-negation", "ordinary"]) {
      const texts = scenario === "mixed-negation" ? MIXED_NEGATION : ORDINARY[locale];
      const days = type === "WEEKLY" ? (texts.length === 5 ? [14, 15, 16, 18, 20] : [14, 16, 18, 20])
        : (texts.length === 5 ? [2, 9, 16, 23, 27] : [2, 9, 16, 27]);
      const items = texts.map((text, i) => {
        const eventDate = new Date(`2026-09-${String(days[i]).padStart(2, "0")}T12:00:00Z`);
        return { text, topics: [], eventDate, previous: false, week: type === "MONTHLY" ? monthlyWeek(eventDate, "UTC") : null,
          source: { sourceEventId: `synthetic-event-${i + 1}`, sourceMemoryId: `synthetic-memory-${i + 1}` } };
      });
      const built = buildReflectionV2({ type, locale, timezone: "UTC", items });
      assert.deepEqual(built.packet.evidence.map(e => e.text), texts, "neither arm may drop or truncate evidence");
      if (type === "MONTHLY") assert.equal(new Set(built.packet.evidence.map(e => e.week)).size, 4);
      const content = JSON.stringify(built.packet), { wireSchema } = compileGatewaySchema(REFLECTION_V2_SCHEMAS[type]);
      const arms = Object.entries(prompts).map(([arm, instructions]) => {
        const body = { model, system: instructions[type], messages: [{ role: "user", content }], max_tokens: maxOutputTokens,
          output_config: { effort: "low", format: { type: "json_schema", schema: wireSchema } } };
        assert.ok(Buffer.byteLength(JSON.stringify(body)) + 1024 <= limits.input, "full request must fit existing admission");
        return { arm, promptCommit: arm === "baseline" ? BASELINE : CANDIDATE, body };
      });
      const withoutPrompt = ({ system, ...body }) => body;
      assert.deepEqual(withoutPrompt(arms[0].body), withoutPrompt(arms[1].body), "only system prompt differs");
      assert.notEqual(arms[0].body.system, arms[1].body.system);
      cases.push({ id: `C${String(cases.length + 1).padStart(2, "0")}`, type, locale, scenario,
        model, timeoutMs: limits.timeoutMs, reservationNanoUsd: quote.reservedNanoUsd, built, arms });
    }
  }
  assert.equal(cases.length, 12);
  const budgetNanoUsd = cases.reduce((sum, c) => sum + 2 * c.reservationNanoUsd, 0);
  assert.equal(budgetNanoUsd, 2_457_600_000, "changed pricing/limits require a new approval plan");
  return { cases, calls: 24, budgetNanoUsd };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) { console.error("STOP: preparation only; no live mode or extra arguments"); process.exitCode = 2; }
  else {
    try {
      const plan = prepareEvaluation();
      console.log(JSON.stringify({ status: "OFFLINE_PREPARATION_PASS", providerCalls: 0, plannedCalls: plan.calls,
        baseline: BASELINE, candidate: CANDIDATE, reservationUsd: plan.budgetNanoUsd / 1e9,
        cases: plan.cases.map(({ id, type, locale, scenario, model, built }) => ({ id, type, locale, scenario, model, evidenceCount: built.packet.evidence.length })) }, null, 2));
    } catch { console.error("STOP: offline preparation checks failed; inspect source/configuration without dispatch"); process.exitCode = 2; }
  }
}

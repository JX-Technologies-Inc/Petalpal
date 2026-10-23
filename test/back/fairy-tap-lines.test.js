import test from "node:test";
import assert from "node:assert/strict";
import { ACTIVITIES, LIMITS, formatBank, ruleCheck, runPipeline } from "../../scripts/generate-fairy-tap-lines.mjs";

// Scripted stand-in for the Anthropic client: answers by agent (from the system prompt).
function fakeClient(answers) {
  const calls = [];
  return {
    calls,
    beta: { messages: { create: async params => {
      calls.push(params);
      const agent = params.system.startsWith("You write") ? "writer" : params.system.startsWith("You review lines for character") ? "persona" : "safety";
      const answer = answers[agent](params);
      if (answer instanceof Error) throw answer;
      return { stop_reason: answer.stop_reason ?? "end_turn", usage: { input_tokens: 100, output_tokens: 50 },
        content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(answer.body ?? answer) }] };
    } } }
  };
}
const bank = { lines: [{ id: "swing-seed-1", activity: "SWINGING", source: "seed", en: "Wheee! One more swing.", zh: "呼～再荡一下！" }] };
const writer = () => ({ lines: [
  { en: "The wind tickles my wings!", zh: "风把我的翅膀吹得痒痒的！" },
  { en: "Wheee! One more swing.", zh: "再荡一次！" },
  { en: "Hold on tight, here I go!", zh: "抓紧啦，我要荡高高！" },
  { en: "Up, up, up!", zh: "小仙女要飞啦！" }
] });
const allPass = ({ messages }) => ({ verdicts: messages[0].content.split("\n").filter(l => /^\d+\./.test(l))
  .map(l => ({ index: Number(l.split(".")[0]), pass: true, reason: "ok" })) });

test("writer, persona and safety agents each filter, then rules drop duplicates and wrong names", async () => {
  const persona = params => ({ verdicts: allPass(params).verdicts.map(v => v.index === 2 ? { ...v, pass: false } : v) });
  const client = fakeClient({ writer, persona, safety: allPass });
  const { added, stats } = await runPipeline({ client, bank, perActivity: 4, activities: ["SWINGING"] });
  assert.deepEqual(stats[0], { activity: "SWINGING", written: 4, persona: 3, safety: 3, rules: 1, error: null });
  assert.deepEqual(added, [{ id: "swinging-gen-1", activity: "SWINGING", source: "generated",
    en: "The wind tickles my wings!", zh: "风把我的翅膀吹得痒痒的！" }]);
  assert.equal(client.calls.length, 3);
  for (const call of client.calls) {
    assert.equal(call.model, "claude-opus-5-5");
    assert.equal(call.output_config.format.type, "json_schema");
    assert.equal(call.fallbacks, "default");
  }
});

test("new ids continue after the highest existing number when reviewed lines were deleted", async () => {
  const gapped = { lines: [...bank.lines,
    { id: "swinging-gen-1", activity: "SWINGING", source: "generated", en: "First kept line.", zh: "第一句" },
    { id: "swinging-gen-3", activity: "SWINGING", source: "generated", en: "Third kept line.", zh: "第三句" }] };
  const { added } = await runPipeline({ client: fakeClient({ writer, persona: allPass, safety: allPass }), bank: gapped,
    perActivity: 4, activities: ["SWINGING"] });
  assert.deepEqual(added.map(line => line.id), ["swinging-gen-4", "swinging-gen-5"]);
});

test("safety only sees lines the persona reviewer passed", async () => {
  const persona = params => ({ verdicts: allPass(params).verdicts.map(v => ({ ...v, pass: v.index === 0 })) });
  let seen;
  const safety = params => { seen = params.messages[0].content; return allPass(params); };
  await runPipeline({ client: fakeClient({ writer, persona, safety }), bank, perActivity: 4, activities: ["SWINGING"] });
  assert.equal(seen, "0. The wind tickles my wings! / 风把我的翅膀吹得痒痒的！");
});

test("a failed or refused stage adds nothing for that activity and the next activity still runs", async () => {
  let refuse = true;
  const safety = params => {
    if (refuse) { refuse = false; return { stop_reason: "refusal", body: {} }; }
    return allPass(params);
  };
  const { added, stats } = await runPipeline({ client: fakeClient({ writer, persona: allPass, safety }), bank,
    perActivity: 4, activities: ["SWINGING", "TEA_TIME"] });
  assert.equal(stats[0].error, "stopped: refusal");
  assert.equal(stats[0].rules, 0);
  assert.ok(added.every(line => line.activity === "TEA_TIME"));
  assert.ok(added.length > 0);
});

test("schema-invalid agent output is rejected", async () => {
  const { added, stats } = await runPipeline({ client: fakeClient({ writer: () => ({ lines: [{ en: "hi" }] }), persona: allPass, safety: allPass }),
    bank, activities: ["IDLE"] });
  assert.equal(stats[0].error, "output does not match schema");
  assert.deepEqual(added, []);
});

test("rule check enforces length, name and duplicates; bank formatting is stable", () => {
  const seen = new Set(["wheeeonemoreswing"]);
  assert.equal(ruleCheck({ en: "x".repeat(LIMITS.en + 1), zh: "好" }, seen), "too long");
  assert.equal(ruleCheck({ en: "Hi", zh: "好".repeat(LIMITS.zh + 1) }, seen), "too long");
  assert.equal(ruleCheck({ en: "Hi", zh: "我是小仙女" }, seen), "wrong name");
  assert.equal(ruleCheck({ en: "Wheee — one more swing!", zh: "好" }, seen), "duplicate");
  assert.equal(ruleCheck({ en: "Hi there", zh: "你好" }, seen), null);
  assert.deepEqual(JSON.parse(formatBank(bank.lines)), bank);
  assert.deepEqual(ACTIVITIES, ["SWINGING", "SLEEPING", "TEA_TIME", "IDLE", "ANY"]);
});

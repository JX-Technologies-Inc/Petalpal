// Offline writer → persona reviewer → safety reviewer pipeline for PPL's tap lines.
// Lines that every agent and the local rules accept are appended to the bundled bank
// (mobile/src/components/garden/fairy/tapLines.json); review them in the git diff before
// committing. The app never calls a model on tap.
//
// Usage:
//   node scripts/generate-fairy-tap-lines.mjs                     # dry run: plan and maximum cost only
//   node scripts/generate-fairy-tap-lines.mjs --run [--per-activity 6]
// --run makes paid Claude API calls with credentials from your own environment
// (ANTHROPIC_API_KEY or an `ant auth login` profile). The script never prints them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv from "ajv";

export const BANK_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../mobile/src/components/garden/fairy/tapLines.json");
export const ACTIVITIES = Object.freeze(["SWINGING", "SLEEPING", "TEA_TIME", "IDLE", "ANY"]);
export const MODEL = "claude-opus-5-5";
// USD per million tokens for MODEL (claude-api reference, cached 2026-10-06).
const PRICE = { input: 4, output: 20 };
const MAX_TOKENS = 4000, MAX_INPUT_TOKENS_PER_CALL = 3000;
export const LIMITS = { en: 60, zh: 24 };

const SCENES = {
  SWINGING: "she is swinging on the garden swing",
  SLEEPING: "she is asleep on her moon bed and the tap half-wakes her",
  TEA_TIME: "she is having tea at her little tea set",
  IDLE: "she is standing in the garden, free",
  ANY: "any moment; the line must fit every activity"
};
const PERSONA = "PPL is the small garden fairy in PetalPal, a private mood-journaling app where each day's mood grows a flower. " +
  "Her signature flower is the crocus. She is warm, playful, gentle and a little sleepy at night, and speaks in the first person. " +
  "In Chinese she is called 小花仙 PPL, never 小仙女.";
const RULES = "Rules for every line: at most 60 characters in English and 24 in Chinese; no advice, diagnosis or questions about the user's health; " +
  "never assume how the user feels today; no guilt, streaks or pressure to come back or use the app; no mention of being an AI; " +
  "nothing scary, romantic or about money; the English and Chinese say the same thing naturally, not word for word.";

const linesSchema = { type: "object", additionalProperties: false, required: ["lines"], properties: {
  lines: { type: "array", items: { type: "object", additionalProperties: false, required: ["en", "zh"],
    properties: { en: { type: "string" }, zh: { type: "string" } } } } } };
const verdictSchema = { type: "object", additionalProperties: false, required: ["verdicts"], properties: {
  verdicts: { type: "array", items: { type: "object", additionalProperties: false, required: ["index", "pass", "reason"],
    properties: { index: { type: "integer" }, pass: { type: "boolean" }, reason: { type: "string" } } } } } };
const ajv = new Ajv({ allErrors: true });
const validLines = ajv.compile(linesSchema), validVerdicts = ajv.compile(verdictSchema);

export const AGENTS = {
  writer: { effort: "medium", schema: linesSchema, valid: validLines,
    system: `You write short speech-bubble lines for a garden fairy. ${PERSONA} ${RULES} Vary rhythm and imagery; do not repeat the example lines.`,
    prompt: ({ activity, count, existing }) => `Write ${count} new lines for when the user taps PPL and ${SCENES[activity]}.\n` +
      `Existing lines to avoid repeating:\n${existing.map(l => `- ${l.en} / ${l.zh}`).join("\n") || "- (none)"}` },
  persona: { effort: "low", schema: verdictSchema, valid: validVerdicts,
    system: `You review lines for character consistency. ${PERSONA} Pass a line only if it sounds like PPL in both languages, fits the scene, ` +
      "and the Chinese reads naturally. Give one verdict per line, using its index.",
    prompt: ({ activity, candidates }) => `Scene: ${SCENES[activity]}.\n${candidates.map((l, i) => `${i}. ${l.en} / ${l.zh}`).join("\n")}` },
  safety: { effort: "low", schema: verdictSchema, valid: validVerdicts,
    system: `You review lines for a mood-journaling app whose users may be having a hard day. ${RULES} ` +
      "Fail any line that breaks a rule or could feel dismissive to someone who is sad. Give one verdict per line, using its index.",
    prompt: ({ candidates }) => candidates.map((l, i) => `${i}. ${l.en} / ${l.zh}`).join("\n") }
};

const normalize = text => text.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
// Deterministic last gate after the agents.
export function ruleCheck(line, seen) {
  const en = line.en.trim(), zh = line.zh.trim();
  if (!en || !zh) return "empty";
  if (en.length > LIMITS.en || [...zh].length > LIMITS.zh) return "too long";
  if (zh.includes("小仙女")) return "wrong name";
  if (seen.has(normalize(en)) || seen.has(normalize(zh))) return "duplicate";
  return null;
}

async function ask(client, agent, input, usage) {
  const response = await client.beta.messages.create({
    model: MODEL, max_tokens: MAX_TOKENS,
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    output_config: { effort: agent.effort, format: { type: "json_schema", schema: agent.schema } },
    system: agent.system,
    messages: [{ role: "user", content: agent.prompt(input) }]
  });
  usage.input += response.usage?.input_tokens ?? 0;
  usage.output += response.usage?.output_tokens ?? 0;
  if (response.stop_reason !== "end_turn") throw new Error(`stopped: ${response.stop_reason}`);
  const text = response.content.filter(block => block.type === "text").map(block => block.text).join("");
  const data = JSON.parse(text);
  if (!agent.valid(data)) throw new Error("output does not match schema");
  return data;
}

const passed = (verdicts, count) => {
  const ok = new Set(verdicts.filter(v => v.pass).map(v => v.index));
  return index => index < count && ok.has(index);
};

export async function runPipeline({ client, bank, perActivity = 6, activities = ACTIVITIES }) {
  const usage = { input: 0, output: 0 }, stats = [], added = [];
  const seen = new Set(bank.lines.flatMap(l => [normalize(l.en), normalize(l.zh)]));
  for (const activity of activities) {
    const row = { activity, written: 0, persona: 0, safety: 0, rules: 0, error: null };
    stats.push(row);
    try {
      const existing = bank.lines.filter(l => l.activity === activity);
      const { lines } = await ask(client, AGENTS.writer, { activity, count: perActivity, existing }, usage);
      const written = lines.slice(0, perActivity);
      row.written = written.length;
      const personaOk = passed((await ask(client, AGENTS.persona, { activity, candidates: written }, usage)).verdicts, written.length);
      const afterPersona = written.filter((_, i) => personaOk(i));
      row.persona = afterPersona.length;
      if (!afterPersona.length) continue;
      const safetyOk = passed((await ask(client, AGENTS.safety, { activity, candidates: afterPersona }, usage)).verdicts, afterPersona.length);
      const afterSafety = afterPersona.filter((_, i) => safetyOk(i));
      row.safety = afterSafety.length;
      const prefix = activity.toLowerCase().replace("_", "");
      // Continue after the highest number so ids stay unique when reviewed lines were deleted.
      let next = Math.max(0, ...bank.lines.map(l => l.id.startsWith(`${prefix}-gen-`) ? Number(l.id.slice(prefix.length + 5)) || 0 : 0)) + 1;
      for (const line of afterSafety) {
        if (ruleCheck(line, seen)) continue;
        seen.add(normalize(line.en)); seen.add(normalize(line.zh));
        added.push({ id: `${prefix}-gen-${next++}`, activity, source: "generated", en: line.en.trim(), zh: line.zh.trim() });
        row.rules++;
      }
    } catch (error) {
      // Fail closed per activity: nothing from a failed stage reaches the bank.
      row.error = error.message;
    }
  }
  return { added, stats, usage, costUsd: (usage.input * PRICE.input + usage.output * PRICE.output) / 1e6 };
}

export const formatBank = lines => `{\n  "lines": [\n${lines.map(line =>
  `    { ${Object.entries(line).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`).join(",\n")}\n  ]\n}\n`;

export const maxCostUsd = activities =>
  activities * 3 * (MAX_INPUT_TOKENS_PER_CALL * PRICE.input + MAX_TOKENS * PRICE.output) / 1e6;

async function main(argv) {
  const run = argv.includes("--run");
  const flag = argv.indexOf("--per-activity");
  const perActivity = flag >= 0 ? Number(argv[flag + 1]) : 6;
  if (!Number.isInteger(perActivity) || perActivity < 1 || perActivity > 12) throw new Error("--per-activity must be 1–12");
  const bank = JSON.parse(fs.readFileSync(BANK_PATH, "utf8"));
  console.log(`${ACTIVITIES.length} activities × 3 agents = ${ACTIVITIES.length * 3} calls on ${MODEL}, ${perActivity} lines each.`);
  console.log(`Maximum cost: about US$${maxCostUsd(ACTIVITIES.length).toFixed(2)}.`);
  if (!run) { console.log("Dry run. Add --run to call the API."); return; }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const result = await runPipeline({ client: new Anthropic(), bank, perActivity });
  console.table(result.stats);
  fs.writeFileSync(BANK_PATH, formatBank([...bank.lines, ...result.added]));
  console.log(`Added ${result.added.length} lines. Actual cost: US$${result.costUsd.toFixed(4)}. Review with: git diff ${path.relative(process.cwd(), BANK_PATH)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}

import { REFLECTION_V2, REFLECTION_V2_INSTRUCTIONS, REFLECTION_V2_SCHEMAS } from "./reflection-v2.js";
import { compileGatewaySchema } from "./ai-gateway-schema.js";
import { GATEWAY_TASK_LIMITS, gatewayError } from "./ai-gateway-config.js";

// The offline candidate's composition paragraph, with the existing introduction,
// evidence safeguards and final JSON/citation/quotation contract unchanged.
// No exemplars, generated plan or inferred facts enter the request.
const stages = REFLECTION_V2_INSTRUCTIONS.WEEKLY.split("\n\n");
export const WEEKLY_RETROSPECTIVE_INSTRUCTIONS = [stages[0], stages[1],
  "Compose a retrospective around what matters in these Events. Where the text explicitly connects experiences, let their relationship carry the writing: a revision in response to feedback, a changed understanding, or feelings that coexist. Choose the details that make that relationship clear; supplied Events are available evidence, not a coverage checklist. Independent experiences can stand beside one another, and a quiet week can stay small. Write directly in idiomatic English or everyday Simplified Chinese, with natural paragraph flow. Paraphrase without quotation marks. Let the ending rest where the evidence leaves things, including what remains unresolved.",
  stages[3]].join("\n\n");
// Selective narrative candidate (AI_WEEKLY_REFLECTION_NARRATIVE_THREAD). Replaces only
// the composition paragraph: Events are candidates, not a checklist; select moments
// with stated significance, link only on textual evidence, organize by meaning and
// keep open outcomes and stated intensity. Select -> relate -> write -> verify happens
// inside the existing single call; no plan is requested or stored. Introduction,
// evidence safeguards and the final JSON/ref/quotation contract are byte-identical.
// The paragraph adds 291 serialized bytes, inside the builder's existing 512-byte
// framing allowance, so packet trimming and Gateway admission are unchanged.
export const WEEKLY_NARRATIVE_THREAD_COMPOSITION = "Treat Events as candidates, not a checklist. " +
  "Select moments with stated significance: a wish, concern, choice, change, unresolved issue, or small detail valued by the user. " +
  "One distinctive moment may matter more than routine entries; do not favor distress, recency, or equal coverage per day. " +
  "Link Events only on textual evidence, not shared tags or dates; keep unrelated moments separate and omit filler. " +
  "Organize by meaning, not weekdays. " +
  "Preserve open outcomes and stated emotional intensity; infer no hidden motives, traits, diagnoses, lessons, growth, or whole-period trends from selected memories. " +
  "Paraphrase naturally in English or Simplified Chinese without quotation marks, stock reassurance, or forced themes.";
export const WEEKLY_NARRATIVE_THREAD_INSTRUCTIONS = [stages[0], stages[1], WEEKLY_NARRATIVE_THREAD_COMPOSITION, stages[3]].join("\n\n");
const { wireSchema } = compileGatewaySchema(REFLECTION_V2_SCHEMAS.WEEKLY);

export function weeklyEditorialSettings(env, contract) {
  const flag = name => {
    if (env[name] === undefined || env[name] === "false") return false;
    if (env[name] !== "true") throw gatewayError("AI_GATEWAY_CONFIG_INVALID");
    return true;
  };
  const settings = {
    recordDaysSeparated: flag("AI_WEEKLY_REFLECTION_RECORD_DAYS_SEPARATED"),
    retrospective: flag("AI_WEEKLY_REFLECTION_RETROSPECTIVE")
  };
  // Present only when enabled, so OFF settings keep their original shape exactly.
  if (flag("AI_WEEKLY_REFLECTION_NARRATIVE_THREAD")) settings.narrativeThread = true;
  if (contract !== REFLECTION_V2.WEEKLY && (settings.recordDaysSeparated || settings.retrospective || settings.narrativeThread)) {
    throw gatewayError("AI_GATEWAY_CONFIG_INVALID");
  }
  // Two composition paragraphs are alternatives; an ambiguous combination fails closed.
  if (settings.retrospective && settings.narrativeThread) throw gatewayError("AI_GATEWAY_CONFIG_INVALID");
  return settings;
}

export const weeklyEditorialInstructions = settings => settings.narrativeThread ? WEEKLY_NARRATIVE_THREAD_INSTRUCTIONS
  : settings.retrospective ? WEEKLY_RETROSPECTIVE_INSTRUCTIONS : REFLECTION_V2_INSTRUCTIONS.WEEKLY;

// Apply presentation AFTER the existing builder's deterministic byte trimming.
// Selection, retained sources, aliases and the validator ref map are unchanged.
export function weeklyEditorialPacket(built, settings, maxOutputTokens) {
  if (!settings.recordDaysSeparated) return built;
  const packet = { ...built.packet,
    evidence: built.packet.evidence.map(({ day, ...evidence }) => evidence),
    recordDays: built.packet.evidence.map(({ ref, day }) => ({ ref, day })) };
  // Mirror native Gateway framing only for this optional presentation check.
  // Gateway remains authoritative for actual admission and cost reservation.
  const requestBytes = Buffer.byteLength(JSON.stringify({ model: "claude-sonnet-5-5",
    system: weeklyEditorialInstructions(settings), messages: [{ role: "user", content: JSON.stringify(packet) }],
    max_tokens: maxOutputTokens,
    output_config: { effort: "low", format: { type: "json_schema", schema: wireSchema } } })) + 1024;
  // If presentation overhead does not fit, keep the original format. Never add
  // an error or evict more sources to make room. The prompt factor stays chosen.
  return requestBytes <= GATEWAY_TASK_LIMITS.WEEKLY_REPORT.input ? { ...built, packet } : built;
}

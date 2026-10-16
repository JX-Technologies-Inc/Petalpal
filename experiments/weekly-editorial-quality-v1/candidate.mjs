// OFFLINE composition experiment only. No runtime imports this module. No fetch,
// env/config loader, provider client, runner, ledger or persistence capability.
import { buildWeeklyReflectionV2Packet } from "../../lib/sonnet-weekly.js";
import { REFLECTION_V2_INSTRUCTIONS, REFLECTION_V2_SCHEMAS } from "../../lib/reflection-v2.js";
import { compileGatewaySchema } from "../../lib/ai-gateway-schema.js";
import { GATEWAY_TASK_LIMITS, gatewayError } from "../../lib/ai-gateway-config.js";

// Keep the current introduction, evidence-safety paragraph and output/quotation
// contract byte-for-byte. Replace only the composition paragraph; no few-shots,
// inferred emotions, generated plan or additional call.
const stages = REFLECTION_V2_INSTRUCTIONS.WEEKLY.split("\n\n");
if (stages.length !== 4) throw gatewayError("AI_GATEWAY_INVALID_INPUT");
export const CANDIDATE_INSTRUCTIONS = [stages[0], stages[1],
  "Compose a retrospective around what matters in these Events. Where the text explicitly connects experiences, let their relationship carry the writing: a revision in response to feedback, a changed understanding, or feelings that coexist. Choose the details that make that relationship clear; supplied Events are available evidence, not a coverage checklist. Independent experiences can stand beside one another, and a quiet week can stay small. Write directly in idiomatic English or everyday Simplified Chinese, with natural paragraph flow. Paraphrase without quotation marks. Let the ending rest where the evidence leaves things, including what remains unresolved.",
  stages[3]].join("\n\n");

// Reuse the exact production envelope preparation and ref map. This is NOT a
// replacement for upstream consent/source validation or the final-write fence.
// Two independent factors permit a later 2x2 comparison on identical evidence.
export function editorialCandidate(input, { presentation = "current", composition = "current" } = {}) {
  if (!["current", "record-days-separated"].includes(presentation) ||
      !["current", "retrospective"].includes(composition)) throw gatewayError("AI_GATEWAY_INVALID_INPUT");
  const built = buildWeeklyReflectionV2Packet(input);
  if (built.packet.evidence.length !== input.evidenceSelection.evidence.length) {
    throw gatewayError("AI_GATEWAY_INVALID_INPUT");
  }
  const packet = structuredClone(built.packet);
  if (presentation === "record-days-separated") {
    const recordDays = packet.evidence.map(({ ref, day }) => ({ ref, day }));
    packet.evidence = packet.evidence.map(({ ref, text, topics, clipped }) => ({ ref, text,
      ...(topics ? { topics } : {}), ...(clipped ? { clipped } : {}) }));
    packet.recordDays = recordDays;
  }
  const instructions = composition === "current" ? REFLECTION_V2_INSTRUCTIONS.WEEKLY : CANDIDATE_INSTRUCTIONS;
  const { wireSchema } = compileGatewaySchema(REFLECTION_V2_SCHEMAS.WEEKLY);
  // Same serialized native request framing and 1024-byte reserve as the Gateway.
  // Reject excess; never trim selected follow-ups to pay for a formatting idea.
  const requestBytesWithReserve = Buffer.byteLength(JSON.stringify({ model: "claude-sonnet-5-5", system: instructions,
    messages: [{ role: "user", content: JSON.stringify(packet) }], max_tokens: 2048,
    output_config: { effort: "low", format: { type: "json_schema", schema: wireSchema } } })) + 1024;
  if (instructions.length > 4000 || requestBytesWithReserve > GATEWAY_TASK_LIMITS.WEEKLY_REPORT.input) {
    throw gatewayError("AI_GATEWAY_INVALID_INPUT");
  }
  return { packet, refs: built.refs, instructions, requestBytesWithReserve };
}

// OFFLINE EXPERIMENT ONLY. No production import, retrieval, authorization,
// persistence, provider call or configuration switch is introduced here.
import { REPORT_EVIDENCE_LIMITS, selectReportEvidence } from "../../lib/report-foundation.js";
import { requireAiIdentity } from "../../lib/ai-identity.js";
import { buildReflectionV2 } from "../../lib/reflection-v2.js";

// Mirrors the frozen original's private ranking/dedup helpers. Keep parity tests
// before considering extraction into shared code; runtime is deliberately untouched.
const order = (a, b) => Number(b.similarity ?? 0) - Number(a.similarity ?? 0) ||
  Number(b.importanceScore ?? 0) - Number(a.importanceScore ?? 0) ||
  +new Date(a.eventDate) - +new Date(b.eventDate) ||
  String(a.sourceEventId).localeCompare(String(b.sourceEventId)) || String(a.id).localeCompare(String(b.id));
const tokens = value => new Set(String(value || "").normalize("NFC").toLocaleLowerCase("en").split(/[^\p{L}\p{N}]+/u).filter(Boolean));
function duplicate(a, b) {
  if (String(a.summary || "").normalize("NFC").trim().toLocaleLowerCase("en") ===
      String(b.summary || "").normalize("NFC").trim().toLocaleLowerCase("en")) return true;
  const x = tokens(a.summary), y = tokens(b.summary);
  if (!x.size || !y.size) return false;
  return [...x].filter(t => y.has(t)).length / new Set([...x, ...y]).size >= 0.85;
}
const theme = row => (Array.isArray(row.topics) ? row.topics
  .filter(t => typeof t === "string" && t.trim()).map(t => t.trim().toLocaleLowerCase("en")).sort() : [])[0] || `event:${row.sourceEventId}`;

// Same text/topic adaptation as buildWeeklyReflectionV2Packet, without accessing
// any source outside the supplied, already consent-authorized candidate pool.
export function packetForSelection({ locale, timezone }, evidence) {
  return buildReflectionV2({ type: "WEEKLY", locale, timezone, items: evidence.map(row => ({
    text: row.summary.trim(), topics: row.topics.filter(t => typeof t === "string" && t.trim()).slice(0, 10).filter(t => t.length <= 40),
    eventDate: row.eventDate, week: null, previous: false,
    source: { sourceEventId: row.sourceEventId, sourceMemoryId: row.sourceMemoryId }
  })) });
}

export function selectWeeklyEvidenceV2(args) {
  const cap = REPORT_EVIDENCE_LIMITS.WEEKLY, limits = args.limits ?? cap;
  const ownerId = requireAiIdentity(args.identity);
  // This function cannot establish consent. As with the original pure selector,
  // callers must supply only the upstream consent/eligibility-verified pool.
  // Additional fail-closed guards make this experiment explicitly Weekly/bounded.
  if (args.reportType !== "WEEKLY" || !["en", "zh-Hans"].includes(args.locale) || !args.timezone ||
      !Array.isArray(args.candidates) || args.candidates.length > limits.candidateTake ||
      !["candidateTake", "maxEvidence", "maxContextCharacters"].every(k => Number.isInteger(limits[k]) && limits[k] > 0 && limits[k] <= cap[k]) ||
      limits.maxPerTheme !== cap.maxPerTheme || limits.minimumEvidence !== cap.minimumEvidence) throw Error("OFFLINE_WEEKLY_INPUT_INVALID");
  for (const row of args.candidates) {
    if (row?.ownerId !== ownerId || row.memoryProcessingAllowed === false) throw Error("OFFLINE_POOL_NOT_AUTHORIZED");
    if ([row.similarity, row.importanceScore].some(v => v != null && (typeof v !== "number" || !Number.isFinite(v)))) throw Error("OFFLINE_RANK_INVALID");
  }
  // Identical-rank, identical-provenance conflicting versions have no stable
  // original winner. Refuse that malformed pool rather than choose by input order.
  for (let i = 0; i < args.candidates.length; i++) for (const other of args.candidates.slice(0, i)) {
    const row = args.candidates[i];
    if (row.id === other.id && row.sourceEventId === other.sourceEventId && order(row, other) === 0 &&
        (row.summary !== other.summary || JSON.stringify(row.topics) !== JSON.stringify(other.topics) || row.memoryType !== other.memoryType)) {
      throw Error("OFFLINE_AMBIGUOUS_DUPLICATE");
    }
  }
  // Initial diversity behavior, including metadata/reasons, stays authoritative.
  const initial = selectReportEvidence({ ...args, limits });
  if (initial.selectedCount >= limits.maxEvidence) return initial;
  const admitted = evidence => {
    try { return packetForSelection(args, evidence).packet.evidence.length === evidence.length; }
    catch (error) {
      if (error.code === "REPORT_NARRATIVE_INVALID_INPUT") return false;
      throw error;
    }
  };
  // Never let a new addition cause downstream longest-item trimming to evict an
  // initial source. If the original already trims, preserve its existing result.
  if (!admitted(initial.evidence)) return initial;

  const eligible = args.candidates.filter(row => row.memoryType === "EVENT" && row.id && row.sourceEventId &&
    Number.isFinite(+new Date(row.eventDate)) && +new Date(row.eventDate) >= +new Date(args.periodStartUtc) &&
    +new Date(row.eventDate) < +new Date(args.periodEndUtc)).sort(order);
  const deduplicated = [], eventIds = new Set(), memoryIds = new Set();
  for (const row of eligible) {
    if (eventIds.has(row.sourceEventId) || memoryIds.has(row.id) || deduplicated.some(other => duplicate(other, row))) continue;
    eventIds.add(row.sourceEventId); memoryIds.add(row.id); deduplicated.push(row);
  }
  const evidence = [...initial.evidence], used = new Set(evidence.map(row => row.sourceEventId));
  let contextCharacters = initial.contextCharacters;
  for (const row of deduplicated) {
    const cost = String(row.summary || "").length + 96;
    if (used.has(row.sourceEventId) || evidence.length >= limits.maxEvidence || contextCharacters + cost > limits.maxContextCharacters) continue;
    const key = theme(row), item = {
      ownerId, sourceEventId: row.sourceEventId, sourceMemoryId: row.id, eventDate: new Date(row.eventDate),
      summary: row.summary, topics: Array.isArray(row.topics) ? [...row.topics] : [],
      importanceScore: row.importanceScore ?? null, similarity: Number(row.similarity ?? 0),
      selectionReason: evidence.some(other => other.theme === key) ? "REPEATED_OR_CHANGING_THEME" : "SEMANTIC_RELEVANCE",
      theme: key, provenance: { sourceEventId: row.sourceEventId, sourceMemoryId: row.id }
    };
    if (!admitted([...evidence, item])) continue;
    evidence.push(item); used.add(row.sourceEventId); contextCharacters += cost;
  }
  if (evidence.length === initial.selectedCount) return initial;
  evidence.sort((a, b) => +a.eventDate - +b.eventDate || a.sourceEventId.localeCompare(b.sourceEventId) || a.sourceMemoryId.localeCompare(b.sourceMemoryId));
  const sufficient = evidence.length >= limits.minimumEvidence;
  return { ...initial, evidence, contextCharacters, selectedCount: evidence.length,
    status: sufficient ? "READY" : "INSUFFICIENT_EVIDENCE",
    reason: sufficient ? null : "BELOW_MINIMUM_EVIDENCE" };
}

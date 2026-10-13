import { requireAiIdentity, assertOwnerIdentity } from "./ai-identity.js";
import { localDateForInstant, weeklyPeriodForLocalDate, previousMonthlyPeriod } from "./ai-periods.js";

export const MONTHLY_EVIDENCE_POLICY = "monthly-cross-week-v1";
export const monthlyWeek = (date, timezone) => weeklyPeriodForLocalDate(localDateForInstant(date, timezone), timezone).periodKey;
const time = value => +new Date(value);
const order = (a, b) => Number(b.similarity || 0) - Number(a.similarity || 0) ||
  Number(b.importanceScore || 0) - Number(a.importanceScore || 0) || time(a.eventDate) - time(b.eventDate) || a.sourceEventId.localeCompare(b.sourceEventId);

// All candidates resolve back to owned, eligible EventMemory rows. Semantic
// results affect ranking only; they cannot introduce a source or bypass a week.
export function selectMonthlyEvidence({ identity, period, events, previousEvents, semanticCandidates = [], limits }) {
  const ownerId = requireAiIdentity(identity), previous = previousMonthlyPeriod({
    year: Number(period.periodKey.slice(0, 4)), month: Number(period.periodKey.slice(5)), timezone: period.timezone
  });
  const ranks = new Map();
  for (const item of semanticCandidates) {
    assertOwnerIdentity(identity, item.ownerId);
    if (item.memoryType === "EVENT" && Number.isFinite(item.similarity)) ranks.set(`${item.sourceEventId}:${item.id}`, item.similarity);
  }
  const candidates = (rows, start, end) => rows.flatMap(event => {
    assertOwnerIdentity(identity, event.ownerId);
    const memory = event.memory;
    if (!event.memoryProcessingAllowed || !memory || memory.memoryType !== "EVENT" || memory.ownerId !== ownerId ||
        memory.sourceEventId !== event.id || !memory.id || typeof memory.summary !== "string" || !memory.summary.trim() ||
        !Number.isFinite(time(event.occurredAt)) || time(event.occurredAt) < time(start) || time(event.occurredAt) >= time(end)) return [];
    const topics = Array.isArray(memory.topics) ? memory.topics.filter(value => typeof value === "string" && value.trim()) : [];
    return [{ ownerId, id: memory.id, sourceEventId: event.id, eventDate: new Date(event.occurredAt), summary: memory.summary,
      topics, importanceScore: memory.importanceScore ?? null, similarity: ranks.get(`${event.id}:${memory.id}`) || 0,
      theme: [...topics].sort()[0] || `event:${event.id}` }];
  });
  const current = candidates(events, period.periodStartUtc, period.periodEndUtc);
  const prior = candidates(previousEvents, previous.periodStartUtc, previous.periodEndUtc);
  const groups = new Map();
  for (const item of current) {
    const week = monthlyWeek(item.eventDate, period.timezone);
    if (!groups.has(week)) groups.set(week, []);
    groups.get(week).push(item);
  }
  const availableWeeks = [...groups.keys()].sort();
  const buckets = availableWeeks.map(week => groups.get(week).sort(order));
  if (prior.length) buckets.push(prior.sort(order));
  // Fair bounded candidate admission, including previous-month comparison
  // sources. Neither similarity nor a busy final week can fill the whole pool.
  const pool = [];
  for (let round = 0; pool.length < limits.candidateTake; round++) {
    let added = false;
    for (const bucket of buckets) {
      if (bucket[round] && pool.length < limits.candidateTake) { pool.push(bucket[round]); added = true; }
    }
    if (!added) break;
  }
  const selected = [], themes = new Map(), ids = new Set(); let contextCharacters = 0;
  function add(item, reason) {
    const cost = item.summary.length + 96;
    if (ids.has(item.sourceEventId) || selected.length >= limits.maxEvidence || contextCharacters + cost > limits.maxContextCharacters) return false;
    ids.add(item.sourceEventId); contextCharacters += cost; const key = `${time(item.eventDate) < time(period.periodStartUtc) ? "previous" : "current"}:${item.theme}`;
    themes.set(key, (themes.get(key) || 0) + 1);
    selected.push({ ...item, sourceMemoryId: item.id, selectionReason: reason,
      provenance: { sourceEventId: item.sourceEventId, sourceMemoryId: item.id } }); return true;
  }
  // Up to six calendar-week anchors have priority over theme repetition limits.
  // The existing 16-source/8,000-character total remains authoritative. Enrichment
  // still observes maxPerTheme; skipping a week fails closed below.
  for (const week of availableWeeks) {
    for (const item of pool.filter(item => time(item.eventDate) >= time(period.periodStartUtc) && monthlyWeek(item.eventDate, period.timezone) === week)) {
      if (add(item, "CROSS_WEEK_COVERAGE")) break;
    }
  }
  // At most three previous-month sources; retained in AiEvidence so deletion
  // of a selected comparison source invalidates the report through existing code.
  let previousCount = 0;
  for (const item of pool.filter(item => time(item.eventDate) < time(period.periodStartUtc)).sort(order)) {
    if (previousCount < 3 && (themes.get(`previous:${item.theme}`) || 0) < limits.maxPerTheme && add(item, "PREVIOUS_MONTH_COMPARISON")) previousCount++;
  }
  for (const item of pool.filter(item => time(item.eventDate) >= time(period.periodStartUtc)).sort(order)) {
    if ((themes.get(`current:${item.theme}`) || 0) < limits.maxPerTheme) add(item, "REPEATED_OR_CHANGING_THEME");
  }
  selected.sort((a, b) => time(a.eventDate) - time(b.eventDate) || a.sourceEventId.localeCompare(b.sourceEventId));
  const currentSelected = selected.filter(item => time(item.eventDate) >= time(period.periodStartUtc));
  const representedWeeks = [...new Set(currentSelected.map(item => monthlyWeek(item.eventDate, period.timezone)))].sort();
  const missingWeeks = availableWeeks.filter(week => !representedWeeks.includes(week));
  const sufficient = currentSelected.length >= limits.minimumEvidence && representedWeeks.length >= 2 && !missingWeeks.length;
  return { ownerId, status: sufficient ? "READY" : "INSUFFICIENT_EVIDENCE",
    reason: sufficient ? null : "SPARSE_OR_INCOMPLETE_WEEK_COVERAGE", candidateCount: pool.length, selectedCount: selected.length,
    contextCharacters, coverage: { availableWeeks, representedWeeks, missingWeeks }, evidence: selected };
}

import { readFileSync } from "node:fs";
import { REPORT_EVIDENCE_LIMITS } from "../../lib/report-foundation.js";

function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const corpus = freeze(JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8")));
export const targets = freeze(JSON.parse(readFileSync(new URL("./targets.json", import.meta.url), "utf8")));
export const locales = Object.freeze(["en", "zh-Hans"]);
export const owner = "synthetic-editorial-owner";
export const period = Object.freeze({ timezone: "UTC", periodKey: "2026-09-14",
  periodStartUtc: "2026-09-14T00:00:00Z", periodEndUtc: "2026-09-21T00:00:00Z" });

// Review metadata/targets never participate in candidate ranking or input.
export function selectorArgs(c, locale) {
  return { reportType: "WEEKLY", identity: { userId: owner }, ...period, locale,
    limits: REPORT_EVIDENCE_LIMITS.WEEKLY, candidates: c.events.map((e, i) => ({
      id: `synthetic-${c.id}-memory-${i + 1}`, sourceEventId: `synthetic-${c.id}-event-${i + 1}`,
      ownerId: owner, memoryType: "EVENT", summary: e[locale], topics: [...e.topics],
      eventDate: new Date(`2026-09-${e.day}T12:00:00Z`), similarity: 0, importanceScore: null
    })) };
}
export function inputFor(c, locale, selection) {
  const args = selectorArgs(c, locale);
  return { reportType: "WEEKLY", ownerId: owner, locale, period: { ...period },
    aggregates: { ownerId: owner, eventCount: args.candidates.length, topTopics: [] },
    evidenceSelection: selection ?? { ownerId: owner, status: "READY", evidence: args.candidates.map(row => ({
      ownerId: owner, sourceEventId: row.sourceEventId, sourceMemoryId: row.id, summary: row.summary,
      topics: row.topics, eventDate: row.eventDate, importanceScore: null,
      provenance: { sourceEventId: row.sourceEventId, sourceMemoryId: row.id }
    })) }, sourceFence: { evidencePolicy: "weekly-localized-v1", sources: [] } };
}

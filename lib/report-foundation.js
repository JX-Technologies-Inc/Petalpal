import { assertOwnerIdentity, requireAiIdentity } from "./ai-identity.js";
import {
  monthlyPeriodFor,
  previousMonthlyPeriod,
  previousWeeklyPeriod,
  reportPeriodStatus,
  weeklyPeriodForLocalDate
} from "./ai-periods.js";
import { trendAnalyzer } from "./trend-analyzer.js";

export const REPORT_EVIDENCE_LIMITS = Object.freeze({
  WEEKLY: Object.freeze({ candidateTake: 32, maxEvidence: 8, maxContextCharacters: 4_000, maxPerTheme: 2, minimumEvidence: 2 }),
  MONTHLY: Object.freeze({ candidateTake: 64, maxEvidence: 16, maxContextCharacters: 8_000, maxPerTheme: 3, minimumEvidence: 3 })
});

function ownerEvents(identity, events, previousEvents = []) {
  const ownerId = requireAiIdentity(identity);
  for (const event of events) assertOwnerIdentity(identity, event.ownerId);
  for (const event of previousEvents) assertOwnerIdentity(identity, event.ownerId);
  return { ownerId, events, previousEvents };
}

function importantEvents(events, threshold = 0.7) {
  return events
    .filter((event) => Number(event.importanceScore ?? event.memory?.importanceScore) >= threshold)
    .sort((left, right) => Number(right.importanceScore ?? right.memory?.importanceScore) - Number(left.importanceScore ?? left.memory?.importanceScore) || String(left.id).localeCompare(String(right.id)))
    .map((event) => event.id);
}

function topTopics(trend) {
  return trend.topicFrequency.slice(0, 10);
}

function normalizedTokens(value) {
  return new Set(String(value || "")
    .normalize("NFC")
    .toLocaleLowerCase("en")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean));
}

function nearDuplicate(left, right) {
  const leftText = String(left.summary || "").normalize("NFC").trim().toLocaleLowerCase("en");
  const rightText = String(right.summary || "").normalize("NFC").trim().toLocaleLowerCase("en");
  if (leftText === rightText) return true;
  const leftTokens = normalizedTokens(leftText);
  const rightTokens = normalizedTokens(rightText);
  if (!leftTokens.size || !rightTokens.size) return false;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union >= 0.85;
}

function evidenceOrder(left, right) {
  const similarity = Number(right.similarity ?? 0) - Number(left.similarity ?? 0);
  if (similarity) return similarity;
  const importance = Number(right.importanceScore ?? 0) - Number(left.importanceScore ?? 0);
  if (importance) return importance;
  const date = new Date(left.eventDate).getTime() - new Date(right.eventDate).getTime();
  return date || String(left.sourceEventId).localeCompare(String(right.sourceEventId)) || String(left.id).localeCompare(String(right.id));
}

function themeKey(candidate) {
  const topics = Array.isArray(candidate.topics)
    ? candidate.topics.filter((topic) => typeof topic === "string" && topic.trim()).map((topic) => topic.trim().toLocaleLowerCase("en")).sort()
    : [];
  return topics[0] || `event:${candidate.sourceEventId}`;
}

function evidenceCharacters(candidate) {
  return String(candidate.summary || "").length + 96;
}

export function selectReportEvidence({
  identity,
  candidates,
  periodStartUtc,
  periodEndUtc,
  limits
}) {
  const ownerId = requireAiIdentity(identity);
  const start = new Date(periodStartUtc);
  const end = new Date(periodEndUtc);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new Error("Evidence selection requires a valid report period");
  }
  if (!limits || !Number.isInteger(limits.maxEvidence) || !Number.isInteger(limits.maxContextCharacters) || !Number.isInteger(limits.maxPerTheme)) {
    throw new Error("Evidence selection requires bounded limits");
  }

  const eligible = [];
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    assertOwnerIdentity(identity, candidate?.ownerId);
    const occurredAt = new Date(candidate.eventDate);
    if (
      candidate.memoryType !== "EVENT" ||
      !candidate.id ||
      !candidate.sourceEventId ||
      Number.isNaN(occurredAt.getTime()) ||
      occurredAt < start ||
      occurredAt >= end
    ) continue;
    eligible.push(candidate);
  }
  eligible.sort(evidenceOrder);

  const deduplicated = [];
  const eventIds = new Set();
  const memoryIds = new Set();
  for (const candidate of eligible) {
    if (eventIds.has(candidate.sourceEventId) || memoryIds.has(candidate.id)) continue;
    if (deduplicated.some((existing) => nearDuplicate(existing, candidate))) continue;
    eventIds.add(candidate.sourceEventId);
    memoryIds.add(candidate.id);
    deduplicated.push(candidate);
  }

  const groups = new Map();
  for (const candidate of deduplicated) {
    const key = themeKey(candidate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }
  const orderedGroups = [...groups.entries()].sort((left, right) =>
    evidenceOrder(left[1][0], right[1][0]) || left[0].localeCompare(right[0]));

  const selected = [];
  let contextCharacters = 0;
  for (let themeIndex = 0; themeIndex < limits.maxPerTheme && selected.length < limits.maxEvidence; themeIndex += 1) {
    for (const [key, group] of orderedGroups) {
      const candidate = group[themeIndex];
      if (!candidate || selected.length >= limits.maxEvidence) continue;
      const characters = evidenceCharacters(candidate);
      if (contextCharacters + characters > limits.maxContextCharacters) continue;
      contextCharacters += characters;
      selected.push({
        ownerId,
        sourceEventId: candidate.sourceEventId,
        sourceMemoryId: candidate.id,
        eventDate: new Date(candidate.eventDate),
        summary: candidate.summary,
        topics: Array.isArray(candidate.topics) ? [...candidate.topics] : [],
        importanceScore: candidate.importanceScore ?? null,
        similarity: Number(candidate.similarity ?? 0),
        selectionReason: themeIndex === 0 ? "SEMANTIC_RELEVANCE" : "REPEATED_OR_CHANGING_THEME",
        theme: key,
        provenance: { sourceEventId: candidate.sourceEventId, sourceMemoryId: candidate.id }
      });
    }
  }
  selected.sort((left, right) =>
    left.eventDate.getTime() - right.eventDate.getTime() ||
    left.sourceEventId.localeCompare(right.sourceEventId) ||
    left.sourceMemoryId.localeCompare(right.sourceMemoryId));

  const minimumEvidence = Number.isInteger(limits.minimumEvidence) ? limits.minimumEvidence : 1;
  const sufficient = selected.length >= minimumEvidence;
  return {
    ownerId,
    status: sufficient ? "READY" : "INSUFFICIENT_EVIDENCE",
    reason: sufficient ? null : (selected.length ? "BELOW_MINIMUM_EVIDENCE" : "NO_ELIGIBLE_EVIDENCE"),
    candidateCount: eligible.length,
    deduplicatedCount: deduplicated.length,
    selectedCount: selected.length,
    contextCharacters,
    evidence: selected
  };
}

export function buildWeeklyReport({
  identity,
  timezone,
  periodKey,
  periodStartUtc,
  periodEndUtc,
  asOf,
  status,
  currentEvents = [],
  previousEvents = [],
  generationVersion = "deterministic-v1"
}) {
  const { ownerId, events, previousEvents: priorEvents } = ownerEvents(identity, currentEvents, previousEvents);
  const trendSignals = trendAnalyzer.analyzeWeekly({ currentEvents: events, previousEvents: priorEvents });
  return {
    ownerId,
    timezone,
    periodKey,
    periodStartUtc,
    periodEndUtc,
    asOf,
    status,
    eventCount: events.length,
    topTopics: topTopics(trendSignals),
    importantEventIds: importantEvents(events),
    trendSignals,
    summary: null,
    generationVersion
  };
}

export function buildMonthlyReport({
  identity,
  timezone,
  periodKey,
  periodStartUtc,
  periodEndUtc,
  asOf,
  status,
  year,
  month,
  currentEvents = [],
  previousEvents = [],
  generationVersion = "deterministic-v1"
}) {
  const { ownerId, events, previousEvents: priorEvents } = ownerEvents(identity, currentEvents, previousEvents);
  const trendSignals = trendAnalyzer.analyzeMonthly({ currentEvents: events, previousEvents: priorEvents });
  return {
    ownerId,
    timezone,
    periodKey,
    periodStartUtc,
    periodEndUtc,
    asOf,
    status,
    year,
    month,
    eventCount: events.length,
    topTopics: topTopics(trendSignals),
    importantEventIds: importantEvents(events),
    trendSignals,
    turningPointEventIds: importantEvents(events, 0.85),
    summary: null,
    generationVersion
  };
}

function evidenceCreateData(ownerId, events, reportField, reportId) {
  return events.map((event) => ({
    ownerId,
    sourceEventId: event.id,
    sourceMemoryId: event.memory?.id || null,
    [reportField]: reportId
  }));
}

async function ownerTimezone(tx, ownerId) {
  const user = await tx.user.findUnique({ where: { id: ownerId }, select: { timezone: true } });
  if (!user) {
    const error = new Error("Authenticated PetalPal owner was not found");
    error.code = "AI_FORBIDDEN";
    throw error;
  }
  return user.timezone;
}

function periodEvents(tx, ownerId, period) {
  return tx.event.findMany({
    where: {
      ownerId,
      occurredAt: { gte: period.periodStartUtc, lt: period.periodEndUtc }
    },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    include: { memory: true }
  });
}

function reportEvidenceQuery(reportType, report) {
  const topics = report.topTopics.slice(0, 5).map((item) => item.topic).filter(Boolean);
  const scope = reportType === "WEEKLY" ? "week" : "month";
  return topics.length
    ? `Meaningful events, changes, progress, challenges, and repeated themes this ${scope} about ${topics.join(", ")}.`
    : `Meaningful events, changes, progress, challenges, and repeated themes this ${scope}.`;
}

export class ReportInputService {
  constructor({ prisma, semanticRetrieval }) {
    this.prisma = prisma;
    this.semanticRetrieval = semanticRetrieval;
  }

  async buildWeeklyInput({ identity, localDate, asOf = new Date(), allowPartial = false }) {
    const ownerId = requireAiIdentity(identity);
    const timezone = await ownerTimezone(this.prisma, ownerId);
    const period = weeklyPeriodForLocalDate(localDate, timezone);
    const status = reportPeriodStatus(period.periodEndUtc, asOf, allowPartial);
    const [events, previousEvents] = await Promise.all([
      periodEvents(this.prisma, ownerId, period),
      periodEvents(this.prisma, ownerId, previousWeeklyPeriod(period))
    ]);
    const aggregates = buildWeeklyReport({ identity, ...period, asOf, status, currentEvents: events, previousEvents });
    return this.#buildInput({ reportType: "WEEKLY", identity, period, aggregates });
  }

  async buildMonthlyInput({ identity, year, month, asOf = new Date(), allowPartial = false }) {
    const ownerId = requireAiIdentity(identity);
    const timezone = await ownerTimezone(this.prisma, ownerId);
    const period = monthlyPeriodFor({ year, month, timezone });
    const status = reportPeriodStatus(period.periodEndUtc, asOf, allowPartial);
    const [events, previousEvents] = await Promise.all([
      periodEvents(this.prisma, ownerId, period),
      periodEvents(this.prisma, ownerId, previousMonthlyPeriod({ year, month, timezone }))
    ]);
    const aggregates = buildMonthlyReport({ identity, ...period, asOf, status, year, month, currentEvents: events, previousEvents });
    return this.#buildInput({ reportType: "MONTHLY", identity, period, aggregates });
  }

  async #buildInput({ reportType, identity, period, aggregates }) {
    const limits = REPORT_EVIDENCE_LIMITS[reportType];
    const candidates = await this.semanticRetrieval.retrieve({
      identity,
      query: reportEvidenceQuery(reportType, aggregates),
      take: limits.candidateTake,
      dateFrom: period.periodStartUtc,
      dateTo: period.periodEndUtc
    });
    const evidenceSelection = selectReportEvidence({
      identity,
      candidates,
      periodStartUtc: period.periodStartUtc,
      periodEndUtc: period.periodEndUtc,
      limits
    });
    return { reportType, ownerId: aggregates.ownerId, period, aggregates, evidenceSelection };
  }
}

export class WeeklyReportService {
  constructor(prisma) { this.prisma = prisma; }

  async generate({ identity, localDate, asOf = new Date(), allowPartial = false, generationVersion = "deterministic-v1" }) {
    const ownerId = requireAiIdentity(identity);
    return this.prisma.$transaction(async (tx) => {
      const timezone = await ownerTimezone(tx, ownerId);
      const period = weeklyPeriodForLocalDate(localDate, timezone);
      const previousPeriod = previousWeeklyPeriod(period);
      const status = reportPeriodStatus(period.periodEndUtc, asOf, allowPartial);
      const [events, previousEvents] = await Promise.all([
        periodEvents(tx, ownerId, period),
        periodEvents(tx, ownerId, previousPeriod)
      ]);
      const data = buildWeeklyReport({
        identity,
        ...period,
        asOf,
        status,
        currentEvents: events,
        previousEvents,
        generationVersion
      });
      const finalized = typeof tx.weeklyReport.findUnique === "function"
        ? await tx.weeklyReport.findUnique({ where: { ownerId_periodKey: { ownerId, periodKey: period.periodKey } } })
        : null;
      if (finalized?.narrativeStatus && finalized.narrativeStatus !== "NOT_GENERATED") return finalized;
      const report = await tx.weeklyReport.upsert({
        where: { ownerId_periodKey: { ownerId, periodKey: period.periodKey } },
        update: data,
        create: data
      });
      await tx.aiEvidence.deleteMany({ where: { ownerId, weeklyReportId: report.id } });
      const evidence = evidenceCreateData(ownerId, events, "weeklyReportId", report.id);
      if (evidence.length) await tx.aiEvidence.createMany({ data: evidence });
      return report;
    });
  }
}

export class MonthlyReportService {
  constructor(prisma) { this.prisma = prisma; }

  async generate({ identity, year, month, asOf = new Date(), allowPartial = false, generationVersion = "deterministic-v1" }) {
    const ownerId = requireAiIdentity(identity);
    return this.prisma.$transaction(async (tx) => {
      const timezone = await ownerTimezone(tx, ownerId);
      const period = monthlyPeriodFor({ year, month, timezone });
      const previousPeriod = previousMonthlyPeriod({ year, month, timezone });
      const status = reportPeriodStatus(period.periodEndUtc, asOf, allowPartial);
      const [events, previousEvents] = await Promise.all([
        periodEvents(tx, ownerId, period),
        periodEvents(tx, ownerId, previousPeriod)
      ]);
      const data = buildMonthlyReport({
        identity,
        ...period,
        asOf,
        status,
        year,
        month,
        currentEvents: events,
        previousEvents,
        generationVersion
      });
      const finalized = typeof tx.monthlyReport.findUnique === "function"
        ? await tx.monthlyReport.findUnique({ where: { ownerId_year_month: { ownerId, year, month } } })
        : null;
      if (finalized?.narrativeStatus && finalized.narrativeStatus !== "NOT_GENERATED") return finalized;
      const report = await tx.monthlyReport.upsert({
        where: { ownerId_year_month: { ownerId, year, month } },
        update: data,
        create: data
      });
      await tx.aiEvidence.deleteMany({ where: { ownerId, monthlyReportId: report.id } });
      const evidence = evidenceCreateData(ownerId, events, "monthlyReportId", report.id);
      if (evidence.length) await tx.aiEvidence.createMany({ data: evidence });
      return report;
    });
  }
}

function reportModel(prisma, reportType) {
  if (reportType === "WEEKLY") return prisma.weeklyReport;
  if (reportType === "MONTHLY") return prisma.monthlyReport;
  throw new Error("Grounded persistence supports only Weekly and Monthly reports");
}

function reportUniqueWhere(reportType, ownerId, aggregates) {
  if (reportType === "WEEKLY") {
    return { ownerId_periodKey: { ownerId, periodKey: aggregates.periodKey } };
  }
  return { ownerId_year_month: { ownerId, year: aggregates.year, month: aggregates.month } };
}

function provenanceKey(value) {
  return `${value?.sourceEventId}\u0000${value?.sourceMemoryId}`;
}

function groundedEvidenceRows({ ownerId, reportType, reportId, reportInput, narrativeResult }) {
  const selectedInput = new Map(reportInput.evidenceSelection.evidence.map((item) => [provenanceKey(item), item]));
  const selectedResult = narrativeResult.provenance?.selectedEvidence || [];
  if (selectedResult.length !== selectedInput.size) {
    throw new Error("Narrative selected provenance does not match report input");
  }
  for (const item of selectedResult) {
    assertOwnerIdentity({ userId: ownerId }, item.ownerId);
    if (!selectedInput.has(provenanceKey(item))) throw new Error("Narrative selected provenance does not match report input");
  }

  const citedFromSections = new Set();
  for (const section of narrativeResult.sections || []) {
    for (const reference of section.evidenceRefs || []) citedFromSections.add(provenanceKey(reference));
  }
  const citedResult = new Set();
  for (const item of narrativeResult.provenance?.citedEvidence || []) {
    assertOwnerIdentity({ userId: ownerId }, item.ownerId);
    const key = provenanceKey(item);
    if (!selectedInput.has(key)) throw new Error("Narrative cited provenance was not selected");
    citedResult.add(key);
  }
  if (citedFromSections.size !== citedResult.size || [...citedFromSections].some((key) => !citedResult.has(key))) {
    throw new Error("Narrative claim citations do not match cited provenance");
  }

  const reportField = reportType === "WEEKLY" ? "weeklyReportId" : "monthlyReportId";
  return [...selectedInput.values()].map((item) => {
    const key = provenanceKey(item);
    return {
      ownerId,
      sourceEventId: item.sourceEventId,
      sourceMemoryId: item.sourceMemoryId,
      claimType: citedResult.has(key) ? "NARRATIVE_CITED" : "NARRATIVE_SELECTED",
      [reportField]: reportId
    };
  });
}

function assertGroundedOutcome(reportInput, narrativeResult, ownerId) {
  if (reportInput.reportType !== "WEEKLY" && reportInput.reportType !== "MONTHLY") {
    throw new Error("Grounded persistence supports only Weekly and Monthly reports");
  }
  assertOwnerIdentity({ userId: ownerId }, reportInput.ownerId);
  assertOwnerIdentity({ userId: ownerId }, reportInput.aggregates?.ownerId);
  assertOwnerIdentity({ userId: ownerId }, reportInput.evidenceSelection?.ownerId);
  assertOwnerIdentity({ userId: ownerId }, narrativeResult?.ownerId);
  if (narrativeResult.reportType !== reportInput.reportType || narrativeResult.periodKey !== reportInput.period?.periodKey) {
    throw new Error("Narrative outcome does not match the report input period");
  }
  if (!new Set(["GENERATED", "INSUFFICIENT_EVIDENCE"]).has(narrativeResult.status)) {
    throw new Error("Only final grounded narrative outcomes can be persisted");
  }
  if (narrativeResult.status === "GENERATED") {
    if (typeof narrativeResult.narrative !== "string" || !narrativeResult.narrative.trim() || !Array.isArray(narrativeResult.sections) || !narrativeResult.sections.length) {
      throw new Error("Generated narrative outcome is incomplete");
    }
  } else if (narrativeResult.narrative !== null || (narrativeResult.sections || []).length) {
    throw new Error("Insufficient-evidence outcome cannot contain a narrative");
  }
}

export class GroundedReportPersistenceService {
  constructor(prisma) { this.prisma = prisma; }

  async findFinalized({ identity, reportType, periodKey }) {
    const ownerId = requireAiIdentity(identity);
    const model = reportModel(this.prisma, reportType);
    return model.findFirst({
      where: { ownerId, periodKey, narrativeStatus: { not: "NOT_GENERATED" } },
      include: { evidence: true }
    });
  }

  async persist({ identity, reportInput, narrativeResult, generationVersion }) {
    const ownerId = requireAiIdentity(identity);
    if (typeof generationVersion !== "string" || !generationVersion.trim() || generationVersion.length > 64) {
      throw new Error("A bounded report generation version is required");
    }
    assertGroundedOutcome(reportInput, narrativeResult, ownerId);
    const reportType = reportInput.reportType;
    const aggregates = reportInput.aggregates;

    return this.prisma.$transaction(async (tx) => {
      const model = reportModel(tx, reportType);
      const where = reportUniqueWhere(reportType, ownerId, aggregates);
      const existing = await model.findUnique({ where });
      if (existing?.narrativeStatus && existing.narrativeStatus !== "NOT_GENERATED") {
        return { skipped: true, outcome: existing.narrativeStatus, report: existing };
      }

      const narrativeStatus = narrativeResult.status;
      const data = {
        ...aggregates,
        summary: narrativeStatus === "GENERATED" ? narrativeResult.narrative : null,
        narrativeStatus,
        narrativeSections: narrativeStatus === "GENERATED" ? narrativeResult.sections : [],
        generationVersion: generationVersion.trim()
      };
      const report = await model.upsert({ where, update: data, create: data });
      const reportField = reportType === "WEEKLY" ? "weeklyReportId" : "monthlyReportId";
      await tx.aiEvidence.deleteMany({ where: { ownerId, [reportField]: report.id } });
      const evidence = groundedEvidenceRows({ ownerId, reportType, reportId: report.id, reportInput, narrativeResult });
      if (evidence.length) await tx.aiEvidence.createMany({ data: evidence });
      return { skipped: false, outcome: narrativeStatus, report, evidenceCount: evidence.length };
    });
  }
}

export class PrivateReportRepository {
  constructor(prisma) { this.prisma = prisma; }

  async getWeeklyReportById({ identity, reportId }) {
    const ownerId = requireAiIdentity(identity);
    return this.prisma.weeklyReport.findFirst({ where: { id: reportId, ownerId }, include: { evidence: true } });
  }

  async getMonthlyReportById({ identity, reportId }) {
    const ownerId = requireAiIdentity(identity);
    return this.prisma.monthlyReport.findFirst({ where: { id: reportId, ownerId }, include: { evidence: true } });
  }

  async getYearlyReportById({ identity, reportId }) {
    const ownerId = requireAiIdentity(identity);
    return this.prisma.yearlyReport.findFirst({ where: { id: reportId, ownerId }, include: { evidence: true } });
  }
}

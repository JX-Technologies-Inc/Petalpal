import { REPORT_EVIDENCE_LIMITS } from "./report-foundation.js";

const REPORT_TYPES = new Set(["WEEKLY", "MONTHLY"]);

export const REPORT_NARRATIVE_SECTION_KINDS = Object.freeze({
  WEEKLY: Object.freeze(["RECENT_MOMENTS", "RECURRING_THEMES", "NOTABLE_CHANGES"]),
  MONTHLY: Object.freeze(["MAJOR_EXPERIENCES", "BROADER_RECURRING_THEMES", "MEANINGFUL_CHANGES_OR_MILESTONES"])
});

export const REPORT_NARRATIVE_AGGREGATE_REFS = Object.freeze(["eventCount", "topTopics", "trendSignals"]);

export const REPORT_NARRATIVE_GENERATION_VERSION = "grounded-narrative-v1";

export const REPORT_NARRATIVE_LIMITS = Object.freeze({
  WEEKLY: Object.freeze({ maxInputCharacters: 12_000, maxSections: 3, maxClaimCharacters: 700, maxNarrativeCharacters: 1_800 }),
  MONTHLY: Object.freeze({ maxInputCharacters: 20_000, maxSections: 3, maxClaimCharacters: 700, maxNarrativeCharacters: 1_800 })
});

function narrativeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw narrativeError("REPORT_NARRATIVE_INVALID_INPUT", `${label} is required`);
  }
  return value.trim();
}

function isoDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw narrativeError("REPORT_NARRATIVE_INVALID_INPUT", `${label} must be a valid date`);
  }
  return date.toISOString();
}

function assertOwner(ownerId, actualOwnerId, label) {
  if (requireString(actualOwnerId, label) !== ownerId) {
    throw narrativeError("AI_FORBIDDEN", `${label} does not belong to the report owner`);
  }
}

function boundedTopics(values, maximum = 10) {
  return (Array.isArray(values) ? values : [])
    .filter((item) => item && typeof item.topic === "string" && Number.isFinite(Number(item.count)))
    .slice(0, maximum)
    .map((item) => ({ topic: item.topic, count: Number(item.count) }));
}

function boundedTopicChanges(values, maximum = 10) {
  return (Array.isArray(values) ? values : [])
    .filter((item) => item && typeof item.topic === "string")
    .slice(0, maximum)
    .map((item) => ({
      topic: item.topic,
      currentCount: Number(item.currentCount || 0),
      previousCount: Number(item.previousCount || 0),
      change: Number(item.change || 0)
    }));
}

function boundedAggregates(aggregates) {
  const trends = aggregates.trendSignals || {};
  return {
    eventCount: Number(aggregates.eventCount || 0),
    topTopics: boundedTopics(aggregates.topTopics),
    trendSignals: {
      status: trends.status === "ok" ? "ok" : "insufficient_data",
      currentEventCount: Number(trends.currentEventCount || 0),
      previousEventCount: Number(trends.previousEventCount || 0),
      eventCountChange: Number(trends.eventCountChange || 0),
      importantEventCount: Number(trends.importantEventCount || 0),
      topicFrequency: boundedTopics(trends.topicFrequency),
      topicChanges: boundedTopicChanges(trends.topicChanges)
    }
  };
}

function selectedEvidence(reportInput, ownerId, reportType) {
  const selection = reportInput.evidenceSelection;
  assertOwner(ownerId, selection?.ownerId, "Evidence selection owner");
  if (!new Set(["READY", "INSUFFICIENT_EVIDENCE"]).has(selection?.status)) {
    throw narrativeError("REPORT_NARRATIVE_INVALID_INPUT", "Evidence selection status is invalid");
  }

  const evidence = Array.isArray(selection.evidence) ? selection.evidence : [];
  const evidenceLimits = REPORT_EVIDENCE_LIMITS[reportType];
  if (evidence.length > evidenceLimits.maxEvidence) {
    throw narrativeError("REPORT_NARRATIVE_INVALID_INPUT", "Selected evidence exceeds the report bound");
  }
  if (selection.status === "READY" && evidence.length < evidenceLimits.minimumEvidence) {
    throw narrativeError("REPORT_NARRATIVE_INVALID_INPUT", "READY evidence is below the report minimum");
  }

  let contextCharacters = 0;
  const selected = evidence.map((item) => {
    assertOwner(ownerId, item?.ownerId, "Selected evidence owner");
    const sourceEventId = requireString(item.sourceEventId, "Selected evidence sourceEventId");
    const sourceMemoryId = requireString(item.sourceMemoryId, "Selected evidence sourceMemoryId");
    if (item.provenance?.sourceEventId !== sourceEventId || item.provenance?.sourceMemoryId !== sourceMemoryId) {
      throw narrativeError("REPORT_NARRATIVE_INVALID_INPUT", "Selected evidence provenance is invalid");
    }
    const summary = requireString(item.summary, "Selected evidence summary");
    contextCharacters += summary.length + 96;
    return {
      sourceEventId,
      sourceMemoryId,
      eventDate: isoDate(item.eventDate, "Selected evidence eventDate"),
      summary,
      topics: (Array.isArray(item.topics) ? item.topics : [])
        .filter((topic) => typeof topic === "string" && topic.trim())
        .slice(0, 10),
      selectionReason: item.selectionReason === "REPEATED_OR_CHANGING_THEME"
        ? "REPEATED_OR_CHANGING_THEME"
        : "SEMANTIC_RELEVANCE",
      theme: typeof item.theme === "string" ? item.theme : null
    };
  });
  if (contextCharacters > evidenceLimits.maxContextCharacters) {
    throw narrativeError("REPORT_NARRATIVE_INVALID_INPUT", "Selected evidence context exceeds the report bound");
  }
  return selected;
}

function validateEnvelope(reportInput) {
  if (!reportInput || typeof reportInput !== "object" || !REPORT_TYPES.has(reportInput.reportType)) {
    throw narrativeError("REPORT_NARRATIVE_INVALID_INPUT", "A Weekly or Monthly ReportInputService output is required");
  }
  const reportType = reportInput.reportType;
  const ownerId = requireString(reportInput.ownerId, "Report ownerId");
  assertOwner(ownerId, reportInput.aggregates?.ownerId, "Aggregate owner");
  const evidence = selectedEvidence(reportInput, ownerId, reportType);
  return { reportType, ownerId, evidence };
}

function provenanceFor(ownerId, evidence) {
  return evidence.map((item) => ({
    ownerId,
    sourceEventId: item.sourceEventId,
    sourceMemoryId: item.sourceMemoryId
  }));
}

export function buildGroundedNarrativeInput(reportInput) {
  const { reportType, evidence } = validateEnvelope(reportInput);
  if (reportInput.evidenceSelection.status !== "READY") {
    throw narrativeError("REPORT_NARRATIVE_INSUFFICIENT_EVIDENCE", "Narrative input requires READY evidence");
  }
  const period = reportInput.period || {};
  const providerInput = {
    instructions: [
      "Use only the supplied deterministic aggregates and selected Event evidence.",
      "Return concise English narrative claims; omit anything uncertain or unsupported.",
      "Do not invent people, events, dates, causes, trends, emotions, diagnoses, or milestones.",
      "Each section must contain one claim and cite its supporting evidenceRefs or aggregateRefs.",
      "Do not repeat the Events one by one and do not make psychological or diagnostic conclusions."
    ],
    report: {
      reportType,
      period: {
        periodKey: requireString(period.periodKey, "Report periodKey"),
        periodStartUtc: isoDate(period.periodStartUtc, "Report periodStartUtc"),
        periodEndUtc: isoDate(period.periodEndUtc, "Report periodEndUtc")
      },
      aggregates: boundedAggregates(reportInput.aggregates),
      selectedEvidence: evidence,
      allowedSectionKinds: [...REPORT_NARRATIVE_SECTION_KINDS[reportType]],
      outputContract: {
        sections: [{ kind: "allowedSectionKind", claim: "one concise supported claim", evidenceRefs: [{ sourceEventId: "id", sourceMemoryId: "id" }], aggregateRefs: ["eventCount"] }]
      }
    }
  };
  if (JSON.stringify(providerInput).length > REPORT_NARRATIVE_LIMITS[reportType].maxInputCharacters) {
    throw narrativeError("REPORT_NARRATIVE_INVALID_INPUT", "Grounded narrative input exceeds its bound");
  }
  return providerInput;
}

function parseProviderOutput(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      throw narrativeError("REPORT_NARRATIVE_INVALID_OUTPUT", "Narrative provider returned invalid JSON");
    }
  }
  if (!value || typeof value !== "object") {
    throw narrativeError("REPORT_NARRATIVE_INVALID_OUTPUT", "Narrative provider returned an invalid value");
  }
  return value;
}

function validateProviderOutput(value, reportType, evidence) {
  const output = parseProviderOutput(value);
  const sections = Array.isArray(output.sections) ? output.sections : [];
  const limits = REPORT_NARRATIVE_LIMITS[reportType];
  if (!sections.length || sections.length > limits.maxSections) {
    throw narrativeError("REPORT_NARRATIVE_INVALID_OUTPUT", "Narrative provider returned an invalid section count");
  }
  const allowedKinds = new Set(REPORT_NARRATIVE_SECTION_KINDS[reportType]);
  const allowedAggregates = new Set(REPORT_NARRATIVE_AGGREGATE_REFS);
  const allowedEvidence = new Map(evidence.map((item) => [`${item.sourceEventId}\u0000${item.sourceMemoryId}`, item]));
  const usedKinds = new Set();

  const normalized = sections.map((section) => {
    if (!allowedKinds.has(section?.kind) || usedKinds.has(section.kind)) {
      throw narrativeError("REPORT_NARRATIVE_INVALID_OUTPUT", "Narrative provider returned an invalid section kind");
    }
    usedKinds.add(section.kind);
    if (typeof section.claim !== "string" || !section.claim.trim()) {
      throw narrativeError("REPORT_NARRATIVE_INVALID_OUTPUT", "Narrative claim is required");
    }
    const claim = section.claim.trim();
    if (claim.length > limits.maxClaimCharacters) {
      throw narrativeError("REPORT_NARRATIVE_INVALID_OUTPUT", "Narrative claim exceeds its bound");
    }
    const evidenceRefs = [];
    const seenEvidence = new Set();
    for (const ref of Array.isArray(section.evidenceRefs) ? section.evidenceRefs : []) {
      const key = `${ref?.sourceEventId}\u0000${ref?.sourceMemoryId}`;
      if (!allowedEvidence.has(key)) {
        throw narrativeError("REPORT_NARRATIVE_INVALID_OUTPUT", "Narrative claim cites evidence that was not selected");
      }
      if (!seenEvidence.has(key)) {
        seenEvidence.add(key);
        const selected = allowedEvidence.get(key);
        evidenceRefs.push({ sourceEventId: selected.sourceEventId, sourceMemoryId: selected.sourceMemoryId });
      }
    }
    const aggregateRefs = [...new Set(Array.isArray(section.aggregateRefs) ? section.aggregateRefs : [])];
    if (aggregateRefs.some((ref) => !allowedAggregates.has(ref))) {
      throw narrativeError("REPORT_NARRATIVE_INVALID_OUTPUT", "Narrative claim cites an unavailable aggregate");
    }
    if (!evidenceRefs.length && !aggregateRefs.length) {
      throw narrativeError("REPORT_NARRATIVE_INVALID_OUTPUT", "Every narrative claim requires grounding references");
    }
    return { kind: section.kind, claim, evidenceRefs, aggregateRefs };
  });
  if (normalized.map((section) => section.claim).join("\n\n").length > limits.maxNarrativeCharacters) {
    throw narrativeError("REPORT_NARRATIVE_INVALID_OUTPUT", "Narrative exceeds its bound");
  }
  return { sections: normalized, model: typeof output.model === "string" ? output.model : null };
}

async function callWithTimeout(provider, input, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(narrativeError("REPORT_NARRATIVE_TIMEOUT", "Narrative provider timed out"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => provider.generateNarrative(input, { signal: controller.signal })),
      timeout
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export class GroundedReportNarrativeService {
  constructor({ provider, timeoutMs = 20_000, maxAttempts = 2 }) {
    if (!provider || typeof provider.generateNarrative !== "function") {
      throw new Error("Grounded report narrative provider is required");
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error("Narrative timeout must be positive");
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) throw new Error("Narrative attempts must be between 1 and 3");
    this.provider = provider;
    this.timeoutMs = timeoutMs;
    this.maxAttempts = maxAttempts;
  }

  async generate(reportInput) {
    const { reportType, ownerId, evidence } = validateEnvelope(reportInput);
    const selectedProvenance = provenanceFor(ownerId, evidence);
    const base = {
      reportType,
      ownerId,
      periodKey: reportInput.period?.periodKey || reportInput.aggregates?.periodKey || null
    };
    if (reportInput.evidenceSelection.status !== "READY") {
      return {
        ...base,
        status: "INSUFFICIENT_EVIDENCE",
        reason: reportInput.evidenceSelection.reason || "INSUFFICIENT_EVIDENCE",
        narrative: null,
        sections: [],
        provenance: { selectedEvidence: selectedProvenance, citedEvidence: [], aggregateRefs: [] },
        attempts: 0
      };
    }

    const input = buildGroundedNarrativeInput(reportInput);
    let failure = narrativeError("REPORT_NARRATIVE_PROVIDER_FAILED", "Narrative provider failed");
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const raw = await callWithTimeout(this.provider, input, this.timeoutMs);
        const output = validateProviderOutput(raw, reportType, evidence);
        const cited = new Map();
        const aggregateRefs = new Set();
        for (const section of output.sections) {
          for (const ref of section.evidenceRefs) cited.set(`${ref.sourceEventId}\u0000${ref.sourceMemoryId}`, { ownerId, ...ref });
          for (const ref of section.aggregateRefs) aggregateRefs.add(ref);
        }
        return {
          ...base,
          status: "GENERATED",
          narrative: output.sections.map((section) => section.claim).join("\n\n"),
          sections: output.sections,
          provenance: {
            selectedEvidence: selectedProvenance,
            citedEvidence: [...cited.values()],
            aggregateRefs: [...aggregateRefs].sort()
          },
          provider: {
            name: this.provider.name || this.provider.constructor?.name || "report-narrative-provider",
            model: output.model || this.provider.model || null
          },
          attempts: attempt
        };
      } catch (error) {
        failure = new Set(["REPORT_NARRATIVE_TIMEOUT", "REPORT_NARRATIVE_INVALID_OUTPUT"]).has(error?.code)
          ? error
          : narrativeError("REPORT_NARRATIVE_PROVIDER_FAILED", "Narrative provider failed");
      }
    }
    return {
      ...base,
      status: "FAILED",
      errorCode: failure.code || "REPORT_NARRATIVE_PROVIDER_FAILED",
      narrative: null,
      sections: [],
      provenance: { selectedEvidence: selectedProvenance, citedEvidence: [], aggregateRefs: [] },
      attempts: this.maxAttempts
    };
  }
}

function cloudflareProviderError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export class CloudflareWorkersReportNarrativeProvider {
  constructor({ env = process.env, fetchImpl = fetch } = {}) {
    this.url = String(env.CLOUDFLARE_WORKER_AI_URL || "").replace(/\/$/, "");
    this.token = env.CLOUDFLARE_WORKER_AI_TOKEN || "";
    this.fetchImpl = fetchImpl;
    this.name = "CLOUDFLARE_WORKERS_AI";
    this.model = null;
  }

  isConfigured() {
    return Boolean(this.url && this.token && typeof this.fetchImpl === "function");
  }

  async generateNarrative(input, { signal } = {}) {
    if (!this.isConfigured()) {
      throw cloudflareProviderError("REPORT_NARRATIVE_PROVIDER_NOT_CONFIGURED", "Cloudflare report narrative provider is not configured");
    }
    let response;
    try {
      response = await this.fetchImpl(`${this.url}/v1/report-narrative`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.token}` },
        body: JSON.stringify(input),
        signal
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw cloudflareProviderError("REPORT_NARRATIVE_PROVIDER_FAILED", "Cloudflare report narrative provider is unavailable");
    }

    let data;
    try {
      data = await response.json();
    } catch {
      if (!response.ok) throw cloudflareProviderError("REPORT_NARRATIVE_PROVIDER_FAILED", "Cloudflare report narrative provider failed");
      throw cloudflareProviderError("REPORT_NARRATIVE_INVALID_OUTPUT", "Cloudflare report narrative provider returned invalid JSON");
    }
    if (!response.ok) {
      throw cloudflareProviderError("REPORT_NARRATIVE_PROVIDER_FAILED", "Cloudflare report narrative provider failed");
    }
    return data;
  }
}

export function configuredCloudflareReportNarrativeProvider({ env = process.env, fetchImpl = fetch } = {}) {
  const provider = new CloudflareWorkersReportNarrativeProvider({ env, fetchImpl });
  return provider.isConfigured() ? provider : null;
}

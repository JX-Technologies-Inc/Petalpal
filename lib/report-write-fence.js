import { previousMonthlyPeriod, previousWeeklyPeriod } from "./ai-periods.js";

function stale(code = "REPORT_SOURCE_STALE") {
  const error = new Error(code === "AI_JOB_LEASE_LOST" ? "Report job claim is no longer current" : "Report input is no longer current");
  error.code = code;
  return error;
}

function instant(value) {
  const time = value == null ? NaN : new Date(value).getTime();
  if (!Number.isFinite(time)) throw stale();
  return time;
}

// Server-only snapshot, never forwarded to the narrative provider or logged.
export function reportSourceSnapshot(events) {
  return events.map((event) => ({
    id: event.id, ownerId: event.ownerId, occurredAt: instant(event.occurredAt),
    updatedAt: instant(event.updatedAt), memoryProcessingAllowed: event.memoryProcessingAllowed,
    memory: event.memory ? {
      id: event.memory.id, ownerId: event.memory.ownerId, sourceEventId: event.memory.sourceEventId,
      updatedAt: instant(event.memory.updatedAt), inputRevision: event.memory.embeddingInputRevision,
      memoryType: event.memory.memoryType, summary: event.memory.summary,
      topics: event.memory.topics, importanceScore: event.memory.importanceScore,
      embeddingStatus: event.memory.embeddingStatus, embeddedInputRevision: event.memory.embeddedInputRevision
    } : null
  })).sort((a, b) => a.id.localeCompare(b.id)).map((row) => structuredClone(row));
}

export async function lockReportConsent(tx, ownerId, expectedUpdatedAt, claimedAt = null) {
  // Exclusive owner lock also serializes report idempotency and Event deletion.
  const rows = await tx.$queryRawUnsafe(`
    SELECT "userId", "aiProcessing", "personalization", "memoryEnabled", "updatedAt"
    FROM "AiConsent" WHERE "userId" = $1 FOR UPDATE
  `, ownerId);
  const consent = rows[0];
  if (rows.length !== 1 || consent.userId !== ownerId || !consent.aiProcessing || !consent.personalization || !consent.memoryEnabled) {
    throw stale("AI_FORBIDDEN");
  }
  const epoch = instant(consent.updatedAt);
  if ((expectedUpdatedAt != null && epoch !== instant(expectedUpdatedAt)) ||
      (claimedAt != null && epoch > instant(claimedAt))) throw stale();
}

export async function lockReportClaim(tx, { ownerId, job, workerId, generationVersion, reportType, periodKey }) {
  if (!job || job.ownerId !== ownerId || job.lockedBy !== workerId || !workerId ||
      job.status !== "RUNNING" || !Number.isInteger(job.attemptCount) || job.attemptCount < 1 ||
      job.jobType !== `${reportType}_REPORT` || job.resourceId !== periodKey ||
      job.idempotencyKey !== `${job.jobType}:${periodKey}:${generationVersion}`) throw stale("AI_JOB_LEASE_LOST");
  const rows = await tx.$queryRawUnsafe(`
    SELECT "id" FROM "AIJob"
    WHERE "id" = $1 AND "ownerId" = $2 AND "status" = 'RUNNING'
      AND "lockedBy" = $3 AND "attemptCount" = $4 AND "lockedAt" = $5
      AND "jobType" = $6::"AIJobType" AND "resourceId" = $7 AND "idempotencyKey" = $8
      AND "leaseExpiresAt" > (clock_timestamp() AT TIME ZONE 'UTC')
    FOR UPDATE
  `, job.id, ownerId, workerId, job.attemptCount, new Date(instant(job.lockedAt)), job.jobType, periodKey, job.idempotencyKey);
  if (rows.length !== 1) throw stale("AI_JOB_LEASE_LOST");
}

export async function finishReportClaim(tx, { ownerId, job, workerId }) {
  // A lease may expire while locks/writes are pending. Check wall clock again;
  // failure rolls back the report, evidence and completion as one transaction.
  const rows = await tx.$queryRawUnsafe(`
    UPDATE "AIJob" SET "status" = 'SUCCEEDED',
      "completedAt" = (clock_timestamp() AT TIME ZONE 'UTC'),
      "updatedAt" = (clock_timestamp() AT TIME ZONE 'UTC'),
      "lockedAt" = NULL, "lockedBy" = NULL, "leaseExpiresAt" = NULL, "lastError" = NULL
    WHERE "id" = $1 AND "ownerId" = $2 AND "status" = 'RUNNING'
      AND "lockedBy" = $3 AND "attemptCount" = $4 AND "lockedAt" = $5
      AND "leaseExpiresAt" > (clock_timestamp() AT TIME ZONE 'UTC')
    RETURNING "id"
  `, job.id, ownerId, workerId, job.attemptCount, new Date(instant(job.lockedAt)));
  if (rows.length !== 1) throw stale("AI_JOB_LEASE_LOST");
}

export async function assertReportSources(tx, ownerId, input) {
  const { period, aggregates, sourceFence, evidenceSelection } = input;
  if (!sourceFence || !Number.isFinite(instant(sourceFence.consentUpdatedAt)) || !Array.isArray(sourceFence.sources) || aggregates.periodKey !== period.periodKey ||
      instant(aggregates.periodStartUtc) !== instant(period.periodStartUtc) ||
      instant(aggregates.periodEndUtc) !== instant(period.periodEndUtc)) throw stale();
  const previous = input.reportType === "WEEKLY" ? previousWeeklyPeriod(period)
    : previousMonthlyPeriod({ year: aggregates.year, month: aggregates.month, timezone: period.timezone });
  const from = new Date(previous.periodStartUtc), to = new Date(period.periodEndUtc);
  // Lock Events before their memories; revision/delete writers cannot pass the
  // recheck and then change the evidence before commit. Consent blocks new Events.
  await tx.$queryRawUnsafe(`
    SELECT "id" FROM "Event" WHERE "ownerId" = $1 AND "occurredAt" >= $2 AND "occurredAt" < $3
    ORDER BY "id" FOR SHARE
  `, ownerId, from, to);
  await tx.$queryRawUnsafe(`
    SELECT memory."id" FROM "EventMemory" AS memory INNER JOIN "Event" AS event
      ON event."id" = memory."sourceEventId" AND event."ownerId" = memory."ownerId"
    WHERE event."ownerId" = $1 AND event."occurredAt" >= $2 AND event."occurredAt" < $3
    ORDER BY memory."id" FOR SHARE OF memory
  `, ownerId, from, to);
  const current = await tx.event.findMany({
    where: { ownerId, memoryProcessingAllowed: true, occurredAt: { gte: from, lt: to } },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }], include: { memory: true }
  });
  const snapshot = reportSourceSnapshot(current);
  if (JSON.stringify(snapshot) !== JSON.stringify(sourceFence.sources)) throw stale();
  const ownerRows = await tx.$queryRawUnsafe('SELECT "timezone", "preferredLocale" FROM "User" WHERE "id" = $1 FOR SHARE', ownerId);
  if (ownerRows.length !== 1 || ownerRows[0].timezone !== period.timezone) throw stale();
  const events = new Map(current.map((event) => [event.id, event]));
  for (const evidence of evidenceSelection.evidence) {
    const event = events.get(evidence.sourceEventId), memory = event?.memory;
    if (evidence.ownerId !== ownerId || !memory || event.ownerId !== ownerId || memory.ownerId !== ownerId ||
        memory.sourceEventId !== event.id || memory.id !== evidence.sourceMemoryId || memory.memoryType !== "EVENT" ||
        instant(event.occurredAt) < instant(period.periodStartUtc) || instant(event.occurredAt) >= instant(period.periodEndUtc) ||
        instant(evidence.eventDate) !== instant(event.occurredAt) || memory.summary !== evidence.summary ||
        JSON.stringify(memory.topics) !== JSON.stringify(evidence.topics) ||
        (memory.importanceScore ?? null) !== evidence.importanceScore ||
        !/^en(?:-|$)/i.test(ownerRows[0].preferredLocale)) throw stale();
  }
}

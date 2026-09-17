-- Production AI foundation: private Event-only sources, derived memory,
-- owner-scoped reports, provenance, and lease-based durable background jobs.

CREATE TYPE "AIJobType" AS ENUM ('MEMORY_EXTRACTION', 'EMBEDDING_GENERATION', 'WEEKLY_REPORT', 'MONTHLY_REPORT');
CREATE TYPE "AIJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "AIReportStatus" AS ENUM ('COMPLETE', 'PARTIAL');

CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "localDate" VARCHAR(10) NOT NULL,
    "idempotencyKey" VARCHAR(191) NOT NULL,
    "memoryProcessingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "consentTermsVersion" VARCHAR(32),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Event_content_not_blank_check" CHECK (length(btrim("content")) > 0),
    CONSTRAINT "Event_local_date_check" CHECK ("localDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);

CREATE TABLE "EventMemory" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "memoryType" VARCHAR(64) NOT NULL,
    "summary" TEXT NOT NULL,
    "topics" JSONB NOT NULL DEFAULT '[]',
    "people" JSONB NOT NULL DEFAULT '[]',
    "importanceScore" DOUBLE PRECISION,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "primaryMood" VARCHAR(32),
    "secondaryEmotions" JSONB,
    "emotionConfidence" DOUBLE PRECISION,
    "emotionModelVersion" VARCHAR(128),
    "embeddingStatus" VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUESTED',
    "embeddingModel" VARCHAR(128),
    "memoryVersion" VARCHAR(32) NOT NULL DEFAULT 'v1',
    "extractionVersion" VARCHAR(32) NOT NULL DEFAULT 'v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventMemory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EventMemory_importance_score_check" CHECK ("importanceScore" IS NULL OR "importanceScore" BETWEEN 0 AND 1),
    CONSTRAINT "EventMemory_emotion_confidence_check" CHECK ("emotionConfidence" IS NULL OR "emotionConfidence" BETWEEN 0 AND 1)
);

CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "periodKey" VARCHAR(10) NOT NULL,
    "periodStartUtc" TIMESTAMP(3) NOT NULL,
    "periodEndUtc" TIMESTAMP(3) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "status" "AIReportStatus" NOT NULL DEFAULT 'COMPLETE',
    "eventCount" INTEGER NOT NULL,
    "topTopics" JSONB NOT NULL DEFAULT '[]',
    "importantEventIds" JSONB NOT NULL DEFAULT '[]',
    "trendSignals" JSONB NOT NULL DEFAULT '{}',
    "summary" TEXT,
    "generationVersion" VARCHAR(64) NOT NULL DEFAULT 'deterministic-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WeeklyReport_event_count_check" CHECK ("eventCount" >= 0),
    CONSTRAINT "WeeklyReport_period_check" CHECK ("periodStartUtc" < "periodEndUtc")
);

CREATE TABLE "MonthlyReport" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "periodKey" VARCHAR(7) NOT NULL,
    "periodStartUtc" TIMESTAMP(3) NOT NULL,
    "periodEndUtc" TIMESTAMP(3) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "status" "AIReportStatus" NOT NULL DEFAULT 'COMPLETE',
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "topTopics" JSONB NOT NULL DEFAULT '[]',
    "importantEventIds" JSONB NOT NULL DEFAULT '[]',
    "trendSignals" JSONB NOT NULL DEFAULT '{}',
    "turningPointEventIds" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT,
    "generationVersion" VARCHAR(64) NOT NULL DEFAULT 'deterministic-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonthlyReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MonthlyReport_month_check" CHECK ("month" BETWEEN 1 AND 12),
    CONSTRAINT "MonthlyReport_event_count_check" CHECK ("eventCount" >= 0),
    CONSTRAINT "MonthlyReport_period_check" CHECK ("periodStartUtc" < "periodEndUtc")
);

CREATE TABLE "YearlyReport" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "periodKey" VARCHAR(4) NOT NULL,
    "periodStartUtc" TIMESTAMP(3) NOT NULL,
    "periodEndUtc" TIMESTAMP(3) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "status" "AIReportStatus" NOT NULL DEFAULT 'COMPLETE',
    "year" INTEGER NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "topTopics" JSONB NOT NULL DEFAULT '[]',
    "trendSignals" JSONB NOT NULL DEFAULT '{}',
    "summary" TEXT,
    "generationVersion" VARCHAR(64) NOT NULL DEFAULT 'deterministic-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "YearlyReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "YearlyReport_event_count_check" CHECK ("eventCount" >= 0),
    CONSTRAINT "YearlyReport_period_check" CHECK ("periodStartUtc" < "periodEndUtc")
);

CREATE TABLE "AIEvidence" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "sourceMemoryId" TEXT,
    "claimType" VARCHAR(64),
    "weeklyReportId" TEXT,
    "monthlyReportId" TEXT,
    "yearlyReportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AIEvidence_exactly_one_report_check" CHECK (
      (("weeklyReportId" IS NOT NULL)::integer +
       ("monthlyReportId" IS NOT NULL)::integer +
       ("yearlyReportId" IS NOT NULL)::integer) = 1
    )
);

CREATE TABLE "AIJob" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "jobType" "AIJobType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "eventId" TEXT,
    "status" "AIJobStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" VARCHAR(128),
    "leaseExpiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "idempotencyKey" VARCHAR(191) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AIJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AIJob_attempts_check" CHECK ("attemptCount" >= 0 AND "maxAttempts" > 0 AND "attemptCount" <= "maxAttempts"),
    CONSTRAINT "AIJob_lock_shape_check" CHECK (
      ("status" = 'RUNNING' AND "lockedAt" IS NOT NULL AND "lockedBy" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL AND "completedAt" IS NULL)
      OR
      ("status" <> 'RUNNING' AND "lockedAt" IS NULL AND "lockedBy" IS NULL AND "leaseExpiresAt" IS NULL)
    ),
    CONSTRAINT "AIJob_completion_shape_check" CHECK (
      ("status" IN ('SUCCEEDED', 'FAILED', 'CANCELLED') AND "completedAt" IS NOT NULL)
      OR
      ("status" IN ('PENDING', 'RUNNING') AND "completedAt" IS NULL)
    )
);

CREATE UNIQUE INDEX "Event_id_ownerId_key" ON "Event"("id", "ownerId");
CREATE UNIQUE INDEX "Event_ownerId_idempotencyKey_key" ON "Event"("ownerId", "idempotencyKey");
CREATE UNIQUE INDEX "EventMemory_sourceEventId_key" ON "EventMemory"("sourceEventId");
CREATE UNIQUE INDEX "EventMemory_sourceEventId_ownerId_key" ON "EventMemory"("sourceEventId", "ownerId");
CREATE UNIQUE INDEX "EventMemory_id_ownerId_key" ON "EventMemory"("id", "ownerId");
CREATE UNIQUE INDEX "WeeklyReport_id_ownerId_key" ON "WeeklyReport"("id", "ownerId");
CREATE UNIQUE INDEX "WeeklyReport_ownerId_periodKey_key" ON "WeeklyReport"("ownerId", "periodKey");
CREATE UNIQUE INDEX "MonthlyReport_id_ownerId_key" ON "MonthlyReport"("id", "ownerId");
CREATE UNIQUE INDEX "MonthlyReport_ownerId_year_month_key" ON "MonthlyReport"("ownerId", "year", "month");
CREATE UNIQUE INDEX "MonthlyReport_ownerId_periodKey_key" ON "MonthlyReport"("ownerId", "periodKey");
CREATE UNIQUE INDEX "YearlyReport_id_ownerId_key" ON "YearlyReport"("id", "ownerId");
CREATE UNIQUE INDEX "YearlyReport_ownerId_year_key" ON "YearlyReport"("ownerId", "year");
CREATE UNIQUE INDEX "YearlyReport_ownerId_periodKey_key" ON "YearlyReport"("ownerId", "periodKey");
CREATE UNIQUE INDEX "AIEvidence_weeklyReportId_sourceEventId_key" ON "AIEvidence"("weeklyReportId", "sourceEventId");
CREATE UNIQUE INDEX "AIEvidence_monthlyReportId_sourceEventId_key" ON "AIEvidence"("monthlyReportId", "sourceEventId");
CREATE UNIQUE INDEX "AIEvidence_yearlyReportId_sourceEventId_key" ON "AIEvidence"("yearlyReportId", "sourceEventId");
CREATE UNIQUE INDEX "AIJob_ownerId_idempotencyKey_key" ON "AIJob"("ownerId", "idempotencyKey");

CREATE INDEX "Event_ownerId_occurredAt_idx" ON "Event"("ownerId", "occurredAt");
CREATE INDEX "Event_ownerId_localDate_idx" ON "Event"("ownerId", "localDate");
CREATE INDEX "EventMemory_ownerId_eventDate_idx" ON "EventMemory"("ownerId", "eventDate");
CREATE INDEX "EventMemory_ownerId_memoryType_idx" ON "EventMemory"("ownerId", "memoryType");
CREATE INDEX "WeeklyReport_ownerId_periodStartUtc_idx" ON "WeeklyReport"("ownerId", "periodStartUtc");
CREATE INDEX "MonthlyReport_ownerId_periodStartUtc_idx" ON "MonthlyReport"("ownerId", "periodStartUtc");
CREATE INDEX "YearlyReport_ownerId_periodStartUtc_idx" ON "YearlyReport"("ownerId", "periodStartUtc");
CREATE INDEX "AIEvidence_ownerId_sourceEventId_idx" ON "AIEvidence"("ownerId", "sourceEventId");
CREATE INDEX "AIEvidence_ownerId_sourceMemoryId_idx" ON "AIEvidence"("ownerId", "sourceMemoryId");
CREATE INDEX "AIEvidence_ownerId_weeklyReportId_idx" ON "AIEvidence"("ownerId", "weeklyReportId");
CREATE INDEX "AIEvidence_ownerId_monthlyReportId_idx" ON "AIEvidence"("ownerId", "monthlyReportId");
CREATE INDEX "AIEvidence_ownerId_yearlyReportId_idx" ON "AIEvidence"("ownerId", "yearlyReportId");
CREATE INDEX "AIJob_status_nextAttemptAt_idx" ON "AIJob"("status", "nextAttemptAt");
CREATE INDEX "AIJob_ownerId_status_nextAttemptAt_idx" ON "AIJob"("ownerId", "status", "nextAttemptAt");
CREATE INDEX "AIJob_resourceId_jobType_idx" ON "AIJob"("resourceId", "jobType");
CREATE INDEX "AIJob_eventId_jobType_idx" ON "AIJob"("eventId", "jobType");

ALTER TABLE "Event" ADD CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMemory" ADD CONSTRAINT "EventMemory_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMemory" ADD CONSTRAINT "EventMemory_sourceEventId_ownerId_fkey" FOREIGN KEY ("sourceEventId", "ownerId") REFERENCES "Event"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyReport" ADD CONSTRAINT "MonthlyReport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "YearlyReport" ADD CONSTRAINT "YearlyReport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIEvidence" ADD CONSTRAINT "AIEvidence_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIEvidence" ADD CONSTRAINT "AIEvidence_sourceEventId_ownerId_fkey" FOREIGN KEY ("sourceEventId", "ownerId") REFERENCES "Event"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIEvidence" ADD CONSTRAINT "AIEvidence_sourceMemoryId_ownerId_fkey" FOREIGN KEY ("sourceMemoryId", "ownerId") REFERENCES "EventMemory"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIEvidence" ADD CONSTRAINT "AIEvidence_weeklyReportId_ownerId_fkey" FOREIGN KEY ("weeklyReportId", "ownerId") REFERENCES "WeeklyReport"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIEvidence" ADD CONSTRAINT "AIEvidence_monthlyReportId_ownerId_fkey" FOREIGN KEY ("monthlyReportId", "ownerId") REFERENCES "MonthlyReport"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIEvidence" ADD CONSTRAINT "AIEvidence_yearlyReportId_ownerId_fkey" FOREIGN KEY ("yearlyReportId", "ownerId") REFERENCES "YearlyReport"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_eventId_ownerId_fkey" FOREIGN KEY ("eventId", "ownerId") REFERENCES "Event"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deleting an Event invalidates any materialized report that cited it. This
-- runs before evidence cascades so no summary can survive without provenance.
CREATE FUNCTION "delete_event_citing_reports"() RETURNS trigger AS $$
BEGIN
  DELETE FROM "WeeklyReport"
  WHERE "ownerId" = OLD."ownerId"
    AND "id" IN (
      SELECT "weeklyReportId" FROM "AIEvidence"
      WHERE "ownerId" = OLD."ownerId" AND "sourceEventId" = OLD."id" AND "weeklyReportId" IS NOT NULL
    );
  DELETE FROM "MonthlyReport"
  WHERE "ownerId" = OLD."ownerId"
    AND "id" IN (
      SELECT "monthlyReportId" FROM "AIEvidence"
      WHERE "ownerId" = OLD."ownerId" AND "sourceEventId" = OLD."id" AND "monthlyReportId" IS NOT NULL
    );
  DELETE FROM "YearlyReport"
  WHERE "ownerId" = OLD."ownerId"
    AND "id" IN (
      SELECT "yearlyReportId" FROM "AIEvidence"
      WHERE "ownerId" = OLD."ownerId" AND "sourceEventId" = OLD."id" AND "yearlyReportId" IS NOT NULL
    );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Event_delete_citing_reports"
BEFORE DELETE ON "Event"
FOR EACH ROW EXECUTE FUNCTION "delete_event_citing_reports"();

-- Terminal jobs are immutable. Same-state updates are allowed for fields such
-- as leases/errors, while all state changes follow the worker state machine.
CREATE FUNCTION "enforce_ai_job_status_transition"() RETURNS trigger AS $$
BEGIN
  IF NEW."status" = OLD."status" THEN
    RETURN NEW;
  END IF;
  IF OLD."status" = 'PENDING' AND NEW."status" IN ('RUNNING', 'CANCELLED') THEN
    RETURN NEW;
  END IF;
  IF OLD."status" = 'RUNNING' AND NEW."status" IN ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'invalid AIJob status transition from % to %', OLD."status", NEW."status"
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AIJob_status_transition"
BEFORE UPDATE OF "status" ON "AIJob"
FOR EACH ROW EXECUTE FUNCTION "enforce_ai_job_status_transition"();

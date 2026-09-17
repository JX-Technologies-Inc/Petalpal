CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" VARCHAR(64) NOT NULL,
    "outcome" VARCHAR(32) NOT NULL,
    "correlationId" VARCHAR(128),
    "actorUserId" VARCHAR(128),
    "targetClass" VARCHAR(64) NOT NULL,
    "targetSafeId" VARCHAR(128),
    "actionCode" VARCHAR(64),
    "reasonCode" VARCHAR(64),
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX "AuditEvent_eventType_createdAt_idx" ON "AuditEvent"("eventType", "createdAt");
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");

-- LEVEL_1_ONLY: application create-only design. Runtime/migration roles and
-- INSERT-only PostgreSQL grants are intentionally deferred to Level 2.

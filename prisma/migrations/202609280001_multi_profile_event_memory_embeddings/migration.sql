-- Expand storage without changing the active legacy embedding path.
CREATE TABLE "EventMemoryEmbedding" (
  "eventMemoryId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "profileKey" VARCHAR(128) NOT NULL,
  "model" VARCHAR(128) NOT NULL,
  "modelRevision" VARCHAR(128) NOT NULL,
  "inputVersion" VARCHAR(32) NOT NULL,
  "inputRevision" INTEGER NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUESTED',
  "embedding" vector(384),
  "embeddedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventMemoryEmbedding_pkey" PRIMARY KEY ("eventMemoryId", "profileKey", "inputRevision"),
  CONSTRAINT "EventMemoryEmbedding_eventMemoryId_ownerId_fkey"
    FOREIGN KEY ("eventMemoryId", "ownerId") REFERENCES "EventMemory"("id", "ownerId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventMemoryEmbedding_inputRevision_check" CHECK ("inputRevision" > 0),
  CONSTRAINT "EventMemoryEmbedding_status_check"
    CHECK ("status" IN ('NOT_REQUESTED', 'GENERATING', 'GENERATED', 'FAILED')),
  CONSTRAINT "EventMemoryEmbedding_shape_check"
    CHECK (
      ("status" = 'GENERATED' AND "embedding" IS NOT NULL AND "embeddedAt" IS NOT NULL)
      OR ("status" <> 'GENERATED' AND "embedding" IS NULL AND "embeddedAt" IS NULL)
    )
);

CREATE INDEX "EventMemoryEmbedding_ownerId_profileKey_status_idx"
  ON "EventMemoryEmbedding"("ownerId", "profileKey", "status");

CREATE UNIQUE INDEX "EventMemoryEmbedding_one_generated_profile_idx"
  ON "EventMemoryEmbedding"("eventMemoryId", "profileKey")
  WHERE "status" = 'GENERATED';

-- Existing local vectors remain in EventMemory for old application instances
-- and immediate rollback. Only complete, current generations are copied.
INSERT INTO "EventMemoryEmbedding" (
  "eventMemoryId", "ownerId", "profileKey", "model", "modelRevision",
  "inputVersion", "inputRevision", "status", "embedding", "embeddedAt",
  "createdAt", "updatedAt"
)
SELECT
  memory."id", memory."ownerId", memory."embeddingProfileKey", memory."embeddingModel",
  memory."embeddingModelRevision", memory."embeddingInputVersion",
  memory."embeddedInputRevision", 'GENERATED', memory."embedding", memory."embeddedAt",
  memory."embeddedAt", memory."updatedAt"
FROM "EventMemory" AS memory
WHERE memory."embeddingStatus" = 'GENERATED'
  AND memory."embedding" IS NOT NULL
  AND memory."embeddedInputRevision" = memory."embeddingInputRevision"
  AND memory."embeddingProfileKey" IS NOT NULL
  AND memory."embeddingModel" IS NOT NULL
  AND memory."embeddingModelRevision" IS NOT NULL
  AND memory."embeddingInputVersion" IS NOT NULL
  AND memory."embeddedAt" IS NOT NULL;

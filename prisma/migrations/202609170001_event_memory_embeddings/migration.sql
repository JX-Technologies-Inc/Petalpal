-- Store the selected English-only BGE Event embeddings on EventMemory.
-- Retrieval intentionally uses exact cosine distance at the current scale;
-- no ANN index is introduced in this phase.

ALTER TABLE "EventMemory"
  ADD COLUMN "embeddingProfileKey" VARCHAR(128),
  ADD COLUMN "embeddingModelRevision" VARCHAR(128),
  ADD COLUMN "embeddingInputVersion" VARCHAR(32),
  ADD COLUMN "embeddingInputRevision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "embeddedInputRevision" INTEGER,
  ADD COLUMN "embedding" vector(384),
  ADD COLUMN "embeddedAt" TIMESTAMP(3);

-- Older rows could only record a status, not a persisted vector. Normalize
-- those placeholders before enforcing the storage lifecycle.
UPDATE "EventMemory"
SET "embeddingStatus" = 'NOT_REQUESTED',
    "embeddingModel" = NULL
WHERE "embeddingStatus" <> 'NOT_REQUESTED';

ALTER TABLE "EventMemory"
  ADD CONSTRAINT "EventMemory_embedding_input_revision_check"
    CHECK ("embeddingInputRevision" > 0),
  ADD CONSTRAINT "EventMemory_embedding_status_check"
    CHECK ("embeddingStatus" IN ('NOT_REQUESTED', 'GENERATING', 'GENERATED', 'FAILED')),
  ADD CONSTRAINT "EventMemory_embedding_shape_check"
    CHECK (
      (
        "embeddingStatus" = 'GENERATED'
        AND "embedding" IS NOT NULL
        AND "embeddingModel" IS NOT NULL
        AND "embeddingProfileKey" IS NOT NULL
        AND "embeddingModelRevision" IS NOT NULL
        AND "embeddingInputVersion" IS NOT NULL
        AND "embeddedInputRevision" = "embeddingInputRevision"
        AND "embeddedAt" IS NOT NULL
      )
      OR
      "embeddingStatus" <> 'GENERATED'
    );

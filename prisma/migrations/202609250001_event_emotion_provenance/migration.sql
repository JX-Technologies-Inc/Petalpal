ALTER TABLE "Event"
  ADD COLUMN "emotionOutcome" VARCHAR(32) NOT NULL DEFAULT 'SKIPPED',
  ADD COLUMN "emotionProvenance" VARCHAR(32),
  ADD COLUMN "emotionModelId" VARCHAR(128),
  ADD COLUMN "emotionModelVersion" VARCHAR(128),
  ADD COLUMN "emotionModelStatus" VARCHAR(32),
  ADD COLUMN "emotionProbabilities" JSONB;

ALTER TABLE "EventMemory"
  ADD COLUMN "emotionOutcome" VARCHAR(32),
  ADD COLUMN "emotionProvenance" VARCHAR(32),
  ADD COLUMN "emotionModelId" VARCHAR(128),
  ADD COLUMN "emotionModelStatus" VARCHAR(32),
  ADD COLUMN "emotionProbabilities" JSONB;

ALTER TABLE "EmotionResult"
ADD COLUMN "secondaryEmotions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "inferencePath" VARCHAR(32) NOT NULL DEFAULT 'NO_AI';

UPDATE "EmotionResult"
SET "secondaryEmotions" = CASE
  WHEN "secondaryEmotion" IS NULL THEN '[]'::jsonb
  ELSE jsonb_build_array("secondaryEmotion")
END,
"inferencePath" = CASE
  WHEN "modelVersion" LIKE '%natural%' THEN 'LOCAL_CLASSIFIER'
  WHEN "modelVersion" LIKE '%llama%' THEN 'FAST_LLM_FALLBACK'
  WHEN "modelVersion" LIKE '%keyword%' THEN 'DETERMINISTIC_FALLBACK'
  ELSE 'NO_AI'
END;

ALTER TABLE "AiInteractionMetadata"
ADD COLUMN "inferencePath" VARCHAR(32);

UPDATE "AiInteractionMetadata"
SET "inferencePath" = CASE
  WHEN "provider" = 'LOCAL' THEN 'LOCAL_CLASSIFIER'
  WHEN "provider" = 'CLOUDFLARE_WORKERS_AI' THEN 'FAST_LLM_FALLBACK'
  WHEN "provider" = 'DETERMINISTIC' THEN 'DETERMINISTIC_FALLBACK'
  ELSE NULL
END;

CREATE INDEX "EmotionResult_inferencePath_createdAt_idx"
ON "EmotionResult"("inferencePath", "createdAt");

CREATE INDEX "AiInteractionMetadata_inferencePath_createdAt_idx"
ON "AiInteractionMetadata"("inferencePath", "createdAt");

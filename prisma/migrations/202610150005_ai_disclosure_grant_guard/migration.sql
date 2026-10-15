-- Apply during the quiesced rollout, before any API/worker is resumed.
-- Keep the four original migrations immutable. Retire invalid grants that an
-- old server may have written since migration 003, then enforce the new floor.
BEGIN;
WITH revoked AS (
 UPDATE "AiConsent" SET "aiProcessing"=false,"personalization"=false,"memoryEnabled"=false,
  "revokedAt"=CURRENT_TIMESTAMP,"updatedAt"=GREATEST(CURRENT_TIMESTAMP,"updatedAt"+INTERVAL '1 millisecond')
 WHERE "termsVersion" <> 'ai-2026-10-15' AND ("aiProcessing" OR "personalization" OR "memoryEnabled")
 RETURNING "userId"
)
UPDATE "AIJob" SET status='CANCELLED',"completedAt"=CURRENT_TIMESTAMP,"lockedAt"=NULL,"lockedBy"=NULL,
 "leaseExpiresAt"=NULL,"lastError"='Consent disclosure changed'
FROM revoked WHERE "AIJob"."ownerId"=revoked."userId" AND status IN ('PENDING','RUNNING');
ALTER TABLE "AiConsent" ADD CONSTRAINT "AiConsent_disclosure_grant_guard"
 CHECK (NOT ("aiProcessing" OR "personalization" OR "memoryEnabled") OR "termsVersion"='ai-2026-10-15');
COMMIT;

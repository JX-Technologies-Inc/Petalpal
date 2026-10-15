ALTER TABLE "Report" ADD COLUMN "aiOutputKind" VARCHAR(16), ADD COLUMN "aiOutputId" VARCHAR(128);
-- Existing grants lacked the processor disclosure. Re-consent is required.
-- Row locks and a new epoch fence dispatch/results using the existing protocol.
UPDATE "AiConsent" SET "aiProcessing"=false,"personalization"=false,"memoryEnabled"=false,
 "revokedAt"=CURRENT_TIMESTAMP,"updatedAt"=GREATEST(CURRENT_TIMESTAMP,"updatedAt"+INTERVAL '1 millisecond');
UPDATE "AIJob" SET status='CANCELLED',"completedAt"=CURRENT_TIMESTAMP,"lockedAt"=NULL,"lockedBy"=NULL,"leaseExpiresAt"=NULL,"lastError"='Consent disclosure changed'
 WHERE status IN ('PENDING','RUNNING');

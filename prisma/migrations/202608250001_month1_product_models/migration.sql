-- Month 1 product models. Existing flowers remain valid legacy records and can
-- be backfilled later because dailyCheckInId is intentionally nullable.

CREATE TYPE "EmotionSource" AS ENUM ('USER', 'MODEL');
CREATE TYPE "ReportCategory" AS ENUM ('HARASSMENT', 'HATE_SPEECH', 'SELF_HARM', 'SPAM', 'PRIVACY', 'OTHER');
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED');
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PREMIUM');
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'GRACE_PERIOD', 'EXPIRED', 'CANCELED');

ALTER TABLE "Flower" DROP CONSTRAINT "Flower_userId_fkey";
ALTER TABLE "Flower" DROP CONSTRAINT "Flower_gardenId_fkey";
ALTER TABLE "Flower" ADD COLUMN "dailyCheckInId" TEXT;
ALTER TABLE "User" ADD COLUMN "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC';

CREATE TABLE "DailyCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" VARCHAR(10) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Journal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyCheckInId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmotionResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyCheckInId" TEXT NOT NULL,
    "label" VARCHAR(32) NOT NULL,
    "source" "EmotionSource" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "modelVersion" VARCHAR(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmotionResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FairyState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "onboardingStep" VARCHAR(64) NOT NULL DEFAULT 'EMPTY_GARDEN',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "lastEvent" VARCHAR(64),
    "unlockedFeatures" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FairyState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "messageId" TEXT,
    "category" "ReportCategory" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsVersion" VARCHAR(32) NOT NULL,
    "aiProcessing" BOOLEAN NOT NULL DEFAULT false,
    "personalization" BOOLEAN NOT NULL DEFAULT false,
    "memoryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiInteractionMetadata" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyCheckInId" TEXT,
    "task" VARCHAR(64) NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "model" VARCHAR(128) NOT NULL,
    "inputHash" VARCHAR(64),
    "outputLabel" VARCHAR(64),
    "confidence" DOUBLE PRECISION,
    "latencyMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorCode" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiInteractionMetadata_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "source" VARCHAR(32),
    "externalCustomerId" VARCHAR(191),
    "externalSubscriptionId" VARCHAR(191),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DailyCheckIn_userId_createdAt_idx" ON "DailyCheckIn"("userId", "createdAt");
CREATE UNIQUE INDEX "DailyCheckIn_userId_localDate_key" ON "DailyCheckIn"("userId", "localDate");
CREATE UNIQUE INDEX "Journal_dailyCheckInId_key" ON "Journal"("dailyCheckInId");
CREATE INDEX "Journal_userId_createdAt_idx" ON "Journal"("userId", "createdAt");
CREATE UNIQUE INDEX "EmotionResult_dailyCheckInId_key" ON "EmotionResult"("dailyCheckInId");
CREATE INDEX "EmotionResult_userId_createdAt_idx" ON "EmotionResult"("userId", "createdAt");
CREATE UNIQUE INDEX "FairyState_userId_key" ON "FairyState"("userId");
CREATE INDEX "Report_reporterId_createdAt_idx" ON "Report"("reporterId", "createdAt");
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
CREATE UNIQUE INDEX "AiConsent_userId_key" ON "AiConsent"("userId");
CREATE INDEX "AiInteractionMetadata_userId_createdAt_idx" ON "AiInteractionMetadata"("userId", "createdAt");
CREATE INDEX "AiInteractionMetadata_task_createdAt_idx" ON "AiInteractionMetadata"("task", "createdAt");
CREATE UNIQUE INDEX "SubscriptionEntitlement_userId_key" ON "SubscriptionEntitlement"("userId");
CREATE UNIQUE INDEX "SubscriptionEntitlement_externalCustomerId_key" ON "SubscriptionEntitlement"("externalCustomerId");
CREATE UNIQUE INDEX "SubscriptionEntitlement_externalSubscriptionId_key" ON "SubscriptionEntitlement"("externalSubscriptionId");
CREATE UNIQUE INDEX "Flower_dailyCheckInId_key" ON "Flower"("dailyCheckInId");

ALTER TABLE "Flower" ADD CONSTRAINT "Flower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Flower" ADD CONSTRAINT "Flower_gardenId_fkey" FOREIGN KEY ("gardenId") REFERENCES "Garden"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Flower" ADD CONSTRAINT "Flower_dailyCheckInId_fkey" FOREIGN KEY ("dailyCheckInId") REFERENCES "DailyCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyCheckIn" ADD CONSTRAINT "DailyCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_dailyCheckInId_fkey" FOREIGN KEY ("dailyCheckInId") REFERENCES "DailyCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmotionResult" ADD CONSTRAINT "EmotionResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmotionResult" ADD CONSTRAINT "EmotionResult_dailyCheckInId_fkey" FOREIGN KEY ("dailyCheckInId") REFERENCES "DailyCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FairyState" ADD CONSTRAINT "FairyState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiConsent" ADD CONSTRAINT "AiConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiInteractionMetadata" ADD CONSTRAINT "AiInteractionMetadata_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiInteractionMetadata" ADD CONSTRAINT "AiInteractionMetadata_dailyCheckInId_fkey" FOREIGN KEY ("dailyCheckInId") REFERENCES "DailyCheckIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlement" ADD CONSTRAINT "SubscriptionEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill safe defaults for accounts that predate these models.
INSERT INTO "FairyState" ("id", "userId", "updatedAt")
SELECT 'fairy_' || "id", "id", CURRENT_TIMESTAMP FROM "User"
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "AiConsent" ("id", "userId", "termsVersion", "updatedAt")
SELECT 'consent_' || "id", "id", '2026-08-25', CURRENT_TIMESTAMP FROM "User"
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "SubscriptionEntitlement" ("id", "userId", "updatedAt")
SELECT 'entitlement_' || "id", "id", CURRENT_TIMESTAMP FROM "User"
ON CONFLICT ("userId") DO NOTHING;

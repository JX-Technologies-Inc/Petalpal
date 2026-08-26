CREATE TABLE "UserFairy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fairyType" VARCHAR(64) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "unlockSource" VARCHAR(32) NOT NULL,
    "unlockMonth" VARCHAR(7),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "level" INTEGER NOT NULL DEFAULT 1,
    "progression" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserFairy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FairyRuntime" (
    "id" TEXT NOT NULL,
    "userFairyId" TEXT NOT NULL,
    "currentState" VARCHAR(32) NOT NULL DEFAULT 'IDLE',
    "currentLocation" VARCHAR(32) NOT NULL DEFAULT 'DEFAULT_AREA',
    "previousState" VARCHAR(32),
    "previousLocation" VARCHAR(32),
    "stateStartedAt" TIMESTAMP(3),
    "nextTransitionAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "transitionId" VARCHAR(64),
    "runtimeVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FairyRuntime_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FairyMonthlyProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "activeDays" INTEGER NOT NULL DEFAULT 0,
    "requiredDays" INTEGER NOT NULL,
    "unlockedThisMonth" BOOLEAN NOT NULL DEFAULT false,
    "unlockedFairyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FairyMonthlyProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserFairy_userId_fairyType_key" ON "UserFairy"("userId", "fairyType");
CREATE UNIQUE INDEX "UserFairy_userId_unlockMonth_key" ON "UserFairy"("userId", "unlockMonth");
CREATE INDEX "UserFairy_userId_unlockedAt_idx" ON "UserFairy"("userId", "unlockedAt");
CREATE UNIQUE INDEX "UserFairy_one_active_per_user" ON "UserFairy"("userId") WHERE "isActive" = true;
CREATE UNIQUE INDEX "FairyRuntime_userFairyId_key" ON "FairyRuntime"("userFairyId");
CREATE UNIQUE INDEX "FairyMonthlyProgress_unlockedFairyId_key" ON "FairyMonthlyProgress"("unlockedFairyId");
CREATE UNIQUE INDEX "FairyMonthlyProgress_userId_month_key" ON "FairyMonthlyProgress"("userId", "month");
CREATE INDEX "FairyMonthlyProgress_userId_month_idx" ON "FairyMonthlyProgress"("userId", "month");

ALTER TABLE "UserFairy" ADD CONSTRAINT "UserFairy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FairyRuntime" ADD CONSTRAINT "FairyRuntime_userFairyId_fkey" FOREIGN KEY ("userFairyId") REFERENCES "UserFairy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FairyMonthlyProgress" ADD CONSTRAINT "FairyMonthlyProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FairyMonthlyProgress" ADD CONSTRAINT "FairyMonthlyProgress_unlockedFairyId_fkey" FOREIGN KEY ("unlockedFairyId") REFERENCES "UserFairy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing users receive the same starter Fairy exactly once.
INSERT INTO "UserFairy" (
    "id", "userId", "fairyType", "name", "unlockSource", "isActive", "updatedAt"
)
SELECT
    'starter_fairy_' || "User"."id", "User"."id", 'BLOOM', 'Bloom', 'ONBOARDING', true, CURRENT_TIMESTAMP
FROM "User"
JOIN "FairyState" ON "FairyState"."userId" = "User"."id"
WHERE "FairyState"."onboardingCompleted" = true
ON CONFLICT ("userId", "fairyType") DO NOTHING;

INSERT INTO "FairyRuntime" ("id", "userFairyId", "updatedAt")
SELECT 'runtime_' || "id", "id", CURRENT_TIMESTAMP
FROM "UserFairy"
ON CONFLICT ("userFairyId") DO NOTHING;

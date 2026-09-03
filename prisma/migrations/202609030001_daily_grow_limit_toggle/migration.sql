ALTER TABLE "DailyCheckIn"
ADD COLUMN "dailyLimitEnforced" BOOLEAN NOT NULL DEFAULT true;

DROP INDEX "DailyCheckIn_userId_localDate_key";

CREATE UNIQUE INDEX "DailyCheckIn_one_enforced_grow_per_day_key"
ON "DailyCheckIn"("userId", "localDate")
WHERE "dailyLimitEnforced" = true;

ALTER TABLE "Event" ADD COLUMN "primaryGardenMood" VARCHAR(32), ADD COLUMN "secondaryEmotions" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "emotionStatus" VARCHAR(16) NOT NULL DEFAULT 'SKIPPED';
ALTER TABLE "Flower" ADD COLUMN "sourceEventId" TEXT;
CREATE UNIQUE INDEX "Flower_sourceEventId_key" ON "Flower"("sourceEventId");
CREATE UNIQUE INDEX "Flower_sourceEventId_userId_key" ON "Flower"("sourceEventId", "userId");
ALTER TABLE "Flower" ADD CONSTRAINT "Flower_sourceEventId_userId_fkey" FOREIGN KEY ("sourceEventId", "userId") REFERENCES "Event"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

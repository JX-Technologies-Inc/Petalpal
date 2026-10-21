-- AlterTable
ALTER TABLE "UserFairy" ADD COLUMN     "momentsSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FairyMoment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userFairyId" TEXT NOT NULL,
    "runtimeVersion" INTEGER NOT NULL,
    "state" VARCHAR(32) NOT NULL,
    "photoKey" VARCHAR(64) NOT NULL,
    "caption" VARCHAR(280) NOT NULL,
    "captionSource" VARCHAR(16) NOT NULL DEFAULT 'FALLBACK',
    "postedAt" TIMESTAMP(3) NOT NULL,
    "likedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FairyMoment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FairyMoment_userId_postedAt_idx" ON "FairyMoment"("userId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FairyMoment_userFairyId_runtimeVersion_key" ON "FairyMoment"("userFairyId", "runtimeVersion");

-- AddForeignKey
ALTER TABLE "FairyMoment" ADD CONSTRAINT "FairyMoment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairyMoment" ADD CONSTRAINT "FairyMoment_userFairyId_fkey" FOREIGN KEY ("userFairyId") REFERENCES "UserFairy"("id") ON DELETE CASCADE ON UPDATE CASCADE;


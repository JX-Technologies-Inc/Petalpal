-- CreateTable
CREATE TABLE "FairyCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" VARCHAR(10) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "streak" INTEGER NOT NULL,
    "graceUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FairyCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FairyKeepsakeGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkInId" TEXT,
    "keepsakeId" VARCHAR(48) NOT NULL,
    "reason" VARCHAR(16) NOT NULL,
    "localDate" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FairyKeepsakeGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FairyClosenessAward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" VARCHAR(16) NOT NULL,
    "awardKey" VARCHAR(96) NOT NULL,
    "localDate" VARCHAR(10) NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FairyClosenessAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FairyCheckIn_userId_localDate_key" ON "FairyCheckIn"("userId", "localDate");

-- CreateIndex
CREATE INDEX "FairyKeepsakeGrant_userId_keepsakeId_idx" ON "FairyKeepsakeGrant"("userId", "keepsakeId");

-- CreateIndex
CREATE UNIQUE INDEX "FairyKeepsakeGrant_userId_localDate_reason_key" ON "FairyKeepsakeGrant"("userId", "localDate", "reason");

-- CreateIndex
CREATE INDEX "FairyClosenessAward_userId_localDate_idx" ON "FairyClosenessAward"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "FairyClosenessAward_userId_source_awardKey_key" ON "FairyClosenessAward"("userId", "source", "awardKey");

-- AddForeignKey
ALTER TABLE "FairyCheckIn" ADD CONSTRAINT "FairyCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairyKeepsakeGrant" ADD CONSTRAINT "FairyKeepsakeGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairyKeepsakeGrant" ADD CONSTRAINT "FairyKeepsakeGrant_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "FairyCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairyClosenessAward" ADD CONSTRAINT "FairyClosenessAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


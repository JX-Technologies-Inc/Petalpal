-- CreateTable
CREATE TABLE "DailyFlowerQuota" (
    "userId" TEXT NOT NULL,
    "localDate" VARCHAR(10) NOT NULL,
    "planted" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyFlowerQuota_pkey" PRIMARY KEY ("userId","localDate")
);

-- AddForeignKey
ALTER TABLE "DailyFlowerQuota" ADD CONSTRAINT "DailyFlowerQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

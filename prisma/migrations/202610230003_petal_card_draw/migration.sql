-- CreateTable
CREATE TABLE "PetalCardDraw" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" VARCHAR(10) NOT NULL,
    "position" INTEGER NOT NULL,
    "cardId" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetalCardDraw_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PetalCardDraw_userId_localDate_key" ON "PetalCardDraw"("userId", "localDate");

-- AddForeignKey
ALTER TABLE "PetalCardDraw" ADD CONSTRAINT "PetalCardDraw_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


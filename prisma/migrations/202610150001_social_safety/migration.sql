ALTER TABLE "User" ADD COLUMN "socialRestricted" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "UserBlock" (
 "blockerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "blockedId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("blockerId", "blockedId"),
 CHECK ("blockerId" <> "blockedId")
);
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

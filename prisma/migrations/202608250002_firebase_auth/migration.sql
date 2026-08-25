ALTER TABLE "User"
ADD COLUMN "firebaseUid" TEXT,
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

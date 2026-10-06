-- Preserve existing friend visit access; owners may opt out in Settings.
ALTER TABLE "User" ADD COLUMN "allowGardenVisits" BOOLEAN NOT NULL DEFAULT true;

-- Allow standalone private journals; preserve all existing links, indexes and foreign keys.
ALTER TABLE "Journal" ALTER COLUMN "dailyCheckInId" DROP NOT NULL;

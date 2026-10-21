-- AlterTable
ALTER TABLE "FairyMoment" ADD COLUMN     "mood" VARCHAR(16),
ADD COLUMN     "spot" VARCHAR(32),
ALTER COLUMN "photoKey" DROP NOT NULL;


CREATE TYPE "AIReportNarrativeStatus" AS ENUM (
  'NOT_GENERATED',
  'GENERATED',
  'INSUFFICIENT_EVIDENCE'
);

ALTER TABLE "WeeklyReport"
  ADD COLUMN "narrativeStatus" "AIReportNarrativeStatus" NOT NULL DEFAULT 'NOT_GENERATED',
  ADD COLUMN "narrativeSections" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "MonthlyReport"
  ADD COLUMN "narrativeStatus" "AIReportNarrativeStatus" NOT NULL DEFAULT 'NOT_GENERATED',
  ADD COLUMN "narrativeSections" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "WeeklyReport"
  ADD CONSTRAINT "WeeklyReport_narrative_outcome_check"
  CHECK (
    "narrativeStatus" = 'NOT_GENERATED'
    OR ("narrativeStatus" = 'GENERATED' AND "summary" IS NOT NULL)
    OR ("narrativeStatus" = 'INSUFFICIENT_EVIDENCE' AND "summary" IS NULL)
  );

ALTER TABLE "MonthlyReport"
  ADD CONSTRAINT "MonthlyReport_narrative_outcome_check"
  CHECK (
    "narrativeStatus" = 'NOT_GENERATED'
    OR ("narrativeStatus" = 'GENERATED' AND "summary" IS NOT NULL)
    OR ("narrativeStatus" = 'INSUFFICIENT_EVIDENCE' AND "summary" IS NULL)
  );

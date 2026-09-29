-- Extend the existing social visit history. Old visits and received-Support
-- totals cannot be reliably assigned to flowers, so leave them intact.
ALTER TABLE "VisitRecord"
    ADD COLUMN "flowerId" TEXT,
    ADD COLUMN "localDate" VARCHAR(10),
    ADD COLUMN "timezone" VARCHAR(64);

CREATE UNIQUE INDEX "VisitRecord_visitorId_flowerId_localDate_key"
    ON "VisitRecord"("visitorId", "flowerId", "localDate");

ALTER TABLE "VisitRecord" ADD CONSTRAINT "VisitRecord_flowerId_fkey"
    FOREIGN KEY ("flowerId") REFERENCES "Flower"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

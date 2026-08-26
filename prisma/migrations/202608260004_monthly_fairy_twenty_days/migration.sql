-- Product rule: every monthly Fairy requires 20 distinct local active days.
-- Previously unlocked rewards remain owned and idempotent; only the recorded
-- requirement is normalized.
UPDATE "FairyMonthlyProgress"
SET "requiredDays" = 20
WHERE "requiredDays" <> 20;

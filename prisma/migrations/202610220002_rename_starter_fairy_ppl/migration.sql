-- The starter Fairy is now called PPL. Rename existing starter Fairies that still carry
-- the old default name; nothing else changes.
UPDATE "UserFairy" SET "name" = 'PPL' WHERE "fairyType" = 'BLOOM' AND "name" = 'Bloom';

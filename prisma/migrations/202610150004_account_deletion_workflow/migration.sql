CREATE TABLE "AccountDeletion" (
 "userId" TEXT PRIMARY KEY,
 "firebaseUid" TEXT NOT NULL UNIQUE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "completedAt" TIMESTAMP(3)
);
-- Registration/relink and erasure serialize even across backend instances.
CREATE FUNCTION prevent_deleted_identity_recreation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(73001605);
 IF NEW."firebaseUid" IS NOT NULL AND EXISTS(SELECT 1 FROM "AccountDeletion" WHERE "firebaseUid"=NEW."firebaseUid") THEN
   RAISE EXCEPTION 'Identity deletion is pending or complete' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "User_deleted_identity_guard" BEFORE INSERT OR UPDATE OF "firebaseUid" ON "User"
 FOR EACH ROW EXECUTE FUNCTION prevent_deleted_identity_recreation();

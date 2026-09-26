import assert from "node:assert/strict";
import test from "node:test";
import { deleteAccountDataInTransaction } from "../../lib/account-deletion.js";

test("E2E cleanup rejects a mismatched test email or Firebase UID before deleting rows", async () => {
  let deleted = false;
  const tx = {
    user: {
      findUnique: async () => ({ id: "test-user", email: "someone-else@example.com", firebaseUid: "different-uid" }),
      delete: async () => { deleted = true; }
    }
  };
  await assert.rejects(
    deleteAccountDataInTransaction(tx, { id: "test-user", expectedEmail: "test@example.com", expectedFirebaseUid: "test-uid" }),
    /email does not match/
  );
  assert.equal(deleted, false);
  tx.user.findUnique = async () => ({ id: "test-user", email: "test@example.com", firebaseUid: "different-uid" });
  await assert.rejects(
    deleteAccountDataInTransaction(tx, { id: "test-user", expectedEmail: "test@example.com", expectedFirebaseUid: "test-uid" }),
    /UID does not match/
  );
  assert.equal(deleted, false);
});

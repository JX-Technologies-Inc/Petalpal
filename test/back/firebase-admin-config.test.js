import assert from "node:assert/strict";
import test from "node:test";
import { deleteFirebaseUser, readFirebaseAdminConfig } from "../../lib/firebase-admin.js";

test("reads a Firebase service account JSON for Render", () => {
  const config = readFirebaseAdminConfig({
    FIREBASE_PROJECT_ID: "petalpal-test",
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
      project_id: "petalpal-test",
      client_email: "firebase-admin@example.com",
      private_key: "line-one\\nline-two"
    })
  });
  assert.equal(config.projectId, "petalpal-test");
  assert.equal(config.serviceAccount.client_email, "firebase-admin@example.com");
  assert.equal(config.serviceAccount.private_key, "line-one\nline-two");
});

test("supports split Firebase Admin variables", () => {
  const config = readFirebaseAdminConfig({
    FIREBASE_PROJECT_ID: "petalpal-test",
    FIREBASE_CLIENT_EMAIL: "firebase-admin@example.com",
    FIREBASE_PRIVATE_KEY: "line-one\\nline-two"
  });
  assert.equal(config.serviceAccount.project_id, "petalpal-test");
  assert.equal(config.serviceAccount.private_key, "line-one\nline-two");
});

test("rejects partial Firebase Admin credentials", () => {
  assert.throws(
    () => readFirebaseAdminConfig({ FIREBASE_CLIENT_EMAIL: "firebase-admin@example.com" }),
    /must be configured together/
  );
});

test("Firebase user deletion treats user-not-found as idempotent success", async () => {
  await assert.doesNotReject(deleteFirebaseUser("missing", {
    deleteUser: async () => {
      throw Object.assign(new Error("missing"), { code: "auth/user-not-found" });
    }
  }));
  await assert.rejects(
    deleteFirebaseUser("failed", {
      deleteUser: async () => { throw new Error("Firebase unavailable"); }
    }),
    /Firebase unavailable/
  );
});

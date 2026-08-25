import assert from "node:assert/strict";
import test from "node:test";

const {
  authenticateFirebaseIdentity,
  requireOwnUser,
  setFirebaseTokenVerifierForTests
} = await import("../../lib/auth.js");

function runIdentityAuthentication(authorization) {
  return new Promise((resolve) => {
    const request = { get: () => authorization };
    const response = {
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ statusCode: this.statusCode, body }); }
    };
    authenticateFirebaseIdentity(request, response, () => {
      resolve({ statusCode: 200, firebase: request.firebase });
    });
  });
}

test("Firebase identity middleware trusts verified token claims only", async () => {
  setFirebaseTokenVerifierForTests(async (token) => {
    if (token !== "valid-firebase-token") throw new Error("invalid");
    return {
      uid: "firebase-user-1",
      email: "petal@example.com",
      email_verified: true,
      firebase: { sign_in_provider: "google.com" }
    };
  });

  assert.equal((await runIdentityAuthentication()).statusCode, 401);
  assert.equal((await runIdentityAuthentication("Bearer invalid")).statusCode, 401);
  assert.deepEqual(
    await runIdentityAuthentication("Bearer valid-firebase-token"),
    {
      statusCode: 200,
      firebase: {
        uid: "firebase-user-1",
        email: "petal@example.com",
        emailVerified: true,
        name: null,
        picture: null,
        provider: "google.com"
      }
    }
  );
});

test("resource ownership cannot be asserted for another PetalPal user", () => {
  const request = { auth: { userId: "user-1", firebaseUid: "firebase-1" } };
  let statusCode;
  const response = {
    status(code) { statusCode = code; return this; },
    json() {}
  };
  assert.equal(requireOwnUser(request, response, "user-1"), true);
  assert.equal(requireOwnUser(request, response, "user-2"), false);
  assert.equal(statusCode, 403);
});

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
  setFirebaseTokenVerifierForTests();
});

test("Firebase verification failures identify missing Admin credentials without logging tokens", async () => {
  const claims = { iss: "https://securetoken.google.com/petalpal-b212c", aud: "petalpal-b212c", exp: 2_000_000_000 };
  const token = `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
  const originalLog = console.info;
  const originalDiagnostics = process.env.FIREBASE_AUTH_DIAGNOSTICS;
  process.env.FIREBASE_AUTH_DIAGNOSTICS = "1";
  const logs = [];
  console.info = (...args) => logs.push(args);
  setFirebaseTokenVerifierForTests(async () => { throw Object.assign(new Error("credential unavailable"), { code: "app/invalid-credential" }); });
  try {
    const response = await runIdentityAuthentication(`Bearer ${token}`);
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, {
      error: "Authentication service unavailable",
      firebaseErrorCode: "app/invalid-credential",
      firebaseErrorMessage: "credential unavailable",
      reason: "admin_credential_unavailable"
    });
    assert.equal(logs[0][1].issuer, claims.iss);
    assert.equal(logs[0][1].audience, claims.aud);
    assert.equal(logs[0][1].expectedProjectId, "petalpal-b212c");
    assert.equal(logs[0][1].expirationTimestamp, claims.exp);
    assert.equal(logs[0][1].reason, "admin_credential_unavailable");
    assert.equal(logs[0][1].firebaseErrorCode, "app/invalid-credential");
    assert.equal(logs[0][1].firebaseErrorMessage, "credential unavailable");
    assert.equal(JSON.stringify(logs).includes(token), false);
  } finally {
    console.info = originalLog;
    if (originalDiagnostics === undefined) delete process.env.FIREBASE_AUTH_DIAGNOSTICS;
    else process.env.FIREBASE_AUTH_DIAGNOSTICS = originalDiagnostics;
    setFirebaseTokenVerifierForTests();
  }
});

test("invalid Firebase user tokens remain 401 rather than Admin configuration failures", async () => {
  const originalDiagnostics = process.env.FIREBASE_AUTH_DIAGNOSTICS;
  process.env.FIREBASE_AUTH_DIAGNOSTICS = "1";
  setFirebaseTokenVerifierForTests(async () => {
    throw Object.assign(new Error("Firebase ID token has invalid signature."), { code: "auth/invalid-id-token" });
  });
  try {
    const claims = { iss: "https://securetoken.google.com/petalpal-b212c", aud: "petalpal-b212c", exp: 2_000_000_000 };
    const invalidToken = `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.bad-signature`;
    const response = await runIdentityAuthentication(`Bearer ${invalidToken}`);
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.firebaseErrorCode, "auth/invalid-id-token");
    assert.equal(response.body.reason, "invalid_token");
  } finally {
    if (originalDiagnostics === undefined) delete process.env.FIREBASE_AUTH_DIAGNOSTICS;
    else process.env.FIREBASE_AUTH_DIAGNOSTICS = originalDiagnostics;
    setFirebaseTokenVerifierForTests();
  }
});

test("Firebase token failures distinguish revoked, expired, and wrong-project tokens", async () => {
  const originalDiagnostics = process.env.FIREBASE_AUTH_DIAGNOSTICS;
  process.env.FIREBASE_AUTH_DIAGNOSTICS = "1";
  const baseClaims = { iss: "https://securetoken.google.com/petalpal-b212c", aud: "petalpal-b212c", exp: 2_000_000_000 };
  const tokenFor = (claims) => `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
  try {
    for (const [errorCode, claims, expectedReason] of [
      ["auth/id-token-revoked", baseClaims, "revoked_token"],
      ["auth/id-token-expired", { ...baseClaims, exp: 1 }, "expired_token"],
      ["auth/invalid-id-token", { ...baseClaims, aud: "other-project" }, "wrong_audience"]
    ]) {
      setFirebaseTokenVerifierForTests(async () => {
        throw Object.assign(new Error("Firebase rejected this ID token"), { code: errorCode });
      });
      const response = await runIdentityAuthentication(`Bearer ${tokenFor(claims)}`);
      assert.equal(response.statusCode, 401);
      assert.equal(response.body.reason, expectedReason);
      assert.equal(response.body.firebaseErrorCode, errorCode);
    }
  } finally {
    if (originalDiagnostics === undefined) delete process.env.FIREBASE_AUTH_DIAGNOSTICS;
    else process.env.FIREBASE_AUTH_DIAGNOSTICS = originalDiagnostics;
    setFirebaseTokenVerifierForTests();
  }
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

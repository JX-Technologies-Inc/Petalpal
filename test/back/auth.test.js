import assert from "node:assert/strict";
import test from "node:test";

const {
  authenticateFirebaseIdentity,
  requireOwnUser,
  requireRecentAuthentication,
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
        authTime: null,
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
      error: "Authentication service unavailable"
    });
    assert.deepEqual(logs[0][1], {
      expectedProjectId: "petalpal-b212c", reason: "admin_credential_unavailable"
    });
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
    assert.deepEqual(response.body, { error: "Invalid or expired Firebase token" });
  } finally {
    if (originalDiagnostics === undefined) delete process.env.FIREBASE_AUTH_DIAGNOSTICS;
    else process.env.FIREBASE_AUTH_DIAGNOSTICS = originalDiagnostics;
    setFirebaseTokenVerifierForTests();
  }
});

test("Firebase token failures keep revoked, expired, and wrong-project details private", async () => {
  const originalLog = console.info;
  const logs = [];
  console.info = (...args) => logs.push(args);
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
      assert.deepEqual(response.body, { error: "Invalid or expired Firebase token" });
      assert.equal(logs.at(-1)[1].reason, expectedReason);
      assert.deepEqual(Object.keys(logs.at(-1)[1]).sort(), ["expectedProjectId", "reason"]);
    }
  } finally {
    console.info = originalLog;
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

test("unknown, disabled, wrong-password and invalid-token failures never disclose provider detail, even with diagnostics enabled", async () => {
  const originalDiagnostics = process.env.FIREBASE_AUTH_DIAGNOSTICS;
  process.env.FIREBASE_AUTH_DIAGNOSTICS = "1";
  try {
    for (const code of ["auth/user-not-found", "auth/user-disabled", "auth/wrong-password", "auth/invalid-credential", "auth/invalid-id-token"]) {
      setFirebaseTokenVerifierForTests(async () => { throw Object.assign(new Error("known@example.test private diagnostic"), { code }); });
      assert.deepEqual(await runIdentityAuthentication("Bearer synthetic-invalid-token"), {
        statusCode: 401, body: { error: "Invalid or expired Firebase token" }
      });
    }
  } finally {
    if (originalDiagnostics === undefined) delete process.env.FIREBASE_AUTH_DIAGNOSTICS;
    else process.env.FIREBASE_AUTH_DIAGNOSTICS = originalDiagnostics;
    setFirebaseTokenVerifierForTests();
  }
});

test("recent authentication trusts only verified auth_time, not refreshed iat or submitted values", () => {
  for (const authTime of [undefined, null, '1000', 0, -1, 1001, 699, 999.5, NaN, Infinity]) {
    let result;
    const res = { status(status) { result = { status }; return this; }, json(body) { result.body = body; } };
    assert.equal(requireRecentAuthentication({ firebase: { authTime, iat: 1000 }, body: { auth_time: 1000 } }, res, 1000), false);
    assert.deepEqual(result, { status: 403, body: { error: "Sign out and sign in again before deleting your account.", code: "auth/requires-recent-login" } });
  }
  for (const authTime of [700, 999, 1000]) {
    assert.equal(requireRecentAuthentication({ firebase: { authTime } }, { status() { throw new Error('Unexpected rejection'); } }, 1000), true);
  }
});

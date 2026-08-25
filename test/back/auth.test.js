import assert from "node:assert/strict";
import test from "node:test";

process.env.JWT_SECRET = "0123456789abcdef0123456789abcdef";

const {
  authenticateRequest,
  createAccessToken,
  requireOwnUser,
  verifyAccessToken
} = await import("../../lib/auth.js");

function runAuthentication(authorization) {
  return new Promise((resolve) => {
    const request = {
      get: () => authorization
    };
    const response = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ statusCode: this.statusCode, body });
      }
    };

    authenticateRequest(request, response, () => {
      resolve({ statusCode: 200, auth: request.auth });
    });
  });
}

test("access tokens preserve identity and reject tampering", () => {
  const token = createAccessToken({ id: "user-1", name: "Petal" });
  assert.equal(verifyAccessToken(token).sub, "user-1");
  assert.throws(() => verifyAccessToken(`${token}tampered`));
});

test("REST authentication accepts valid bearer tokens only", async () => {
  const token = createAccessToken({ id: "user-1", name: "Petal" });

  assert.equal((await runAuthentication()).statusCode, 401);
  assert.equal((await runAuthentication("Bearer invalid")).statusCode, 401);
  assert.deepEqual(await runAuthentication(`Bearer ${token}`), {
    statusCode: 200,
    auth: { userId: "user-1" }
  });
});

test("resource ownership cannot be asserted for another user", () => {
  const request = { auth: { userId: "user-1" } };
  let statusCode;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json() {}
  };

  assert.equal(requireOwnUser(request, response, "user-1"), true);
  assert.equal(requireOwnUser(request, response, "user-2"), false);
  assert.equal(statusCode, 403);
});

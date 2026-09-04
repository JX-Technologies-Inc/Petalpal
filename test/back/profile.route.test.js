import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../lib/prisma.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { app } from "../../server.js";

test("profile locale is validated, canonicalized and owner-only", async (t) => {
  const originalFindUnique = prisma.user.findUnique;
  const originalUpdate = prisma.user.update;
  let persistedLocale = "en";

  prisma.user.findUnique = async ({ where }) => where.firebaseUid
    ? { id: where.firebaseUid === "owner-firebase" ? "owner-1" : "other-1" }
    : null;
  prisma.user.update = async ({ where, data }) => {
    assert.equal(where.id, "owner-1");
    persistedLocale = data.preferredLocale;
    return {
      id: "owner-1",
      accountId: "PP0001",
      name: "Bloom",
      email: "bloom@example.com",
      avatar: "🦋",
      timezone: "UTC",
      preferredLocale: persistedLocale
    };
  };
  setFirebaseTokenVerifierForTests(async (token) => ({
    uid: token === "owner-token" ? "owner-firebase" : "other-firebase",
    email_verified: true
  }));

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    prisma.user.findUnique = originalFindUnique;
    prisma.user.update = originalUpdate;
    setFirebaseTokenVerifierForTests();
    await new Promise((resolve) => server.close(resolve));
  });
  const url = `http://127.0.0.1:${server.address().port}/users/owner-1/profile`;
  const send = (token, preferredLocale) => fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ preferredLocale })
  });

  const updated = await send("owner-token", "en-ca");
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).user.preferredLocale, "en-CA");
  assert.equal(persistedLocale, "en-CA");

  const invalid = await send("owner-token", "not_a_locale");
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { error: "Invalid preferred locale" });

  const forbidden = await send("other-token", "fr-CA");
  assert.equal(forbidden.status, 403);
});

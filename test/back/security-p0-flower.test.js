import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../lib/prisma.js";
import { app } from "../../server.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";

test("flower ownership uses token/path identity and prevents cross-user deletion", async (t) => {
  const originals = {
    userFindUnique: prisma.user.findUnique,
    flowerFindFirst: prisma.flower.findFirst,
    flowerDelete: prisma.flower.delete,
    messageDeleteMany: prisma.message.deleteMany
  };
  const deleted = [];
  prisma.user.findUnique = async ({ where }) => where.firebaseUid
    ? { id: where.firebaseUid === "a-firebase" ? "user-a" : "user-b" }
    : { id: where.id, firebaseUid: `${where.id}-firebase` };
  prisma.flower.findFirst = async ({ where }) => {
    if (where.userId === "user-a" && where.id === "flower-a") return { id: "flower-a", userId: "user-a" };
    if (where.userId === "user-b" && where.id === "flower-b") return { id: "flower-b", userId: "user-b" };
    return null;
  };
  prisma.message.deleteMany = async () => ({ count: 0 });
  prisma.flower.delete = async ({ where }) => { deleted.push(where); return { id: where.id, userId: "user-a" }; };
  setFirebaseTokenVerifierForTests(async (token) => ({ uid: token === "a-token" ? "a-firebase" : "b-firebase", email_verified: true }));

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    prisma.user.findUnique = originals.userFindUnique;
    prisma.flower.findFirst = originals.flowerFindFirst;
    prisma.flower.delete = originals.flowerDelete;
    prisma.message.deleteMany = originals.messageDeleteMany;
    setFirebaseTokenVerifierForTests();
    await new Promise((resolve) => server.close(resolve));
  });
  const headers = { Authorization: "Bearer a-token", "Content-Type": "application/json" };
  const victimCreate = await fetch(`${base}/users/user-b/flowers`, { method: "POST", headers, body: JSON.stringify({ mood: "SUNNY_BLOOM", userId: "user-b", ownerId: "user-b", owner: "user-b", role: "admin", premium: true }) });
  assert.equal(victimCreate.status, 403);

  const victimDelete = await fetch(`${base}/users/user-b/flowers/flower-b`, { method: "DELETE", headers, body: JSON.stringify({ userId: "user-b", ownerId: "user-b", owner: "user-b", admin: true }) });
  assert.equal(victimDelete.status, 403);
  assert.deepEqual(deleted, []);

  const ownDelete = await fetch(`${base}/users/user-a/flowers/flower-a`, { method: "DELETE", headers, body: JSON.stringify({ userId: "user-b", ownerId: "user-b", owner: "user-b", role: "admin", vip: true, premium: true }) });
  assert.equal(ownDelete.status, 200);
  assert.deepEqual(deleted, [{ id: "flower-a" }]);
});

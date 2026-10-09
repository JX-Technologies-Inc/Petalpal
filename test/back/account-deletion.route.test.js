import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../lib/prisma.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { app, setFirebaseUserDeleterForTests } from "../../server.js";

function deletionTransaction() {
  const state = {
    user: true,
    friendships: 2,
    friendRequests: 2,
    flowers: 1,
    flowerMessages: 1,
    gardenVisits: 1,
    garden: true,
    userVisits: 1,
    userMessages: 1
  };
  const tx = {
    user: {
      findUnique: async () => state.user
        ? { id: "owner-1", firebaseUid: "firebase-owner" }
        : null,
      delete: async () => { state.user = false; }
    },
    friendship: { deleteMany: async () => { state.friendships = 0; } },
    friendRequest: { deleteMany: async () => { state.friendRequests = 0; } },
    garden: {
      findUnique: async () => state.garden ? { id: "garden-1" } : null,
      delete: async () => { state.garden = false; }
    },
    flower: {
      findMany: async () => state.flowers ? [{ id: "flower-1" }] : [],
      deleteMany: async () => { state.flowers = 0; }
    },
    message: {
      deleteMany: async ({ where }) => {
        if (where.flowerId) state.flowerMessages = 0;
        if (where.userId) state.userMessages = 0;
      }
    },
    visitRecord: {
      deleteMany: async ({ where }) => {
        if (where.gardenId) state.gardenVisits = 0;
        if (where.visitorId) state.userVisits = 0;
      }
    }
  };
  return { state, tx };
}

test("account deletion is owner-only, deletes all related data and rolls back on Firebase failure", async (t) => {
  const originalFindUnique = prisma.user.findUnique;
  const originalAuditCreate = prisma.auditEvent.create;
  const originalTransaction = prisma.$transaction;
  let current = deletionTransaction();
  let firebaseUid = null;
  let audits = 0, transactions = 0;
  prisma.auditEvent.create = async () => { audits++; return { id: "audit-1" }; };

  prisma.user.findUnique = async ({ where }) => ({
    id: where.firebaseUid === "firebase-owner" ? "owner-1" : "other-1"
  });
  prisma.$transaction = async (callback) => {
    transactions++;
    const snapshot = structuredClone(current.state);
    try {
      return await callback(current.tx);
    } catch (error) {
      Object.assign(current.state, snapshot);
      throw error;
    }
  };
  setFirebaseTokenVerifierForTests(async (token) => ({
    uid: token === "other-token" ? "firebase-other" : "firebase-owner",
    email_verified: true,
    iat: Math.floor(Date.now()/1000),
    auth_time: token === "stale-token" ? Math.floor(Date.now()/1000)-600
      : token === "missing-time" ? undefined : token === "bad-time" ? "bad"
      : token === "future-time" ? Math.floor(Date.now()/1000)+60 : Math.floor(Date.now()/1000)
  }));
  setFirebaseUserDeleterForTests(async (uid) => { firebaseUid = uid; });

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    prisma.user.findUnique = originalFindUnique;
    prisma.auditEvent.create = originalAuditCreate;
    prisma.$transaction = originalTransaction;
    setFirebaseTokenVerifierForTests();
    setFirebaseUserDeleterForTests();
    await new Promise((resolve) => server.close(resolve));
  });
  const url = `http://127.0.0.1:${server.address().port}/users/owner-1`;
  const remove = (token) => fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ auth_time: Math.floor(Date.now()/1000) })
  });

  const forbidden = await remove("other-token");
  assert.equal(forbidden.status, 403);
  assert.equal(current.state.user, true);

  for (const token of ["stale-token", "missing-time", "bad-time", "future-time"]) {
    const rejected = await remove(token);
    assert.equal(rejected.status, 403);
    assert.equal((await rejected.json()).code, "auth/requires-recent-login");
    assert.equal(audits, 0); assert.equal(transactions, 0); assert.equal(firebaseUid, null);
    assert.deepEqual(current.state, deletionTransaction().state);
  }

  const deleted = await remove("owner-token");
  assert.equal(deleted.status, 200);
  assert.equal(firebaseUid, "firebase-owner");
  assert.deepEqual(current.state, {
    user: false,
    friendships: 0,
    friendRequests: 0,
    flowers: 0,
    flowerMessages: 0,
    gardenVisits: 0,
    garden: false,
    userVisits: 0,
    userMessages: 0
  });

  current = deletionTransaction();
  setFirebaseUserDeleterForTests(async () => { throw new Error("Firebase unavailable"); });
  const failed = await remove("owner-token");
  assert.equal(failed.status, 500);
  assert.deepEqual(current.state, deletionTransaction().state);
});

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
  const originalTransaction = prisma.$transaction;
  let current = deletionTransaction();
  let firebaseUid = null;

  prisma.user.findUnique = async ({ where }) => ({
    id: where.firebaseUid === "firebase-owner" ? "owner-1" : "other-1"
  });
  prisma.$transaction = async (callback) => {
    const snapshot = structuredClone(current.state);
    try {
      return await callback(current.tx);
    } catch (error) {
      Object.assign(current.state, snapshot);
      throw error;
    }
  };
  setFirebaseTokenVerifierForTests(async (token) => ({
    uid: token === "owner-token" ? "firebase-owner" : "firebase-other",
    email_verified: true
  }));
  setFirebaseUserDeleterForTests(async (uid) => { firebaseUid = uid; });

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    prisma.user.findUnique = originalFindUnique;
    prisma.$transaction = originalTransaction;
    setFirebaseTokenVerifierForTests();
    setFirebaseUserDeleterForTests();
    await new Promise((resolve) => server.close(resolve));
  });
  const url = `http://127.0.0.1:${server.address().port}/users/owner-1`;
  const remove = (token) => fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  const forbidden = await remove("other-token");
  assert.equal(forbidden.status, 403);
  assert.equal(current.state.user, true);

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

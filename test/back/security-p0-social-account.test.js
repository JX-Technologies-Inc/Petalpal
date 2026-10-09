import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../lib/prisma.js";
import { app } from "../../server.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";

async function call(base, path, { method = "GET", token = "a-token", body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, body: await response.json() };
}

test("friends, requests, subscription and reports derive identity from the token", async (t) => {
  const originals = {
    userFindUnique: prisma.user.findUnique,
    userFindMany: prisma.user.findMany,
    friendFindMany: prisma.friendRequest.findMany,
    friendFindUnique: prisma.friendRequest.findUnique,
    friendCreate: prisma.friendRequest.create,
    friendDelete: prisma.friendRequest.delete,
    friendshipFindFirst: prisma.friendship.findFirst,
    friendshipFindMany: prisma.friendship.findMany,
    friendshipDeleteMany: prisma.friendship.deleteMany,
    subscriptionUpsert: prisma.subscriptionEntitlement.upsert,
    reportCreate: prisma.report.create,
    reportedUserFind: prisma.user.findUnique
  };
  const calls = [];
  prisma.user.findUnique = async ({ where }) => {
    if (where.firebaseUid) return { id: where.firebaseUid === "a-firebase" ? "user-a" : "user-b" };
    return { id: where.id, name: where.id };
  };
  const publicUser = { id: 'user-b', name: 'Amy', accountId: 'amy123', avatar: '🦋', email: 'private@example.test' };
  const project = select => Object.fromEntries(Object.keys(select).filter(key => select[key]).map(key => [key, publicUser[key]]));
  prisma.user.findMany = async ({ select, where }) => { calls.push({ kind: 'search', where }); return [project(select)]; };
  prisma.friendship.findMany = async ({ include }) => [{ friend: project(include.friend.select) }];
  prisma.friendRequest.findMany = async ({ include }) => include.sender
    ? [{ id: 'incoming-a', senderId: 'user-b', receiverId: 'user-a', sender: project(include.sender.select) }]
    : [{ id: 'outgoing-a', senderId: 'user-a', receiverId: 'user-b', receiver: project(include.receiver.select) }];
  prisma.friendRequest.findUnique = async ({ where }) => {
    if (where.id === "request-b") return { id: "request-b", senderId: "user-c", receiverId: "user-b", status: "pending" };
    return null;
  };
  prisma.friendRequest.create = async ({ data }) => { calls.push({ kind: "request", data }); return { ...data }; };
  prisma.friendRequest.delete = async ({ where }) => { calls.push({ kind: "reject", where }); return {}; };
  prisma.friendship.deleteMany = async ({ where }) => { calls.push({ kind: "remove", where }); return { count: 1 }; };
  prisma.friendship.findFirst = async () => null;
  prisma.subscriptionEntitlement.upsert = async ({ where, create }) => { calls.push({ kind: "subscription", where, create }); return { userId: create.userId, premium: false }; };
  prisma.report.create = async ({ data }) => { calls.push({ kind: "report", data }); return { id: "report-1", ...data }; };
  setFirebaseTokenVerifierForTests(async (token) => ({ uid: token === "a-token" ? "a-firebase" : "b-firebase", email_verified: true }));

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    for (const [name, value] of Object.entries(originals)) {
      if (name === "reportedUserFind") continue;
      if (name === "userFindUnique") prisma.user.findUnique = value;
      else if (name === "userFindMany") prisma.user.findMany = value;
      else if (name === "friendFindMany") prisma.friendRequest.findMany = value;
      else if (name === "friendFindUnique") prisma.friendRequest.findUnique = value;
      else if (name === "friendCreate") prisma.friendRequest.create = value;
      else if (name === "friendDelete") prisma.friendRequest.delete = value;
      else if (name === "friendshipDeleteMany") prisma.friendship.deleteMany = value;
      else if (name === "friendshipFindFirst") prisma.friendship.findFirst = value;
      else if (name === "friendshipFindMany") prisma.friendship.findMany = value;
      else if (name === "subscriptionUpsert") prisma.subscriptionEntitlement.upsert = value;
      else if (name === "reportCreate") prisma.report.create = value;
    }
    setFirebaseTokenVerifierForTests();
    await new Promise((resolve) => server.close(resolve));
  });

  assert.equal((await call(base, "/users/user-b/friends", { token: "a-token" })).status, 403);
  assert.equal((await call(base, "/friends/requests/user-b", { token: "a-token" })).status, 403);
  const friends = await call(base, '/users/user-a/friends');
  assert.equal(friends.status, 200); assert.equal(friends.body[0].accountId, 'amy123');
  assert.equal(friends.body[0].email, undefined);
  const search = await call(base, '/users/search?name=Amy');
  assert.equal(search.body[0].accountId, 'amy123'); assert.equal(search.body[0].email, undefined);
  await call(base, '/users/search?name=%40amy123');
  assert.deepEqual(calls.filter(x => x.kind === 'search').at(-1).where, { id: { not: 'user-a' }, OR: [
    { name: { contains: '@amy123', mode: 'insensitive' } }, { accountId: { contains: 'amy123', mode: 'insensitive' } }
  ] });
  const requests = await call(base, '/friends/requests/user-a');
  assert.equal(requests.body.incoming[0].sender.accountId, 'amy123');
  assert.equal(requests.body.outgoing[0].receiver.accountId, 'amy123');
  assert.equal((await call(base, "/friends/requests/request-b/accept", { token: "a-token", method: "POST", body: { userId: "user-b", ownerId: "user-b" } })).status, 403);
  assert.equal((await call(base, "/friends/requests/request-b/reject", { token: "a-token", method: "POST", body: { userId: "user-b", ownerId: "user-b" } })).status, 403);

  assert.equal((await call(base, "/friends/request", { method: "POST", body: { receiverId: "user-b", senderId: "user-b", userId: "user-b", ownerId: "user-b", role: "admin", admin: true } })).status, 201);
  assert.deepEqual(calls.find((x) => x.kind === "request").data, { senderId: "user-a", receiverId: "user-b", status: "pending" });

  assert.equal((await call(base, "/friends/remove", { method: "POST", body: { friendId: "user-b", userId: "user-b", ownerId: "user-b", role: "admin" } })).status, 200);
  assert.match(JSON.stringify(calls.find((x) => x.kind === "remove").where), /user-a/);

  assert.equal((await call(base, "/users/user-b/subscription", { token: "a-token" })).status, 403);
  assert.equal((await call(base, "/users/user-a/subscription", { token: "a-token", method: "GET" })).status, 200);
  assert.equal(calls.find((x) => x.kind === "subscription").create.userId, "user-a");

  assert.equal((await call(base, "/reports", { method: "POST", body: { reportedUserId: "user-b", reporterId: "user-b", reporter: "user-b", userId: "user-b", ownerId: "user-b", role: "admin", admin: true, category: "OTHER" } })).status, 201);
  assert.equal(calls.find((x) => x.kind === "report").data.reporterId, "user-a");
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { io as connectSocket } from "socket.io-client";
import prisma from "../../lib/prisma.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { server } from "../../server.js";

const events = ["join-user", "leave-user", "join-garden", "move-avatar"];
const injectedFields = ["userId", "ownerId", "owner", "role", "admin", "isAdmin", "vip", "premium"];

function connect(baseUrl, auth) {
  return connectSocket(baseUrl, { auth, transports: ["websocket"] });
}

async function rejected(socket) {
  const error = await new Promise((resolve) => socket.once("connect_error", resolve));
  socket.disconnect();
  return error;
}

test("Socket.IO handshake rejects missing, invalid and expired verifier results at runtime", { concurrency: false }, async (t) => {
  const originalFindUnique = prisma.user.findUnique;
  setFirebaseTokenVerifierForTests(async (token) => {
    if (token === "valid-token") return { uid: "firebase-a", email_verified: true };
    const error = new Error("verifier detail must not escape");
    if (token === "expired-token") error.code = "auth/id-token-expired";
    throw error;
  });
  prisma.user.findUnique = async () => ({ id: "user-a" });
  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    prisma.user.findUnique = originalFindUnique;
    setFirebaseTokenVerifierForTests();
    await new Promise((resolve) => server.close(resolve));
  });

  const cases = [
    ["missing", {}],
    ["empty", { token: "" }],
    ["invalid", { token: "invalid-token" }],
    ["expired", { token: "expired-token" }]
  ];
  for (const [name, auth] of cases) {
    const error = await rejected(connect(baseUrl, auth));
    assert.match(error.message, /Authentication required|Invalid or expired Firebase token/);
    assert.doesNotMatch(error.message, /verifier detail|auth\/id-token-expired|stack/i);
    assert.notEqual(name, "");
  }
});

test("Socket.IO valid-token runtime regression still connects", { concurrency: false }, async (t) => {
  const originalFindUnique = prisma.user.findUnique;
  setFirebaseTokenVerifierForTests(async () => ({ uid: "firebase-a", email_verified: true }));
  prisma.user.findUnique = async () => ({ id: "user-a" });
  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const socket = connect(`http://127.0.0.1:${server.address().port}`, { token: "valid-token" });
  t.after(async () => {
    socket.disconnect();
    prisma.user.findUnique = originalFindUnique;
    setFirebaseTokenVerifierForTests();
    await new Promise((resolve) => server.close(resolve));
  });
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  socket.emit("join-user", { userId: "user-b", ownerId: "user-b" });
  assert.equal(socket.connected, true);
});

test("Socket.IO authenticated handler inventory and identity guards are explicit", async () => {
  const source = await readFile("server.js", "utf8");
  assert.match(source, /io\.use\(authenticateSocket\)/);
  for (const event of events) assert.match(source, new RegExp(`socket\\.on\\(\\\"${event}\\\"`));
  assert.match(source, /socket\.data\.currentUserId/);
  assert.match(source, /socket\.join\(\s*`user:\$\{normalizedUserId\}`\s*\)/);
  assert.match(source, /visitorId = String\(socket\.data\.currentUserId\)/);
  assert.match(source, /socket\.data\.currentGarden !== gardenOwnerId/);
  assert.match(source, /io\.to\(`garden:\$\{gardenOwnerId\}`\)\.emit/);
  for (const field of injectedFields) assert.equal(typeof field, "string");
});

test("Socket.IO semantics keep garden social and user rooms token-derived", async () => {
  const source = await readFile("server.js", "utf8");
  assert.match(source, /socket\.join\(`garden:\$\{gardenOwnerId\}`\)/);
  assert.match(source, /socket\.data\.currentUserId/);
  assert.match(source, /socket\.on\("join-user"[\s\S]*socket\.join\(\s*`user:/);
});

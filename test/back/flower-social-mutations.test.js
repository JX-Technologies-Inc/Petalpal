import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { io as connectSocket } from "socket.io-client";

import prisma from "../../lib/prisma.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { server } from "../../server.js";

const privateFields = [
  "event",
  "generationSeed",
  "dailyCheckInId",
  "dailyCheckIn",
  "emotionResult"
];

const message = {
  id: "message-1",
  author: "Visitor",
  text: "Beautiful!",
  createdAt: "2026-09-04T00:00:00.000Z",
  flowerId: "flower-1",
  userId: "visitor-1"
};

const privateFlower = {
  id: "flower-1",
  mood: "SUNNY_BLOOM",
  speciesCode: "SUNFLOWER",
  colorAccent: "WARM_GOLD",
  event: "Private journal text",
  name: "Sunflower",
  meaning: "Joy",
  img: "🌻",
  left: 10,
  top: 20,
  regionId: null,
  slotId: null,
  scale: 1,
  rotation: 0,
  layer: 0,
  layoutVersion: 1,
  supportCount: 1,
  variant: "standard",
  rarity: "COMMON",
  growthState: "BLOOMED",
  visualEffect: null,
  season: "AUTUMN",
  generationSeed: "private-seed",
  createdAt: "2026-09-04T00:00:00.000Z",
  userId: "owner-1",
  gardenId: "garden-1",
  dailyCheckInId: "checkin-1",
  dailyCheckIn: {
    journal: { content: "Private journal text" },
    emotionResult: { label: "SUNNY_BLOOM" }
  },
  emotionResult: { label: "SUNNY_BLOOM" },
  messages: [message]
};

function assertSocialFlower(flower) {
  for (const field of privateFields) assert.equal(Object.hasOwn(flower, field), false);
  assert.equal(flower.name, "Sunflower");
  assert.equal(flower.supportCount, 1);
  assert.deepEqual(flower.messages[0], {
    id: message.id,
    author: message.author,
    text: message.text,
    createdAt: message.createdAt
  });
}

test("support and message HTTP/socket payloads expose only social Flower data", async (t) => {
  const originals = {
    userFindUnique: prisma.user.findUnique,
    flowerFindFirst: prisma.flower.findFirst,
    flowerUpdate: prisma.flower.update,
    flowerFindUnique: prisma.flower.findUnique,
    messageCreate: prisma.message.create,
    visitCreate: prisma.visitRecord.create
  };
  prisma.user.findUnique = async ({ where }) => where.firebaseUid
    ? { id: "visitor-1" }
    : { id: "visitor-1", name: "Visitor", avatar: "🦋" };
  prisma.flower.findFirst = async () => ({ id: "flower-1", gardenId: "garden-1" });
  prisma.flower.update = async () => privateFlower;
  prisma.flower.findUnique = async () => privateFlower;
  prisma.message.create = async () => message;
  prisma.visitRecord.create = async () => ({ id: "visit-1" });
  setFirebaseTokenVerifierForTests(async () => ({ uid: "visitor-firebase", email_verified: true }));

  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const socket = connectSocket(baseUrl, {
    auth: { token: "visitor-token" },
    transports: ["websocket"]
  });
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  socket.emit("join-garden", "owner-1");
  await delay(10);

  t.after(async () => {
    socket.close();
    Object.assign(prisma.user, { findUnique: originals.userFindUnique });
    Object.assign(prisma.flower, {
      findFirst: originals.flowerFindFirst,
      update: originals.flowerUpdate,
      findUnique: originals.flowerFindUnique
    });
    prisma.message.create = originals.messageCreate;
    prisma.visitRecord.create = originals.visitCreate;
    setFirebaseTokenVerifierForTests();
    await new Promise((resolve) => server.close(resolve));
  });

  const post = (path, body) => fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: "Bearer visitor-token",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const supportEvent = new Promise((resolve) => socket.once("supportUpdated", resolve));
  const supportResponse = await post("/users/owner-1/flowers/flower-1/support", {});
  assert.equal(supportResponse.status, 200);
  assertSocialFlower(await supportResponse.json());
  assertSocialFlower((await supportEvent).flower);

  const messageEvent = new Promise((resolve) => socket.once("messageAdded", resolve));
  const messageResponse = await post("/users/owner-1/flowers/flower-1/message", {
    text: "Beautiful!"
  });
  assert.equal(messageResponse.status, 200);
  assertSocialFlower(await messageResponse.json());
  const emitted = await messageEvent;
  assertSocialFlower(emitted.flower);
  assert.deepEqual(emitted.message, {
    id: message.id,
    author: message.author,
    text: message.text,
    createdAt: message.createdAt
  });
});

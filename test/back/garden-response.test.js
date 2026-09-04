import assert from "node:assert/strict";
import test from "node:test";

import { serializeGardenResponse } from "../../lib/garden-response.js";

const privateFlower = {
  id: "flower-1",
  mood: "SUNNY_BLOOM",
  speciesCode: "SUNFLOWER",
  colorAccent: "WARM_GOLD",
  event: "A private journal entry",
  name: "Sunflower",
  meaning: "Joy",
  img: "/sunflower.png",
  left: 12,
  top: 34,
  regionId: null,
  slotId: null,
  scale: 1,
  rotation: 0,
  layer: 0,
  layoutVersion: 1,
  supportCount: 2,
  variant: "standard",
  rarity: "COMMON",
  growthState: "BLOOMED",
  visualEffect: "SOFT_SPARKLE",
  season: "SUMMER",
  generationSeed: "private-seed",
  createdAt: "2026-09-03T00:00:00.000Z",
  userId: "owner-1",
  gardenId: "garden-1",
  dailyCheckInId: "checkin-1",
  dailyCheckIn: {
    createdAt: "2026-09-03T00:00:00.000Z",
    journal: { content: "A private journal entry" },
    emotionResult: {
      label: "SUNNY_BLOOM",
      secondaryEmotions: ["gratitude"],
      intensity: 0.7,
      confidence: 0.9
    }
  },
  emotionResult: { confidence: 0.9 },
  messages: [{
    id: "message-1",
    author: "Friend",
    text: "Beautiful!",
    createdAt: "2026-09-03T01:00:00.000Z",
    flowerId: "flower-1",
    userId: "friend-1"
  }]
};

function response(includePrivate) {
  return serializeGardenResponse({
    owner: { id: "owner-1", name: "Bloom", avatar: "flower.png" },
    garden: { flowers: [privateFlower], visitRecords: [] },
    activeVisitors: [],
    includePrivate
  });
}

test("owner garden response preserves private Journal-linked flower data", () => {
  assert.equal(response(true).flowers[0].event, "A private journal entry");
  assert.equal(response(true).flowers[0].generationSeed, "private-seed");
  assert.deepEqual(response(true).flowers[0].dailyCheckIn.emotionResult.secondaryEmotions, ["gratitude"]);
});

test("social garden response excludes Journal, AI and internal relation fields", () => {
  const flower = response(false).flowers[0];
  for (const field of [
    "event", "generationSeed", "userId", "gardenId", "dailyCheckInId", "dailyCheckIn", "emotionResult"
  ]) {
    assert.equal(Object.hasOwn(flower, field), false);
  }
  assert.deepEqual(flower.messages[0], {
    id: "message-1",
    author: "Friend",
    text: "Beautiful!",
    createdAt: "2026-09-03T01:00:00.000Z"
  });
});

test("social garden response retains normal Flower display metadata", () => {
  const flower = response(false).flowers[0];
  assert.equal(flower.name, "Sunflower");
  assert.equal(flower.img, "/sunflower.png");
  assert.equal(flower.left, 12);
  assert.equal(flower.top, 34);
  assert.equal(flower.regionId, null);
  assert.equal(flower.slotId, null);
  assert.equal(flower.scale, 1);
  assert.equal(flower.rotation, 0);
  assert.equal(flower.layer, 0);
  assert.equal(flower.layoutVersion, 1);
  assert.equal(flower.colorAccent, "WARM_GOLD");
  assert.equal(flower.visualEffect, "SOFT_SPARKLE");
});

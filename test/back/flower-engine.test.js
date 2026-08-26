import test from "node:test";
import assert from "node:assert/strict";

import { generateFlowerMetadata, seasonForLocalDate } from "../../lib/flower-engine.js";

const options = [
  { name: "Sunflower", meaning: "Happiness", img: "🌻" },
  { name: "Tulip", meaning: "Joy", img: "🌷" }
];

test("flower metadata is deterministic for the same daily check-in", () => {
  const input = {
    options,
    mood: "happy",
    secondaryEmotion: "calm",
    intensity: 0.7,
    localDate: "2026-08-26",
    userId: "user-1",
    recentFlowers: []
  };

  assert.deepEqual(generateFlowerMetadata(input), generateFlowerMetadata(input));
});

test("flower engine avoids the most recent species when another is available", () => {
  const result = generateFlowerMetadata({
    options,
    mood: "happy",
    localDate: "2026-08-26",
    userId: "user-2",
    recentFlowers: [{ name: "Sunflower" }]
  });

  assert.equal(result.name, "Tulip");
  assert.equal(result.season, "SUMMER");
  assert.match(result.generationSeed, /^[a-f0-9]{64}$/);
});

test("seasonForLocalDate maps calendar months", () => {
  assert.equal(seasonForLocalDate("2026-04-01"), "SPRING");
  assert.equal(seasonForLocalDate("2026-07-01"), "SUMMER");
  assert.equal(seasonForLocalDate("2026-10-01"), "AUTUMN");
  assert.equal(seasonForLocalDate("2026-01-01"), "WINTER");
});

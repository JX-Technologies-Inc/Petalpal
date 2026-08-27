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
    primaryGardenMood: "SUNNY_BLOOM",
    secondaryEmotions: [
      { label: "gratitude", score: 0.8, role: "PRIMARY_VARIANT" }
    ],
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
    primaryGardenMood: "happy",
    localDate: "2026-08-26",
    userId: "user-2",
    recentFlowers: [{ name: "Sunflower" }]
  });

  assert.equal(result.name, "Tulip");
  assert.equal(result.speciesCode, "TULIP");
  assert.equal(result.season, "SUMMER");
  assert.match(result.generationSeed, /^[a-f0-9]{64}$/);
});

test("secondary emotions modify semantic color and effect without changing species pool", () => {
  const result = generateFlowerMetadata({
    options,
    primaryGardenMood: "SUNNY_BLOOM",
    secondaryEmotions: [
      { label: "gratitude", score: 0.9, role: "PRIMARY_VARIANT" }
    ],
    localDate: "2026-08-26",
    userId: "user-variant",
    recentFlowers: []
  });
  assert.ok(options.some(({ name }) => name === result.name));
  assert.equal(result.colorAccent, "WARM_GOLD");
  assert.equal(result.visualEffect, "SOFT_SPARKLE");
});

test("seasonForLocalDate maps calendar months", () => {
  assert.equal(seasonForLocalDate("2026-04-01"), "SPRING");
  assert.equal(seasonForLocalDate("2026-07-01"), "SUMMER");
  assert.equal(seasonForLocalDate("2026-10-01"), "AUTUMN");
  assert.equal(seasonForLocalDate("2026-01-01"), "WINTER");
});

import test from "node:test";
import assert from "node:assert/strict";

import { generateFlowerMetadata, seasonForLocalDate } from "../../lib/flower-engine.js";
import { previewEventFlower } from "../../lib/event-flower.js";
import flowerDB from "../../data/flowerDB.js";
import {
  CANONICAL_PRIMARY_GARDEN_MOODS,
  LEGACY_PRIMARY_MOODS,
  compatibilitySpeciesPool,
  speciesPoolForPrimary
} from "../../lib/flower-variant-config.js";

const options = [
  { name: "Sunflower", meaning: "Happiness", img: "🌻" },
  { name: "Tulip", meaning: "Joy", img: "🌷" }
];

test("all canonical Primary Blooms use explicit approved species pools", () => {
  const approvedCodes = new Set(compatibilitySpeciesPool(flowerDB).map(({ speciesCode }) => speciesCode));
  for (const mood of CANONICAL_PRIMARY_GARDEN_MOODS) {
    const { pool, source } = speciesPoolForPrimary(mood, flowerDB);
    assert.equal(source, "PRIMARY_CONFIG");
    assert.ok(pool.length > 0);
    assert.ok(pool.every(({ speciesCode }) => approvedCodes.has(speciesCode)));
  }
});

test("canonical species selection remains deterministic for every Bloom", () => {
  for (const mood of CANONICAL_PRIMARY_GARDEN_MOODS) {
    const { pool } = speciesPoolForPrimary(mood, flowerDB);
    const input = {
      options: pool,
      primaryGardenMood: mood,
      localDate: "2026-09-03",
      userId: "canonical-user"
    };
    assert.deepEqual(generateFlowerMetadata(input), generateFlowerMetadata(input));
  }
});

test("legacy Primary moods retain their existing catalog pools", () => {
  for (const mood of LEGACY_PRIMARY_MOODS) {
    const { pool, source } = speciesPoolForPrimary(mood, flowerDB);
    assert.equal(source, "LEGACY_PRIMARY_CONFIG");
    assert.equal(pool.length, flowerDB[mood].length);
  }
});

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

test("secondary emotions modify only visuals after stable Primary Mood species selection", () => {
  const { pool } = speciesPoolForPrimary("SUNNY_BLOOM", flowerDB);
  const input = { options: pool, primaryGardenMood: "SUNNY_BLOOM", localDate: "2026-09-28", userId: "alice", recentFlowers: [] };
  const base = generateFlowerMetadata({ ...input, secondaryEmotions: [] });
  const one = generateFlowerMetadata({ ...input, secondaryEmotions: [{ label: "gratitude" }] });
  const two = generateFlowerMetadata({ ...input, secondaryEmotions: [{ label: "gratitude" }, { label: "surprise" }] });

  for (const flower of [one, two]) {
    assert.equal(flower.speciesCode, base.speciesCode);
    assert.equal(flower.name, base.name);
    assert.equal(flower.img, base.img);
    assert.equal(flower.generationSeed, base.generationSeed);
    assert.equal(flower.variant, base.variant);
  }
  assert.equal(base.colorAccent, null);
  assert.equal(one.colorAccent, "WARM_GOLD");
  assert.equal(one.visualEffect, "SOFT_SPARKLE");
  assert.equal(two.colorAccent, "WARM_GOLD");
  assert.equal(two.visualEffect, "FLASH_SPARKLE");
});

test("two same-cluster LLM labels change Event visuals without changing base species", () => {
  const input = { userId: "synthetic-user", localDate: "2026-09-28", primaryGardenMood: "SUNNY_BLOOM", recentFlowers: [] };
  const base = previewEventFlower({ ...input, labels: [] });
  const two = previewEventFlower({ ...input, labels: ["gratitude", "caring"] });
  assert.equal(two.speciesCode, base.speciesCode);
  assert.equal(two.name, base.name);
  assert.equal(two.generationSeed, base.generationSeed);
  assert.equal(two.colorAccent, "WARM_GOLD");
  assert.equal(two.visualEffect, "GENTLE_GLOW");
});

test("seasonForLocalDate maps calendar months", () => {
  assert.equal(seasonForLocalDate("2026-04-01"), "SPRING");
  assert.equal(seasonForLocalDate("2026-07-01"), "SUMMER");
  assert.equal(seasonForLocalDate("2026-10-01"), "AUTUMN");
  assert.equal(seasonForLocalDate("2026-01-01"), "WINTER");
});

// The art team's "Flower Type & Mood" table (Resources/), limited to species with Garden art.
const MOOD_TABLE_POOLS = {
  SUNNY_BLOOM: ["SUNFLOWER", "GERBERA_DAISY", "COREOPSIS", "DAISY"],
  GENTLE_BLOOM: ["HYDRANGEA"],
  QUIET_BLOOM: ["BLUEBELL", "ANEMONE", "HEATHER"],
  HEALING_BLOOM: ["CHAMOMILE", "SNOWDROP"],
  FIRE_BLOOM: ["POPPY", "PETUNIA", "GENTIAN"],
  WONDER_BLOOM: ["TULIP", "BIRD_OF_PARADISE", "YELLOW_DAFFODIL", "WHITE_ROSE"],
  DRIFTING_BLOOM: ["DANDELION", "ASTER", "YELLOW_RAPESEED_FLOWER"],
  PEACEFUL_BLOOM: ["LAVENDER", "CHINESE_VIOLET_CRESS", "OLIVE"]
};

test("Primary Bloom pools follow the mood table and every species can be planted and drawn", async () => {
  const { readFileSync, existsSync, readdirSync } = await import("node:fs");
  const root = new URL("../../mobile/", import.meta.url);
  // Mobile refuses to plant a species without a parent collision class ("not ready for planting").
  const collision = readFileSync(new URL("src/components/garden/planting/parentCollision.ts", root), "utf8");
  const plantable = new Set([...collision.match(/PARENT_COLLISION_CLASSES[^{]*\{([^}]*)\}/)[1].matchAll(/([A-Z_]+):'[SML]'/g)].map(m => m[1]));
  const seen = new Set();
  for (const mood of CANONICAL_PRIMARY_GARDEN_MOODS) {
    const { pool } = speciesPoolForPrimary(mood, flowerDB);
    assert.deepEqual(pool.map(({ speciesCode }) => speciesCode), MOOD_TABLE_POOLS[mood], mood);
    for (const flower of pool) {
      assert.ok(plantable.has(flower.speciesCode), `${flower.speciesCode} has a planting size`);
      const art = new URL(`assets/garden/flowers/species/${flower.speciesCode.toLowerCase()}/`, root);
      assert.ok(existsSync(art) && readdirSync(art, { recursive: true }).some(f => String(f).endsWith(".png")), `${flower.speciesCode} has Garden art`);
      assert.ok(typeof flower.meaning === "string" && flower.meaning.length > 0 && flower.meaning.length <= 40, `${flower.speciesCode} meaning`);
      assert.equal(seen.has(flower.speciesCode), false, `${flower.speciesCode} belongs to one mood`);
      seen.add(flower.speciesCode);
    }
  }
  for (const missing of ["BLUE_ROSE", "LOTUS", "CHERRY_BLOSSOM", "ROSE", "TUMI", "WHITE_MAGNOLIA"]) assert.equal(seen.has(missing), false, missing);
});

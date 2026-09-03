import test from "node:test";
import assert from "node:assert/strict";

import {
  flowerVariantForSecondaryEmotions,
  selectFlowerSecondaryEmotions
} from "../../lib/secondary-emotion-selector.js";

test("filters excluded and primary-redundant labels", () => {
  const selected = selectFlowerSecondaryEmotions({
    primaryGardenMood: "SUNNY_BLOOM",
    candidates: [
      { label: "joy", score: 0.95 },
      { label: "neutral", score: 0.9 },
      { label: "approval", score: 0.88 },
      { label: "gratitude", score: 0.8 }
    ]
  });
  assert.deepEqual(selected, [
    { label: "gratitude", score: 0.8, role: "PRIMARY_VARIANT" }
  ]);
});

test("deduplicates labels and semantic clusters and returns at most two", () => {
  const selected = selectFlowerSecondaryEmotions({
    primaryGardenMood: "PEACEFUL_BLOOM",
    candidates: [
      { label: "joy", score: 0.7 },
      { label: "excitement", score: 0.9 },
      { label: "fear", score: 0.8 },
      { label: "fear", score: 0.6 },
      { label: "curiosity", score: 0.75 }
    ]
  });
  assert.deepEqual(selected, [
    { label: "excitement", score: 0.9, role: "PRIMARY_VARIANT" },
    { label: "fear", score: 0.8, role: "ACCENT_VARIANT" }
  ]);
});

test("legacy coarse classifier labels never enter the 21-label selector", () => {
  const selected = selectFlowerSecondaryEmotions({
    primaryGardenMood: "FIRE_BLOOM",
    candidates: ["happy", "calm", "stressed"]
  });
  assert.deepEqual(selected, []);
});

test("selected secondary emotions produce semantic visual metadata", () => {
  const selected = selectFlowerSecondaryEmotions({
    primaryGardenMood: "SUNNY_BLOOM",
    candidates: [
      { label: "gratitude", score: 0.9 },
      { label: "fear", score: 0.8 }
    ]
  });
  assert.deepEqual(flowerVariantForSecondaryEmotions(selected), {
    colorAccent: "WARM_GOLD",
    effect: "SUBTLE_MIST"
  });
});

for (const [primaryGardenMood, redundant] of [
  ["QUIET_BLOOM", "sadness"],
  ["FIRE_BLOOM", "anger"],
  ["WONDER_BLOOM", "curiosity"],
  ["DRIFTING_BLOOM", "confusion"]
]) {
  test(`${primaryGardenMood} filters its redundant secondary`, () => {
    assert.deepEqual(selectFlowerSecondaryEmotions({
      primaryGardenMood,
      candidates: [redundant]
    }), []);
  });
}

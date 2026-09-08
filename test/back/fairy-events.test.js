import assert from "node:assert/strict";
import test from "node:test";

import { resolveFairyEvent } from "../../lib/fairy-events.js";

test("Fairy events use the fixed deterministic priority", () => {
  assert.equal(resolveFairyEvent({
    onboardingStep: "EMPTY_GARDEN",
    onboardingCompleted: false,
    distinctCheckInCount: 0,
    newFlowerRarity: "RARE"
  }).code, "FIRST_LOGIN");

  assert.equal(resolveFairyEvent({
    onboardingStep: "MOOD_SELECTION",
    onboardingCompleted: false,
    distinctCheckInCount: 1,
    newFlowerRarity: "RARE"
  }).code, "FIRST_FLOWER");

  assert.equal(resolveFairyEvent({
    onboardingStep: "GARDEN_UNLOCKED",
    onboardingCompleted: true,
    distinctCheckInCount: 2,
    newFlowerRarity: "RARE"
  }).code, "RETURN_DAY_2");

  assert.equal(resolveFairyEvent({
    onboardingStep: "GARDEN_UNLOCKED",
    onboardingCompleted: true,
    distinctCheckInCount: 3,
    newFlowerRarity: "RARE"
  }).code, "RARE_FLOWER");

  assert.equal(resolveFairyEvent({
    onboardingStep: "GARDEN_UNLOCKED",
    onboardingCompleted: true,
    distinctCheckInCount: 3,
    newFlowerRarity: "COMMON"
  }), null);
});

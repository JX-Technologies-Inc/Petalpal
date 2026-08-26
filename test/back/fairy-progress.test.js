import test from "node:test";
import assert from "node:assert/strict";

import {
  MONTHLY_FAIRY_UNLOCK_ACTIVE_DAYS,
  nextUnlockableFairy,
  withOnboardingGuideFairy
} from "../../lib/fairy-config.js";
import { monthFromLocalDate, normalizeProgress } from "../../lib/fairy-progress.js";

test("local check-in dates map to a stable calendar month", () => {
  assert.equal(monthFromLocalDate("2026-08-31"), "2026-08");
  assert.equal(monthFromLocalDate("2026-09-01"), "2026-09");
});

test("monthly progress is capped at one", () => {
  assert.deepEqual(
    normalizeProgress({
      month: "2026-08",
      activeDays: 21,
      requiredDays: 20,
      unlockedThisMonth: true
    }),
    {
      month: "2026-08",
      activeDays: 21,
      requiredDays: 20,
      progress: 1,
      unlockedThisMonth: true
    }
  );
});

test("all monthly Fairies use the centralized 20-day requirement", () => {
  const firstMonthly = nextUnlockableFairy(["BLOOM"]);
  const secondMonthly = nextUnlockableFairy(["BLOOM", firstMonthly.type]);
  assert.equal(MONTHLY_FAIRY_UNLOCK_ACTIVE_DAYS, 20);
  assert.equal(firstMonthly.type, "LUMI");
  assert.equal(secondMonthly.type, "MOSS");
});

test("onboarding state explicitly identifies Bloom as the guide Fairy", () => {
  assert.deepEqual(withOnboardingGuideFairy({ onboardingStep: "MOOD_SELECTION" }), {
    onboardingStep: "MOOD_SELECTION",
    guideFairyType: "BLOOM",
    guideFairy: { type: "BLOOM", name: "Bloom" }
  });
});

import test from "node:test";
import assert from "node:assert/strict";

import { reconcileFairyRuntime } from "../../lib/fairy-runtime.js";

const startedAt = new Date("2026-08-26T10:00:00.000Z");

function record(overrides = {}) {
  return {
    userId: "fairy-user",
    currentState: "IDLE",
    currentLocation: "GARDEN_CENTER",
    stateStartedAt: startedAt,
    nextTransitionAt: new Date("2026-08-26T11:00:00.000Z"),
    ...overrides
  };
}

test("fairy remains in the current state before its transition", () => {
  const result = reconcileFairyRuntime(record(), new Date("2026-08-26T10:30:00.000Z"));
  assert.equal(result.update.currentState, "IDLE");
  assert.equal(result.transition.changed, false);
});

test("fairy advances and requests animation only near the transition", () => {
  const result = reconcileFairyRuntime(record(), new Date("2026-08-26T11:00:05.000Z"));
  assert.equal(result.update.currentState, "UNDER_TREE");
  assert.equal(result.update.currentLocation, "UNDER_TREE");
  assert.equal(result.transition.previousState, "IDLE");
  assert.equal(result.transition.shouldAnimate, true);
});

test("late resume reconciles all elapsed transitions without replaying animations", () => {
  const result = reconcileFairyRuntime(record(), new Date("2026-08-27T03:00:00.000Z"));
  assert.ok(result.transition.transitionsReconciled > 1);
  assert.equal(result.transition.shouldAnimate, false);
  assert.ok(result.update.nextTransitionAt > new Date("2026-08-27T03:00:00.000Z"));
});

test("same persisted state and time produce the same schedule", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");
  assert.deepEqual(reconcileFairyRuntime(record(), now), reconcileFairyRuntime(record(), now));
});

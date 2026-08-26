import test from "node:test";
import assert from "node:assert/strict";

import {
  reconcileFairyRuntime,
  formatFairyRuntimeResponse,
  timeOfDay
} from "../../lib/fairy-runtime.js";

const startedAt = new Date("2026-08-26T10:00:00.000Z");

function record(overrides = {}) {
  return {
    userFairyId: "owned-fairy-1",
    currentState: "IDLE",
    currentLocation: "GARDEN_CENTER",
    stateStartedAt: startedAt,
    nextTransitionAt: new Date("2026-08-26T11:00:00.000Z"),
    ...overrides
  };
}

test("fairy remains in the current state before its transition", () => {
  const result = reconcileFairyRuntime(record(), {
    now: new Date("2026-08-26T10:30:00.000Z"),
    timezone: "America/Vancouver"
  });
  assert.equal(result.update.currentState, "IDLE");
  assert.equal(result.transition.changed, false);
});

test("fairy advances and requests animation only near the transition", () => {
  const result = reconcileFairyRuntime(record(), {
    now: new Date("2026-08-26T11:00:05.000Z"),
    timezone: "America/Vancouver"
  });
  assert.notEqual(result.update.currentState, "IDLE");
  assert.ok(["TREE", "MAILBOX", "FLOWER"].includes(result.update.currentLocation));
  assert.equal(result.update.previousState, "IDLE");
  assert.equal(result.transition.shouldAnimate, true);
});

test("late resume reconciles all elapsed transitions without replaying animations", () => {
  const now = new Date("2026-08-27T03:00:00.000Z");
  const result = reconcileFairyRuntime(record(), {
    now,
    timezone: "America/Vancouver"
  });
  assert.ok(result.transition.transitionsReconciled > 1);
  assert.equal(result.transition.shouldAnimate, false);
  assert.ok(result.update.nextTransitionAt > now);
});

test("same persisted state and time produce the same schedule", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");
  const options = { now, timezone: "America/Vancouver" };
  assert.deepEqual(
    reconcileFairyRuntime(record(), options),
    reconcileFairyRuntime(record(), options)
  );
});

test("runtime response exposes semantic state without pixel coordinates", () => {
  const response = formatFairyRuntimeResponse(
    {
      id: "owned-fairy-1",
      fairyType: "BLOOM",
      name: "Bloom",
      level: 1,
      progression: 0
    },
    {
      currentState: "UNDER_TREE",
      currentLocation: "TREE",
      previousState: "IDLE",
      previousLocation: "DEFAULT_AREA",
      stateStartedAt: startedAt,
      nextTransitionAt: new Date("2026-08-26T12:00:00.000Z"),
      lastActiveAt: new Date("2026-08-26T11:00:05.000Z"),
      transitionId: "transition-1",
      runtimeVersion: 1
    },
    { shouldAnimate: true }
  );

  assert.deepEqual(response.fairy, {
    id: "owned-fairy-1",
    type: "BLOOM",
    name: "Bloom",
    level: 1,
    progression: 0
  });
  assert.equal(response.currentLocation, "TREE");
  assert.equal(response.previousLocation, "DEFAULT_AREA");
  assert.equal(response.shouldAnimate, true);
  assert.equal(response.transitionId, "transition-1");
  assert.equal("x" in response, false);
  assert.equal("y" in response, false);
});

test("time-of-day context uses the user's timezone", () => {
  const instant = new Date("2026-08-26T06:30:00.000Z");
  assert.equal(timeOfDay(instant, "America/Vancouver"), "NIGHT");
  assert.equal(timeOfDay(instant, "Asia/Tokyo"), "DAY");
});

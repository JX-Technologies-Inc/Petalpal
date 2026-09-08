import test from "node:test";
import assert from "node:assert/strict";

import {
  reconcileFairyRuntime,
  formatFairyRuntimeResponse
} from "../../lib/fairy-runtime.js";

const STABLE_STATES = [
  "SLEEPING",
  "TEA_TIME",
  "SWINGING",
  "AT_MAILBOX",
  "IDLE",
  "IN_TREEHOUSE"
];

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
    now: new Date("2026-08-26T10:30:00.000Z")
  });
  assert.equal(result.update.currentState, "IDLE");
  assert.equal(result.transition.changed, false);
});

test("fairy advances and requests animation only near the transition", () => {
  const result = reconcileFairyRuntime(record(), {
    now: new Date("2026-08-26T11:00:05.000Z")
  });
  assert.notEqual(result.update.currentState, "IDLE");
  assert.ok(["MOON_BED", "TEA_CHAIR", "SWING", "MAILBOX", "TREEHOUSE"].includes(
    result.update.currentLocation
  ));
  assert.equal(result.update.previousState, "IDLE");
  assert.equal(result.transition.shouldAnimate, true);
});

test("late resume reconciles all elapsed transitions without replaying animations", () => {
  const now = new Date("2026-08-27T03:00:00.000Z");
  const result = reconcileFairyRuntime(record(), {
    now
  });
  assert.ok(result.transition.transitionsReconciled > 1);
  assert.equal(result.transition.shouldAnimate, false);
  assert.ok(result.update.nextTransitionAt > now);
});

test("same persisted state and time produce the same schedule", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");
  const options = { now };
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
      currentState: "TEA_TIME",
      currentLocation: "TEA_CHAIR",
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
  assert.equal(response.currentLocation, "TEA_CHAIR");
  assert.equal(response.previousLocation, "DEFAULT_AREA");
  assert.equal(response.phase, "TRANSITIONING");
  assert.deepEqual(response.allowedActions, []);
  assert.equal(response.shouldAnimate, true);
  assert.equal(response.transitionId, "transition-1");
  assert.equal("x" in response, false);
  assert.equal("y" in response, false);
});

test("all stable states schedule their next transition in 30-120 minutes", () => {
  for (const currentState of STABLE_STATES) {
    const result = reconcileFairyRuntime(record({
      currentState,
      nextTransitionAt: null
    }), { now: startedAt });
    const durationMinutes =
      (result.update.nextTransitionAt.getTime() - startedAt.getTime()) / 60_000;
    assert.ok(durationMinutes >= 30 && durationMinutes <= 120, currentState);
  }
});

test("state selection is independent of timezone and time of day", () => {
  const now = new Date("2026-08-26T11:00:05.000Z");
  assert.deepEqual(
    reconcileFairyRuntime(record(), { now, timezone: "America/Vancouver" }),
    reconcileFairyRuntime(record(), { now, timezone: "Asia/Tokyo" })
  );
});

test("legacy runtime states normalize safely on lazy reconciliation", () => {
  const underTree = reconcileFairyRuntime(record({ currentState: "UNDER_TREE" }), {
    now: new Date("2026-08-26T10:30:00.000Z")
  });
  const sleepingOnFlower = reconcileFairyRuntime(record({
    currentState: "SLEEPING_ON_FLOWER"
  }), { now: new Date("2026-08-26T10:30:00.000Z") });

  assert.equal(underTree.update.currentState, "IN_TREEHOUSE");
  assert.equal(underTree.update.currentLocation, "TREEHOUSE");
  assert.equal(sleepingOnFlower.update.currentState, "SLEEPING");
  assert.equal(sleepingOnFlower.update.currentLocation, "MOON_BED");
});

test("legacy out-of-range schedules normalize once to the new duration window", () => {
  const legacy = record({
    currentState: "SLEEPING_ON_FLOWER",
    nextTransitionAt: new Date("2026-08-26T18:00:00.000Z")
  });
  const first = reconcileFairyRuntime(legacy, { now: startedAt });
  const durationMinutes =
    (first.update.nextTransitionAt.getTime() - startedAt.getTime()) / 60_000;
  assert.ok(durationMinutes >= 30 && durationMinutes <= 120);

  const persisted = reconcileFairyRuntime({
    ...legacy,
    ...first.update
  }, { now: startedAt });
  assert.equal(
    persisted.update.nextTransitionAt.getTime(),
    first.update.nextTransitionAt.getTime()
  );
});

test("stable states expose contextual allowed actions", () => {
  const expectations = {
    IDLE: ["CHAT", "STUDY_WITH_ME"],
    TEA_TIME: ["CHAT"],
    SWINGING: ["CHAT"],
    SLEEPING: ["CHAT"],
    AT_MAILBOX: ["CHAT"],
    IN_TREEHOUSE: ["ENTER_TREEHOUSE", "OPEN_DIY_JOURNAL"]
  };

  for (const [currentState, allowedActions] of Object.entries(expectations)) {
    const response = formatFairyRuntimeResponse(
      { id: "owned-fairy-1", fairyType: "BLOOM", name: "Bloom", level: 1, progression: 0 },
      {
        currentState,
        currentLocation: `${currentState}_LOCATION`,
        previousState: null,
        previousLocation: null,
        stateStartedAt: startedAt,
        nextTransitionAt: new Date("2026-08-26T12:00:00.000Z"),
        lastActiveAt: startedAt,
        transitionId: "transition-1",
        runtimeVersion: 1
      },
      { shouldAnimate: false }
    );
    assert.equal(response.phase, "STABLE");
    assert.deepEqual(response.allowedActions, allowedActions);
  }
});

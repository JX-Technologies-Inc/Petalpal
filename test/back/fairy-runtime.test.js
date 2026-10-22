import test from "node:test";
import assert from "node:assert/strict";

import {
  reconcileFairyRuntime,
  formatFairyRuntimeResponse,
  fairyDayPhase
} from "../../lib/fairy-runtime.js";
import { FAIRY_RUNTIME_CONFIG } from "../../lib/fairy-config.js";

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

test("retry within the animation window returns the same transition instruction", () => {
  const first = reconcileFairyRuntime(record(), {
    now: new Date("2026-08-26T11:00:05.000Z")
  });
  const retry = reconcileFairyRuntime({
    ...record(),
    ...first.update
  }, {
    now: new Date("2026-08-26T11:00:10.000Z")
  });

  assert.equal(retry.transition.transitionsReconciled, 0);
  assert.equal(retry.transition.shouldAnimate, true);
  assert.equal(retry.update.previousState, first.update.previousState);
  assert.equal(retry.update.currentState, first.update.currentState);
  assert.equal(retry.update.transitionId, first.update.transitionId);
});

test("retry after the animation window does not request replay", () => {
  const first = reconcileFairyRuntime(record(), {
    now: new Date("2026-08-26T11:00:05.000Z")
  });
  const retry = reconcileFairyRuntime({
    ...record(),
    ...first.update
  }, {
    now: new Date("2026-08-26T11:00:21.000Z")
  });

  assert.equal(retry.transition.shouldAnimate, false);
  assert.equal(retry.update.transitionId, first.update.transitionId);
});

test("late resume reconciles all elapsed transitions without replaying animations", () => {
  const now = new Date("2026-08-27T03:00:00.000Z");
  const result = reconcileFairyRuntime(record(), {
    now
  });
  assert.ok(result.transition.transitionsReconciled > 1);
  assert.equal(result.transition.shouldAnimate, false);
  assert.equal(result.update.transitionId, null);
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

test("daytime states schedule their next transition in 30-120 minutes; sleep by day ends at once", () => {
  const sleptByDay = reconcileFairyRuntime(record({ currentState: "SLEEPING", nextTransitionAt: null }), { now: startedAt });
  assert.notEqual(sleptByDay.update.currentState, "SLEEPING", "an older schedule's daytime sleep is ended");
  for (const currentState of STABLE_STATES.filter(state => state !== "SLEEPING")) {
    const result = reconcileFairyRuntime(record({
      currentState,
      nextTransitionAt: null
    }), { now: startedAt });
    const durationMinutes =
      (result.update.nextTransitionAt.getTime() - startedAt.getTime()) / 60_000;
    assert.ok(durationMinutes >= 30 && durationMinutes <= 120, currentState);
  }
});

test("the same instant is night in one account zone and day in another", () => {
  // 19:00Z = 04:00 in Tokyo (always asleep) and 12:00 in Vancouver (never asleep).
  const now = new Date("2026-08-26T19:00:00.000Z");
  assert.equal(reconcileFairyRuntime(record(), { now, timezone: "Asia/Tokyo" }).update.currentState, "SLEEPING");
  assert.notEqual(reconcileFairyRuntime(record(), { now, timezone: "America/Vancouver" }).update.currentState, "SLEEPING");
  // An unknown zone falls back to UTC (19:00 there: daytime).
  assert.notEqual(reconcileFairyRuntime(record(), { now, timezone: "Not/AZone" }).update.currentState, "SLEEPING");
});

const localClock = (at, timeZone) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
};

test("over 60 days she sleeps every night, never by day, and sometimes stays up late", () => {
  const { lateStates, lateChance } = FAIRY_RUNTIME_CONFIG.night;
  for (const timezone of ["Asia/Shanghai", "America/Vancouver"]) {
    let current = record({ userFairyId: `fairy-${timezone}`, stateStartedAt: new Date("2026-09-01T00:00:00Z"), nextTransitionAt: null });
    const lateNights = new Set(), nights = new Set();
    for (let at = new Date("2026-09-02T00:00:00Z"); at < new Date("2026-11-01T00:00:00Z"); at = new Date(at.getTime() + 20 * 60_000)) {
      const { update } = reconcileFairyRuntime(current, { now: at, timezone });
      current = { ...current, ...update };
      const { date, minutes } = localClock(at, timezone), state = update.currentState;
      if (minutes >= 60 && minutes < 360) assert.equal(state, "SLEEPING", `${timezone} ${at.toISOString()}`);
      if (minutes >= 450 && minutes < 1320) assert.notEqual(state, "SLEEPING", `${timezone} ${at.toISOString()}`);
      if (minutes >= 1320 && minutes < 1410) {
        nights.add(date);
        if (state !== "SLEEPING") { lateNights.add(date); assert.ok(lateStates.includes(state), `${state} at ${at.toISOString()}`); }
      }
    }
    const share = lateNights.size / nights.size;
    assert.ok(share > lateChance / 3 && share < lateChance * 2.5, `${timezone}: ${lateNights.size} late nights of ${nights.size}`);
  }
});

test("night boundaries stay on local wall-clock time across DST changes", () => {
  const { sleepHour, wakeHour, lateWakeHour, lateBedtimeHours: [from, to] } = FAIRY_RUNTIME_CONFIG.night;
  for (const timezone of ["America/New_York", "Europe/London", "Asia/Shanghai", "America/Vancouver"]) {
    for (let day = Date.UTC(2026, 9, 20); day <= Date.UTC(2026, 10, 10); day += 86_400_000) {
      const date = new Date(day).toISOString().slice(0, 10);
      // Local noon of `date`: search the day for it (the zone offset is unknown to the test).
      let localNoon = null;
      for (let t = day - 14 * 3_600_000; t < day + 38 * 3_600_000; t += 15 * 60_000) {
        const clock = localClock(new Date(t), timezone);
        if (clock.date === date && clock.minutes === 720) { localNoon = new Date(t); break; }
      }
      assert.ok(localNoon, `${timezone} ${date}`);
      const dayPhase = fairyDayPhase("dst-fairy", localNoon, timezone);
      assert.equal(dayPhase.phase, "DAY");
      assert.deepEqual(localClock(dayPhase.until, timezone), { date, minutes: sleepHour * 60 }, `${timezone} ${date} bedtime starts at 22:00`);
      const evening = fairyDayPhase("dst-fairy", dayPhase.until, timezone);
      let sleep = evening;
      if (evening.phase === "LATE") {
        const bedtime = localClock(evening.until, timezone), minutes = bedtime.minutes + (bedtime.date === date ? 0 : 1440);
        assert.ok(minutes >= from * 60 && minutes < to * 60, `${timezone} ${date} late bedtime ${minutes}`);
        sleep = fairyDayPhase("dst-fairy", evening.until, timezone);
      }
      assert.equal(sleep.phase, "SLEEP");
      assert.equal(localClock(sleep.until, timezone).minutes, (evening.phase === "LATE" ? lateWakeHour : wakeHour) * 60, `${timezone} ${date} wake`);
    }
  }
});

test("legacy runtime states normalize safely on lazy reconciliation", () => {
  const underTree = reconcileFairyRuntime(record({ currentState: "UNDER_TREE" }), {
    now: new Date("2026-08-26T10:30:00.000Z")
  });
  // Asleep at 03:00 UTC, inside any night.
  const night = new Date("2026-08-26T03:00:00.000Z");
  const sleepingOnFlower = reconcileFairyRuntime(record({
    currentState: "SLEEPING_ON_FLOWER", stateStartedAt: night, nextTransitionAt: null
  }), { now: new Date("2026-08-26T03:30:00.000Z") });

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

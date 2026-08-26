import { createHash } from "node:crypto";

export const FAIRY_RUNTIME_STATES = Object.freeze({
  IDLE: { location: "GARDEN_CENTER", next: "UNDER_TREE", minMinutes: 45, maxMinutes: 75 },
  UNDER_TREE: { location: "UNDER_TREE", next: "AT_MAILBOX", minMinutes: 30, maxMinutes: 60 },
  AT_MAILBOX: { location: "MAILBOX", next: "SLEEPING_ON_FLOWER", minMinutes: 20, maxMinutes: 40 },
  SLEEPING_ON_FLOWER: { location: "FAVORITE_FLOWER", next: "IDLE", minMinutes: 150, maxMinutes: 240 }
});

function stableFraction(seed) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 12);
  return Number.parseInt(hex, 16) / 0xffffffffffff;
}

function transitionAt(userId, state, startedAt) {
  const rule = FAIRY_RUNTIME_STATES[state] || FAIRY_RUNTIME_STATES.IDLE;
  const fraction = stableFraction(`${userId}:${state}:${startedAt.toISOString()}`);
  const minutes = rule.minMinutes + fraction * (rule.maxMinutes - rule.minMinutes);
  return new Date(startedAt.getTime() + Math.round(minutes * 60_000));
}

export function reconcileFairyRuntime(record, nowInput = new Date()) {
  const now = new Date(nowInput);
  let currentState = FAIRY_RUNTIME_STATES[record.currentState] ? record.currentState : "IDLE";
  let stateStartedAt = record.stateStartedAt ? new Date(record.stateStartedAt) : now;
  let nextTransitionAt = record.nextTransitionAt
    ? new Date(record.nextTransitionAt)
    : transitionAt(record.userId, currentState, stateStartedAt);
  let transitions = 0;
  let previousState = null;

  while (nextTransitionAt <= now && transitions < 10_000) {
    previousState = currentState;
    stateStartedAt = nextTransitionAt;
    currentState = FAIRY_RUNTIME_STATES[currentState].next;
    nextTransitionAt = transitionAt(record.userId, currentState, stateStartedAt);
    transitions += 1;
  }

  const currentLocation = FAIRY_RUNTIME_STATES[currentState].location;
  const shouldAnimate =
    transitions === 1 && now.getTime() - stateStartedAt.getTime() <= 15_000;

  return {
    update: {
      currentState,
      currentLocation,
      stateStartedAt,
      nextTransitionAt,
      lastActiveAt: now
    },
    transition: {
      changed: transitions > 0,
      previousState,
      currentState,
      currentLocation,
      transitionsReconciled: transitions,
      shouldAnimate
    }
  };
}

import { createHash } from "node:crypto";
import { FAIRY_RUNTIME_CONFIG } from "./fairy-config.js";

export const FAIRY_RUNTIME_STATES = Object.freeze(
  Object.fromEntries(
    Object.entries(FAIRY_RUNTIME_CONFIG.locations).map(([state, location]) => [
      state,
      { location }
    ])
  )
);

function stableFraction(seed) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 12);
  return Number.parseInt(hex, 16) / 0xffffffffffff;
}

export function timeOfDay(date, timezone = "UTC") {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23"
    }).format(date)
  );
  if (hour >= 21 || hour < 6) return "NIGHT";
  if (hour >= 17) return "EVENING";
  return "DAY";
}

function weightedState(userFairyId, currentState, at, timezone, version) {
  const period = timeOfDay(at, timezone);
  const weights = FAIRY_RUNTIME_CONFIG.transitions[currentState][period];
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = stableFraction(`${userFairyId}:state:${version}:${at.toISOString()}`) * total;
  for (const [state, weight] of entries) {
    roll -= weight;
    if (roll < 0) return state;
  }
  return entries.at(-1)[0];
}

function transitionAt(userFairyId, state, startedAt, version) {
  const [minMinutes, maxMinutes] = FAIRY_RUNTIME_CONFIG.durationsMinutes[state];
  const fraction = stableFraction(
    `${userFairyId}:duration:${state}:${version}:${startedAt.toISOString()}`
  );
  const minutes = minMinutes + fraction * (maxMinutes - minMinutes);
  return new Date(startedAt.getTime() + Math.round(minutes * 60_000));
}

function transitionId(userFairyId, version, startedAt) {
  return createHash("sha256")
    .update(`${userFairyId}:${version}:${startedAt.toISOString()}`)
    .digest("hex")
    .slice(0, 32);
}

export function reconcileFairyRuntime(record, options = {}) {
  const now = new Date(options.now || new Date());
  const timezone = options.timezone || "UTC";
  const userFairyId = record.userFairyId;
  let currentState = FAIRY_RUNTIME_STATES[record.currentState]
    ? record.currentState
    : "IDLE";
  let currentLocation = FAIRY_RUNTIME_CONFIG.locations[currentState];
  let previousState = record.previousState || null;
  let previousLocation = record.previousLocation || null;
  let stateStartedAt = record.stateStartedAt ? new Date(record.stateStartedAt) : now;
  let runtimeVersion = Number.isInteger(record.runtimeVersion)
    ? record.runtimeVersion
    : 0;
  let nextTransitionAt = record.nextTransitionAt
    ? new Date(record.nextTransitionAt)
    : transitionAt(userFairyId, currentState, stateStartedAt, runtimeVersion);
  let transitions = 0;

  while (nextTransitionAt <= now && transitions < 10_000) {
    const transitionTime = nextTransitionAt;
    previousState = currentState;
    previousLocation = currentLocation;
    currentState = weightedState(
      userFairyId,
      currentState,
      transitionTime,
      timezone,
      runtimeVersion
    );
    currentLocation = FAIRY_RUNTIME_CONFIG.locations[currentState];
    stateStartedAt = transitionTime;
    runtimeVersion += 1;
    nextTransitionAt = transitionAt(
      userFairyId,
      currentState,
      stateStartedAt,
      runtimeVersion
    );
    transitions += 1;
  }

  const shouldAnimate =
    transitions === 1 &&
    now.getTime() - stateStartedAt.getTime() <=
      FAIRY_RUNTIME_CONFIG.animationWindowMs;
  const currentTransitionId = transitionId(
    userFairyId,
    runtimeVersion,
    stateStartedAt
  );

  return {
    update: {
      currentState,
      currentLocation,
      previousState,
      previousLocation,
      stateStartedAt,
      nextTransitionAt,
      lastActiveAt: now,
      transitionId: currentTransitionId,
      runtimeVersion
    },
    transition: {
      changed: transitions > 0,
      transitionsReconciled: transitions,
      shouldAnimate
    }
  };
}

export function formatFairyRuntimeResponse(fairy, runtime, transition) {
  return {
    fairy: {
      id: fairy.id,
      type: fairy.fairyType,
      name: fairy.name,
      level: fairy.level,
      progression: fairy.progression
    },
    currentState: runtime.currentState,
    currentLocation: runtime.currentLocation,
    previousState: runtime.previousState,
    previousLocation: runtime.previousLocation,
    stateStartedAt: runtime.stateStartedAt,
    nextTransitionAt: runtime.nextTransitionAt,
    lastActiveAt: runtime.lastActiveAt,
    shouldAnimate: transition.shouldAnimate,
    transitionId: runtime.transitionId,
    runtimeVersion: runtime.runtimeVersion
  };
}

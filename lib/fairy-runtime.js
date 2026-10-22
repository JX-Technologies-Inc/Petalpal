import { createHash } from "node:crypto";
import { addLocalDays, localDateForInstant, localTimeToUtc, normalizeIanaTimezone } from "./ai-periods.js";
import { FAIRY_RUNTIME_CONFIG } from "./fairy-config.js";

export const FAIRY_RUNTIME_STATES = Object.freeze(
  Object.fromEntries(
    Object.entries(FAIRY_RUNTIME_CONFIG.locations).map(([state, location]) => [
      state,
      { location }
    ])
  )
);

const LEGACY_RUNTIME_STATES = Object.freeze({
  UNDER_TREE: "IN_TREEHOUSE",
  SLEEPING_ON_FLOWER: "SLEEPING"
});

function normalizeRuntimeState(state) {
  const normalized = LEGACY_RUNTIME_STATES[state] || state;
  return FAIRY_RUNTIME_STATES[normalized] ? normalized : "IDLE";
}

export function stableFraction(seed) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 12);
  return Number.parseInt(hex, 16) / 0xffffffffffff;
}

function weightedState(userFairyId, currentState, at, version, allowed) {
  const weights = FAIRY_RUNTIME_CONFIG.transitions[currentState];
  const entries = Object.entries(weights).filter(([state]) => allowed.has(state));
  if (!entries.length) return [...allowed].find(state => state !== currentState) ?? [...allowed][0];
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

// Day and night in the account time zone (FAIRY_RUNTIME_CONFIG.night). The evening of local
// date D starts her night; a late night has its own bedtime and a later wake-up on D + 1.
const NIGHT = FAIRY_RUNTIME_CONFIG.night;
const PHASE_STATES = Object.freeze({
  DAY: new Set(Object.keys(FAIRY_RUNTIME_CONFIG.locations).filter(state => state !== "SLEEPING")),
  LATE: new Set(NIGHT.lateStates),
  SLEEP: new Set(["SLEEPING"])
});
function nightOf(userFairyId, localDate, zone, cache) {
  const key = `${localDate}`;
  if (cache.has(key)) return cache.get(key);
  const late = stableFraction(`${userFairyId}:late-night:${localDate}`) < NIGHT.lateChance;
  const [from, to] = NIGHT.lateBedtimeHours;
  const start = localTimeToUtc(localDate, NIGHT.sleepHour * 60, zone);
  const bedtime = late
    ? localTimeToUtc(localDate, Math.floor((from + stableFraction(`${userFairyId}:bedtime:${localDate}`) * (to - from)) * 60), zone)
    : start;
  const wake = localTimeToUtc(addLocalDays(localDate, 1), (late ? NIGHT.lateWakeHour : NIGHT.wakeHour) * 60, zone);
  const night = { late, start, bedtime, wake };
  cache.set(key, night);
  return night;
}
// { phase: DAY | LATE | SLEEP, until: when it ends, next: the phase after it }.
export function fairyDayPhase(userFairyId, at, timezone, cache = new Map()) {
  const zone = normalizeIanaTimezone(timezone) || "UTC";
  const today = localDateForInstant(at, zone);
  const within = night => at < night.bedtime
    ? { phase: "LATE", until: night.bedtime, next: "SLEEP" }
    : { phase: "SLEEP", until: night.wake, next: "DAY" };
  const lastNight = nightOf(userFairyId, addLocalDays(today, -1), zone, cache);
  if (at < lastNight.wake) return within(lastNight);
  const tonight = nightOf(userFairyId, today, zone, cache);
  if (at >= tonight.start) return within(tonight);
  return { phase: "DAY", until: tonight.start, next: tonight.late ? "LATE" : "SLEEP" };
}

// When a state started at `startedAt` ends: its own 30–120 minutes, cut short where the next
// part of the day does not allow it. Sleep lasts until she wakes. A state the current part of
// the day does not allow (an older schedule) ends at once.
function stateEndsAt(userFairyId, state, startedAt, version, timezone, cache, natural = transitionAt(userFairyId, state, startedAt, version)) {
  let window = fairyDayPhase(userFairyId, startedAt, timezone, cache);
  if (!PHASE_STATES[window.phase].has(state)) return startedAt;
  if (window.phase === "SLEEP") return window.until;
  while (natural > window.until) {
    if (!PHASE_STATES[window.next].has(state)) return window.until;
    window = fairyDayPhase(userFairyId, window.until, timezone, cache);
  }
  return natural;
}
function nextState(userFairyId, currentState, at, version, timezone, cache) {
  const { phase } = fairyDayPhase(userFairyId, at, timezone, cache);
  return phase === "SLEEP" ? "SLEEPING" : weightedState(userFairyId, currentState, at, version, PHASE_STATES[phase]);
}

function transitionId(userFairyId, version, startedAt) {
  return createHash("sha256")
    .update(`${userFairyId}:${version}:${startedAt.toISOString()}`)
    .digest("hex")
    .slice(0, 32);
}

export function reconcileFairyRuntime(record, options = {}) {
  const now = new Date(options.now || new Date());
  const userFairyId = record.userFairyId;
  let currentState = normalizeRuntimeState(record.currentState);
  let currentLocation = FAIRY_RUNTIME_CONFIG.locations[currentState];
  let previousState = record.previousState
    ? normalizeRuntimeState(record.previousState)
    : null;
  let previousLocation = previousState
    ? FAIRY_RUNTIME_CONFIG.locations[previousState]
    : null;
  let stateStartedAt = record.stateStartedAt ? new Date(record.stateStartedAt) : now;
  let runtimeVersion = Number.isInteger(record.runtimeVersion)
    ? record.runtimeVersion
    : 0;
  // A persisted end inside the state's 30–120 minutes is kept; either way the day/night rules
  // apply, so a schedule written under older rules is brought in line.
  const timezone = options.timezone, nights = new Map();
  const persistedNextTransitionAt = record.nextTransitionAt ? new Date(record.nextTransitionAt) : null;
  const [minMinutes, maxMinutes] = FAIRY_RUNTIME_CONFIG.durationsMinutes[currentState];
  const persistedValid = persistedNextTransitionAt &&
    persistedNextTransitionAt.getTime() >= stateStartedAt.getTime() + minMinutes * 60_000 &&
    persistedNextTransitionAt.getTime() <= stateStartedAt.getTime() + maxMinutes * 60_000;
  let nextTransitionAt = stateEndsAt(userFairyId, currentState, stateStartedAt, runtimeVersion, timezone, nights,
    persistedValid ? persistedNextTransitionAt : undefined);
  let transitions = 0;
  // States entered at or after options.enteredSince, oldest first (Fairy Moments input).
  const enteredSince = options.enteredSince ? new Date(options.enteredSince) : null;
  const entered = [];

  while (nextTransitionAt <= now && transitions < 10_000) {
    const transitionTime = nextTransitionAt;
    previousState = currentState;
    previousLocation = currentLocation;
    currentState = nextState(userFairyId, currentState, transitionTime, runtimeVersion, timezone, nights);
    currentLocation = FAIRY_RUNTIME_CONFIG.locations[currentState];
    stateStartedAt = transitionTime;
    runtimeVersion += 1;
    nextTransitionAt = stateEndsAt(userFairyId, currentState, stateStartedAt, runtimeVersion, timezone, nights);
    transitions += 1;
    if (enteredSince && transitionTime >= enteredSince) {
      entered.push({ state: currentState, at: transitionTime, runtimeVersion });
    }
  }

  const currentTransitionId = transitions === 1
    ? transitionId(userFairyId, runtimeVersion, stateStartedAt)
    : transitions > 1
      ? null
      : record.transitionId || null;
  const animationAgeMs = now.getTime() - stateStartedAt.getTime();
  const shouldAnimate = Boolean(currentTransitionId && previousState) &&
    animationAgeMs >= 0 &&
    animationAgeMs <= FAIRY_RUNTIME_CONFIG.animationWindowMs;

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
    },
    entered
  };
}

export function formatFairyRuntimeResponse(fairy, runtime, transition) {
  const phase = transition.shouldAnimate ? "TRANSITIONING" : "STABLE";
  const allowedActions = phase === "TRANSITIONING"
    ? []
    : [...(FAIRY_RUNTIME_CONFIG.interactions[runtime.currentState] || [])];

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
    phase,
    allowedActions,
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

export const FAIRY_CATALOG = Object.freeze([
  { type: "BLOOM", name: "Bloom", unlockSource: "ONBOARDING" },
  { type: "LUMI", name: "Lumi", unlockSource: "MONTHLY_ACTIVITY" },
  { type: "MOSS", name: "Moss", unlockSource: "MONTHLY_ACTIVITY" },
  { type: "ASTER", name: "Aster", unlockSource: "MONTHLY_ACTIVITY" }
]);

export const STARTER_FAIRY = FAIRY_CATALOG[0];
export const MONTHLY_FAIRY_UNLOCK_ACTIVE_DAYS = 20;

export function withOnboardingGuideFairy(fairyState) {
  return {
    ...fairyState,
    guideFairyType: STARTER_FAIRY.type,
    guideFairy: {
      type: STARTER_FAIRY.type,
      name: STARTER_FAIRY.name
    }
  };
}

export const FAIRY_RUNTIME_CONFIG = Object.freeze({
  animationWindowMs: 20_000,
  durationsMinutes: {
    IDLE: [30, 90],
    UNDER_TREE: [60, 180],
    AT_MAILBOX: [20, 60],
    SLEEPING_ON_FLOWER: [240, 480]
  },
  locations: {
    IDLE: "DEFAULT_AREA",
    UNDER_TREE: "TREE",
    AT_MAILBOX: "MAILBOX",
    SLEEPING_ON_FLOWER: "FLOWER"
  },
  transitions: {
    IDLE: {
      DAY: { UNDER_TREE: 6, AT_MAILBOX: 2, SLEEPING_ON_FLOWER: 1 },
      EVENING: { UNDER_TREE: 4, AT_MAILBOX: 4, SLEEPING_ON_FLOWER: 2 },
      NIGHT: { UNDER_TREE: 1, AT_MAILBOX: 1, SLEEPING_ON_FLOWER: 8 }
    },
    UNDER_TREE: {
      DAY: { IDLE: 6, AT_MAILBOX: 3, SLEEPING_ON_FLOWER: 1 },
      EVENING: { IDLE: 3, AT_MAILBOX: 5, SLEEPING_ON_FLOWER: 2 },
      NIGHT: { IDLE: 1, AT_MAILBOX: 1, SLEEPING_ON_FLOWER: 8 }
    },
    AT_MAILBOX: {
      DAY: { IDLE: 5, UNDER_TREE: 4, SLEEPING_ON_FLOWER: 1 },
      EVENING: { IDLE: 3, UNDER_TREE: 4, SLEEPING_ON_FLOWER: 3 },
      NIGHT: { IDLE: 1, UNDER_TREE: 1, SLEEPING_ON_FLOWER: 8 }
    },
    SLEEPING_ON_FLOWER: {
      DAY: { IDLE: 7, UNDER_TREE: 3 },
      EVENING: { IDLE: 5, UNDER_TREE: 5 },
      NIGHT: { IDLE: 3, UNDER_TREE: 7 }
    }
  }
});

export function nextUnlockableFairy(ownedTypes) {
  const owned = new Set(ownedTypes);
  return FAIRY_CATALOG.find(
    (fairy) => fairy.unlockSource === "MONTHLY_ACTIVITY" && !owned.has(fairy.type)
  ) || null;
}

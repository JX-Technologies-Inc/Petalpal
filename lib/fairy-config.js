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
    SLEEPING: [30, 120],
    TEA_TIME: [30, 120],
    SWINGING: [30, 120],
    AT_MAILBOX: [30, 120],
    IDLE: [30, 120],
    IN_TREEHOUSE: [30, 120]
  },
  locations: {
    SLEEPING: "MOON_BED",
    TEA_TIME: "TEA_CHAIR",
    SWINGING: "SWING",
    AT_MAILBOX: "MAILBOX",
    IDLE: "DEFAULT_AREA",
    IN_TREEHOUSE: "TREEHOUSE"
  },
  transitions: {
    IDLE: {
      TEA_TIME: 3,
      SWINGING: 3,
      AT_MAILBOX: 2,
      SLEEPING: 2,
      IN_TREEHOUSE: 1
    },
    TEA_TIME: {
      IDLE: 4,
      SWINGING: 2,
      AT_MAILBOX: 2,
      SLEEPING: 1,
      IN_TREEHOUSE: 1
    },
    SWINGING: {
      IDLE: 4,
      TEA_TIME: 2,
      AT_MAILBOX: 2,
      SLEEPING: 1,
      IN_TREEHOUSE: 1
    },
    AT_MAILBOX: {
      IDLE: 4,
      TEA_TIME: 2,
      SWINGING: 2,
      SLEEPING: 1,
      IN_TREEHOUSE: 1
    },
    SLEEPING: {
      IDLE: 4,
      TEA_TIME: 2,
      SWINGING: 2,
      AT_MAILBOX: 1,
      IN_TREEHOUSE: 1
    },
    IN_TREEHOUSE: {
      IDLE: 4,
      TEA_TIME: 2,
      SWINGING: 2,
      AT_MAILBOX: 1,
      SLEEPING: 1
    }
  },
  interactions: {
    SLEEPING: ["CHAT"],
    TEA_TIME: ["CHAT"],
    SWINGING: ["CHAT"],
    AT_MAILBOX: ["CHAT"],
    IDLE: ["CHAT", "STUDY_WITH_ME"],
    IN_TREEHOUSE: ["ENTER_TREEHOUSE", "OPEN_DIY_JOURNAL"]
  }
});

export function nextUnlockableFairy(ownedTypes) {
  const owned = new Set(ownedTypes);
  return FAIRY_CATALOG.find(
    (fairy) => fairy.unlockSource === "MONTHLY_ACTIVITY" && !owned.has(fairy.type)
  ) || null;
}

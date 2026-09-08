const FAIRY_EVENTS = Object.freeze({
  FIRST_LOGIN: Object.freeze({
    code: "FIRST_LOGIN",
    dialogueKey: "fairy.first_login",
    actionKey: "FAIRY_APPEARS"
  }),
  FIRST_FLOWER: Object.freeze({
    code: "FIRST_FLOWER",
    dialogueKey: "fairy.first_flower",
    actionKey: "CELEBRATE_FLOWER"
  }),
  RETURN_DAY_2: Object.freeze({
    code: "RETURN_DAY_2",
    dialogueKey: "fairy.return_day_2",
    actionKey: "WELCOME_BACK"
  }),
  RARE_FLOWER: Object.freeze({
    code: "RARE_FLOWER",
    dialogueKey: "fairy.rare_flower",
    actionKey: "CELEBRATE_RARE_FLOWER"
  })
});

export function resolveFairyEvent({
  onboardingStep,
  onboardingCompleted,
  distinctCheckInCount = 0,
  newFlowerRarity = null
}) {
  if (
    onboardingCompleted !== true &&
    onboardingStep === "EMPTY_GARDEN" &&
    distinctCheckInCount === 0
  ) {
    return FAIRY_EVENTS.FIRST_LOGIN;
  }
  if (distinctCheckInCount === 1) return FAIRY_EVENTS.FIRST_FLOWER;
  if (distinctCheckInCount === 2) return FAIRY_EVENTS.RETURN_DAY_2;
  if (newFlowerRarity === "RARE") return FAIRY_EVENTS.RARE_FLOWER;
  return null;
}

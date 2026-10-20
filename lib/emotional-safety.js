// Server copy of the bounded immediate-danger rule in
// mobile/src/services/emotionalSafety.ts; keep the two patterns identical.
// It only decides what a report leaves out. It never diagnoses, blocks saving,
// notifies anyone or claims comprehensive risk detection.
const IMMEDIATE_EN = /\b(?:i (?:am going to|plan to|will) (?:kill|hurt) myself (?:now|tonight|today)|i (?:have )?just (?:took|taken) an overdose|i cannot keep myself safe)\b/u;
const IMMEDIATE_ZH = /我(?:现在|今晚|今天)(?:要|打算)(?:自杀|伤害自己)|我刚(?:刚)?(?:服药过量|吃了过量的药)|我无法保证自己的安全/u;

export function immediateSupportRequired(text) {
  const value = String(text ?? "").normalize("NFKC").replace(/[\p{Cf}]/gu, "").toLowerCase();
  return IMMEDIATE_EN.test(value) || IMMEDIATE_ZH.test(value);
}

// Reviewed wording from the mobile hint, without the "save this entry" line.
export const REPORT_SUPPORT_TEXT = Object.freeze({
  en: "You do not have to face this alone. If there is danger now, contact local emergency services, move somewhere safer if you can, and ask someone you trust to stay with you. PetalPal cannot provide emergency response and does not automatically notify anyone.",
  "zh-Hans": "你不必独自面对。如果现在有危险，请联系当地紧急服务，并尽可能到安全的地方，请信任的人陪伴。PetalPal 无法提供紧急救援，也不会自动通知他人。"
});

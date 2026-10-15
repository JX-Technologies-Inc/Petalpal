// Local, bounded UI hint only. Never uploads text, diagnoses, blocks saving or
// claims comprehensive risk detection. The always-visible help path is primary.
export const GENERAL_SUPPORT = 'PetalPal is for reflection, not medical advice or emergency response. If you or someone else is in immediate danger, contact local emergency services or a trusted person who can help now.';
export function immediateSupportHint(text:string):string|null {
 const value=text.normalize('NFKC').replace(/[\p{Cf}]/gu,'').toLowerCase();
 const immediate=/\b(?:i (?:am going to|plan to|will) (?:kill|hurt) myself (?:now|tonight|today)|i (?:have )?just (?:took|taken) an overdose|i cannot keep myself safe)\b/u.test(value) || /我(?:现在|今晚|今天)(?:要|打算)(?:自杀|伤害自己)|我刚(?:刚)?(?:服药过量|吃了过量的药)|我无法保证自己的安全/u.test(value);
 if(!immediate)return null;
 return /[\p{Script=Han}]/u.test(value)
 ? '你不必独自面对这一刻。如果现在有危险，请联系当地紧急服务，并尽可能到安全的地方，请信任的人陪伴。PetalPal 无法提供紧急救援，也不会自动通知他人。你仍然可以保存这篇记录。'
 : 'You do not have to face this moment alone. If there is danger now, contact local emergency services, move somewhere safer if you can, and ask someone you trust to stay with you. PetalPal cannot provide emergency response and does not automatically notify anyone. You can still save this entry.';
}

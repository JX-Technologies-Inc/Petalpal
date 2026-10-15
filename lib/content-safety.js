// Independently authored PetalPal policy rules; no third-party dictionaries.
// See docs/content-safety.md. This is deliberately not semantic moderation.
export const CONTENT_SAFETY_POLICY = "petalpal-content-v1.1";
export const CONTENT_REJECTED = "CONTENT_REJECTED";

const gap = "[\\s\\p{P}\\p{S}]{0,3}";
const leet = { a: "[a@4]", e: "[e3]", i: "[i1!|]", o: "[o0]", s: "[s$5]", t: "[t7]" };
const term = word => [...word].map(c => leet[c] || c).join(gap);
const profane = `(?:${["fuck", "fucker", "bitch", "asshole", "cunt"].map(term).join("|")})`;
const insult = `(?:${profane}|idiot|scum|worthless trash)`;
const group = "(?:women|men|muslims|jews|christians|black people|white people|chinese people|gay people|trans people|immigrants)";
const english = source => new RegExp(`(?<![\\p{Script=Latin}\\p{N}])(?:${source})(?![\\p{Script=Latin}\\p{N}])`, "gu");
const chinese = source => new RegExp(source, "gu");
const threatRule = english(`(?:i\\s+(?:will|am going to)|i'm\\s+going\\s+to)\\s+(?:kill|murder|shoot|stab)\\s+(?:you|him|her|them)(?!\\s+(?:a message|an email|a text|in chess))`);
const rules = [
  english(`${term("fuck")}\\s+(?:you|u)|shut\\s+the\\s+${term("fuck")}\\s+up`),
  english(`you(?:'re|\\s+are)?\\s+(?:(?:a|an)\\s+)?(?:fucking\\s+)?${insult}`),
  english(`(?:all\\s+)?${group}\\s+(?:are\\s+(?:subhuman|vermin)|(?:should|must|deserve\\s+to)\\s+die)`),
  threatRule,
  // Specific promotional/instructional formulations; no operational instructions.
  english("(?:here(?:'s| is) how to|follow these steps to)\\s+(?:build a bomb(?![ -](?:shelter|proof))|poison someone|kill someone)"),
  english("(?:you should|go and)\\s+(?:kill yourself|murder them)"),
  chinese(`(?:操${gap}你${gap}妈|肏${gap}你${gap}妈|你[\\p{Zs}\\t]{0,3}(?:这个|就是|是个|是)?${gap}(?:傻${gap}[逼比]|蠢货|废物|贱人))`),
  chinese("(?:女人|男人|穆斯林|犹太人|黑人|白人|中国人|同性恋|跨性别者|移民)(?:全都|都|就)?(?:该死|必须死|是低等人|不是人)"),
  chinese("我(?:今晚|明天|现在)?(?:一定要|要|会|将)(?:杀死|杀了|捅死|枪杀)(?:你|他|她|他们|她们)"),
  chinese("(?:教你如何|按这些步骤|下面是)(?:制造炸弹|给人下毒|杀人的方法)|你(?:应该|赶紧|快去)自杀"),
];
const isolated = new RegExp(`^(?:${profane}|${term("shit")}|傻${gap}[逼比]|操${gap}你${gap}妈)[\\s!！。.,，]*$`, "u");

// Scope context to the immediately attributed phrase/quotation. A help-seeking
// word elsewhere in the submission never grants a blanket bypass.
const reportedPrefix = /(?:(?:he|she|they|someone|the bully|my bully)\s+(?:said|shouted|wrote|texted)(?:\s+to me)?|(?:he|she|they)\s+called me|i was told|i was threatened with|i keep remembering the words|please (?:do not|don't) say|(?:他|她|他们|有人|同学|霸凌者|爸爸|妈妈|父亲|母亲|哥哥|姐姐|弟弟|妹妹)(?:对我)?(?:说|喊|骂我)|我被骂|请不要说)[\s:：,，]*$/u;
const fearPrefix = /(?:i(?:'m| am) (?:afraid|worried|scared)(?: that)?|我(?:很)?(?:害怕|担心))\s*$/u;
const rejectionPrefix = /(?:i (?:do not|don't) (?:believe|think)(?: that)?|i reject the claim that|我(?:不认为|不觉得|不相信)|我反对(?:这种说法)?[:：]?)\s*$/u;

function analysisText(content) {
  let text = content.normalize("NFKC").normalize("NFD").replace(/[\p{M}\p{Cf}]/gu, "").toLowerCase();
  // Fold common apostrophe equivalents only inside Latin contractions. Keep
  // quotation delimiters intact so attributed Chinese/English quotes still work.
  text = text.replace(/(?<=\p{Script=Latin})[’‘ʼ](?=\p{Script=Latin})/gu, "'");
  // Only mask paired quotations with an explicit reporting frame, never every
  // quoted span. Preserve offsets while masking; storage always uses the input.
  text = text.replace(/"[^"\n]{1,1000}"|'[^'\n]{1,1000}'|“[^”\n]{1,1000}”|「[^」\n]{1,1000}」|‘[^’\n]{1,1000}’/gu,
    (quote, offset) => reportedPrefix.test(text.slice(Math.max(0, offset - 120), offset)) ? " ".repeat(quote.length) : quote);
  return text;
}

export function assertContentAllowed(content) {
  // Callers perform their existing type/size validation first.
  const text = analysisText(content);
  let rejected = isolated.test(text.trim());
  let supportRequired = false;
  for (const rule of rules) {
    rule.lastIndex = 0;
    for (const match of text.matchAll(rule)) {
      const before = text.slice(Math.max(0, match.index - 120), match.index);
      if (reportedPrefix.test(before) || rejectionPrefix.test(before)) continue;
      rejected = true;
      // Fear of a concrete violent action is ambiguous, not an allowlist. Stop
      // writes/AI and offer a fixed supportive response instead of abuse wording.
      if (rule === threatRule && fearPrefix.test(before)) supportRequired = true;
    }
  }
  if (rejected) {
    const error = new Error("Please revise this entry to remove abusive or dangerous language. You can still describe difficult experiences and ask for help.");
    error.code = CONTENT_REJECTED;
    error.status = 422;
    error.supportRequired = supportRequired;
    throw error;
  }
}

export function contentSafetyResponse(req, error) {
  const locale = req.acceptsLanguages("en", "zh-CN", "zh");
  const chinesePreferred = typeof locale === "string" && locale.startsWith("zh");
  return {
    error: error?.supportRequired ? (chinesePreferred
      ? "这篇内容尚未保存。如果你担心自己可能伤害他人，请先与对方和可能用于伤人的物品保持距离，并联系信任的人寻求支持。如果有人面临紧迫危险，请联系当地紧急服务。你可以继续记录感受和寻求帮助。"
      : "This entry was not saved. If you are worried you might hurt someone, put distance between yourself, that person and anything you could use to hurt them, and contact someone you trust for support. If anyone is in immediate danger, contact local emergency services. You can still describe your feelings and ask for support.") : chinesePreferred
      ? "请修改这篇内容，移除辱骂或危险言论。你仍然可以记录困难经历和寻求帮助。"
      : "Please revise this entry to remove abusive or dangerous language. You can still describe difficult experiences and ask for help.",
    code: CONTENT_REJECTED,
    policyVersion: CONTENT_SAFETY_POLICY
  };
}

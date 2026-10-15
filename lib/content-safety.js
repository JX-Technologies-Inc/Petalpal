// Independently authored PetalPal policy rules; no third-party dictionaries.
// See docs/content-safety.md. This is deliberately not semantic moderation.
export const CONTENT_SAFETY_POLICY = "petalpal-content-v1.2";
export const CONTENT_REJECTED = "CONTENT_REJECTED";

const gap = "[\\s\\p{P}\\p{S}]{0,3}";
// Lookalikes are recognized inside these terms only, never folded globally.
const leet = { a: "[a@4]", c: "[cс]", e: "[e3]", i: "[i1!|]", o: "[o0]", s: "[s$5]", t: "[t7]" };
const term = word => [...word].map(c => leet[c] || c).join(gap);
const profane = `(?:${["fuck", "fucks", "fucked", "fucking", "fucker", "fuckers", "motherfucker", "motherfuckers", "shit", "shitty", "bullshit", "bitch", "bitches", "asshole", "assholes", "cunt"].map(term).join("|")}|b${gap}[i1!|]{2,4}${gap}t${gap}[cс]${gap}h)`;
const insult = `(?:${profane}|idiot|scum|worthless trash)`;
const group = "(?:women|men|muslims|jews|christians|black people|white people|chinese people|gay people|trans people|immigrants)";
const english = (source, flags = "giu") => new RegExp(`(?<![\\p{Script=Latin}\\p{N}])(?:${source})(?![\\p{Script=Latin}\\p{N}])`, flags);
const chinese = source => new RegExp(source, "gu");
const subject = "(?:you|he|she|they|i|[a-z]{1,30})";
const predicate = `(?:(?:a|an)\\s+)?(?:fucking\\s+)?${insult}`;
const chineseInsult = `(?:傻${gap}[逼比]|蠢货|废物|贱人|sha[ \\t]{0,3}bi(?![a-z]))`;
const benignThreatSuffix = "(?!\\s+(?:a message|an email|a text|in chess)\\b)";
const threatRule = english(`(?:i(?:'ll|'m\\s+going\\s+to|\\s+(?:w[i1]ll|am going to)))\\s+(?:k[i1]ll|murder|shoot|stab)\\s+(?:you|him|her|them)${benignThreatSuffix}`);
// A bounded capitalized Latin name, not every arbitrary object of a verb.
const namedThreatRule = english(`(?:[Ii](?:'ll|'m going to| (?:w[i1]ll|am going to)))\\s+(?:k[i1]ll|murder|shoot|stab)\\s+(?!Time\\b|Myself\\b|The\\b|A\\b)[A-Z][a-z]{1,29}${benignThreatSuffix}`, "gu");
const chineseThreatRule = chinese("我(?:今晚|明天|现在)?(?:一定要|要|会|将)(?:杀死|杀了|杀|捅死|枪杀)(?:你|他|她|他们|她们)");
const harmfulAction = "(?:build a bomb(?![ -](?:shelter|proof))|poison someone|kill someone)";
const rules = [
  english(profane),
  english(`(?:you(?:'re|\\s+are)?|${subject}(?:'s|\\s+(?:is|are)))\\s+${predicate}`),
  english(`(?:all\\s+)?${group}\\s+(?:are\\s+(?:subhuman|vermin)|(?:should|must|deserve\\s+to)\\s+(?:die|be killed))`),
  threatRule, namedThreatRule, chineseThreatRule,
  english(`(?:here(?:'s| is) how to|follow these steps to|how (?:can|do) i|how to)\\s+${harmfulAction}`),
  english("(?:you should|go and)\\s+(?:kill yourself|murder them)"),
  chinese(`(?:他${gap}妈${gap}的|操${gap}你${gap}妈|肏${gap}你${gap}妈|傻${gap}[逼比])`),
  chinese(`(?:你|他|她)[\\p{Zs}\\t]{0,3}(?:这个|就是|是个|是)?${gap}${chineseInsult}`),
  chinese("(?:女人|男人|穆斯林|犹太人|黑人|白人|中国人|同性恋|跨性别者|移民)(?:全都|都|就)?(?:该死|必须死|是低等人|不是人)"),
  chinese("(?:教你如何|按这些步骤|下面是|怎么|如何)(?:制造炸弹|给人下毒|杀人的方法)|你(?:应该|赶紧|快去)自杀"),
];

// These frames protect the immediately matched phrase or attributed quotation,
// never the rest of a sentence/submission. Negative predicates protect only their
// matched abuse phrase; a following independent attack must still be checked.
const reportedPrefix = /(?:(?:he|she|they|someone|the bully|my (?:bully|father|mother|dad|mom)|the (?:villain|character|historical record))\s+(?:said|says|shouted|wrote|texted|told me)(?:\s+to me)?|(?:he|she|they)\s+called me|i was told|i was threatened with|i keep remembering the words|please (?:do not|don't) say|(?:他|她|他们|有人|同学|霸凌者|爸爸|妈妈|父亲|母亲|哥哥|姐姐|弟弟|妹妹|角色|史料)(?:对我)?(?:说|喊|骂我)|我被骂|请不要说)(?:\s+(?:a|an))?[\s:：,，]*$/iu;
const fearPrefix = /(?:i(?:'m| am) (?:afraid|worried|scared)(?: that)?|我(?:很)?(?:害怕|担心))\s*$/iu;
const rejectionPrefix = /(?:i (?:do not|don't) (?:believe|think)(?: that)?|nobody believes(?: that)?|i (?:do not|don't) want to learn|i reject the claim that|我(?:不认为|不觉得|不相信|不想知道)|我反对(?:这种说法)?[:：]?)\s*$/iu;
const fictionPrefix = /(?:in (?:my|the) (?:novel|story|screenplay)|在(?:我的)?(?:小说|故事|剧本)里)[\s,:：，]*$/iu;
const negatedAbuse = [
  english(`${subject}(?:'m|'re|'s|\\s+(?:am|is|are))\\s+(?:not|never)\\s+${predicate}`),
  chinese(`(?:我|你|他|她)不是(?:个)?${chineseInsult}`),
];
const protectedPrefix = before => reportedPrefix.test(before) || rejectionPrefix.test(before) || fictionPrefix.test(before);

function analysisText(content) {
  let text = content.normalize("NFKC").normalize("NFD").replace(/[\p{M}\p{Cf}]/gu, "");
  // Preserve case for bounded proper-name threats and quotation delimiters.
  text = text.replace(/(?<=\p{Script=Latin})[’‘ʼ](?=\p{Script=Latin})/gu, "'");
  text = text.replace(/"[^"\n]{1,1000}"|(?<!\p{Script=Latin})'[^'\n]{1,1000}'|“[^”\n]{1,1000}”|「[^」\n]{1,1000}」|‘[^’\n]{1,1000}’/gu,
    (quote, offset) => protectedPrefix(text.slice(Math.max(0, offset - 160), offset)) ? " ".repeat(quote.length) : quote);
  return text;
}

export function assertContentAllowed(content) {
  // Callers perform their existing type/size validation first.
  const text = analysisText(content);
  const protectedCharacters = new Uint8Array(text.length);
  const matches = [];
  for (const rule of [...rules, ...negatedAbuse]) {
    rule.lastIndex = 0;
    for (const match of text.matchAll(rule)) {
      const start = match.index, end = start + match[0].length;
      const before = text.slice(Math.max(0, start - 160), start);
      if (negatedAbuse.includes(rule) || protectedPrefix(before)) protectedCharacters.fill(1, start, end);
      else matches.push({ start, end, supportive: [threatRule, namedThreatRule, chineseThreatRule].includes(rule) && fearPrefix.test(before) });
    }
  }
  // Nested lexical matches inherit only an actually protected phrase's span.
  const rejected = matches.filter(({ start, end }) => !protectedCharacters.subarray(start, end).every(Boolean));
  if (rejected.length) {
    const error = new Error("Please revise this entry to remove abusive or dangerous language. You can still describe difficult experiences and ask for help.");
    error.code = CONTENT_REJECTED;
    error.status = 422;
    error.supportRequired = rejected.some(match => match.supportive);
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

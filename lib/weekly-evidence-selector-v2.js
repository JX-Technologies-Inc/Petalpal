import { REPORT_EVIDENCE_LIMITS } from "./report-foundation.js";
import { requireAiIdentity } from "./ai-identity.js";
import { buildReflectionV2 } from "./reflection-v2.js";
import { localDateForInstant } from "./ai-periods.js";

// Opt-in Weekly candidate. No retrieval, authorization, inference or persistence.
const invalid = (code = "REPORT_NARRATIVE_INVALID_INPUT") => {
  throw Object.assign(new Error("Weekly evidence is unavailable"), { code });
};
const norm = text => text.normalize("NFC").replace(/\s+/gu, " ").trim();
const order = (a, b) => (b.similarity ?? 0) - (a.similarity ?? 0) ||
  (b.importanceScore ?? 0) - (a.importanceScore ?? 0) || +new Date(a.eventDate) - +new Date(b.eventDate) ||
  a.sourceEventId.localeCompare(b.sourceEventId) || a.id.localeCompare(b.id);
const theme = row => [...(row.topics ?? [])].filter(t => t.trim()).map(t => t.trim().toLocaleLowerCase("en")).sort()[0] || `event:${row.sourceEventId}`;
const cost = row => row.summary.length + 96;

// These function words/time labels do not establish a specific content link.
// This is a conservative lexical gate, not a semantic score or identity claim.
const STOP = new Set(("i me my myself we us our you your he him his she her it its they them their " +
  "a an the and or but if so as at by for from in into of on to with is am are was were be been being " +
  "have has had do does did not no never this that these those there here about after before because " +
  "can could may might must should will would just still already again now then today yesterday tomorrow " +
  "day days week weeks monday tuesday wednesday thursday friday saturday sunday some any all very really " +
  "我 我们 你 你们 他 她 它 他们 她们 自己 这个 那个 这些 那些 今天 昨天 明天 这周 上周 " +
  "周一 周二 周三 周四 周五 周六 周日 时候 后来 还是 已经 现在 然后 因为 所以 但是 不过 " +
  "没有 不是 不会 不能 还有 一个 一些 什么 觉得 有点 一起 可以 这样 那样 " +
  "的 了 着 过 在 是 有 没 不 再 很 太 挺 也 和 或 而 与 又 还 就 都 这 那 个 些 只 把 被 让 给 " +
  "从 对 到 要 会 所 呢 吗 啊 来 去 说 做 看 想 记 试 上 下 一 中 于 为 及 将 以").split(/\s+/u));
function words(text, segmenter) {
  return new Set([...segmenter.segment(text)].filter(part => part.isWordLike).map(part =>
    part.segment.normalize("NFC").toLocaleLowerCase("en").replace(/['’]s$/u, ""))
    // Dictionary segmentation can legitimately return single-character Han nouns.
    .filter(word => ([...word].length >= 2 || /^\p{Script=Han}$/u.test(word)) && /\p{L}/u.test(word) && !STOP.has(word)));
}

// A short correction can share only one content word ("I am happy" / "I am
// not happy"). Retain that surface change without interpreting its polarity.
const NEGATORS = new Set(["not", "no", "never", "不", "没", "没有", "不是", "并非", "不再"]);
function correctionForm(text, segmenter) {
  let count = 0;
  const key = [...segmenter.segment(text)].filter(part => part.isWordLike).flatMap(part => {
    const word = part.segment.normalize("NFC").toLocaleLowerCase("en");
    if (NEGATORS.has(word)) { count++; return []; }
    if (word === "cannot" || word === "can't" || word === "can’t") { count++; return ["can"]; }
    if (word === "won't" || word === "won’t") { count++; return ["will"]; }
    if (/n['’]t$/u.test(word)) { count++; return [word.replace(/n['’]t$/u, "")]; }
    return [word];
  });
  return { key: JSON.stringify(key), count };
}

// Opt-in significance ordering (AI_WEEKLY_EVIDENCE_SIGNIFICANCE, requires V2). It only
// ORDERS owner-scoped candidates; it never rewrites text, never reaches the packet and
// never scores emotion, polarity, intensity or psychology. Signals, in priority order:
// 1. Repetition: a record whose content words largely repeat a higher-ranked record
//    (Jaccard >= 0.6, negated corrections exempt) is deferred; frequency is not significance.
// 2. Explicit importanceScore, honoured when present (it is null in production today).
// 3. Stated stance: a closed, polarity-neutral set of first-person wanting/valuing,
//    deciding, concern and open-question constructions. No emotion words are listed.
// 4. Day spread: within a tier, candidates interleave by local day (round-robin),
//    then similarity, then time, so the earliest day cannot absorb every slot.
// Shared topic labels never establish continuity on their own.
const STANCE = {
  en: new RegExp(String.raw`\b(?:i|we)(?:['’](?:m|ve|d|ll))?(?:\s+[^\s.!?;,]+){0,3}?\s+(?:likes?|liked|loved?|wanted|wants?|wish(?:ed)?|hoped?|miss(?:ed)?|keep|kept|decided?|choose|chose|agreed?|accept(?:ed)?|refused?|enjoy(?:ed)?|feel|felt|know|sure|wonder(?:ed)?|believe|regret(?:ted)?|prefer(?:red)?|cared?|worr(?:y|ied))\b` +
    String.raw`|(?:^|[.!?;]\s*)(?:decided|chose|agreed|accepted|refused|applied|asked for)\b` +
    String.raw`|\b(?:haven['’]t|hasn['’]t|have not|has not)\s+(?:yet\s+)?(?:decided|chosen|picked|signed|agreed|heard)\b|\b(?:not sure|undecided|don['’]t know|do not know)\b`, "iu"),
  "zh-Hans": /我[^，。！？；,.!?;]{0,4}?(?:喜欢|爱|想|希望|舍不得|决定|选择|同意|答应|拒绝|觉得|感觉|知道|确定|后悔|庆幸|期待|在乎|担心|怕)|(?:^|[，。！？；])(?:决定|选了|申请|答应|同意|拒绝)|还没有?(?:定|决定|选|想好|签|答应|回复)|不确定|拿不准|不知道/u
};
export function significanceOrder(rows, { locale, timezone }) {
  const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
  const base = [...rows].sort(order), info = new Map(base.map(row => [row, {
    words: words(row.summary, segmenter), labels: words((row.topics ?? []).join(" "), segmenter), correction: correctionForm(row.summary, segmenter),
    stance: STANCE[locale].test(norm(row.summary)), day: localDateForInstant(row.eventDate, timezone) }]));
  const reps = [];
  for (const row of [...base].sort((a, b) => info.get(b).stance - info.get(a).stance || order(a, b))) {
    const own = info.get(row);
    own.repeated = reps.some(rep => {
      const other = info.get(rep), shared = [...own.words].filter(w => other.words.has(w)).length;
      const union = new Set([...own.words, ...other.words]).size;
      const correction = own.correction.key === other.correction.key && own.correction.count !== other.correction.count;
      return union > 0 && shared / union >= 0.6 && !correction;
    });
    if (!own.repeated) reps.push(row);
  }
  const tier = row => [info.get(row).repeated ? 1 : 0, -(row.importanceScore ?? 0), info.get(row).stance ? 0 : 1];
  // Within a day: similarity, then more distinct specific content over a bare one-line
  // action (a bounded detail count, not a significance or emotion score), then time.
  const inDay = [...base].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0) ||
    info.get(b).words.size - info.get(a).words.size || order(a, b));
  const seen = new Map();
  for (const row of inDay) {
    const key = JSON.stringify([...tier(row), info.get(row).day]);
    info.get(row).round = seen.get(key) ?? 0; seen.set(key, info.get(row).round + 1);
  }
  const rank = row => [...tier(row), info.get(row).round];
  return base.sort((a, b) => { const x = rank(a), y = rank(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return order(a, b); }).map(row => ({ row, ...info.get(row) }));
}
// Bounded upstream pool: rank every already-loaded, owner-scoped period row, keep `take`.
// A textual link needs a shared specific content word that is not merely a topic label word.
const linkedText = (a, b) => [...a.words].some(w => b.words.has(w) && !a.labels.has(w) && !b.labels.has(w));
export const weeklySignificanceCandidates = (rows, { locale, timezone, take }) =>
  significanceOrder(rows, { locale, timezone }).slice(0, take).map(item => item.row);

// Mirror the existing Weekly adapter's allowlist; parity is tested against it.
function packet(evidence, { locale, timezone }) {
  return buildReflectionV2({ type: "WEEKLY", locale, timezone, items: evidence.map(row => ({
    text: row.summary.trim(), topics: row.topics.filter(t => t.trim()).slice(0, 10).filter(t => t.length <= 40),
    eventDate: row.eventDate, week: null, previous: false,
    source: { sourceEventId: row.sourceEventId, sourceMemoryId: row.sourceMemoryId }
  })) });
}

export function selectWeeklyEvidenceV2(args) {
  const ownerId = requireAiIdentity(args.identity), cap = REPORT_EVIDENCE_LIMITS.WEEKLY, limits = args.limits ?? cap;
  if (args.reportType !== "WEEKLY" || !["en", "zh-Hans"].includes(args.locale) || typeof args.timezone !== "string" ||
      !Array.isArray(args.candidates) || args.candidates.length > limits.candidateTake ||
      !["candidateTake", "maxEvidence", "maxContextCharacters"].every(k => Number.isInteger(limits[k]) && limits[k] > 0 && limits[k] <= cap[k]) ||
      limits.minimumEvidence !== cap.minimumEvidence || limits.maxPerTheme !== cap.maxPerTheme) invalid();
  const start = +new Date(args.periodStartUtc), end = +new Date(args.periodEndUtc);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) invalid();
  try { new Intl.DateTimeFormat("en", { timeZone: args.timezone }); } catch { invalid(); }

  const eligible = [];
  for (const row of args.candidates) {
    if (row?.ownerId !== ownerId || row.memoryProcessingAllowed === false) invalid("AI_FORBIDDEN");
    if ([row.similarity, row.importanceScore].some(v => v != null && (typeof v !== "number" || !Number.isFinite(v)))) invalid();
    if (row.memoryType !== "EVENT" || typeof row.id !== "string" || !row.id.trim() ||
        typeof row.sourceEventId !== "string" || !row.sourceEventId.trim() ||
        !Number.isFinite(+new Date(row.eventDate)) || +new Date(row.eventDate) < start || +new Date(row.eventDate) >= end) continue;
    if (typeof row.summary !== "string" || !row.summary.trim() ||
        (row.topics != null && (!Array.isArray(row.topics) || row.topics.some(t => typeof t !== "string")))) invalid();
    eligible.push(row);
  }
  // A source version must be unambiguous. Similarity may vary between duplicate
  // retrieval hits; source content, metadata and provenance may not.
  for (let i = 0; i < eligible.length; i++) for (const other of eligible.slice(0, i)) {
    const row = eligible[i];
    if ((row.id === other.id || row.sourceEventId === other.sourceEventId) &&
        (row.id !== other.id || row.sourceEventId !== other.sourceEventId || row.summary !== other.summary ||
         +new Date(row.eventDate) !== +new Date(other.eventDate) ||
         JSON.stringify(row.topics ?? []) !== JSON.stringify(other.topics ?? []) ||
         (row.importanceScore ?? null) !== (other.importanceScore ?? null))) invalid("REPORT_SOURCE_STALE");
  }
  eligible.sort(order);
  const unique = [], ids = new Set(), memories = new Set(), texts = new Set();
  for (const row of eligible) {
    const text = norm(row.summary);
    // Never use token overlap, negation lists or case folding to merge claims.
    if (ids.has(row.sourceEventId) || memories.has(row.id) || texts.has(text)) continue;
    ids.add(row.sourceEventId); memories.add(row.id); texts.add(text); unique.push(row);
  }
  if (args.significance !== undefined && typeof args.significance !== "boolean") invalid();
  const significance = args.significance === true;
  const ranked = significance ? significanceOrder(unique, args) : null;
  if (ranked) unique.splice(0, unique.length, ...ranked.map(item => item.row));
  const position = new Map(unique.map((row, index) => [row, index]));
  const meta = ranked ? new Map(ranked.map(item => [item.row, item])) : null, firsts = new Map();
  // Significance mode: a shared topic label groups records only when the text also links
  // them to the label's first record; otherwise the record is its own experience.
  const groupKey = row => {
    const key = theme(row); if (!ranked) return key;
    if (!firsts.has(key)) { firsts.set(key, row); return key; }
    return linkedText(meta.get(row), meta.get(firsts.get(key))) ? key : `event:${row.sourceEventId}`;
  };
  const keys = new Map(unique.map(row => [row, groupKey(row)]));
  const groups = new Map();
  for (const row of unique) { const key = keys.get(row); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); }
  // Continuity endpoint: a linked group's second slot goes to its latest other non-repeated
  // record, so the far end of a documented development (e.g. a later open outcome) survives.
  const endpoints = new Map();
  if (ranked) for (const [key, rows] of groups) {
    const linked = rows.slice(1).filter(row => !meta.get(row).repeated);
    const endpoint = linked.sort((a, b) => +new Date(b.eventDate) - +new Date(a.eventDate) || position.get(a) - position.get(b))[0];
    if (endpoint) { endpoints.set(key, endpoint); rows.splice(1, rows.length - 1, endpoint, ...rows.slice(1).filter(row => row !== endpoint)); }
  }
  const buckets = [...groups.entries()].sort((a, b) => (ranked ? position.get(a[1][0]) - position.get(b[1][0]) : order(a[1][0], b[1][0])) || a[0].localeCompare(b[0]));
  const evidence = [], used = new Set(); let contextCharacters = 0;
  const add = (row, reason, admit = false) => {
    if (used.has(row.sourceEventId) || evidence.length >= limits.maxEvidence || contextCharacters + cost(row) > limits.maxContextCharacters) return false;
    const item = { ownerId, sourceEventId: row.sourceEventId, sourceMemoryId: row.id,
      eventDate: new Date(row.eventDate), summary: row.summary, topics: [...(row.topics ?? [])],
      importanceScore: row.importanceScore ?? null, similarity: row.similarity ?? 0,
      selectionReason: reason, theme: theme(row), provenance: { sourceEventId: row.sourceEventId, sourceMemoryId: row.id } };
    if (admit) {
      try { if (packet([...evidence, item], args).packet.evidence.length !== evidence.length + 1) return false; }
      catch (error) { if (error.code === "REPORT_NARRATIVE_INVALID_INPUT") return false; throw error; }
    }
    evidence.push(item); used.add(row.sourceEventId); contextCharacters += cost(row); return true;
  };
  if (ranked) {
    // Significance mode: admit in rank order (tiers already interleave days), at most
    // maxPerTheme per theme; a linked endpoint is admitted together with its theme's first.
    const taken = new Map();
    for (const row of unique) {
      const key = keys.get(row), rows = groups.get(key), count = taken.get(key) ?? 0;
      if (count >= limits.maxPerTheme || !rows.slice(0, limits.maxPerTheme).includes(row) || used.has(row.sourceEventId)) continue;
      if (!add(row, count === 0 ? "SEMANTIC_RELEVANCE" : "REPEATED_OR_CHANGING_THEME")) continue;
      taken.set(key, count + 1);
      const endpoint = endpoints.get(key);
      if (count === 0 && endpoint && !used.has(endpoint.sourceEventId) && add(endpoint, "REPEATED_OR_CHANGING_THEME")) taken.set(key, 2);
    }
  } else {
    // Original two-round topic-diversity allocation, with exact-only dedup above.
    for (let round = 0; round < limits.maxPerTheme; round++) for (const [, rows] of buckets) {
      if (rows[round]) add(rows[round], round === 0 ? "SEMANTIC_RELEVANCE" : "REPEATED_OR_CHANGING_THEME");
    }
  }
  const anchors = [...evidence];
  let admits = false;
  try { admits = packet(anchors, args).packet.evidence.length === anchors.length; }
  catch (error) { if (error.code !== "REPORT_NARRATIVE_INVALID_INPUT") throw error; }
  if (admits && evidence.length < limits.maxEvidence) {
    const segmenter = new Intl.Segmenter(args.locale, { granularity: "word" });
    const sentences = new Intl.Segmenter(args.locale, { granularity: "sentence" });
    const clauses = text => [...sentences.segment(text)].map(part => norm(part.segment)).filter(Boolean);
    const anchorWords = anchors.map(row => ({ theme: row.theme, words: words(row.summary, segmenter), correction: correctionForm(row.summary, segmenter) }));
    const seenClauses = new Set(anchors.flatMap(row => clauses(row.summary)));
    for (const row of unique) {
      if (used.has(row.sourceEventId)) continue;
      const lexical = words(row.summary, segmenter), key = theme(row), correction = correctionForm(row.summary, segmenter);
      // Require specific overlap or a narrowly matched short negated correction.
      // New additions never become anchors, preventing transitive topic drift.
      const linked = anchorWords.some(anchor => {
        if (anchor.theme !== key) return false;
        const shared = [...lexical].filter(w => anchor.words.has(w)).length;
        return shared >= 2 || (shared >= 1 && correction.key === anchor.correction.key && correction.count !== anchor.correction.count);
      });
      const fresh = clauses(row.summary).some(clause => !seenClauses.has(clause));
      if (linked && fresh && add(row, "REPEATED_OR_CHANGING_THEME", true)) clauses(row.summary).forEach(clause => seenClauses.add(clause));
    }
  }
  evidence.sort((a, b) => +a.eventDate - +b.eventDate || a.sourceEventId.localeCompare(b.sourceEventId) || a.sourceMemoryId.localeCompare(b.sourceMemoryId));
  const sufficient = evidence.length >= limits.minimumEvidence;
  return { ownerId, status: sufficient ? "READY" : "INSUFFICIENT_EVIDENCE",
    reason: sufficient ? null : evidence.length ? "BELOW_MINIMUM_EVIDENCE" : "NO_ELIGIBLE_EVIDENCE",
    candidateCount: eligible.length, deduplicatedCount: unique.length, selectedCount: evidence.length, contextCharacters, evidence };
}

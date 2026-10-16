import { REPORT_EVIDENCE_LIMITS } from "./report-foundation.js";
import { requireAiIdentity } from "./ai-identity.js";
import { buildReflectionV2 } from "./reflection-v2.js";

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
  const groups = new Map();
  for (const row of unique) { const key = theme(row); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); }
  const buckets = [...groups.entries()].sort((a, b) => order(a[1][0], b[1][0]) || a[0].localeCompare(b[0]));
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
  // Original two-round topic-diversity allocation, with exact-only dedup above.
  for (let round = 0; round < limits.maxPerTheme; round++) for (const [, rows] of buckets) {
    if (rows[round]) add(rows[round], round === 0 ? "SEMANTIC_RELEVANCE" : "REPEATED_OR_CHANGING_THEME");
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

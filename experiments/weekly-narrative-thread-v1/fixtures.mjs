// Offline, deterministic, per-dimension screening for Weekly narrative outputs.
// Lexical/structural PROXIES only: they can catch known failure shapes (weekday
// inventories, unlinked event walks, stock lessons, dropped negation/open items,
// padding) but cannot certify faithful paraphrase, naturalness or quality.
// Human review against experiments/weekly-editorial-quality-v1/RUBRIC.md remains required.
import { readFileSync } from "node:fs";
import { validateReflectionV2 } from "../../lib/reflection-v2.js";

const read = name => JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), "utf8"));
export const exemplars = Object.freeze(read("exemplars.json").exemplars);
export const foils = Object.freeze(read("foils.json").foils);

// Case shape from the frozen benchmark review notes (not model input).
export const CLASS = Object.freeze({ E01: "thread", E02: "thread", E03: "thread", E04: "mixed", E05: "unrelated",
  E06: "thread", E07: "thread", E08: "unrelated", E09: "sparse" });

// keep: every pattern must match (preserved negation, uncertainty, open outcome, attribution).
// avoid: no pattern may match (documented failure claims for the case).
export const PROBES = Object.freeze({
  E01: { en: { keep: [/nervous/i], avoid: [/presentation (went|was a success)|confiden/i] },
    "zh-Hans": { keep: [/紧张/], avoid: [/展示(很)?成功|自信/] } },
  E02: { en: { keep: [/still wish/i, /no time|haven't picked|not set|isn't a time/i], avoid: [/reconcil|angry|didn't care|went for (a|the) walk|assertive/i] },
    "zh-Hans": { keep: [/遗憾/, /还没定/], avoid: [/和好|生气|不在乎|一起散了步/] } },
  E03: { en: { keep: [/haven't chosen|not chosen|isn't chosen|undecided/i], avoid: [/final edition (is )?(done|finished|complete)|sold|confiden|persever|realiz|learned/i] },
    "zh-Hans": { keep: [/还没选/], avoid: [/完成了正式|卖|自信|坚持不懈|意识到|学会/] } },
  E04: { en: { keep: [/isn't fixed|not fixed/i], avoid: [/cured|washed away|made up for|burnout|gratitude/i] },
    "zh-Hans": { keep: [/没修好/], avoid: [/治愈|冲淡|抵消|倦怠|感恩/] } },
  E05: { en: { keep: [], avoid: [/rest after|healing|peace|ritual/i] }, "zh-Hans": { keep: [], avoid: [/疗愈|治愈|平静|仪式/] } },
  E06: { en: { keep: [/haven't decided|not decided|undecided/i, /hasn't made|doesn't feel fine|still upset/i],
    avoid: [/blessing|(?<!n't )made the rejection feel fine|resilien|new plan|for the best/i] },
    "zh-Hans": { keep: [/还没决定/, /没有因此|还是让你难受/], avoid: [/因祸得福|释然|好事一桩|新计划/] } },
  E07: { en: { keep: [/haven't agreed|not agreed/i, /budget/i], avoid: [/signed|moved in|can afford|partner|(?<!n't )agreed to move/i] },
    "zh-Hans": { keep: [/没有答应/, /负担/], avoid: [/签了|搬了过去|负担得起|伴侣|(?<!没有)答应了?搬/] } },
  E08: { en: { keep: [/sounded excited/i], avoid: [/new beginnings|your own (bakery )?job|you were excited about the bakery|were excited about the bakery/i] },
    "zh-Hans": { keep: [/听起来很兴奋/], avoid: [/新的开始|你拿到/] } },
  E09: { en: { keep: [], avoid: [/juicy|favou?rite|\brest\b|peace|quiet enjoyment|comfort/i] }, "zh-Hans": { keep: [], avoid: [/多汁|最爱|休息|平静|惬意/] } }
});
const GENERIC = { en: /\b(realiz\w*|learned (that|to trust)|journey|resilien\w*|grew|growth|healing|healed|stronger|regained|self-discovery|proud of yourself|you deserve|remember to|be gentle)\b/i,
  "zh-Hans": /成长|治愈|疗愈|变得更坚强|找回自信|自我发现|旅程|你值得|记得要/ };
const THEME = { en: /\b(a week of|theme|common thread|all about|new beginnings|showed things changing)\b/i, "zh-Hans": /主题|都关于|新的开始|共同点/ };
const OPENING = { en: /^(this week|over the week|this past week)\b/i, "zh-Hans": /^(这一?周|本周|这个星期)/ };
const WEEKDAY = { en: /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/g, "zh-Hans": /周[一二三四五六日天]|星期[一二三四五六日天]/g };
const SPARSE_MAX = { en: 60, "zh-Hans": 30 };

export function score(output, { caseId, locale, built, model = "claude-sonnet-5-5" }) {
  const kind = CLASS[caseId], sentences = output.paragraphs.flatMap(p => p.sentences);
  let validator = true, narrative = "";
  try { narrative = validateReflectionV2(output, { type: "WEEKLY", locale, built, model }).narrative; }
  catch { validator = false; narrative = sentences.map(s => s.text).join(" "); }
  const probe = PROBES[caseId][locale];
  const weekdays = (narrative.match(WEEKDAY[locale]) || []).length;
  const firsts = sentences.map(s => Number(s.refs[0].slice(1)));
  const singleWalk = sentences.length >= 3 && sentences.every(s => s.refs.length === 1) &&
    firsts.every((n, i) => i === 0 || n >= firsts[i - 1]) && new Set(firsts).size >= 3;
  const linked = sentences.some(s => s.refs.length >= 2);
  const openers = sentences.map(s => locale === "en" ? s.text.split(/\s+/)[0].toLowerCase() : s.text.slice(0, 2));
  const repeatedOpener = openers.some(o => openers.filter(x => x === o).length > 2);
  return {
    // Structural validator + case probes. PASS is necessary, not sufficient, for fidelity.
    fidelity: validator && probe.keep.every(re => re.test(narrative)) && !probe.avoid.some(re => re.test(narrative)),
    // No stock lesson/therapy vocabulary, no imposed theme, no padding of sparse notes.
    restraint: !GENERIC[locale].test(narrative) && !THEME[locale].test(narrative) &&
      (kind !== "sparse" || narrative.length <= SPARSE_MAX[locale]),
    // Not a weekday inventory; thread/mixed weeks are not a one-Event-per-sentence date walk.
    cohesion: weekdays < 2 && (kind === "unrelated" || kind === "sparse" || !singleWalk),
    // Thread/mixed weeks bind at least one stated relationship across Events. N/A otherwise.
    synthesis: kind === "thread" || kind === "mixed" ? linked : null,
    // Proxy only; real naturalness needs human review.
    naturalness: !OPENING[locale].test(narrative.trim()) && !repeatedOpener,
    validator
  };
}

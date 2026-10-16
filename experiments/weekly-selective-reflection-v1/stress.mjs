// Deterministic synthetic stress set A-H for selective Weekly reflection. Offline only.
// Q1 (selection): does the existing upstream path + selector deliver the explicitly
//     meaningful Events to the model input?
// Q2 (composition): given delivered evidence, does the unchanged contract permit a
//     selective, unforced reflection (and what can it not detect)?
// `meaningful` marks are review annotations only; they never enter selection or input.
import { REPORT_EVIDENCE_LIMITS, selectReportEvidence } from "../../lib/report-foundation.js";
import { selectWeeklyEvidenceV2 } from "../../lib/weekly-evidence-selector-v2.js";
import { selectMonthlyEvidence, monthlyWeek } from "../../lib/monthly-evidence.js";
import { buildWeeklyReflectionV2Packet } from "../../lib/sonnet-weekly.js";

export const owner = "synthetic-stress-owner";
export const week = Object.freeze({ timezone: "UTC", periodKey: "2026-09-14",
  periodStartUtc: "2026-09-14T00:00:00Z", periodEndUtc: "2026-09-21T00:00:00Z" });
const at = (day, hour) => new Date(Date.UTC(2026, 8, day, hour));
const e = (day, hour, topics, en, zh, meaningful = false) => ({ day, hour, topics, en, zh: zh ?? en, meaningful });

const ROUTINE = [["Bought milk and bread.", "买了牛奶和面包。"], ["Commute was fine.", "通勤还算顺利。"],
  ["Watched an episode of the cooking show.", "看了一集烹饪节目。"], ["Did the laundry.", "洗了衣服。"],
  ["Answered emails after lunch.", "午饭后回了邮件。"], ["Took the bins out.", "把垃圾桶拿出去了。"],
  ["Walked to the shop for batteries.", "走去小店买电池。"], ["Paid the phone bill.", "交了话费。"],
  ["Tidied the desk.", "收拾了书桌。"]];

export const CASES = Object.freeze([
  { id: "A", title: "21 unrelated Events, three per day; three explicitly significant, mid/late week",
    events: Array.from({ length: 21 }, (_, i) => {
      const day = 14 + Math.floor(i / 3), hour = 9 + (i % 3) * 4;
      if (i === 10) return e(day, hour, ["family"], "Decided to tell my sister I can't host Christmas this year. I'm still not sure how she'll take it.",
        "决定告诉姐姐今年圣诞没法在我家办了。还不知道她会怎么想。", true);
      if (i === 16) return e(day, hour, ["library"], "Found my grandmother's handwritten recipe card tucked inside a library book. I kept it in my wallet.",
        "在图书馆的书里夹着发现了外婆手写的菜谱卡，我把它收进了钱包。", true);
      if (i === 19) return e(day, hour, ["career"], "Asked for the transfer to the Leeds office. I won't hear back until next month.",
        "申请调去利兹办公室了，下个月才会有回复。", true);
      const [en, zh] = ROUTINE[i % ROUTINE.length];
      return e(day, hour, [`routine-${i}`], `${en.slice(0, -1)} (${i + 1}).`, `${zh.slice(0, -1)}（${i + 1}）。`);
    }) },
  { id: "B", title: "Busy week of repeated work stress plus one distinctive quiet positive moment",
    events: [...Array.from({ length: 11 }, (_, i) => e(14 + Math.floor(i / 2), 9 + (i % 2) * 5, ["work"],
      i % 2 ? `The budget spreadsheet broke again before the deadline; stressful (${i + 1}).` : `Another long budget meeting ran over and I felt drained (${i + 1}).`,
      [`预算会又拖堂了，累坏了（${i + 1}）。`, `截止前预算表又出错了，压力好大（${i + 1}）。`][i % 2])),
      e(19, 18, [], "The neighbour's little girl waved from her balcony holding a drawing of my dog. It made my whole evening.",
        "邻居家的小女孩在阳台上举着画我家狗的画朝我挥手，整个晚上都很开心。", true)] },
  { id: "C", title: "One project across the week mixed with unrelated relationship, hobby and daily life",
    events: [e(14, 9, ["kitchen renovation"], "The kitchen renovation quote came in higher than I hoped; I want to keep the old tiles.", "厨房翻新的报价比预想的高，我想保留旧瓷砖。", true),
      e(14, 19, ["choir"], "Choir rehearsal; we sang the new hymn twice.", "合唱排练，新的赞美诗唱了两遍。"),
      e(15, 12, ["friends"], "Mia called; she's moving to Glasgow and I'll miss her.", "米娅打电话说要搬去格拉斯哥了，我会想她的。", true),
      e(16, 10, ["kitchen renovation"], "Asked the builder whether the old kitchen tiles can be kept; he isn't sure yet.", "问了施工师傅旧厨房瓷砖能不能保留，他还说不准。", true),
      e(17, 8, ["chores"], "Did the laundry.", "洗了衣服。"),
      e(18, 15, ["kitchen renovation"], "The builder said the old kitchen tiles can stay if we skip the new splashback. I said yes.", "施工师傅说如果不做新挡板，旧厨房瓷砖可以留下。我同意了。", true),
      e(19, 11, ["health"], "Dentist check-up, all fine.", "看牙医检查，一切正常。"),
      e(20, 16, ["kitchen renovation"], "Still haven't decided on the kitchen paint colour.", "厨房墙面的颜色还没定。", true)] },
  { id: "D", title: "Contradictory and corrected records: negation, uncertainty, attribution, changed outcome",
    events: [e(14, 10, ["reunion"], "Mia said she would come to the reunion.", "米娅说她会来同学聚会。", true),
      e(16, 10, ["reunion"], "Mia isn't coming to the reunion after all; it was her brother who said yes.", "米娅其实不来同学聚会了，答应来的是她哥哥。", true),
      e(15, 18, ["driving test"], "I think I passed the driving theory test.", "我觉得驾照理论考试过了。", true),
      e(17, 9, ["driving test"], "I didn't pass the driving theory test; I misread the email. Retaking it on the 30th.", "驾照理论考试没过，是我看错了邮件。30号重考。", true),
      e(18, 20, ["cooking"], "Made dumplings with too much ginger.", "包饺子姜放多了。")] },
  { id: "E", title: "Sparse ordinary week, no common thread",
    events: [e(15, 9, [], "Cleaned the bathroom.", "打扫了浴室。"), e(17, 13, [], "Rain all day.", "下了一整天雨。"), e(20, 8, [], "Made toast.", "做了吐司。")] },
  { id: "F", title: "High volume: 40 Events, beyond the 32-candidate and 8-evidence limits; meaningful Events early and late",
    events: Array.from({ length: 40 }, (_, i) => {
      const day = 14 + Math.floor(i / 6), hour = 7 + (i % 6) * 2;
      if (i === 1) return e(day, hour, ["home"], "Our offer on the flat was accepted. I still can't quite believe it; we haven't signed yet.",
        "我们给那套公寓的出价被接受了，还是不太敢相信，合同还没签。", true);
      if (i === 37) return e(day, hour, ["father"], "Dad remembered my name today without prompting. I had to step outside for a minute.",
        "今天爸爸没人提醒就叫出了我的名字，我得出去缓一缓。", true);
      const [en, zh] = ROUTINE[i % ROUTINE.length];
      return e(day, hour, [["errands", "work", "home chores", "media"][i % 4]], `${en.slice(0, -1)} (${i + 1}).`, `${zh.slice(0, -1)}（${i + 1}）。`);
    }) },
  { id: "H", title: "Colloquial English/Chinese with different emotional intensity",
    events: [e(14, 20, ["music"], "Honestly gutted the gig got pulled last minute.", "演出临时取消了，真的郁闷死了。", true),
      e(16, 13, ["family"], "Lunch with Dad was... fine? A bit awkward.", "跟老爸吃了午饭，还行吧，有点尴尬。", true),
      e(19, 17, ["home"], "Absolutely buzzing — we got the flat!", "太激动了，房子拿下了！", true),
      e(20, 10, [], "Meh, lazy Sunday.", "周日，懒懒的，没干啥。")] }
]);

// Mirrors lib/report-foundation.js: Chinese takes the last candidateTake period Events
// with similarity 0. English uses BGE retrieval, which is not reproducible offline; with
// no relevance signal (similarity 0) the selectors behave identically, so only the
// 32-candidate cut differs ("en-similarity0" is that bounded approximation).
export function weeklyArgs(c, locale) {
  const limits = REPORT_EVIDENCE_LIMITS.WEEKLY;
  const rows = c.events.map((ev, i) => ({ id: `stress-${c.id}-memory-${i + 1}`, sourceEventId: `stress-${c.id}-event-${i + 1}`,
    ownerId: owner, memoryType: "EVENT", summary: locale === "en" ? ev.en : ev.zh, topics: [...ev.topics],
    eventDate: at(ev.day, ev.hour), similarity: 0, importanceScore: null, meaningful: ev.meaningful }))
    .sort((a, b) => +a.eventDate - +b.eventDate);
  const candidates = (locale === "zh-Hans" ? rows.slice(-limits.candidateTake) : rows.slice(0, limits.candidateTake))
    .map(({ meaningful, ...row }) => row);
  return { args: { reportType: "WEEKLY", identity: { userId: owner }, ...week, locale, limits, candidates }, rows };
}
export function weeklyInput(selection, locale, count) {
  return { reportType: "WEEKLY", ownerId: owner, locale, period: { ...week },
    aggregates: { ownerId: owner, eventCount: count, topTopics: [] }, evidenceSelection: selection,
    sourceFence: { evidencePolicy: "weekly-localized-v1", sources: [] } };
}
export function analyzeWeekly(c, locale) {
  const { args, rows } = weeklyArgs(c, locale), meaningful = rows.filter(r => r.meaningful).map(r => r.sourceEventId);
  const inCandidates = new Set(args.candidates.map(r => r.sourceEventId));
  const out = { case: c.id, locale, events: rows.length, candidates: args.candidates.length, meaningful: meaningful.length,
    droppedBeforeSelector: meaningful.filter(id => !inCandidates.has(id)).length };
  for (const [name, select] of [["v1", selectReportEvidence], ["v2", selectWeeklyEvidenceV2]]) {
    const selection = select(structuredClone(args));
    const delivered = selection.status === "READY"
      ? buildWeeklyReflectionV2Packet(weeklyInput(selection, locale, rows.length)) : null;
    const ids = delivered ? [...delivered.refs.values()].map(r => r.source.sourceEventId) : [];
    out[name] = { status: selection.status, delivered: ids.length, meaningfulDelivered: meaningful.filter(id => ids.includes(id)).length,
      days: [...new Set(ids.map(id => rows.find(r => r.sourceEventId === id).eventDate.getUTCDate()))].sort((a, b) => a - b), built: delivered, ids };
  }
  return out;
}

// G: a month of unrelated weeks, a recurring theme and an unresolved decision.
export const MONTH = Object.freeze({ timezone: "UTC", periodKey: "2026-09", periodStartUtc: "2026-09-01T00:00:00Z", periodEndUtc: "2026-10-01T00:00:00Z" });
export const G = Object.freeze([
  [2, ["running"], "Ran 5 km before work; legs heavy.", false], [3, ["work"], "Quarterly report submitted.", false],
  [5, ["running"], "Ran 5 km again, a bit easier.", false], [9, ["garden"], "Planted garlic in the back bed.", false],
  [10, ["work"], "Team lunch, nothing special.", false], [12, ["running"], "Skipped my run; knee felt sore.", false],
  [15, ["job"], "Got an offer for the Lisbon job. I don't know whether to take it.", true], [17, ["running"], "Ran 3 km slowly; knee okay.", false],
  [18, ["chores"], "Did the laundry.", false], [23, ["friends"], "Dinner with Noor; we laughed about school.", true],
  [24, ["job"], "Still haven't decided about Lisbon. Asked for another week.", true], [26, ["running"], "Ran 5 km, knee fine.", false],
  [29, ["chores"], "Paid the phone bill.", false], [30, ["garden"], "First garlic shoots are up.", true]
].map(([day, topics, summary, meaningful], i) => ({ day, topics, summary, meaningful, i })));
export function analyzeMonthly() {
  const events = G.map(g => ({ id: `g-event-${g.i + 1}`, ownerId: owner, occurredAt: at(g.day, 12), memoryProcessingAllowed: true,
    memory: { id: `g-memory-${g.i + 1}`, ownerId: owner, memoryType: "EVENT", sourceEventId: `g-event-${g.i + 1}`, summary: g.summary, topics: g.topics, importanceScore: null } }));
  const selection = selectMonthlyEvidence({ identity: { userId: owner }, period: MONTH, events, previousEvents: [], limits: REPORT_EVIDENCE_LIMITS.MONTHLY });
  const weeks = [...new Set(events.map(ev => monthlyWeek(ev.occurredAt, "UTC")))];
  const selectedWeeks = new Set(selection.evidence.map(ev => monthlyWeek(ev.eventDate, "UTC")));
  const meaningful = G.filter(g => g.meaningful).map(g => `g-event-${g.i + 1}`);
  return { status: selection.status, weeks: weeks.length, weeksCovered: weeks.filter(w => selectedWeeks.has(w)).length,
    delivered: selection.evidence.length, meaningful: meaningful.length,
    meaningfulDelivered: meaningful.filter(id => selection.evidence.some(ev => ev.sourceEventId === id)).length, selection };
}

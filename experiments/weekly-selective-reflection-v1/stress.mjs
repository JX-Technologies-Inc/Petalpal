// Deterministic synthetic stress set A-H for selective Weekly reflection. Offline only.
// Q1 (selection): does the existing upstream path + selector deliver the explicitly
//     meaningful Events to the model input?
// Q2 (composition): given delivered evidence, does the unchanged contract permit a
//     selective, unforced reflection (and what can it not detect)?
// `meaningful` marks are review annotations only; they never enter selection or input.
import { REPORT_EVIDENCE_LIMITS, selectReportEvidence } from "../../lib/report-foundation.js";
import { selectWeeklyEvidenceV2, weeklySignificanceCandidates } from "../../lib/weekly-evidence-selector-v2.js";
import { selectMonthlyEvidence, monthlyWeek } from "../../lib/monthly-evidence.js";
import { buildWeeklyReflectionV2Packet } from "../../lib/sonnet-weekly.js";

export const owner = "synthetic-stress-owner";
export const week = Object.freeze({ timezone: "UTC", periodKey: "2026-09-14",
  periodStartUtc: "2026-09-14T00:00:00Z", periodEndUtc: "2026-09-21T00:00:00Z" });
const at = (day, hour) => new Date(Date.UTC(2026, 8, day, hour));
// group/outcome are independent review annotations (experience identity, later stated
// outcome). Like `meaningful`, they never reach a selector or production code.
const e = (day, hour, topics, en, zh, meaningful = false, review = {}) => ({ day, hour, topics, en, zh: zh ?? en, meaningful, ...review });

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

// Added cases (kept separate so the recorded A-H expectations stay unchanged).
const DISTINCT = [["Fixed the squeaky cupboard hinge.", "修好了吱吱响的柜门合页。"], ["Commute took forty minutes.", "通勤花了四十分钟。"],
  ["Watered the balcony herbs.", "给阳台上的香草浇了水。"], ["Returned the parcel at the post office.", "去邮局退了包裹。"],
  ["Updated the team spreadsheet.", "更新了团队的表格。"], ["Bought a new phone charger.", "买了个新充电器。"],
  ["Swept the hallway.", "扫了走廊。"], ["Renewed the library card.", "续了图书证。"], ["Booked the car service.", "约了汽车保养。"],
  ["Ironed shirts for the week.", "熨了这周要穿的衬衫。"], ["Defrosted the freezer.", "给冰箱除了霜。"], ["Paid the gas bill online.", "在网上交了燃气费。"],
  ["Cleaned the bike chain.", "清理了自行车链条。"], ["Sorted the recycling.", "分好了可回收垃圾。"], ["Changed the bed sheets.", "换了床单。"],
  ["Printed the boarding pass.", "打印了登机牌。"], ["Replaced the kitchen light bulb.", "换了厨房的灯泡。"], ["Topped up the travel card.", "给交通卡充了值。"]];
export const EXTRA_CASES = Object.freeze([
  { id: "I", title: "Similar topic labels on unrelated experiences",
    events: [e(14, 9, ["project"], "Our team project deadline moved to Friday.", "团队项目的截止日期改到了周五。", false, { group: "work-project" }),
      e(15, 18, ["project"], "Helped my nephew glue his volcano for the school project. He wanted it to really erupt.", "帮外甥粘学校作业的火山模型，他想让它真的能喷发。", true, { group: "nephew" }),
      e(16, 12, ["dog"], "Bought dog food.", "买了狗粮。", false, { group: "dog-food" }),
      e(17, 8, ["dog"], "A stray dog followed me to the station. I wanted to take it home but couldn't.", "一只流浪狗跟着我走到车站，我想带它回家，但没办法。", true, { group: "stray" }),
      e(18, 14, ["project"], "I decided to present the team project myself.", "我决定自己来讲团队项目。", true, { group: "work-project", outcome: true }),
      e(19, 10, ["dog"], "Walked past the dog park.", "路过了狗公园。", false, { group: "dog-park" })] },
  { id: "J", title: "Seven Events on one day; one meaningful late in the day without a stance word",
    events: [...DISTINCT.slice(0, 6).map(([en, zh], i) => e(17, 7 + i * 2, [`chore-${i}`], en, zh)),
      e(17, 21, ["family"], "Mum's test results came back clear. I sat in the car for ten minutes before driving home.",
        "妈妈的检查结果没问题。我在车里坐了十分钟才开回家。", true),
      ...DISTINCT.slice(6, 12).map(([en, zh], i) => e([14, 15, 16, 18, 19, 20][i], 12, [`errand-${i}`], en, zh))] },
  { id: "K", title: "21 all-distinct Events; significant ones not first on their days",
    events: Array.from({ length: 21 }, (_, i) => {
      const day = 14 + Math.floor(i / 3), hour = 9 + (i % 3) * 4;
      if (i === 2) return e(day, hour, ["friend"], "Lena visited with her baby. I loved how she grabbed my finger.", "莉娜带着宝宝来了，宝宝抓住我手指的样子我好喜欢。", true);
      if (i === 13) return e(day, hour, ["move"], "Viewed the flat by the river. I'm not sure we can afford it.", "去看了河边那套房子，不确定我们负担得起。", true);
      if (i === 20) return e(day, hour, ["move"], "We still haven't decided about the river flat.", "河边那套房子我们还没决定。", true, { group: "move", outcome: true });
      return e(day, hour, [`life-${i}`], ...DISTINCT[i % DISTINCT.length]);
    }) },
  { id: "L", title: "Busy week; an early concern and a late unresolved decision about the same studio",
    events: [e(14, 9, ["studio"], "Ari offered to share the studio lease. I'm worried about the rent.", "阿黎说可以合租工作室，我担心租金。", true, { group: "studio" }),
      ...DISTINCT.slice(0, 12).map(([en, zh], i) => e(14 + Math.floor((i + 1) / 2), 13 + (i % 2) * 4, ["studio"].filter(() => i === 3).concat([`day-${i}`]), en, zh)),
      e(20, 19, ["studio"], "Still haven't decided whether to sign the studio lease.", "工作室的租约要不要签，还没决定。", true, { group: "studio", outcome: true })] }
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
  // After: opt-in significance mode replays the new bounded pool over EVERY eligible period row.
  const pool = weeklySignificanceCandidates(rows.map(({ meaningful, ...row }) => row), { locale, timezone: week.timezone,
    take: REPORT_EVIDENCE_LIMITS.WEEKLY.candidateTake });
  const selection = selectWeeklyEvidenceV2({ ...structuredClone(args), candidates: structuredClone(pool), significance: true });
  const built = selection.status === "READY" ? buildWeeklyReflectionV2Packet(weeklyInput(selection, locale, rows.length)) : null;
  const ids = built ? [...built.refs.values()].map(r => r.source.sourceEventId) : [], inPool = new Set(pool.map(r => r.sourceEventId));
  out.sig = { status: selection.status, candidates: pool.length, droppedBeforeSelector: meaningful.filter(id => !inPool.has(id)).length,
    delivered: ids.length, meaningfulDelivered: meaningful.filter(id => ids.includes(id)).length,
    days: [...new Set(ids.map(id => rows.find(r => r.sourceEventId === id).eventDate.getUTCDate()))].sort((a, b) => a - b),
    contextCharacters: selection.contextCharacters, built, ids };
  // Review-only metrics, computed from annotations after selection.
  const meta = id => c.events[+id.split("-").pop() - 1], group = id => meta(id).group ?? meta(id).topics[0] ?? id;
  const groups = new Set(rows.map(r => group(r.sourceEventId))), outcomes = rows.filter(r => meta(r.sourceEventId).outcome).map(r => r.sourceEventId);
  for (const name of ["v1", "v2", "sig"]) {
    const sel = out[name].ids;
    out[name].groupsCovered = new Set(sel.map(group)).size; out[name].groups = groups.size;
    out[name].outcomesDelivered = outcomes.filter(id => sel.includes(id)).length; out[name].outcomes = outcomes.length;
    // Same topic label, different review experience, both delivered: a false-link risk for the writer.
    out[name].sharedLabelPairs = sel.flatMap((a, i) => sel.slice(i + 1).filter(b =>
      meta(a).topics.some(t => meta(b).topics.includes(t)) && group(a) !== group(b))).length;
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

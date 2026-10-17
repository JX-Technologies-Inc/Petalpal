// OFFLINE ONLY. Realistic, irregular synthetic weeks (M-Q) that extend stress cases A-L
// without changing them: bursts and gaps, ultra-short entries next to a long one,
// same-day mood swings and low mood that must not be diagnosed, sarcasm and
// code-switching, and a single-Event week. Synthetic text only; no user data. Same
// week (2026-09-14..20, UTC) and shape as stress.mjs, so analyzeWeekly() applies.
const e = (day, hour, topics, en, zh, meaningful = false, review = {}) => ({ day, hour, topics, en, zh: zh ?? en, meaningful, ...review });

export const REALISTIC_CASES = Object.freeze([
  { id: "M", title: "Bursts and gaps: three Events on Monday, silence until Saturday, one late on Sunday",
    events: [
      e(14, 8, ["work"], "Monday already. Inbox at 200 before nine.", "又是周一，九点前邮件就两百封了。"),
      e(14, 13, ["work"], "Skipped lunch to finish the client deck.", "为了赶客户的方案没吃午饭。"),
      e(14, 22, ["family"], "Mum called to say her test results came back clear. I cried a bit after hanging up.",
        "妈妈打电话说检查结果没问题。挂了电话我哭了一会儿。", true, { group: "mum" }),
      e(19, 11, ["chores"], "Cleaned the flat.", "打扫了屋子。"),
      e(20, 23, ["family"], "Still thinking about Mum's call. I want to visit her next month.",
        "还在想妈妈那通电话。我想下个月去看她。", true, { group: "mum", outcome: true })] },
  { id: "N", title: "Ultra-short entries around one long, specific entry",
    events: [
      e(14, 9, [], "tired", "累"), e(15, 9, [], "ok", "还行"), e(15, 21, [], "meh", "一般"),
      e(16, 20, ["friends"], "Had dinner with Jun for the first time since we argued in spring. Neither of us mentioned it. It felt easy, which surprised me, but I still don't know if we should talk about what happened.",
        "春天吵架之后第一次和阿俊吃饭。我们都没提那件事。气氛挺轻松，这让我有点意外，但我还是不知道要不要把那件事说开。", true, { group: "jun" }),
      e(17, 9, [], "tired again", "又累了"), e(19, 14, [], "rain", "下雨")] },
  { id: "O", title: "Same-day mood swing, then a low day that must not be diagnosed",
    events: [
      e(15, 8, ["work"], "Got the internship offer! Called everyone I know.", "拿到实习offer了！给认识的人都打了电话。", true, { group: "offer" }),
      e(15, 23, ["work"], "Can't sleep. What if I'm not good enough for it and they regret hiring me.",
        "睡不着。万一我其实不够好，他们后悔录用我怎么办。", true, { group: "offer" }),
      e(16, 12, ["chores"], "Groceries.", "买菜。"),
      e(17, 15, [], "Stayed in bed most of the day. Didn't feel like seeing anyone.", "一天大部分时间都躺在床上，不想见任何人。", true, { group: "low" }),
      e(18, 19, ["friends"], "Lin dragged me out for a walk. Glad she did, I think.", "小林硬拉我出去散步。应该挺庆幸她这么做的吧。", true, { group: "low" })] },
  { id: "P", title: "Sarcasm, self-deprecation and code-switching",
    events: [
      e(14, 10, ["commute"], "Great, a flat tyre on the way to my presentation. Just perfect.", "太好了，去做汇报的路上爆胎了。真是完美。", true, { group: "presentation" }),
      e(14, 17, ["work"], "Presentation went fine somehow. Me, the queen of last-minute.", "汇报居然还顺利。不愧是我，deadline战神。", true, { group: "presentation", outcome: true }),
      e(16, 20, ["hobby"], "Tried the new ramen place, totally worth it, 10/10 would queue again.", "去了那家新拉面店，totally worth it，排队也值。"),
      e(18, 13, ["chores"], "Laundry day.", "洗衣服的一天。")] },
  { id: "Q", title: "Single-Event week: must abstain instead of padding",
    events: [e(17, 21, ["work"], "Long day, nothing special.", "很长的一天，没什么特别的。")] },
]);

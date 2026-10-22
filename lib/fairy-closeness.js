// Closeness with PPL (亲密度), the daily calendar check-in and her keepsakes (信物).
//
// Days are the account's local days (User.timezone, see time.md). Every write runs in one
// transaction under a per-owner advisory lock, so the daily caps and the once-a-day
// check-in hold under concurrent requests. The level is derived from the award ledger.
import { addLocalDays, localDateForInstant, normalizeIanaTimezone } from "./ai-periods.js";
import { stableFraction } from "./fairy-runtime.js";
import { weeklyReportLocale } from "./report-locale.js";
import { FAIRY_KEEPSAKES, KEEPSAKES_BY_ID, MAX_LEVEL_KEEPSAKE, keepsakesOf, monthlyKeepsake } from "./fairy-keepsakes.js";

// Points per award and how many awards of each source count per local day.
export const CLOSENESS_SOURCES = Object.freeze({
  CHECK_IN: { points: 10, dailyCap: 1 },
  STREAK_7: { points: 20, dailyCap: 1 },
  EVENT: { points: 5, dailyCap: 3 },
  MOMENT_LIKE: { points: 2, dailyCap: 3 },
  FAIRY_TAP: { points: 1, dailyCap: 5 },
  WEEKLY_READ: { points: 15, dailyCap: 1 }
});

export const MAX_LEVEL = 20;
// Points needed to go from `level` to `level + 1`: 35, 50, 65 … 305 (3,230 in total).
export const pointsToNextLevel = level => 20 + 15 * level;

const TITLES = [
  { from: 1, en: "First hello", "zh-Hans": "初次相遇" },
  { from: 3, en: "Getting to know you", "zh-Hans": "渐渐熟悉" },
  { from: 5, en: "Garden friends", "zh-Hans": "花园好友" },
  { from: 8, en: "Kindred hearts", "zh-Hans": "心事伙伴" },
  { from: 12, en: "Flower confidants", "zh-Hans": "知心花友" },
  { from: 16, en: "In tune", "zh-Hans": "默契知己" },
  { from: 20, en: "Forever companions", "zh-Hans": "一生花伴" }
];
const titleFor = level => TITLES.filter(title => level >= title.from).at(-1);

// What each level opens. `coming_soon` perks are shown but not built yet.
export const CLOSENESS_UNLOCKS = Object.freeze([
  { level: 3, key: "MOMENTS_FOR_YOU", status: "coming_soon" },
  { level: 5, key: "MORE_RARE_KEEPSAKES", status: "live" },
  { level: 8, key: "MAILBOX_LETTERS", status: "coming_soon" },
  { level: 12, key: "AVATAR_FRAME", status: "live" },
  { level: 16, key: "EASIER_MONTHLY_KEEPSAKE", status: "live" },
  { level: 20, key: "FOREVER_KEEPSAKE", status: "live" }
]);

export const STREAK_REWARD_EVERY = 7;
export const GRACE_WINDOW_DAYS = 7; // one bridged missed day per 7 local days
export const monthlyDaysNeeded = level => (level >= 16 ? 16 : 20);
const rareChance = level => (level >= 5 ? 0.1 : 0.05);
const UNOWNED_PREFERENCE = 0.7;

const MAX_OWNERS = 100;
// FAIRY_CLOSENESS_OWNER_IDS: comma-separated User ids, or "*" alone for every signed-in
// owner. Spaces and line breaks around them are ignored. Unset, empty or malformed: nobody.
export function fairyClosenessEnabledFor(userId, env = process.env) {
  const raw = typeof env.FAIRY_CLOSENESS_OWNER_IDS === "string" ? env.FAIRY_CLOSENESS_OWNER_IDS.trim() : "";
  if (!raw || typeof userId !== "string" || !userId) return false;
  if (raw === "*") return true;
  const ids = raw.split(",").map(id => id.trim());
  if (ids.length > MAX_OWNERS || ids.some(id => !/^[A-Za-z0-9_-]{1,64}$/.test(id))) return false;
  return ids.includes(userId);
}

export function closenessLocale(preferredLocale) {
  try { return weeklyReportLocale(preferredLocale); } catch { return "en"; }
}

export function closenessLevel(total, locale = "en") {
  let level = 1, into = Math.max(0, Math.floor(total) || 0);
  while (level < MAX_LEVEL && into >= pointsToNextLevel(level)) { into -= pointsToNextLevel(level); level += 1; }
  const maxed = level === MAX_LEVEL;
  const nextTitle = maxed ? null : TITLES.find(title => title.from > level);
  return {
    level, title: titleFor(level)[locale], total: Math.max(0, Math.floor(total) || 0),
    pointsIntoLevel: maxed ? 0 : into, pointsForNextLevel: maxed ? null : pointsToNextLevel(level),
    nextTitle: nextTitle ? { level: nextTitle.from, title: nextTitle[locale] } : null, maxed
  };
}

const dayNumber = localDate => Date.UTC(+localDate.slice(0, 4), +localDate.slice(5, 7) - 1, +localDate.slice(8, 10)) / 86_400_000;
export const daysBetween = (from, to) => dayNumber(to) - dayNumber(from);

// The streak a check-in on `today` continues. `last` is the newest earlier check-in;
// `graceUsedSince` says whether a missed day was already bridged in the grace window.
export function nextStreak({ today, last, graceUsedSince }) {
  if (!last) return { streak: 1, graceUsed: false };
  const gap = daysBetween(last.localDate, today);
  if (gap === 1) return { streak: last.streak + 1, graceUsed: false };
  if (gap === 2 && !graceUsedSince) return { streak: last.streak + 1, graceUsed: true };
  return { streak: 1, graceUsed: false };
}

function pick(pool, owned, seed) {
  const unowned = pool.filter(keepsake => !owned.has(keepsake.id));
  const from = unowned.length && stableFraction(`${seed}:prefer`) < UNOWNED_PREFERENCE ? unowned : pool;
  return from[Math.floor(stableFraction(seed) * from.length) % from.length];
}

// Today's keepsakes for a check-in: the daily one (sometimes rare), a rare one every 7th
// streak day, and the month's brooch on the day the month's check-ins reach the threshold.
// Deterministic per owner and day.
export function planKeepsakes({ userId, today, level, streak, monthCheckIns, owned, monthlyGrantedThisMonth }) {
  const seed = `${userId}:${today}`;
  const plan = [];
  const rare = stableFraction(`${seed}:rare`) < rareChance(level);
  const daily = pick(keepsakesOf(rare ? "RARE" : "COMMON"), owned, `${seed}:daily`);
  plan.push({ keepsakeId: daily.id, reason: "DAILY" });
  if (streak % STREAK_REWARD_EVERY === 0) {
    const pool = keepsakesOf("RARE").filter(keepsake => keepsake.id !== daily.id);
    plan.push({ keepsakeId: pick(pool, owned, `${seed}:streak`).id, reason: "STREAK_7" });
  }
  const brooch = monthlyKeepsake(Number(today.slice(5, 7)));
  if (brooch && !monthlyGrantedThisMonth && monthCheckIns >= monthlyDaysNeeded(level)) {
    plan.push({ keepsakeId: brooch.id, reason: "MONTHLY" });
  }
  return plan;
}

export function presentKeepsake(keepsakeId, locale, { withNote = true } = {}) {
  const keepsake = KEEPSAKES_BY_ID.get(keepsakeId);
  if (!keepsake) return null;
  return {
    id: keepsake.id, rarity: keepsake.rarity, name: keepsake.name[locale],
    ...(withNote ? { note: keepsake.note[locale] } : {}), ...(keepsake.month ? { month: keepsake.month } : {})
  };
}

async function lockOwner(tx, userId) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`fairy-closeness:${userId}`}))::text AS "locked"`;
}

async function ownerClock(tx, userId, now) {
  const owner = await tx.user.findUnique({ where: { id: userId }, select: { timezone: true, preferredLocale: true } });
  if (!owner) return null;
  const timezone = normalizeIanaTimezone(owner.timezone) || "UTC";
  return { timezone, today: localDateForInstant(now, timezone), locale: closenessLocale(owner.preferredLocale) };
}

async function totalPoints(tx, userId) {
  const sum = await tx.fairyClosenessAward.aggregate({ where: { userId }, _sum: { points: true } });
  return sum._sum.points || 0;
}

// Adds one award if the source still has room today; idempotent per (source, key).
// Returns the points added (0 when capped or repeated). Reaching the highest level gives
// her forever keepsake once.
async function addAward(tx, { userId, source, key, today }) {
  const rule = CLOSENESS_SOURCES[source];
  const used = await tx.fairyClosenessAward.count({ where: { userId, source, localDate: today } });
  if (used >= rule.dailyCap) return 0;
  const repeated = await tx.fairyClosenessAward.findUnique({
    where: { userId_source_awardKey: { userId, source, awardKey: key } }, select: { id: true }
  });
  if (repeated) return 0;
  await tx.fairyClosenessAward.create({ data: { userId, source, awardKey: key, localDate: today, points: rule.points } });
  return rule.points;
}

async function grantForeverKeepsake(tx, { userId, today, total }) {
  if (closenessLevel(total).level < MAX_LEVEL) return null;
  const owned = await tx.fairyKeepsakeGrant.findFirst({ where: { userId, keepsakeId: MAX_LEVEL_KEEPSAKE }, select: { id: true } });
  if (owned) return null;
  await tx.fairyKeepsakeGrant.create({ data: { userId, keepsakeId: MAX_LEVEL_KEEPSAKE, reason: "SPECIAL", localDate: today } });
  return MAX_LEVEL_KEEPSAKE;
}

function levelChange(before, after, locale) {
  const from = closenessLevel(before, locale), to = closenessLevel(after, locale);
  return to.level > from.level ? { level: to.level, title: to.title } : null;
}

// Awards closeness for something the owner did (EVENT, MOMENT_LIKE, FAIRY_TAP,
// WEEKLY_READ). `key` identifies the thing (event id, moment id …) so repeats count once.
export async function awardCloseness(prisma, { userId, source, key, now = new Date() }) {
  if (!CLOSENESS_SOURCES[source] || source === "CHECK_IN" || source === "STREAK_7") throw new TypeError("Unsupported closeness source");
  if (typeof key !== "string" || !key || key.length > 96) throw new TypeError("A closeness award key is required");
  return prisma.$transaction(async tx => {
    await lockOwner(tx, userId);
    const clock = await ownerClock(tx, userId, now);
    if (!clock) return { awarded: 0, levelUp: null, keepsake: null };
    const before = await totalPoints(tx, userId);
    const awarded = await addAward(tx, { userId, source, key, today: clock.today });
    const keepsake = awarded ? await grantForeverKeepsake(tx, { userId, today: clock.today, total: before + awarded }) : null;
    return {
      awarded, levelUp: levelChange(before, before + awarded, clock.locale),
      keepsake: keepsake ? presentKeepsake(keepsake, clock.locale) : null
    };
  });
}

// FAIRY_TAP has no natural id, so each tap of the day takes the next numbered key.
export async function awardFairyTap(prisma, { userId, now = new Date() }) {
  return prisma.$transaction(async tx => {
    await lockOwner(tx, userId);
    const clock = await ownerClock(tx, userId, now);
    if (!clock) return { awarded: 0, levelUp: null, keepsake: null };
    const used = await tx.fairyClosenessAward.count({ where: { userId, source: "FAIRY_TAP", localDate: clock.today } });
    const before = await totalPoints(tx, userId);
    const awarded = await addAward(tx, { userId, source: "FAIRY_TAP", key: `${clock.today}:${used + 1}`, today: clock.today });
    const keepsake = awarded ? await grantForeverKeepsake(tx, { userId, today: clock.today, total: before + awarded }) : null;
    return {
      awarded, levelUp: levelChange(before, before + awarded, clock.locale),
      keepsake: keepsake ? presentKeepsake(keepsake, clock.locale) : null
    };
  });
}

// The calendar check-in. Once per local day; a repeat returns today's result unchanged.
export async function checkInWithFairy(prisma, { userId, now = new Date() }) {
  return prisma.$transaction(async tx => {
    await lockOwner(tx, userId);
    const clock = await ownerClock(tx, userId, now);
    if (!clock) return null;
    const { today, timezone, locale } = clock;
    const existing = await tx.fairyCheckIn.findUnique({ where: { userId_localDate: { userId, localDate: today } } });
    if (existing) {
      const grants = await tx.fairyKeepsakeGrant.findMany({ where: { userId, localDate: today }, orderBy: { createdAt: "asc" } });
      return {
        created: false, checkIn: { localDate: today, streak: existing.streak, graceUsed: existing.graceUsed },
        keepsakes: grants.map(grant => ({ ...presentKeepsake(grant.keepsakeId, locale), reason: grant.reason, firstTime: false })),
        awarded: 0, levelUp: null, locale
      };
    }
    const last = await tx.fairyCheckIn.findFirst({ where: { userId, localDate: { lt: today } }, orderBy: { localDate: "desc" } });
    const graceUsedSince = await tx.fairyCheckIn.count({
      where: { userId, graceUsed: true, localDate: { gt: addLocalDays(today, -GRACE_WINDOW_DAYS) } }
    });
    const { streak, graceUsed } = nextStreak({ today, last, graceUsedSince: graceUsedSince > 0 });
    const before = await totalPoints(tx, userId);
    const grants = await tx.fairyKeepsakeGrant.findMany({ where: { userId }, select: { keepsakeId: true, reason: true, localDate: true } });
    const owned = new Set(grants.map(grant => grant.keepsakeId));
    const month = today.slice(0, 7);
    const monthCheckIns = 1 + await tx.fairyCheckIn.count({ where: { userId, localDate: { startsWith: month } } });
    const plan = planKeepsakes({
      userId, today, level: closenessLevel(before).level, streak, monthCheckIns, owned,
      monthlyGrantedThisMonth: grants.some(grant => grant.reason === "MONTHLY" && grant.localDate.startsWith(month))
    });
    const checkIn = await tx.fairyCheckIn.create({ data: { userId, localDate: today, timezone, streak, graceUsed } });
    await tx.fairyKeepsakeGrant.createMany({
      data: plan.map(item => ({ userId, checkInId: checkIn.id, keepsakeId: item.keepsakeId, reason: item.reason, localDate: today }))
    });
    let awarded = await addAward(tx, { userId, source: "CHECK_IN", key: today, today });
    if (streak % STREAK_REWARD_EVERY === 0) awarded += await addAward(tx, { userId, source: "STREAK_7", key: today, today });
    const forever = await grantForeverKeepsake(tx, { userId, today, total: before + awarded });
    const keepsakes = plan.map(item => ({ ...presentKeepsake(item.keepsakeId, locale), reason: item.reason, firstTime: !owned.has(item.keepsakeId) }));
    if (forever) keepsakes.push({ ...presentKeepsake(forever, locale), reason: "SPECIAL", firstTime: true });
    return {
      created: true, checkIn: { localDate: today, streak, graceUsed }, keepsakes,
      awarded, levelUp: levelChange(before, before + awarded, locale), locale
    };
  });
}

// Whether the streak still counts today: checked in today or yesterday, or two days ago
// with the weekly grace still free.
function liveStreak(today, last, graceUsedSince) {
  if (!last) return 0;
  const gap = daysBetween(last.localDate, today);
  if (gap <= 1) return last.streak;
  return gap === 2 && !graceUsedSince ? last.streak : 0;
}

// Everything the closeness page and the calendar check-in card show.
export async function closenessSummary(prisma, { userId, now = new Date() }) {
  return prisma.$transaction(async tx => {
    const clock = await ownerClock(tx, userId, now);
    if (!clock) return null;
    const { today, locale } = clock;
    const total = await totalPoints(tx, userId);
    const level = closenessLevel(total, locale);
    const todays = await tx.fairyClosenessAward.findMany({ where: { userId, localDate: today }, select: { source: true, points: true } });
    const last = await tx.fairyCheckIn.findFirst({ where: { userId, localDate: { lte: today } }, orderBy: { localDate: "desc" } });
    const graceUsedSince = await tx.fairyCheckIn.count({
      where: { userId, graceUsed: true, localDate: { gt: addLocalDays(today, -GRACE_WINDOW_DAYS) } }
    });
    const checkedInToday = last?.localDate === today;
    const streak = liveStreak(today, last, graceUsedSince > 0);
    const month = today.slice(0, 7);
    const monthCheckIns = await tx.fairyCheckIn.count({ where: { userId, localDate: { startsWith: month } } });
    const grants = await tx.fairyKeepsakeGrant.findMany({ where: { userId }, select: { keepsakeId: true, reason: true, localDate: true } });
    const brooch = monthlyKeepsake(Number(today.slice(5, 7)));
    return {
      locale, localDate: today, ...level,
      today: Object.entries(CLOSENESS_SOURCES).map(([source, rule]) => {
        const rows = todays.filter(row => row.source === source);
        return { source, count: rows.length, dailyCap: rule.dailyCap, points: rows.reduce((sum, row) => sum + row.points, 0), pointsEach: rule.points };
      }),
      checkIn: {
        checkedInToday, streak,
        graceAvailable: graceUsedSince === 0,
        // Check-ins still to go (today's included when not done yet) until the 7th-day rare keepsake.
        checkInsToStreakReward: STREAK_REWARD_EVERY - (streak % STREAK_REWARD_EVERY)
      },
      monthly: brooch ? {
        month, checkIns: monthCheckIns, needed: monthlyDaysNeeded(level.level),
        keepsake: presentKeepsake(brooch.id, locale, { withNote: false }),
        earned: grants.some(grant => grant.reason === "MONTHLY" && grant.localDate.startsWith(month))
      } : null,
      collection: { owned: new Set(grants.map(grant => grant.keepsakeId)).size, total: FAIRY_KEEPSAKES.length },
      unlocks: CLOSENESS_UNLOCKS.map(unlock => ({ ...unlock, unlocked: level.level >= unlock.level }))
    };
  });
}

// Calendar marks for one local month: the days checked in and their keepsakes.
export async function listCheckIns(prisma, { userId, month, now = new Date() }) {
  return prisma.$transaction(async tx => {
    const clock = await ownerClock(tx, userId, now);
    if (!clock) return null;
    const target = month || clock.today.slice(0, 7);
    const rows = await tx.fairyCheckIn.findMany({
      where: { userId, localDate: { startsWith: target } }, orderBy: { localDate: "asc" },
      select: { localDate: true, streak: true, graceUsed: true }
    });
    const grants = await tx.fairyKeepsakeGrant.findMany({
      where: { userId, localDate: { startsWith: target } }, select: { localDate: true, keepsakeId: true, reason: true }
    });
    return {
      locale: clock.locale, month: target, today: clock.today,
      days: rows.map(row => ({
        localDate: row.localDate, streak: row.streak, graceUsed: row.graceUsed,
        keepsakes: grants.filter(grant => grant.localDate === row.localDate)
          .map(grant => ({ id: grant.keepsakeId, reason: grant.reason }))
      }))
    };
  });
}

// The keepsake book: every keepsake, owned or not. Her note shows only once owned.
export async function listKeepsakes(prisma, { userId, now = new Date() }) {
  return prisma.$transaction(async tx => {
    const clock = await ownerClock(tx, userId, now);
    if (!clock) return null;
    const grants = await tx.fairyKeepsakeGrant.findMany({
      where: { userId }, orderBy: { localDate: "asc" }, select: { keepsakeId: true, localDate: true }
    });
    const byId = new Map();
    for (const grant of grants) {
      const entry = byId.get(grant.keepsakeId) || { count: 0, firstLocalDate: grant.localDate };
      entry.count += 1;
      byId.set(grant.keepsakeId, entry);
    }
    return {
      locale: clock.locale,
      owned: byId.size, total: FAIRY_KEEPSAKES.length,
      keepsakes: FAIRY_KEEPSAKES.map(keepsake => {
        const entry = byId.get(keepsake.id);
        return {
          ...presentKeepsake(keepsake.id, clock.locale, { withNote: Boolean(entry) }),
          owned: Boolean(entry), count: entry?.count || 0, firstLocalDate: entry?.firstLocalDate || null
        };
      })
    };
  });
}

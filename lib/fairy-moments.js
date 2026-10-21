// Fairy Moments: the active Fairy occasionally posts while at tea, on the swing, at the
// mailbox, in the treehouse, out on a walk or just before sleep: a photo, or a text-only
// small discovery with her own mood. Posts are derived from the seeded runtime transitions,
// so replaying a reconcile never posts twice. Owner-only; off unless the owner is listed
// in FAIRY_MOMENTS_OWNER_IDS.
import { localDateForInstant, normalizeIanaTimezone } from "./ai-periods.js";
import { FAIRY_MOMENTS_CONFIG, FAIRY_RUNTIME_CONFIG } from "./fairy-config.js";
import { FAIRY_MOMENT_CAPTIONS } from "./fairy-moment-captions.js";
import { stableFraction } from "./fairy-runtime.js";
import { weeklyReportLocale } from "./report-locale.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const MAX_OWNERS = 100;
export const FAIRY_MOMENTS_PAGE_SIZE = 20;

// Comma-separated User ids. Unset, empty or malformed: nobody (fails closed).
export function fairyMomentsEnabledFor(userId, env = process.env) {
  const raw = env.FAIRY_MOMENTS_OWNER_IDS;
  if (typeof raw !== "string" || !raw) return false;
  const ids = raw.split(",");
  if (ids.length > MAX_OWNERS || ids.some(id => !/^[A-Za-z0-9_-]{1,64}$/.test(id))) return false;
  return ids.includes(userId);
}

export function fairyMomentsSince(now) {
  return new Date(now.getTime() - FAIRY_MOMENTS_CONFIG.lookbackDays * DAY_MS);
}

const hourFormatters = new Map();
function localHour(at, timezone) {
  let formatter = hourFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
    hourFormatters.set(timezone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(at).map(part => [part.type, part.value]));
  return Number(parts.hour) + Number(parts.minute) / 60;
}

// Active hours are in the account timezone (User.timezone), like every other local time.
function postingAllowed(at, hour, postedTimes, [start, end]) {
  if (hour < start || hour >= end) return false;
  const minGap = FAIRY_MOMENTS_CONFIG.minGapHours * HOUR_MS;
  if (postedTimes.some(time => Math.abs(at - time) < minGap)) return false;
  return postedTimes.filter(time => time <= at && time > at - 7 * DAY_MS).length < FAIRY_MOMENTS_CONFIG.maxPerWeek;
}

const pickFrom = (list, seed) => list[Math.floor(stableFraction(seed) * list.length)];
const periodAt = hour => FAIRY_MOMENTS_CONFIG.periods.find(([, from, to]) => hour >= from && hour < to)?.[0];

// Her mood is fixed per local day, nudged by where she is: an empty mailbox can make her
// wistful, bedtime makes her sleepy or cozy.
export function fairyMood(userFairyId, localDate, state, seed) {
  const mood = pickFrom(FAIRY_MOMENTS_CONFIG.moods, `${userFairyId}:mood:${localDate}`);
  if (state === "AT_MAILBOX" && stableFraction(`${seed}:wistful`) < 0.3) return "WISTFUL";
  if (state === "SLEEPING" && !["SLEEPY", "COZY", "CALM"].includes(mood)) return "SLEEPY";
  return mood;
}

// Photos rendered in the current light; walks have one photo per sight.
function photoOptions(state, spot, period) {
  if (state === "IDLE") return FAIRY_MOMENTS_CONFIG.spotPhotos[spot] === period ? [`IDLE/${spot}`] : [];
  return (FAIRY_MOMENTS_CONFIG.photos[state] || []).filter(photo => photo.period === period).map(photo => `${state}/${photo.key}`);
}

// Pure: which of the entered states become posts, given the posts already made.
export function planFairyMoments({ userFairyId, entered, timezone, postedAt = [] }) {
  const zone = normalizeIanaTimezone(timezone) || "UTC";
  const { states, chancePerVisit, stateHours, activeHours, spots, textOnlyChance, postDelayMinutes: [minDelay, maxDelay] } = FAIRY_MOMENTS_CONFIG;
  const postedTimes = postedAt.map(date => new Date(date).getTime());
  const planned = [];
  for (const { state, at, runtimeVersion } of entered) {
    if (!states.includes(state)) continue;
    const seed = `${userFairyId}:moment:${runtimeVersion}`;
    if (stableFraction(`${seed}:chance`) >= chancePerVisit[state]) continue;
    const delayMinutes = minDelay + stableFraction(`${seed}:delay`) * (maxDelay - minDelay);
    const time = new Date(at).getTime() + Math.round(delayMinutes * 60_000);
    const hour = localHour(time, zone);
    if (!postingAllowed(time, hour, postedTimes, stateHours[state] || activeHours)) continue;
    postedTimes.push(time);
    const spot = state === "IDLE" ? pickFrom(spots, `${seed}:spot`) : null;
    const options = photoOptions(state, spot, periodAt(hour));
    const textOnly = !options.length || stableFraction(`${seed}:text`) < textOnlyChance;
    planned.push({
      runtimeVersion, state, spot, postedAt: new Date(time),
      mood: fairyMood(userFairyId, localDateForInstant(new Date(time), zone), state, seed),
      photoKey: textOnly ? null : pickFrom(options, `${seed}:photo`)
    });
  }
  return planned;
}

function captionLocale(preferredLocale) {
  try { return weeklyReportLocale(preferredLocale); } catch { return "en"; }
}

export const fairyMomentTopic = (state, spot) => state === "IDLE" ? `IDLE:${spot}` : state;

// Seeded preset pick that skips captions she used recently. A text-only post is a small
// discovery; lines written for her current mood come first.
export function pickFairyMomentCaption({ seed, topic, textOnly = false, mood = null, locale, recentCaptions = [] }) {
  const captions = FAIRY_MOMENT_CAPTIONS[captionLocale(locale)];
  let options = captions.photo[topic];
  if (textOnly) {
    const lines = captions.text[topic];
    options = [...lines.filter(([lineMood]) => lineMood === mood), ...lines.filter(([lineMood]) => lineMood !== mood)].map(([, text]) => text);
  }
  const preferred = textOnly ? Math.max(1, captions.text[topic].filter(([lineMood]) => lineMood === mood).length) : options.length;
  const start = Math.floor(stableFraction(`${seed}:caption`) * preferred);
  for (let offset = 0; offset < options.length; offset++) {
    const caption = options[(start + offset) % options.length];
    if (!recentCaptions.includes(caption)) return caption;
  }
  return options[start];
}

// Called inside the runtime transaction, after reconcile, under the fairy-runtime lock.
// captionSource PENDING lets a model caption replace the preset later (lib/haiku-fairy-moment.js).
export async function recordFairyMoments(tx, { userId, userFairyId, entered, timezone, locale, captionSource = "FALLBACK" }) {
  if (!entered.length) return 0;
  const windowStart = new Date(new Date(entered[0].at).getTime() - 7 * DAY_MS);
  const recent = await tx.fairyMoment.findMany({
    where: { userFairyId, postedAt: { gte: windowStart } },
    orderBy: { postedAt: "asc" },
    select: { postedAt: true, caption: true }
  });
  const planned = planFairyMoments({ userFairyId, entered, timezone, postedAt: recent.map(moment => moment.postedAt) });
  if (!planned.length) return 0;
  const recentCaptions = recent.slice(-5).map(moment => moment.caption);
  const data = planned.map(moment => {
    const caption = pickFairyMomentCaption({
      seed: `${userFairyId}:moment:${moment.runtimeVersion}`, topic: fairyMomentTopic(moment.state, moment.spot),
      textOnly: !moment.photoKey, mood: moment.mood, locale, recentCaptions
    });
    recentCaptions.push(caption);
    return { ...moment, userId, userFairyId, caption, captionSource };
  });
  const result = await tx.fairyMoment.createMany({ data, skipDuplicates: true });
  return result.count;
}

export async function hasUnreadFairyMoments(db, { userFairyId, momentsSeenAt, now }) {
  const newer = await db.fairyMoment.findFirst({
    where: { userFairyId, postedAt: { lte: now, ...(momentsSeenAt ? { gt: momentsSeenAt } : {}) } },
    select: { id: true }
  });
  return Boolean(newer);
}

function formatMoment(moment) {
  return {
    id: moment.id,
    postedAt: moment.postedAt,
    state: moment.state,
    location: moment.spot || FAIRY_RUNTIME_CONFIG.locations[moment.state],
    mood: moment.mood,
    photoKey: moment.photoKey,
    caption: moment.caption,
    liked: Boolean(moment.likedAt)
  };
}

// Newest first. Posts scheduled a few minutes ahead stay hidden until postedAt.
// Opening the first page marks everything shown as seen.
export async function listFairyMoments(db, { userId, before = null, now }) {
  const fairy = await db.userFairy.findFirst({
    where: { userId, isActive: true },
    select: { id: true, fairyType: true, name: true, momentsSeenAt: true }
  });
  if (!fairy) return null;
  // The panel's own words follow the same language as her captions (Weekly report language).
  const owner = await db.user.findUnique({ where: { id: userId }, select: { preferredLocale: true } });
  const rows = await db.fairyMoment.findMany({
    where: { userFairyId: fairy.id, postedAt: { lte: now, ...(before ? { lt: before } : {}) } },
    orderBy: { postedAt: "desc" },
    take: FAIRY_MOMENTS_PAGE_SIZE + 1
  });
  const posts = rows.slice(0, FAIRY_MOMENTS_PAGE_SIZE);
  const newest = posts[0]?.postedAt;
  if (!before && newest && (!fairy.momentsSeenAt || newest > fairy.momentsSeenAt)) {
    await db.userFairy.update({ where: { id: fairy.id }, data: { momentsSeenAt: newest } });
  }
  return {
    fairy: { id: fairy.id, type: fairy.fairyType, name: fairy.name },
    locale: captionLocale(owner?.preferredLocale),
    posts: posts.map(formatMoment),
    nextBefore: rows.length > FAIRY_MOMENTS_PAGE_SIZE ? posts.at(-1).postedAt : null
  };
}

export async function setFairyMomentLike(db, { userId, momentId, liked, now }) {
  const result = await db.fairyMoment.updateMany({
    where: { id: momentId, userId, postedAt: { lte: now } },
    data: { likedAt: liked ? now : null }
  });
  return result.count > 0;
}

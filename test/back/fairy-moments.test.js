import test from "node:test";
import assert from "node:assert/strict";

import { FAIRY_MOMENTS_CONFIG, FAIRY_RUNTIME_CONFIG } from "../../lib/fairy-config.js";
import { FAIRY_MOMENT_CAPTIONS } from "../../lib/fairy-moment-captions.js";
import { reconcileFairyRuntime } from "../../lib/fairy-runtime.js";
import {
  fairyMomentTopic,
  fairyMomentsEnabledFor,
  fairyMomentsSince,
  pickFairyMomentCaption,
  planFairyMoments
} from "../../lib/fairy-moments.js";

const HOUR = 3_600_000;
const start = new Date("2026-10-01T00:00:00.000Z");
const FAIRIES = Array.from({ length: 12 }, (_, index) => `fairy-${index + 1}`);

// A visit to `state` every 75 minutes for `days` days.
function visits(state, days = 28, from = start) {
  return Array.from({ length: Math.floor(days * 24 * 60 / 75) }, (_, index) => ({
    state, at: new Date(from.getTime() + index * 75 * 60_000), runtimeVersion: index + 1
  }));
}
const planAll = (state, timezone = "UTC") =>
  FAIRIES.flatMap(userFairyId => planFairyMoments({ userFairyId, entered: visits(state), timezone }).map(moment => ({ ...moment, userFairyId })));

function localHour(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" })
    .formatToParts(date).map(part => [part.type, part.value]));
  return Number(parts.hour) + Number(parts.minute) / 60;
}
const periodAt = hour => FAIRY_MOMENTS_CONFIG.periods.find(([, from, to]) => hour >= from && hour < to)[0];
const photoPeriod = key => {
  const [state, id] = key.split("/");
  return state === "IDLE" ? FAIRY_MOMENTS_CONFIG.spotPhotos[id] : FAIRY_MOMENTS_CONFIG.photos[state].find(photo => photo.key === id).period;
};

test("owner allowlist is off by default and fails closed when malformed", () => {
  assert.equal(fairyMomentsEnabledFor("user_1", {}), false);
  assert.equal(fairyMomentsEnabledFor("user_1", { FAIRY_MOMENTS_OWNER_IDS: "" }), false);
  assert.equal(fairyMomentsEnabledFor("user_1", { FAIRY_MOMENTS_OWNER_IDS: "user_1,user_2" }), true);
  assert.equal(fairyMomentsEnabledFor("user_3", { FAIRY_MOMENTS_OWNER_IDS: "user_1,user_2" }), false);
  assert.equal(fairyMomentsEnabledFor("user_1", { FAIRY_MOMENTS_OWNER_IDS: "user_1, user_2" }), false);
  assert.equal(fairyMomentsEnabledFor("user_1", { FAIRY_MOMENTS_OWNER_IDS: "user_1,,user_2" }), false);
  // "*" alone: every signed-in owner (the beta); mixed or padded forms stay closed.
  assert.equal(fairyMomentsEnabledFor("user_9", { FAIRY_MOMENTS_OWNER_IDS: "*" }), true);
  assert.equal(fairyMomentsEnabledFor(undefined, { FAIRY_MOMENTS_OWNER_IDS: "*" }), false);
  for (const value of ["*,user_1", " *", "**"]) assert.equal(fairyMomentsEnabledFor("user_1", { FAIRY_MOMENTS_OWNER_IDS: value }), false, value);
});

test("planning is deterministic and posts some, but not every, visit", () => {
  const entered = visits("TEA_TIME");
  const first = planFairyMoments({ userFairyId: "fairy-1", entered, timezone: "UTC" });
  assert.deepEqual(planFairyMoments({ userFairyId: "fairy-1", entered, timezone: "UTC" }), first);
  assert.ok(first.length >= 4, `expected several posts in four weeks, got ${first.length}`);
  assert.ok(first.length <= 4 * FAIRY_MOMENTS_CONFIG.maxPerWeek);
  assert.notDeepEqual(planFairyMoments({ userFairyId: "fairy-2", entered, timezone: "UTC" }), first);
  for (const moment of first) {
    assert.equal(moment.state, "TEA_TIME");
    assert.equal(moment.spot, null);
    const visit = entered.find(item => item.runtimeVersion === moment.runtimeVersion);
    const delay = (moment.postedAt - visit.at) / 60_000;
    assert.ok(delay >= 5 && delay <= 25, "posted 5-25 minutes into the visit");
  }
});

test("posts respect active hours in the account timezone, the 48h gap and the weekly cap", () => {
  for (const timezone of ["UTC", "America/Vancouver", "Asia/Shanghai"]) {
    const planned = planFairyMoments({ userFairyId: "fairy-1", entered: visits("SWINGING"), timezone });
    assert.ok(planned.length > 0, timezone);
    const [open, close] = FAIRY_MOMENTS_CONFIG.activeHours;
    for (const [index, moment] of planned.entries()) {
      const hour = localHour(moment.postedAt, timezone);
      assert.ok(hour >= open && hour < close, `${timezone} local hour ${hour}`);
      if (index) assert.ok(moment.postedAt - planned[index - 1].postedAt >= FAIRY_MOMENTS_CONFIG.minGapHours * HOUR);
      const week = planned.filter(other => other.postedAt <= moment.postedAt && other.postedAt > moment.postedAt - 7 * 24 * HOUR);
      assert.ok(week.length <= FAIRY_MOMENTS_CONFIG.maxPerWeek);
    }
  }
});

test("an invalid account timezone falls back to UTC", () => {
  const entered = visits("TEA_TIME");
  assert.deepEqual(planFairyMoments({ userFairyId: "fairy-1", entered, timezone: "Not/AZone" }),
    planFairyMoments({ userFairyId: "fairy-1", entered, timezone: "UTC" }));
});

test("a photo always matches the local light; otherwise the post is text only", () => {
  for (const timezone of ["UTC", "Asia/Shanghai"]) {
    for (const state of ["TEA_TIME", "SWINGING", "AT_MAILBOX", "IN_TREEHOUSE", "IDLE"]) {
      const planned = planAll(state, timezone);
      const photos = planned.filter(moment => moment.photoKey), texts = planned.filter(moment => !moment.photoKey);
      assert.ok(photos.length && texts.length, `${state} has both photo and text posts`);
      for (const moment of photos) {
        assert.equal(photoPeriod(moment.photoKey), periodAt(localHour(moment.postedAt, timezone)), moment.photoKey);
        assert.ok(moment.photoKey.startsWith(`${state}/`));
      }
    }
  }
  // AT_MAILBOX has only daytime photos, so evening mailbox posts are all text.
  const evening = planAll("AT_MAILBOX").filter(moment => localHour(moment.postedAt, "UTC") >= 18);
  assert.ok(evening.length > 0 && evening.every(moment => moment.photoKey === null));
});

test("walks are about one sight; good night only posts late with night photos", () => {
  const walks = planAll("IDLE");
  assert.deepEqual([...new Set(walks.map(moment => moment.spot))].sort(), [...FAIRY_MOMENTS_CONFIG.spots].sort());
  for (const moment of walks.filter(item => item.photoKey)) assert.equal(moment.photoKey, `IDLE/${moment.spot}`);
  const nights = planAll("SLEEPING");
  assert.ok(nights.length > 0);
  for (const moment of nights) {
    const hour = localHour(moment.postedAt, "UTC");
    assert.ok(hour >= 21 && hour < 23.5, `good night at ${hour}`);
    assert.equal(moment.spot, null);
    if (moment.photoKey) assert.equal(photoPeriod(moment.photoKey), "night");
    assert.ok(["SLEEPY", "COZY", "CALM"].includes(moment.mood));
  }
});

test("her mood is one of hers, fixed per local day, and an empty mailbox can make her wistful", () => {
  for (const state of ["TEA_TIME", "AT_MAILBOX"]) {
    for (const moment of planAll(state)) assert.ok(FAIRY_MOMENTS_CONFIG.moods.includes(moment.mood));
  }
  // Same fairy and local day, different visits: the same base mood (mailbox can override to WISTFUL).
  const day = new Date("2026-10-05T09:00:00.000Z");
  const sameDay = [1, 2, 3].map(version => planFairyMoments({ userFairyId: "fairy-1", timezone: "UTC",
    entered: [{ state: "TEA_TIME", at: new Date(day.getTime() + version * 60_000), runtimeVersion: version * 1000 }] }));
  const moods = new Set(sameDay.flat().map(moment => moment.mood));
  assert.ok(moods.size <= 1);
  const mailboxMoods = planAll("AT_MAILBOX").map(moment => moment.mood);
  assert.ok(mailboxMoods.filter(mood => mood === "WISTFUL").length > mailboxMoods.length / 7);
});

test("sleeping outside the late window never posts", () => {
  const morning = visits("SLEEPING", 28).filter(visit => visit.at.getUTCHours() < 20);
  assert.deepEqual(planFairyMoments({ userFairyId: "fairy-1", entered: morning, timezone: "UTC" }), []);
});

test("existing posts block new ones within the gap, so a replayed plan adds nothing", () => {
  const entered = visits("AT_MAILBOX", 7);
  const planned = planFairyMoments({ userFairyId: "fairy-1", entered, timezone: "UTC" });
  assert.ok(planned.length > 0);
  assert.deepEqual(planFairyMoments({ userFairyId: "fairy-1", entered, timezone: "UTC", postedAt: planned.map(item => item.postedAt) }), []);
});

const TOPICS = [...["TEA_TIME", "SWINGING", "AT_MAILBOX", "IN_TREEHOUSE", "SLEEPING"],
  ...FAIRY_MOMENTS_CONFIG.spots.map(spot => fairyMomentTopic("IDLE", spot))];

test("every topic has photo captions and mood-tagged discovery lines in both languages", () => {
  for (const locale of Object.keys(FAIRY_MOMENT_CAPTIONS)) {
    const { photo, text } = FAIRY_MOMENT_CAPTIONS[locale];
    assert.deepEqual(Object.keys(photo).sort(), [...TOPICS].sort(), locale);
    assert.deepEqual(Object.keys(text).sort(), [...TOPICS].sort(), locale);
    for (const topic of TOPICS) {
      assert.ok(photo[topic].length >= 3, `${locale} ${topic}`);
      assert.ok(text[topic].length >= 3, `${locale} ${topic}`);
      assert.ok(text[topic].every(([mood, line]) => FAIRY_MOMENTS_CONFIG.moods.includes(mood) && line.length <= 280));
      assert.ok(photo[topic].every(line => line.length <= 280));
    }
  }
});

test("captions follow the owner's locale, prefer her mood for text posts and avoid recent repeats", () => {
  const english = FAIRY_MOMENT_CAPTIONS.en.photo.TEA_TIME;
  assert.ok(english.includes(pickFairyMomentCaption({ seed: "s", topic: "TEA_TIME", locale: "en-CA" })));
  assert.ok(FAIRY_MOMENT_CAPTIONS["zh-Hans"].photo.TEA_TIME.includes(pickFairyMomentCaption({ seed: "s", topic: "TEA_TIME", locale: "zh-Hans-CN" })));
  assert.ok(english.includes(pickFairyMomentCaption({ seed: "s", topic: "TEA_TIME", locale: "fr" })));
  assert.equal(pickFairyMomentCaption({ seed: "s", topic: "TEA_TIME", locale: "en", recentCaptions: english.slice(0, -1) }), english.at(-1));
  const lines = FAIRY_MOMENT_CAPTIONS["zh-Hans"].text["IDLE:EAST_BRIDGE"];
  const curious = lines.find(([mood]) => mood === "CURIOUS")[1];
  assert.equal(pickFairyMomentCaption({ seed: "s", topic: "IDLE:EAST_BRIDGE", textOnly: true, mood: "CURIOUS", locale: "zh-Hans" }), curious);
  const other = pickFairyMomentCaption({ seed: "s", topic: "IDLE:EAST_BRIDGE", textOnly: true, mood: "CURIOUS", locale: "zh-Hans", recentCaptions: [curious] });
  assert.ok(lines.some(([, line]) => line === other) && other !== curious);
  assert.ok(lines.some(([, line]) => line === pickFairyMomentCaption({ seed: "s", topic: "IDLE:EAST_BRIDGE", textOnly: true, mood: "SLEEPY", locale: "zh-Hans" })));
});

test("every postable state has a location and photos in valid light", () => {
  const periods = FAIRY_MOMENTS_CONFIG.periods.map(([period]) => period);
  for (const state of FAIRY_MOMENTS_CONFIG.states) {
    assert.ok(FAIRY_RUNTIME_CONFIG.locations[state]);
    assert.ok(FAIRY_MOMENTS_CONFIG.chancePerVisit[state] > 0);
    for (const photo of FAIRY_MOMENTS_CONFIG.photos[state] || []) assert.ok(periods.includes(photo.period));
  }
  for (const spot of FAIRY_MOMENTS_CONFIG.spots) assert.ok(periods.includes(FAIRY_MOMENTS_CONFIG.spotPhotos[spot]));
});

test("reconcile reports states entered since the lookback, oldest first", () => {
  const now = new Date("2026-10-20T12:00:00.000Z");
  const record = {
    userFairyId: "fairy-1", currentState: "IDLE", stateStartedAt: new Date("2026-10-01T00:00:00.000Z"),
    nextTransitionAt: null, runtimeVersion: 0
  };
  assert.deepEqual(reconcileFairyRuntime(record, { now }).entered, []);
  const since = fairyMomentsSince(now);
  const { entered, update } = reconcileFairyRuntime(record, { now, enteredSince: since });
  assert.ok(entered.length > 50);
  assert.ok(entered.every(item => item.at >= since && item.at <= now));
  assert.ok(entered.every((item, index) => !index || item.runtimeVersion === entered[index - 1].runtimeVersion + 1));
  assert.equal(entered.at(-1).runtimeVersion, update.runtimeVersion);
  assert.equal(entered.at(-1).state, update.currentState);
});

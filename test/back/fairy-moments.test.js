import test from "node:test";
import assert from "node:assert/strict";

import { FAIRY_MOMENTS_CONFIG, FAIRY_RUNTIME_CONFIG } from "../../lib/fairy-config.js";
import { FAIRY_MOMENT_CAPTIONS } from "../../lib/fairy-moment-captions.js";
import { reconcileFairyRuntime } from "../../lib/fairy-runtime.js";
import {
  fairyMomentsEnabledFor,
  fairyMomentsSince,
  pickFairyMomentCaption,
  planFairyMoments
} from "../../lib/fairy-moments.js";

const HOUR = 3_600_000;
const start = new Date("2026-10-01T00:00:00.000Z");

// A visit to `state` every 75 minutes for `days` days.
function visits(state, days = 28, from = start) {
  return Array.from({ length: Math.floor(days * 24 * 60 / 75) }, (_, index) => ({
    state, at: new Date(from.getTime() + index * 75 * 60_000), runtimeVersion: index + 1
  }));
}

function localHour(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" })
    .formatToParts(date).map(part => [part.type, part.value]));
  return Number(parts.hour) + Number(parts.minute) / 60;
}

test("owner allowlist is off by default and fails closed when malformed", () => {
  assert.equal(fairyMomentsEnabledFor("user_1", {}), false);
  assert.equal(fairyMomentsEnabledFor("user_1", { FAIRY_MOMENTS_OWNER_IDS: "" }), false);
  assert.equal(fairyMomentsEnabledFor("user_1", { FAIRY_MOMENTS_OWNER_IDS: "user_1,user_2" }), true);
  assert.equal(fairyMomentsEnabledFor("user_3", { FAIRY_MOMENTS_OWNER_IDS: "user_1,user_2" }), false);
  assert.equal(fairyMomentsEnabledFor("user_1", { FAIRY_MOMENTS_OWNER_IDS: "user_1, user_2" }), false);
  assert.equal(fairyMomentsEnabledFor("user_1", { FAIRY_MOMENTS_OWNER_IDS: "user_1,,user_2" }), false);
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
    assert.equal(moment.photoKey, "TEA_TIME/1");
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

test("sleeping and idle visits never post", () => {
  for (const state of ["SLEEPING", "IDLE"]) {
    assert.deepEqual(planFairyMoments({ userFairyId: "fairy-1", entered: visits(state), timezone: "UTC" }), []);
  }
});

test("existing posts block new ones within the gap, so a replayed plan adds nothing", () => {
  const entered = visits("AT_MAILBOX", 7);
  const planned = planFairyMoments({ userFairyId: "fairy-1", entered, timezone: "UTC" });
  assert.ok(planned.length > 0);
  assert.deepEqual(planFairyMoments({ userFairyId: "fairy-1", entered, timezone: "UTC", postedAt: planned.map(item => item.postedAt) }), []);
});

test("captions follow the owner's locale and avoid recent repeats", () => {
  const english = FAIRY_MOMENT_CAPTIONS.en.TEA_TIME;
  const chinese = FAIRY_MOMENT_CAPTIONS["zh-Hans"].TEA_TIME;
  assert.ok(english.includes(pickFairyMomentCaption({ seed: "s", state: "TEA_TIME", locale: "en-CA" })));
  assert.ok(chinese.includes(pickFairyMomentCaption({ seed: "s", state: "TEA_TIME", locale: "zh-Hans-CN" })));
  assert.ok(english.includes(pickFairyMomentCaption({ seed: "s", state: "TEA_TIME", locale: "fr" })));
  const recentCaptions = english.slice(0, -1);
  assert.equal(pickFairyMomentCaption({ seed: "s", state: "TEA_TIME", locale: "en", recentCaptions }), english.at(-1));
  for (const locale of Object.keys(FAIRY_MOMENT_CAPTIONS)) {
    for (const state of FAIRY_MOMENTS_CONFIG.states) {
      assert.ok(FAIRY_MOMENT_CAPTIONS[locale][state].length >= 6, `${locale} ${state}`);
      assert.ok(FAIRY_MOMENT_CAPTIONS[locale][state].every(caption => caption.length <= 280));
    }
  }
});

test("every postable state has a location and at least one photo", () => {
  for (const state of FAIRY_MOMENTS_CONFIG.states) {
    assert.ok(FAIRY_RUNTIME_CONFIG.locations[state]);
    assert.ok(FAIRY_MOMENTS_CONFIG.photosPerState[state] >= 1);
  }
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

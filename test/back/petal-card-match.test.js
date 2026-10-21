import assert from "node:assert/strict";
import test from "node:test";
import { ARC_CARDS, matchWeeklyPetalCard, weeklyArc } from "../../lib/petal-card-match.js";
import { petalCard } from "../../lib/petal-cards.js";

const DAYS = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"];
const M = { Q: "QUIET_BLOOM", D: "DRIFTING_BLOOM", F: "FIRE_BLOOM", S: "SUNNY_BLOOM", P: "PEACEFUL_BLOOM",
  H: "HEALING_BLOOM", G: "GENTLE_BLOOM", W: "WONDER_BLOOM" };
// "Q0 H5" = Quiet on Monday, Healing on Saturday; points stay in the order given (time order).
const week = spec => spec.split(" ").map(item => ({ mood: M[item[0]], date: DAYS[Number(item.slice(1))] }));
const match = (spec, ownerId = "alice", periodKey = "2026-09-14") => matchWeeklyPetalCard({ ownerId, periodKey, days: DAYS, points: week(spec) });

test("design example: a low week that lifts at the end gets a lifting card", () => {
  const result = match("Q0 Q1 D1 Q2 Q3 H4 H6");
  assert.equal(result.arc, "LIFTING");
  assert.deepEqual(result.dominant, { mood: "QUIET_BLOOM", count: 4 });
  assert.deepEqual(result.shift, { mood: "HEALING_BLOOM", count: 2 });
  assert.equal(result.distinct, 3);
  assert.ok(ARC_CARDS.LIFTING.includes(result.cardId));
});

test("a clear direction wins over mixed (owner decision)", () => {
  // Four distinct moods, low Mon–Thu, bright Fri–Sun: the effect-preview week.
  assert.equal(match("Q0 D1 Q2 H4 S5 H6").arc, "LIFTING");
  assert.equal(match("S0 P1 S2 F4 Q5 Q6").arc, "SINKING");
  assert.ok(ARC_CARDS.SINKING.includes(match("S0 P1 S2 F4 Q5 Q6").cardId));
  // Four moods with no clear direction.
  const mixed = match("S0 Q1 W4 F5");
  assert.equal(mixed.arc, "MIXED");
  assert.equal(mixed.shift, null);
  assert.ok(ARC_CARDS.MIXED.includes(mixed.cardId));
});

test("direction needs more than half of each side, and both halves", () => {
  assert.equal(weeklyArc(week("Q0 S1 H4 H5"), DAYS).arc, "STEADY", "half low is not a low start");
  assert.equal(weeklyArc(week("Q0 Q1 Q2"), DAYS).arc, "STEADY", "nothing on Fri–Sun");
  assert.equal(weeklyArc(week("W0 W1 W5 W6"), DAYS).arc, "STEADY", "Wonder is neither low nor bright");
});

test("steady week: a card tagged with the dominant mood; ties go to the later mood", () => {
  const steady = match("P0 P2 P5");
  assert.equal(steady.arc, "STEADY");
  assert.ok(petalCard(steady.cardId).moods.includes("PEACEFUL_BLOOM"));
  const tie = match("G0 G1 W5 W6");
  assert.deepEqual(tie.dominant, { mood: "WONDER_BLOOM", count: 2 });
  assert.ok(petalCard(tie.cardId).moods.includes("WONDER_BLOOM"));
  for (const id of Object.values(ARC_CARDS).flat()) assert.equal(petalCard(id).heavy, false, id);
});

test("fewer than three moods: no card", () => {
  assert.equal(match("Q0 H5"), null);
  assert.equal(matchWeeklyPetalCard({ ownerId: "alice", periodKey: "2026-09-14", days: DAYS.slice(1), points: week("Q0 Q1 H5") }), null);
});

test("stable per owner and week, varied across weeks", () => {
  assert.equal(match("Q0 Q1 D1 Q2 Q3 H4 H6").cardId, match("Q0 Q1 D1 Q2 Q3 H4 H6").cardId);
  const picks = new Set(Array.from({ length: 60 }, (_, i) => match("Q0 Q1 D1 Q2 Q3 H4 H6", "alice", `2026-W${i}`).cardId));
  assert.deepEqual([...picks].sort(), [...ARC_CARDS.LIFTING].sort());
  const owners = new Set(Array.from({ length: 60 }, (_, i) => match("P0 P2 P5", `user-${i}`).cardId));
  assert.ok(owners.size > 3, "different owners get different steady cards");
});

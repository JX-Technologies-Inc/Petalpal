// OFFLINE ONLY: deterministic selection over synthetic native-Chinese weeks R-U plus
// the busy stress weeks. No provider, database or network. Annotations never reach input.
import assert from "node:assert/strict";
import test from "node:test";
import { CASES, EXTRA_CASES, analyzeWeekly, weeklyArgs } from "../../experiments/weekly-selective-reflection-v1/stress.mjs";
import { ZH_NATIVE_CASES } from "../../experiments/weekly-selective-reflection-v1/zh-native.mjs";

const all = [...CASES, ...EXTRA_CASES, ...ZH_NATIVE_CASES];
const busy = [["A", 3], ["B", 1], ["F", 2], ["J", 1], ["K", 3], ["L", 2]];

test("native zh weeks R-U are well-formed busy weeks with two agreed important Events each", () => {
  assert.deepEqual(ZH_NATIVE_CASES.map(c => c.id), ["R", "S", "T", "U"]);
  for (const c of ZH_NATIVE_CASES) {
    assert.ok(c.events.length >= 15 && c.events.length <= 25, c.id);
    assert.equal(c.events.filter(e => e.meaningful).length, 2, c.id);
    const slots = c.events.map(e => `${e.day}/${e.hour}`);
    assert.equal(new Set(slots).size, slots.length, `${c.id} unique day/hour`);
    for (const e of c.events) assert.ok(e.day >= 14 && e.day <= 20 && e.zh.length > 0 && e.zh.length < 450);
    const { args } = weeklyArgs(c, "zh-Hans");
    for (const row of args.candidates) assert.ok(!("meaningful" in row) && !("labelerOnly" in row));
  }
});

test("default selection misses most important Events; significance ordering delivers all of them", () => {
  let delivered = { v1: 0, sig: 0 }, important = 0;
  const cells = [...busy.flatMap(([id, n]) => ["en", "zh-Hans"].map(locale => [id, locale, n])),
    ...ZH_NATIVE_CASES.map(c => [c.id, "zh-Hans", 2])];
  for (const [id, locale, n] of cells) {
    const out = analyzeWeekly(all.find(c => c.id === id), locale);
    assert.equal(out.meaningful, n, `${id}/${locale}`);
    assert.equal(out.v1.status, "READY"); assert.equal(out.sig.status, "READY");
    assert.equal(out.sig.meaningfulDelivered, n, `${id}/${locale} significance delivers every important Event`);
    delivered.v1 += out.v1.meaningfulDelivered; delivered.sig += out.sig.meaningfulDelivered; important += n;
  }
  assert.equal(important, 32);
  assert.deepEqual(delivered, { v1: 10, sig: 32 });
  const native = ZH_NATIVE_CASES.map(c => analyzeWeekly(c, "zh-Hans"));
  assert.deepEqual(native.map(o => o.v1.meaningfulDelivered), [0, 1, 1, 0]);
});

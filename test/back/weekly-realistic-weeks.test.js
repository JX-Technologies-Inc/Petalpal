// OFFLINE ONLY. Realistic irregular weeks M-Q through the real Weekly selectors and
// packet builder in en and zh-Hans. Proves what the writer receives; it does not
// measure writing quality (that needs separately approved live calls).
import assert from "node:assert/strict";
import test from "node:test";
import { REALISTIC_CASES } from "../../experiments/weekly-selective-reflection-v1/realistic.mjs";
import { analyzeWeekly } from "../../experiments/weekly-selective-reflection-v1/stress.mjs";

const LOCALES = ["en", "zh-Hans"];
const byId = Object.fromEntries(REALISTIC_CASES.map((c) => [c.id, c]));

test("every meaningful moment in the irregular weeks reaches the writer, in both languages and all selectors", () => {
  // [events, meaningful]; small weeks deliver every Event, so filler reaches the writer too.
  const expected = { M: [5, 2], N: [6, 1], O: [5, 4], P: [4, 2] };
  for (const [id, [events, meaningful]] of Object.entries(expected)) {
    for (const locale of LOCALES) {
      const r = analyzeWeekly(byId[id], locale);
      assert.equal(r.events, events, `${id}/${locale} events`);
      for (const selector of ["v1", "v2", "sig"]) {
        assert.equal(r[selector].status, "READY", `${id}/${locale}/${selector}`);
        assert.equal(r[selector].meaningfulDelivered, meaningful, `${id}/${locale}/${selector} meaningful`);
        assert.equal(r[selector].delivered, events, `${id}/${locale}/${selector} filler is delivered too`);
      }
    }
  }
});

test("bursts and gaps keep both ends of the week; the low day stays in the evidence", () => {
  for (const locale of LOCALES) {
    assert.deepEqual(analyzeWeekly(byId.M, locale).v2.days, [14, 19, 20]);
    const o = analyzeWeekly(byId.O, locale).v2;
    assert.deepEqual(o.days, [15, 16, 17, 18], "the low day (17th) is not dropped or softened away by selection");
  }
});

test("a single-Event week abstains instead of padding", () => {
  for (const locale of LOCALES) {
    const r = analyzeWeekly(byId.Q, locale);
    for (const selector of ["v1", "v2", "sig"]) assert.equal(r[selector].status, "INSUFFICIENT_EVIDENCE", `${locale}/${selector}`);
  }
});

test("ultra-short entries, sarcasm and code-switching reach the writer verbatim", () => {
  const texts = (c, locale) => [...analyzeWeekly(c, locale).v2.built.packet.evidence].map((item) => item.text);
  assert.ok(texts(byId.N, "zh-Hans").includes("累"));
  assert.ok(texts(byId.P, "en").some((t) => t.includes("Just perfect.")));
  assert.ok(texts(byId.P, "zh-Hans").some((t) => t.includes("totally worth it")));
});

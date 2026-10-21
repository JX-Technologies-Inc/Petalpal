import assert from "node:assert/strict";
import test from "node:test";
import { CANONICAL_PRIMARY_GARDEN_MOODS } from "../../lib/flower-variant-config.js";
import { DRAWABLE_PETAL_CARDS, PETAL_CARD_DISCLAIMER, PETAL_CARDS, petalCard } from "../../lib/petal-cards.js";

const HEAVY = ["major-13", "major-15", "major-16", "swords-03", "swords-05", "swords-08", "swords-09", "swords-10", "pentacles-05"];

test("catalog: 78 cards, the 9 heavy ones never drawable", () => {
  assert.equal(PETAL_CARDS.length, 78);
  assert.equal(new Set(PETAL_CARDS.map(card => card.id)).size, 78);
  assert.equal(new Set(PETAL_CARDS.map(card => card.art)).size, 78);
  assert.deepEqual(PETAL_CARDS.filter(card => card.heavy).map(card => card.id).sort(), [...HEAVY].sort());
  assert.equal(DRAWABLE_PETAL_CARDS.length, 69);
  for (const id of HEAVY) assert.equal(petalCard(id).copy, null, id);
  assert.equal(petalCard("major-17").names["zh-Hans"], "星星");
  assert.equal(petalCard("nope"), null);
  const suits = { major: 22, wands: 14, cups: 14, swords: 14, pentacles: 14 };
  for (const [suit, count] of Object.entries(suits)) assert.equal(PETAL_CARDS.filter(card => card.id.startsWith(`${suit}-`)).length, count, suit);
});

test("copy: every drawable card has a short line and text in both locales, moods are Garden moods", () => {
  const limits = { en: { line: 48, text: 260 }, "zh-Hans": { line: 14, text: 70 } };
  for (const card of DRAWABLE_PETAL_CARDS) {
    assert.ok(card.moods.length >= 1 && card.moods.every(mood => CANONICAL_PRIMARY_GARDEN_MOODS.includes(mood)), card.id);
    for (const locale of ["en", "zh-Hans"]) {
      const { line, text } = card.copy[locale];
      assert.ok(line && [...line].length <= limits[locale].line, `${card.id} ${locale} line: ${line}`);
      assert.ok(text && [...text].length <= limits[locale].text, `${card.id} ${locale} text`);
    }
    // The fairy is 小花仙 in Chinese copy.
    assert.ok(!/小仙女/.test(card.copy["zh-Hans"].text), card.id);
  }
  // Every mood has at least one card, so a steady week can always be matched.
  for (const mood of CANONICAL_PRIMARY_GARDEN_MOODS) assert.ok(DRAWABLE_PETAL_CARDS.some(card => card.moods.includes(mood)), mood);
});

test("copy: no prediction, fortune or advice words", () => {
  const banned = { en: /\b(?:will|luck|lucky|fortune|fate|destin\w*|omen|should|must|try to)\b/iu,
    "zh-Hans": /预测|预示|运气|好运|厄运|注定|命中|吉|凶|应该|必须|试着|建议/u };
  for (const card of DRAWABLE_PETAL_CARDS) for (const locale of ["en", "zh-Hans"]) {
    const { line, text } = card.copy[locale];
    assert.ok(!banned[locale].test(`${line} ${text}`), `${card.id} ${locale}`);
  }
  assert.ok(PETAL_CARD_DISCLAIMER.en && PETAL_CARD_DISCLAIMER["zh-Hans"]);
});

import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";

import prisma from "../../lib/prisma.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { DRAWABLE_PETAL_CARDS } from "../../lib/petal-cards.js";
import { cardBackFor, dailyDeck, drawPetalCard, petalDrawsForMonth, todaysPetalDraw } from "../../lib/petal-card-draw.js";
import { app } from "../../server.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const at = (localDate, hourUtc = 20) => new Date(`${localDate}T${String(hourUtc).padStart(2, "0")}:00:00.000Z`);

test("today's deck: every drawable card once, fixed per owner and day, different across days and owners", () => {
  const deck = dailyDeck("u1", "2026-10-22");
  assert.equal(deck.length, DRAWABLE_PETAL_CARDS.length);
  assert.deepEqual([...deck].sort(), DRAWABLE_PETAL_CARDS.map(card => card.id).sort());
  assert.deepEqual(dailyDeck("u1", "2026-10-22"), deck);
  assert.notDeepEqual(dailyDeck("u1", "2026-10-23"), deck);
  assert.notDeepEqual(dailyDeck("u2", "2026-10-22"), deck);
});

test("card backs alternate by calendar day", () => {
  assert.notEqual(cardBackFor("2026-10-22"), cardBackFor("2026-10-23"));
  assert.equal(cardBackFor("2026-10-22"), cardBackFor("2026-10-24"));
  assert.ok(["lilac", "violet"].includes(cardBackFor("2026-10-31")));
});

function fakeDatabase(users) {
  const draws = [];
  const match = (row, where = {}) => Object.entries(where).every(([key, value]) => key === "userId_localDate"
    ? row.userId === value.userId && row.localDate === value.localDate
    : value && typeof value === "object" && "startsWith" in value ? row[key].startsWith(value.startsWith) : row[key] === value);
  const db = {
    draws,
    user: { findUnique: async ({ where }) => users[where.id] || null },
    petalCardDraw: {
      findUnique: async ({ where }) => draws.find(row => match(row, where)) || null,
      findMany: async ({ where }) => draws.filter(row => match(row, where)).sort((a, b) => a.localDate.localeCompare(b.localDate)),
      create: async ({ data }) => {
        if (draws.some(row => row.userId === data.userId && row.localDate === data.localDate)) throw new Error("unique");
        const row = { id: `d${draws.length + 1}`, createdAt: new Date(0), ...data }; draws.push(row); return row;
      }
    },
    $queryRaw: async () => [{ locked: "" }]
  };
  db.$transaction = async fn => fn(db);
  return db;
}
const OWNER = { o: { timezone: "America/Vancouver", preferredLocale: "zh-Hans" } };

test("once a day: the chosen place gives today's card; a second draw keeps the first", async () => {
  const db = fakeDatabase(OWNER);
  const before = await todaysPetalDraw(db, { userId: "o", now: at("2026-10-22") });
  assert.equal(before.localDate, "2026-10-22");
  assert.equal(before.deckSize, DRAWABLE_PETAL_CARDS.length);
  assert.equal(before.drawn, null);
  assert.equal(before.locale, "zh-Hans");
  assert.ok(!("deck" in before), "the deck order is never sent before the draw");

  const first = await drawPetalCard(db, { userId: "o", position: 12, now: at("2026-10-22") });
  assert.equal(first.created, true);
  assert.equal(first.position, 12);
  assert.equal(first.card.id, dailyDeck("o", "2026-10-22")[12]);
  assert.ok(first.card.name && first.card.line && first.card.text && first.card.disclaimer);

  const again = await drawPetalCard(db, { userId: "o", position: 3, now: at("2026-10-22", 23) });
  assert.equal(again.created, false);
  assert.equal(again.card.id, first.card.id);
  assert.equal((await todaysPetalDraw(db, { userId: "o", now: at("2026-10-22") })).drawn.card.id, first.card.id);

  // 06:30 UTC on the 23rd is still the 22nd in Vancouver; the next local day draws afresh.
  assert.equal((await drawPetalCard(db, { userId: "o", position: 0, now: new Date("2026-10-23T06:30:00Z") })).created, false);
  const next = await drawPetalCard(db, { userId: "o", position: DRAWABLE_PETAL_CARDS.length + 5, now: at("2026-10-23") });
  assert.equal(next.position, 5, "places wrap around the deck");
  assert.equal(next.card.id, dailyDeck("o", "2026-10-23")[5]);

  const month = await petalDrawsForMonth(db, { userId: "o", month: "2026-10", lang: "en" });
  assert.deepEqual(month.map(day => day.localDate), ["2026-10-22", "2026-10-23"]);
  assert.ok(month.every(day => day.id && day.name));
  await assert.rejects(drawPetalCard(db, { userId: "o", position: -1, now: at("2026-10-24") }), TypeError);
  await assert.rejects(drawPetalCard(db, { userId: "o", position: 1.5, now: at("2026-10-24") }), TypeError);
});

test("migration: one draw per owner and day, removed with the account", async () => {
  const db = new PGlite({ extensions: { vector } });
  try {
    const names = (await readdir(path.join(root, "prisma/migrations"), { withFileTypes: true }))
      .filter(item => item.isDirectory()).map(item => item.name).sort();
    for (const name of names) await db.exec(await readFile(path.join(root, "prisma/migrations", name, "migration.sql"), "utf8"));
    await db.exec(`INSERT INTO "User" (id, name) VALUES ('o', 'O');
      INSERT INTO "PetalCardDraw" (id, "userId", "localDate", position, "cardId") VALUES ('d1', 'o', '2026-10-22', 4, 'major-17');`);
    await assert.rejects(db.exec(`INSERT INTO "PetalCardDraw" (id, "userId", "localDate", position, "cardId") VALUES ('d2', 'o', '2026-10-22', 5, 'major-14')`), /unique/i);
    await db.exec(`DELETE FROM "User" WHERE id = 'o'`);
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM "PetalCardDraw"`)).rows[0].n, 0);
  } finally { await db.close(); }
});

test("petal draw routes", async (t) => {
  const db = fakeDatabase({ "owner-1": { timezone: "America/Vancouver", preferredLocale: "en" } });
  const restore = [];
  const stub = (target, method, fn) => { const original = target[method]; restore.push(() => { target[method] = original; }); target[method] = fn; };
  stub(prisma, "$transaction", async fn => fn(db));
  stub(prisma.user, "findUnique", async args => (args.where?.firebaseUid === "owner-uid"
    ? { id: "owner-1", firebaseUid: "owner-uid", timezone: "America/Vancouver" } : db.user.findUnique(args)));
  stub(prisma.petalCardDraw, "findUnique", db.petalCardDraw.findUnique);
  t.mock.timers.enable({ apis: ["Date"], now: at("2026-10-22") });
  setFirebaseTokenVerifierForTests(async () => ({ uid: "owner-uid", email: "owner@example.test", email_verified: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => {
    delete process.env.PETAL_CARDS_OWNER_IDS;
    restore.forEach(fn => fn());
    setFirebaseTokenVerifierForTests();
    await new Promise(resolve => server.close(resolve));
  });
  const call = async (urlPath, method = "GET", body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${urlPath}`, {
      method, headers: { Authorization: "Bearer owner-token", ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, body: await response.json() };
  };
  await t.test("off unless the owner is listed", async () => {
    assert.equal((await call("/api/petal-cards/today")).status, 404);
    assert.equal((await call("/api/petal-cards/draw", "POST", { position: 1 })).status, 404);
  });
  await t.test("today, draw, bad input", async () => {
    process.env.PETAL_CARDS_OWNER_IDS = "*";
    const today = await call("/api/petal-cards/today");
    assert.equal(today.status, 200);
    assert.equal(today.body.drawn, null);
    assert.ok(["lilac", "violet"].includes(today.body.back));
    for (const body of [{}, { position: -1 }, { position: "3" }, { position: 2.5 }, { position: 1, extra: true }]) {
      assert.equal((await call("/api/petal-cards/draw", "POST", body)).status, 400, JSON.stringify(body));
    }
    const drawn = await call("/api/petal-cards/draw", "POST", { position: 7 });
    assert.equal(drawn.status, 200);
    assert.equal(drawn.body.card.id, dailyDeck("owner-1", "2026-10-22")[7]);
    assert.equal((await call("/api/petal-cards/today")).body.drawn.card.id, drawn.body.card.id);
  });
});

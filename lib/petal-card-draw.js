// The daily petal card draw (轮回花环): once per account-local day the owner spins the ring and
// picks one place in today's deck. The deck is every drawable card in an order fixed per
// owner and day (seeded, so a refresh or another device shows the same deck); the app only
// learns the deck size until a place is chosen, so it cannot peek ahead. The card back
// alternates by day. Gated by the petal card switch (PETAL_CARDS_OWNER_IDS).
import { localDateForInstant, normalizeIanaTimezone } from "./ai-periods.js";
import { stableFraction } from "./fairy-runtime.js";
import { weeklyReportLocale } from "./report-locale.js";
import { DRAWABLE_PETAL_CARDS, PETAL_CARD_DISCLAIMER, petalCard } from "./petal-cards.js";

export const PETAL_CARD_BACKS = Object.freeze(["lilac", "violet"]);

const locale = value => { try { return weeklyReportLocale(value); } catch { return "en"; } };
const dayNumber = localDate => Date.UTC(+localDate.slice(0, 4), +localDate.slice(5, 7) - 1, +localDate.slice(8, 10)) / 86_400_000;

// Today's back: the two designs in turn, by calendar day.
export const cardBackFor = localDate => PETAL_CARD_BACKS[dayNumber(localDate) % 2];

// Today's deck for this owner: every drawable card id, shuffled with a seed of owner + day.
export function dailyDeck(userId, localDate) {
  const ids = DRAWABLE_PETAL_CARDS.map(card => card.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(stableFraction(`${userId}:${localDate}:deck:${i}`) * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export function presentPetalCard(cardId, lang) {
  const card = petalCard(cardId);
  if (!card) return null;
  return {
    id: card.id, name: card.names[lang], line: card.copy[lang].line, text: card.copy[lang].text,
    disclaimer: PETAL_CARD_DISCLAIMER[lang]
  };
}

async function ownerDay(db, userId, now) {
  const owner = await db.user.findUnique({ where: { id: userId }, select: { timezone: true, preferredLocale: true } });
  if (!owner) return null;
  const timezone = normalizeIanaTimezone(owner.timezone) || "UTC";
  return { today: localDateForInstant(now, timezone), lang: locale(owner.preferredLocale) };
}

const drawResult = (row, lang) => ({ position: row.position, drawnAt: row.createdAt, card: presentPetalCard(row.cardId, lang) });

// What the ring needs before a draw: the deck size, today's back, and today's card if drawn.
export async function todaysPetalDraw(db, { userId, now = new Date() }) {
  const day = await ownerDay(db, userId, now);
  if (!day) return null;
  const row = await db.petalCardDraw.findUnique({ where: { userId_localDate: { userId, localDate: day.today } } });
  return {
    locale: day.lang, localDate: day.today, deckSize: DRAWABLE_PETAL_CARDS.length, back: cardBackFor(day.today),
    drawn: row ? drawResult(row, day.lang) : null
  };
}

// Picks the card at `position` (0-based, wraps around the deck). Once a day: a second draw
// returns the first one unchanged.
export async function drawPetalCard(prisma, { userId, position, now = new Date() }) {
  if (!Number.isInteger(position) || position < 0) throw new TypeError("position must be a whole number ≥ 0");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`petal-card-draw:${userId}`}))::text AS "locked"`;
    const day = await ownerDay(tx, userId, now);
    if (!day) return null;
    const existing = await tx.petalCardDraw.findUnique({ where: { userId_localDate: { userId, localDate: day.today } } });
    if (existing) return { created: false, locale: day.lang, localDate: day.today, ...drawResult(existing, day.lang) };
    const deck = dailyDeck(userId, day.today);
    const place = position % deck.length;
    const row = await tx.petalCardDraw.create({ data: { userId, localDate: day.today, position: place, cardId: deck[place] } });
    return { created: true, locale: day.lang, localDate: day.today, ...drawResult(row, day.lang) };
  });
}

// Calendar marks: the card drawn on each day of a local month (YYYY-MM).
export async function petalDrawsForMonth(db, { userId, month, lang }) {
  const rows = await db.petalCardDraw.findMany({
    where: { userId, localDate: { startsWith: month } }, orderBy: { localDate: "asc" }, select: { localDate: true, cardId: true }
  });
  return rows.map(row => ({ localDate: row.localDate, id: row.cardId, name: petalCard(row.cardId)?.names[lang] ?? row.cardId }));
}

// At most DAILY_FLOWER_LIMIT new flowers per account-local day (time.md). The count lives in
// DailyFlowerQuota, not in Flower rows, so deleting a flower never gives the day's planting back.
// DAILY_GROW_LIMIT_ENABLED=false (synthetic TEST runs) lifts the limit, as for Daily Grow.
export const DAILY_FLOWER_LIMIT = 2;
export const flowerLimitEnabled = () => process.env.DAILY_GROW_LIMIT_ENABLED !== "false";

// Takes one of the day's plantings inside the caller's transaction. A single conditional
// upsert, so two requests at once can never both take the last one.
export async function reserveFlowerPlanting(tx, { userId, localDate }) {
  if (!flowerLimitEnabled()) return { granted: true, limit: null, planted: null };
  const rows = await tx.$queryRawUnsafe(
    `/* flower-quota:reserve */ INSERT INTO "DailyFlowerQuota" ("userId", "localDate", "planted", "updatedAt")
     VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
     ON CONFLICT ("userId", "localDate") DO UPDATE
       SET "planted" = "DailyFlowerQuota"."planted" + 1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "DailyFlowerQuota"."planted" < $3
     RETURNING "planted"`,
    userId, localDate, DAILY_FLOWER_LIMIT);
  if (rows.length) return { granted: true, limit: DAILY_FLOWER_LIMIT, planted: Number(rows[0].planted) };
  return { granted: false, limit: DAILY_FLOWER_LIMIT, planted: DAILY_FLOWER_LIMIT };
}

export async function flowerQuotaToday(prisma, { userId, localDate }) {
  if (!flowerLimitEnabled()) return { localDate, limit: null, planted: null, remaining: null };
  const row = await prisma.dailyFlowerQuota.findUnique({ where: { userId_localDate: { userId, localDate } } });
  const planted = Math.min(row?.planted ?? 0, DAILY_FLOWER_LIMIT);
  return { localDate, limit: DAILY_FLOWER_LIMIT, planted, remaining: DAILY_FLOWER_LIMIT - planted };
}

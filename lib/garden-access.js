// A confirmed friendship is represented by Friendship rows, never a pending request.
export async function canVisitGarden(db, owner, viewerId) {
  if (!owner || !viewerId) return false;
  if (owner.id === viewerId) return true;
  if (!await socialPairAllowed(db, owner.id, viewerId)) return false;
  if (owner.allowGardenVisits !== true) return false;
  return Boolean(await db.friendship.findUnique({
    where: { userId_friendId: { userId: owner.id, friendId: viewerId } },
    select: { id: true }
  }));
}

export class SocialAccessError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Covered HTTP social operations and friendship mutations lock the same User rows in
// database order. NO KEY UPDATE also conflicts with a privacy UPDATE, without
// unnecessarily blocking foreign-key KEY SHARE locks. Locks live until commit.
export async function withSocialLocks(db, userIds, operation) {
  const ids = [...new Set(userIds)];
  if (!ids.length || ids.length > 2 || ids.some(id => typeof id !== 'string' || !id)) {
    throw new SocialAccessError('Invalid social identity', 400);
  }
  try {
    return await db.$transaction(async tx => {
      await tx.$queryRawUnsafe("SELECT set_config('lock_timeout', '1500ms', true), set_config('statement_timeout', '4000ms', true)");
      await tx.$queryRawUnsafe(
        `SELECT id FROM "User" WHERE id IN (${ids.map((_, i) => '$' + (i + 1)).join(',')}) ORDER BY id COLLATE "C" FOR NO KEY UPDATE`,
        ...ids
      );
      return operation(tx);
    }, { isolationLevel: 'ReadCommitted', maxWait: 2000, timeout: 5000 });
  } catch (error) {
    const codes = [error?.code, error?.meta?.code, error?.cause?.code,
      error?.cause?.originalCode, error?.meta?.driverAdapterError?.cause?.originalCode];
    if (codes.some(code => ['55P03', '40P01', '57014', 'P2028', 'P2034'].includes(code))) {
      throw new SocialAccessError('Social access is busy; retry shortly', 503);
    }
    throw error;
  }
}

export function withSocialAuthorization(db, ownerId, viewerId, operation) {
  return withSocialLocks(db, [ownerId, viewerId], async tx => {
    const owner = await tx.user.findUnique({ where: { id: ownerId }, select: { id: true, allowGardenVisits: true } });
    if (!owner) throw new SocialAccessError('User not found', 404);
    if (!await canVisitGarden(tx, owner, viewerId)) {
      throw new SocialAccessError("Garden visits require a confirmed friendship and the owner's permission", 403);
    }
    return operation(tx);
  });
}

export function sendSocialError(res, error) {
  if (!(error instanceof SocialAccessError)) return false;
  if (error.status === 503) res.set('Retry-After', '1');
  res.status(error.status).json({ error: error.message });
  return true;
}

// A directional stored block denies contact and visibility in BOTH directions.
// Only the blocker may remove their row; unblocking never restores friendship.
export async function socialPairAllowed(db, a, b) {
  if (a === b) return true;
  const [blocked, restricted] = await Promise.all([
    db.userBlock.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { blockerId: true } }),
    db.user.findFirst({ where: { id: { in: [a, b] }, socialRestricted: true }, select: { id: true } })
  ]);
  return !blocked && !restricted;
}
export async function requireSocialPair(db, a, b) {
  if (!await socialPairAllowed(db, a, b)) throw new SocialAccessError('This interaction is unavailable', 403);
}
export async function hiddenSocialIds(db, viewerId) {
  const [blocks, restricted] = await Promise.all([
    db.userBlock.findMany({ where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] }, select: { blockerId: true, blockedId: true } }),
    db.user.findMany({ where: { socialRestricted: true }, select: { id: true } })
  ]);
  return new Set([...blocks.map(b => b.blockerId === viewerId ? b.blockedId : b.blockerId), ...restricted.map(u => u.id)]);
}
export function filterSocialPayload(value, hidden) {
  if (Array.isArray(value)) return value.map(v => filterSocialPayload(v, hidden)).filter(v => v !== null);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if ([value.authorUserId, (typeof value.text === "string" && value.author ? value.userId : undefined), value.visitorId, value.senderId, value.receiverId, value.friendId].some(id => hidden.has(id))) return null;
  return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, filterSocialPayload(v, hidden)]));
}

// A confirmed friendship is represented by Friendship rows, never a pending request.
export async function canVisitGarden(db, owner, viewerId) {
  if (!owner || !viewerId) return false;
  if (owner.id === viewerId) return true;
  if (owner.allowGardenVisits !== true) return false;
  return Boolean(await db.friendship.findUnique({
    where: { userId_friendId: { userId: owner.id, friendId: viewerId } },
    select: { id: true }
  }));
}

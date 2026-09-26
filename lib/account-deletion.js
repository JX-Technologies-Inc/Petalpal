export async function deleteAccountDataInTransaction(tx, { id, expectedEmail, expectedFirebaseUid } = {}) {
  const user = await tx.user.findUnique({ where: { id } });
  if (!user) return null;
  if (expectedEmail && user.email?.trim().toLowerCase() !== expectedEmail) {
    throw new Error("Test account database email does not match the configured test email");
  }
  if (expectedFirebaseUid && user.firebaseUid !== expectedFirebaseUid) {
    throw new Error("Test account database Firebase UID does not match the expected UID");
  }

  await tx.friendship.deleteMany({ where: { OR: [{ userId: id }, { friendId: id }] } });
  await tx.friendRequest.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } });

  const garden = await tx.garden.findUnique({ where: { ownerId: id } });
  if (garden) {
    const flowers = await tx.flower.findMany({ where: { gardenId: garden.id }, select: { id: true } });
    const flowerIds = flowers.map((flower) => flower.id);
    if (flowerIds.length > 0) {
      await tx.message.deleteMany({ where: { flowerId: { in: flowerIds } } });
      await tx.flower.deleteMany({ where: { id: { in: flowerIds } } });
    }
    await tx.visitRecord.deleteMany({ where: { gardenId: garden.id } });
    await tx.garden.delete({ where: { id: garden.id } });
  }

  await tx.visitRecord.deleteMany({ where: { visitorId: id } });
  await tx.message.deleteMany({ where: { userId: id } });
  await tx.user.delete({ where: { id } });
  return user;
}

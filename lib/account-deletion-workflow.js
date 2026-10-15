import { deleteAccountDataInTransaction } from './account-deletion.js';
// Durable DB erasure and Firebase identity deletion cannot be one distributed
// transaction. Commit erasure + retry record first; never recreate erased data.
export async function requestAccountDeletion(db, { userId, firebaseUid }, deleteIdentity) {
  const request = await db.$transaction(async tx => {
    // Same advisory lock is enforced by the database identity-insert triggers.
    await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(73001605)::text');
    const previous = await tx.accountDeletion.findUnique({where:{userId}});
    if(previous) {
      if(previous.firebaseUid!==firebaseUid) throw new Error('Deletion identity mismatch');
      return previous;
    }
    const user=await tx.user.findUnique({where:{id:userId},select:{firebaseUid:true}});
    if(!user || user.firebaseUid!==firebaseUid) throw new Error('Deletion identity mismatch');
    const record=await tx.accountDeletion.create({data:{userId,firebaseUid}});
    await deleteAccountDataInTransaction(tx,{id:userId,expectedFirebaseUid:firebaseUid});
    return record;
  });
  if(request.completedAt)return {success:true};
  return finishAccountDeletion(db,request,deleteIdentity);
}
export async function finishAccountDeletion(db, request, deleteIdentity) {
  try {
    await deleteIdentity(request.firebaseUid); // deletion of a missing UID is idempotent
    await db.accountDeletion.update({where:{userId:request.userId},data:{completedAt:new Date()}});
    return {success:true};
  } catch {
    // No provider error or identity is returned or logged. Retry is operator-owned.
    return {success:false,pending:true,dataDeleted:true,message:'Your PetalPal data was deleted. Identity deletion is pending; support can complete it. You may retry here.'};
  }
}

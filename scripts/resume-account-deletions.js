// Operator-only server job. Never accept arbitrary UIDs or user data from CLI.
// Run only after explicit production authorization with server-managed secrets.
import prisma from '../lib/prisma.js';
import { deleteFirebaseUser } from '../lib/firebase-admin.js';
import { finishAccountDeletion } from '../lib/account-deletion-workflow.js';
if(process.argv[2]!=='--execute-authorized') throw new Error('Explicit operator execution required');
let completed=0,pending=0;
try {
 for(const request of await prisma.accountDeletion.findMany({where:{completedAt:null},take:100,orderBy:{createdAt:'asc'}})) {
  const result=await finishAccountDeletion(prisma,request,deleteFirebaseUser);
  result.success?completed++:pending++;
 }
 console.info({completed,pending}); // Counts only; no identity or provider error.
} finally {await prisma.$disconnect();}

import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import pg from 'pg';
import net from 'node:net';
assert.equal(process.env.PETALPAL_RELEASE_ISOLATED,'1','Use the disposable release runner');
assert.equal(process.env.DOTENV_CONFIG_PATH,'/dev/null');
const target=new URL(process.env.REAL_POSTGRES_DATABASE_URL);
assert.equal(target.hostname,'127.0.0.1');assert.equal(target.pathname,'/petalpal_test');
let externalCalls=0;const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){let options=args[0];if(Array.isArray(options))options=options[0];const host=typeof options==='object'?options.host:args[1];if(host&&!['127.0.0.1','localhost','::1'].includes(host)){externalCalls++;throw Error('External network forbidden in upgrade tests');}return connect.apply(this,args);};
const db=new pg.Client({connectionString:target.toString()});await db.connect();
const migrations=new URL('../../prisma/migrations/',import.meta.url);
const all=(await readdir(migrations)).filter(x=>/^\d/.test(x)).sort();
const apply=async name=>db.query(await readFile(new URL(name+'/migration.sql',migrations),'utf8'));
const rows=async(sql,args)=>(await db.query(sql,args)).rows;
test.after(async()=>{await db.end();net.Socket.prototype.connect=connect;assert.equal(externalCalls,0);});
let server,prisma,protectedDeletions;
test('upgrade four release migrations with existing sources, grants, jobs and cost tombstones',async()=>{
 for(const name of all.filter(x=>x<'202610150001'))await apply(name);
 await db.query(`INSERT INTO "User" (id,name,"firebaseUid") VALUES ('legacy','Legacy Person','legacy'),('modern','Modern Person','modern'),('accepted','Accepted Person','accepted');
 INSERT INTO "Journal" (id,"userId",content,"updatedAt") VALUES ('kept-journal','legacy','Synthetic original Journal',CURRENT_TIMESTAMP);
 INSERT INTO "AiConsent" (id,"userId","termsVersion","aiProcessing",personalization,"memoryEnabled","updatedAt") VALUES
 ('legacy-consent','legacy','2026-08-25',true,true,true,'2026-10-14'),('modern-consent','modern','ai-2026-10-15',true,true,true,'2026-10-14');
 INSERT INTO "AIJob" (id,"ownerId","jobType","resourceId",status,"idempotencyKey","updatedAt","lockedBy","lockedAt","leaseExpiresAt") VALUES
 ('pending','legacy','WEEKLY_REPORT','fixture','PENDING','pending',CURRENT_TIMESTAMP,NULL,NULL,NULL),
 ('running','modern','WEEKLY_REPORT','fixture','RUNNING','running',CURRENT_TIMESTAMP,'old-worker',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+INTERVAL '1 hour');
 INSERT INTO "AuditEvent" (id,"eventType",outcome,"targetClass") VALUES ('cost-tombstone','AI_COST_RESERVED','COMPLETED','fixture');`);
 await db.query(`INSERT INTO "Event" (id,"ownerId",content,"occurredAt",timezone,"localDate","idempotencyKey","updatedAt") VALUES
 ('kept-event','legacy','Synthetic Event',CURRENT_TIMESTAMP,'UTC','2026-10-15','kept-event',CURRENT_TIMESTAMP);
 INSERT INTO "EventMemory" (id,"ownerId","sourceEventId","memoryType",summary,"eventDate","updatedAt") VALUES
 ('kept-memory','legacy','kept-event','EVENT','Synthetic memory',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
 await db.query(`UPDATE "EventMemory" SET embedding=$1::vector WHERE id='kept-memory'`,['['+Array(384).fill(0).join(',')+']']);
 await apply('202610150001_social_safety');await apply('202610150002_community_acceptance');
 assert.ok((await rows('SELECT "communityTermsVersion" FROM "User"')).every(u=>u.communityTermsVersion===null));
 await db.query(`UPDATE "User" SET "communityTermsVersion"='previous-community',"communityAcceptedAt"=CURRENT_TIMESTAMP WHERE id='modern'`);
 await db.query(`UPDATE "User" SET "communityTermsVersion"='petalpal-community-2026-10-15',"communityAcceptedAt"=CURRENT_TIMESTAMP WHERE id='accepted'`);
 await apply('202610150003_ai_disclosure');
 assert.ok((await rows('SELECT * FROM "AiConsent"')).every(c=>!c.aiProcessing&&!c.personalization&&!c.memoryEnabled&&new Date(c.updatedAt)>new Date('2026-10-14')));
 assert.ok((await rows('SELECT * FROM "AIJob"')).every(j=>j.status==='CANCELLED'&&j.lockedBy===null&&j.leaseExpiresAt===null));
 await apply('202610150004_account_deletion_workflow');
 assert.equal((await rows(`SELECT vector_dims(embedding) AS n FROM "EventMemory" WHERE id='kept-memory'`))[0].n,384);
 assert.equal((await rows('SELECT content FROM "Journal"'))[0].content,'Synthetic original Journal');
 assert.equal((await rows('SELECT count(*)::int AS n FROM "AuditEvent"'))[0].n,1);
 assert.equal((await rows(`SELECT "communityTermsVersion" FROM "User" WHERE id='modern'`))[0].communityTermsVersion,'previous-community');
 // A previously migrated RC can already contain pending/completed deletions.
 await db.query(`INSERT INTO "AccountDeletion" ("userId","firebaseUid","completedAt") VALUES
 ('deleted-pending','pending-uid',NULL),('deleted-done','done-uid',CURRENT_TIMESTAMP)`);
 protectedDeletions=await rows('SELECT * FROM "AccountDeletion" ORDER BY "userId"');
});
test('guard upgrade retires legacy regrants, preserves current grants and deletion protections',async()=>{
 // Model the unsafe old-server write possible after 003, before guard rollout.
 await db.query(`UPDATE "AiConsent" SET "aiProcessing"=true,personalization=true,"memoryEnabled"=true WHERE "userId"='legacy';
 UPDATE "AiConsent" SET "aiProcessing"=true WHERE "userId"='modern';
 INSERT INTO "AIJob" (id,"ownerId","jobType","resourceId",status,"idempotencyKey","updatedAt") VALUES ('legacy-regrant-job','legacy','WEEKLY_REPORT','fixture','PENDING','legacy-regrant-job',CURRENT_TIMESTAMP)`);
 await apply('202610150005_ai_disclosure_grant_guard');
 assert.equal((await rows(`SELECT "aiProcessing" FROM "AiConsent" WHERE "userId"='legacy'`))[0].aiProcessing,false);
 assert.equal((await rows(`SELECT status FROM "AIJob" WHERE id='legacy-regrant-job'`))[0].status,'CANCELLED');
 assert.equal((await rows(`SELECT "aiProcessing" FROM "AiConsent" WHERE "userId"='modern'`))[0].aiProcessing,true);
 assert.deepEqual(await rows('SELECT * FROM "AccountDeletion" ORDER BY "userId"'),protectedDeletions);
 assert.equal((await rows(`SELECT "communityTermsVersion" FROM "User" WHERE id='accepted'`))[0].communityTermsVersion,'petalpal-community-2026-10-15');
 for(const uid of ['pending-uid','done-uid'])await assert.rejects(db.query(`INSERT INTO "User" (id,name,"firebaseUid") VALUES ($1,'Replay',$2)`,['replay-'+uid,uid]),e=>e.code==='23514');
 await assert.rejects(db.query(`UPDATE "User" SET "firebaseUid"='done-uid' WHERE id='legacy'`),e=>e.code==='23514');
 for(const field of ['aiProcessing','personalization','memoryEnabled'])await assert.rejects(db.query(`UPDATE "AiConsent" SET "${field}"=true WHERE "userId"='legacy'`),e=>e.code==='23514');
 await assert.rejects(db.query(`INSERT INTO "AiConsent" (id,"userId","termsVersion","aiProcessing","updatedAt") VALUES ('replay-grant','legacy','old',true,CURRENT_TIMESTAMP)`),e=>['23514','23505'].includes(e.code));
});
test('new API rejects legacy clients, accepts explicit versions, and old-server grants fail atomically',async()=>{
 // Start only the new binary. Production rollout must drain old processes first.
 ({default:prisma}=await import('../../lib/prisma.js'));
 const auth=await import('../../lib/auth.js');auth.setFirebaseTokenVerifierForTests(async token=>({uid:token,email_verified:true,auth_time:Math.floor(Date.now()/1000)}));
 ({server}=await import('../../server.js'));server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const api=async(path,body)=>{const r=await fetch(base+path,{method:'PUT',headers:{Authorization:'Bearer legacy','Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 try{
  assert.equal((await api('/users/legacy/ai-consent',{aiProcessing:true})).status,428);
  assert.equal((await api('/users/legacy/ai-consent',{aiProcessing:true,disclosureVersion:'stale'})).status,428);
  assert.equal((await api('/users/legacy/ai-consent',{aiProcessing:true,disclosureVersion:'ai-2026-10-15'})).status,200);
  const {updateAiConsent}=await import('../../lib/ai-consent.js');
  // The old server hardcodes its old termsVersion. Use its unchanged persistence
  // helper to prove the database guard rolls back that entire transaction.
  await assert.rejects(updateAiConsent(prisma,{identity:{userId:'legacy'},termsVersion:'2026-08-25',aiProcessing:true,personalization:true,memoryEnabled:true}));
  assert.equal((await rows(`SELECT "termsVersion" FROM "AiConsent" WHERE "userId"='legacy'`))[0].termsVersion,'ai-2026-10-15');
  assert.equal((await api('/users/me/community-acceptance',{version:'stale',accepted:true})).status,400);
  assert.equal((await api('/users/me/community-acceptance',{version:'petalpal-community-2026-10-15',accepted:true})).status,200);
  assert.equal((await api('/users/legacy/ai-consent',{aiProcessing:false})).status,200);
  assert.equal((await rows(`SELECT "aiProcessing" FROM "AiConsent" WHERE "userId"='legacy'`))[0].aiProcessing,false);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await prisma.$disconnect();auth.setFirebaseTokenVerifierForTests();}
});

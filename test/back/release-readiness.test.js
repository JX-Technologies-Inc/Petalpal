import assert from 'node:assert/strict';
import test from 'node:test';
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';
assert.equal(process.env.PETALPAL_RELEASE_ISOLATED,'1','Use scripts/release-readiness-test.mjs');
assert.equal(process.env.DOTENV_CONFIG_PATH,'/dev/null');
// Deny all external network calls, including paid inference and Firebase.
let externalCalls=0;
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){const a=args[0]; const host=typeof a==='object'?a.host:args[1]; if(host && !['localhost','127.0.0.1','::1'].includes(host)){externalCalls++;throw new Error('External network forbidden in release tests');} return connect.apply(this,args);};
syncBuiltinESMExports();
const {default:db}=await import('../../lib/prisma.js');
const {setFirebaseTokenVerifierForTests}=await import('../../lib/auth.js');
const {server,setFirebaseUserDeleterForTests}=await import('../../server.js');
const {io:connectSocket}=await import('socket.io-client');
const {canVisitGarden}=await import('../../lib/garden-access.js');
setFirebaseTokenVerifierForTests(async token=>({uid:token==='stale-deleting'?'deleting':token,email_verified:true,auth_time:Math.floor(Date.now()/1000)-(token==='stale-deleting'?600:0)}));
server.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`;
async function api(who,path,method='GET',body){const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${who}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};}
test.after(async()=>{assert.equal(externalCalls,0);server.closeAllConnections();await new Promise(r=>server.close(r));await db.$disconnect();net.Socket.prototype.connect=connect;});
async function seed(){for(const id of ['a','b','c','moderator']) await db.user.upsert({where:{id},create:{id,name:`Person ${id}`,firebaseUid:id,garden:{create:{id:`garden-${id}`}}},update:{}});}
test('A: actual API report privacy, dedup, moderator authorization and block races',async()=>{
 await seed();
 assert.equal((await api('a','/friends/request','POST',{receiverId:'b'})).status,201);
 const request=await db.friendRequest.findFirst({where:{senderId:'a'}});
 assert.equal((await api('b',`/friends/requests/${request.id}/accept`,'POST',{})).status,200);
 assert.equal((await api('a','/users/b/garden')).status,200);
 const reports=await Promise.all(Array.from({length:4},()=>api('a','/reports','POST',{reportedUserId:'b',category:'HARASSMENT'})));
 assert.ok(reports.every(r=>r.status===202));assert.equal(await db.report.count(),1);
 assert.deepEqual(reports[0].body,{accepted:true});
 assert.equal((await api('a','/reports','POST',{reportedUserId:'b',category:'OTHER',details:'private text'})).status,400);
 assert.equal((await api('b','/moderation/reports')).status,403);
 const queue=await api('moderator','/moderation/reports'); assert.equal(queue.status,200);assert.ok(!JSON.stringify(queue.body).includes('reporter'));
 await api('a','/users/me/blocks/b','PUT',{});
 assert.equal(await db.friendship.count(),0);assert.equal(await db.friendRequest.count(),0);
 assert.equal((await api('b','/friends/request','POST',{receiverId:'a'})).status,403);
 assert.equal((await api('a','/users/b/garden')).status,403);
 assert.equal((await api('a','/users/b')).status,403);
 assert.deepEqual((await api('a','/users/me/blocks')).body.users.map(u=>u.id),['b']);
 // Deliberately stale friendship cannot bypass the persistent block.
 await db.friendship.create({data:{userId:'b',friendId:'a'}});
 assert.equal(await canVisitGarden(db,{id:'b',allowGardenVisits:true},'a'),false);
 assert.equal((await api('c','/users/me/blocks/b','DELETE')).status,200);
 assert.equal(await db.userBlock.count(),1);
 await db.friendship.deleteMany();
 assert.equal((await api('a','/users/me/blocks/b','DELETE')).status,200);
 assert.equal(await db.friendship.count(),0);
 // Same pair locks serialize contact against block commit.
 await Promise.all([api('a','/friends/request','POST',{receiverId:'b'}),api('b','/users/me/blocks/a','PUT',{})]);
 assert.equal(await db.friendRequest.count(),0);
 assert.equal((await api('a','/friends/request','POST',{receiverId:'b'})).status,403);
 const report=queue.body[0];assert.equal((await api('moderator',`/moderation/reports/${report.id}`,'POST',{action:'restrict-user'})).status,200);
 assert.equal((await api('b','/friends/request','POST',{receiverId:'c'})).status,403);
 assert.equal((await api('b','/users/me/blocks')).status,200);
 await db.user.update({where:{id:'b'},data:{socialRestricted:false}}); await db.userBlock.deleteMany();
});

test('A: Socket.IO evicts a blocked visitor and denies rejoin; message reports require visibility',async()=>{
 await db.friendship.createMany({data:[{userId:'a',friendId:'b'},{userId:'b',friendId:'a'}]});
 const flower=await db.flower.create({data:{id:'social-flower',userId:'a',gardenId:'garden-a',mood:'joy',name:'Flower',meaning:'Test',img:'flower.png',left:0,top:0}});
 const message=await db.message.create({data:{flowerId:flower.id,userId:'b',author:'Person b',text:'Hello'}});
 assert.equal((await api('c','/reports','POST',{messageId:message.id,category:'OTHER'})).status,404);
 assert.equal((await api('a','/reports','POST',{messageId:message.id,category:'HARASSMENT'})).status,202);
 const socket=connectSocket(base,{auth:{token:'b'},transports:['websocket'],reconnection:false});
 try {
 await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
 const ack=event=>new Promise((resolve,reject)=>socket.timeout(2000).emit(event,'a',(err,result)=>err?reject(err):resolve(result)));
 assert.deepEqual(await ack('join-garden'),{ok:true});
 assert.equal((await api('a','/users/me/blocks/b','PUT',{})).status,200);
 assert.equal((await ack('join-garden')).ok,false);
 assert.equal((await api('b',`/users/a/flowers/${flower.id}/message`,'POST',{text:'Bypass'})).status,403);
 assert.equal((await api('b',`/users/a/flowers/${flower.id}/support`,'POST',{})).status,403);
 assert.equal(await db.message.count(),1);
 const garden=await api('a','/users/a/garden'); assert.equal(garden.status,200);
 assert.equal(garden.body.flowers[0].messages.length,0,'Blocked author is removed from own Garden');
 const session=await api('a','/session'); assert.equal(session.status,200);
 assert.equal(session.body.garden.flowers[0].messages.length,0,'Session snapshot also filters blocked messages');

 } finally {socket.disconnect();}
 await db.userBlock.deleteMany();
});

test('B: acceptance and screening run before message, visit record or notification side effects',async()=>{
 await db.friendship.createMany({data:[{userId:'a',friendId:'b'},{userId:'b',friendId:'a'}],skipDuplicates:true});
 const path='/users/a/flowers/social-flower/message';
 assert.equal((await api('b',path,'POST',{text:'Hello'})).status,428);
 assert.equal((await api('b','/users/me/community-acceptance','PUT',{version:'stale',accepted:true})).status,400);
 const version='petalpal-community-2026-10-15';
 assert.equal((await api('b','/users/me/community-acceptance','PUT',{version,accepted:true})).status,200);
 const count=await db.message.count(),visits=await db.visitRecord.count();
 for(const text of ['f u c k you','ＦＵＣＫ you','You are an idiot','我今晚要杀了你','send me nudes']) assert.equal((await api('b',path,'POST',{text})).status,422);
 assert.equal(await db.message.count(),count);assert.equal(await db.visitRecord.count(),visits);
 assert.equal((await api('b',path,'POST',{text:'I am sad and need help. 我很难过，想寻求帮助。'})).status,200);
 assert.equal(await db.message.count(),count+1);
 assert.equal((await api('b','/users/avatar','PUT',{avatar:'f u c k you'})).status,422);
 const messageReport=await db.report.findFirst({where:{messageId:{not:null}}});
 assert.equal((await api('moderator',`/moderation/reports/${messageReport.id}`,'POST',{action:'remove-message'})).status,200);
 assert.equal(await db.message.findUnique({where:{id:messageReport.messageId}}),null);

});

test('C: explicit versioned consent, withdrawal epoch, output ownership and no private report text',async()=>{
 const disclosure=await api('a','/ai/disclosure');assert.equal(disclosure.status,200);assert.ok(disclosure.body.features.every(f=>!f.configured));
 assert.equal((await api('a','/users/a/ai-consent','PUT',{aiProcessing:true})).status,428);
 const consent=await api('a','/users/a/ai-consent','PUT',{aiProcessing:true,personalization:true,memoryEnabled:true,disclosureVersion:disclosure.body.version});assert.equal(consent.status,200);
 const {PrismaAiCostGate}=await import('../../lib/ai-cost-gate.js');const gate=new PrismaAiCostGate(db);
 await gate.checkProcessingConsent({identity:{userId:'a'},consentUpdatedAt:consent.body.updatedAt});
 const event=await db.event.create({data:{id:'private-event',ownerId:'a',content:'Synthetic private reflection',occurredAt:new Date(),localDate:'2026-10-15',timezone:'UTC',idempotencyKey:'privacy-fixture'}});
 assert.equal((await api('b','/ai-output-reports','POST',{kind:'event',outputId:event.id,category:'OTHER'})).status,404);
 assert.equal((await api('a','/ai-output-reports','POST',{kind:'event',outputId:event.id,category:'OTHER'})).status,202);
 const queue=await api('moderator','/moderation/reports');assert.ok(!JSON.stringify(queue.body).includes(event.content));
 assert.equal((await api('a','/users/a/ai-consent','PUT',{aiProcessing:false})).status,200);
 await assert.rejects(gate.checkProcessingConsent({identity:{userId:'a'},consentUpdatedAt:consent.body.updatedAt}),{code:'AI_FORBIDDEN'});
 assert.equal((await api('a','/users/a/ai-consent','PUT',{aiProcessing:true,disclosureVersion:disclosure.body.version})).status,200);
 await assert.rejects(gate.checkProcessingConsent({identity:{userId:'a'},consentUpdatedAt:consent.body.updatedAt}),{code:'AI_FORBIDDEN'});
 assert.ok(await db.event.findUnique({where:{id:event.id}}));
});

test('D: real PostgreSQL erasure, vector cascade, Firebase failure recovery and anti-resurrection',async()=>{
 const id='deleting';await db.user.create({data:{id,name:'Disposable',firebaseUid:id,garden:{create:{id:'deleting-garden'}}}});
 await db.journal.create({data:{id:'deleting-journal',userId:id,content:'Synthetic private diary'}});
 const event=await db.event.create({data:{id:'deleting-event',ownerId:id,content:'Synthetic private event',occurredAt:new Date(),localDate:'2026-10-15',timezone:'UTC',idempotencyKey:'deletion-fixture'}});
 await db.eventMemory.create({data:{id:'deleting-memory',ownerId:id,sourceEventId:event.id,memoryType:'EVENT',summary:'Synthetic memory',eventDate:new Date()}});
 await db.eventMemoryEmbedding.create({data:{eventMemoryId:'deleting-memory',ownerId:id,profileKey:'fixture',model:'fixture',modelRevision:'1',inputVersion:'1',inputRevision:1}});
 await db.$executeRawUnsafe(`UPDATE "EventMemoryEmbedding" SET embedding=$1::vector, status='GENERATED', "embeddedAt"=CURRENT_TIMESTAMP WHERE "eventMemoryId"=$2`,'['+Array(384).fill(0).join(',')+']','deleting-memory');
 await db.report.create({data:{reporterId:'a',reportedUserId:id,category:'OTHER'}});
 const journalB=await db.journal.create({data:{userId:'b',content:'Unrelated synthetic diary'}});
 let calls=0;setFirebaseUserDeleterForTests(async()=>{calls++;throw new Error('Injected identity outage');});
 assert.equal((await api('b','/users/deleting','DELETE')).status,403);assert.equal(calls,0);
 assert.equal((await api('stale-deleting','/users/deleting','DELETE')).status,403);assert.equal(calls,0);
 const result=await api(id,'/users/deleting','DELETE');assert.equal(result.status,202);assert.equal(result.body.dataDeleted,true);assert.equal(calls,1);
 assert.equal(await db.user.findUnique({where:{id}}),null);assert.equal(await db.journal.findUnique({where:{id:'deleting-journal'}}),null);
 assert.equal(await db.eventMemory.count({where:{ownerId:id}}),0);assert.equal(await db.eventMemoryEmbedding.count({where:{ownerId:id}}),0);
 assert.equal(await db.report.count({where:{reportedUserId:id}}),0);assert.ok(await db.journal.findUnique({where:{id:journalB.id}}));
 await assert.rejects(db.user.create({data:{id:'resurrection',name:'No',firebaseUid:id}}));
 assert.equal((await api(id,'/events')).status,403);
 setFirebaseUserDeleterForTests(async()=>{calls++;});
 assert.equal((await api(id,'/users/deleting','DELETE')).status,200);assert.ok((await db.accountDeletion.findUnique({where:{userId:id}})).completedAt);
 assert.equal((await api(id,'/users/deleting','DELETE')).status,200);assert.equal(calls,2);
 // A failed relational transaction leaves both account and retry queue unchanged.
 const {requestAccountDeletion}=await import('../../lib/account-deletion-workflow.js');
 await db.user.create({data:{id:'rollback',name:'Rollback',firebaseUid:'rollback'}});
 const proxy=new Proxy(db,{get(target,key){if(key==='$transaction')return fn=>target.$transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='report')return {deleteMany:async()=>{throw new Error('Injected DB failure');}};return t[k];}})));return target[key];}});
 await assert.rejects(requestAccountDeletion(proxy,{userId:'rollback',firebaseUid:'rollback'},async()=>{throw new Error('Must not call Firebase');}));
 assert.ok(await db.user.findUnique({where:{id:'rollback'}}));assert.equal(await db.accountDeletion.findUnique({where:{userId:'rollback'}}),null);
});

test('integration: server avatars, Community gates, A/B/C HTTP/socket filtering and leave authorization',async()=>{
 assert.equal((await api('a','/analyze-mood','POST',{})).status,400,'Legacy route remains available and rejects before inference');
 const ids=['va','vb','vc','vx'];
 for(const id of ids)await db.user.create({data:{id,name:'Person '+id,avatar:'🐝',firebaseUid:id,communityTermsVersion:id==='vx'?null:'petalpal-community-2026-10-15',garden:{create:{id:'garden-'+id}}}});
 for(const actor of ['va','vb','vx'])await db.friendship.createMany({data:[{userId:'vc',friendId:actor},{userId:actor,friendId:'vc'}]});
 const flower=await db.flower.create({data:{id:'visit-flower',userId:'vc',gardenId:'garden-vc',mood:'joy',name:'Flower',meaning:'Test',img:'flower.png',left:0,top:0}});
 await db.message.create({data:{flowerId:flower.id,userId:'vb',author:'Person vb',text:'A kind message'}});
 assert.equal((await api('va','/users/me/blocks/vb','PUT',{})).status,200);
 const socket=connectSocket(base,{auth:{token:'vc'},transports:['websocket'],reconnection:false});
 const observer=connectSocket(base,{auth:{token:'va'},transports:['websocket'],reconnection:false});
 const events=[],filtered=[];
 try{
  for(const client of [socket,observer]){
   await new Promise((resolve,reject)=>{if(client.connected)return resolve();client.once('connect',resolve);client.once('connect_error',reject);});
   await new Promise((resolve,reject)=>client.timeout(2000).emit('join-garden','vc',(err,reply)=>{if(err)return reject(err);assert.equal(reply.ok,true);resolve();}));
  }
  socket.onAny((name,data)=>events.push({name,data}));observer.onAny((name,data)=>filtered.push({name,data}));
  const bad={visitorAvatar:'send me nudes'};
  const visited=await api('vb','/visit','POST',{hostUserId:'vc',...bad});assert.equal(visited.status,200);
  assert.equal(visited.body.activeVisitors.find(v=>v.visitorId==='vb').avatar,'🐝');
  const ownVisit=await api('va','/visit','POST',{hostUserId:'vc',...bad});assert.equal(ownVisit.status,200);
  assert.ok(!JSON.stringify(ownVisit.body).includes('vb'));
  const moved=await api('va','/visit/move','POST',{hostUserId:'vc',x:100,y:100,...bad});assert.equal(moved.status,200);assert.ok(!JSON.stringify(moved.body).includes('vb'));
  assert.equal((await api('vb','/visit/move','POST',{hostUserId:'vc',x:101,y:101,...bad})).status,200);
  const support=await api('va',`/users/vc/flowers/${flower.id}/support`,'POST',bad);assert.equal(support.status,200);assert.equal(support.body.messages.length,0);
  const left=await api('va','/leave','POST',{hostUserId:'vc',...bad});assert.equal(left.status,200);assert.ok(!JSON.stringify(left.body).includes('vb'));
  await new Promise(r=>setTimeout(r,40));
  assert.ok(events.length>0);assert.ok(!JSON.stringify(events).includes(bad.visitorAvatar));
  assert.ok(!JSON.stringify(filtered).includes('vb'),'No blocked identity in any realtime delivery');
  assert.ok(filtered.every(e=>e.data?.record!==null),'Blocked records do not produce empty notifications');
  assert.ok((await db.visitRecord.findMany({where:{gardenId:'garden-vc'}})).every(r=>r.visitorAvatar==='🐝'));
  events.length=0;
  const before=await db.visitRecord.count();
  for(const [path,body] of [['/visit',{hostUserId:'vc'}],['/visit/move',{hostUserId:'vc',x:1,y:1}],['/leave',{hostUserId:'vc'}],[`/users/vc/flowers/${flower.id}/support`,{}]])assert.equal((await api('vx',path,'POST',body)).status,428);
  assert.equal((await api('vb','/leave','POST',{hostUserId:'va',...bad})).status,403);
  await db.user.update({where:{id:'vc'},data:{allowGardenVisits:false}});
  const cleanup=await api('vb','/leave','POST',{hostUserId:'vc',...bad});assert.equal(cleanup.status,200);assert.deepEqual(cleanup.body,{success:true,activeVisitors:[],record:null});
  assert.equal(await db.visitRecord.count(),before);await new Promise(r=>setTimeout(r,40));assert.equal(events.length,0);
  await db.user.update({where:{id:'vc'},data:{allowGardenVisits:true}});
  const afterCleanup=await api('vc','/users/vc/garden');assert.equal(afterCleanup.status,200);assert.ok(!afterCleanup.body.activeVisitors.some(v=>v.visitorId==='vb'));
  // A commit failure must not publish a successful departure or persisted record.
  const transact=db.$transaction;
  db.$transaction=fn=>transact.call(db,async tx=>{await fn(tx);throw Error('Injected rollback');});
  try{const result=await api('va','/leave','POST',{hostUserId:'vc'});assert.equal(result.status,500);}finally{db.$transaction=transact;}
  assert.equal(await db.visitRecord.count(),before);await new Promise(r=>setTimeout(r,40));assert.equal(events.length,0);
 }finally{socket.disconnect();observer.disconnect();}
});

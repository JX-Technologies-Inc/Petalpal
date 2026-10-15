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
const {server}=await import('../../server.js');
const {io:connectSocket}=await import('socket.io-client');
const {canVisitGarden}=await import('../../lib/garden-access.js');
setFirebaseTokenVerifierForTests(async token=>({uid:token,email_verified:true,auth_time:Math.floor(Date.now()/1000)}));
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
});

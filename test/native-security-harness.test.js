import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createNativeSecurityHarnessBridge,nativeSecurityHarnessRouter,assertNativeTestDeletion} from '../lib/native-security-harness.js';
const env={NATIVE_SECURITY_TEST:'1',NODE_ENV:'development',PORT:'3108',FIREBASE_PROJECT_ID:'petalpal-native-security-test',
 DEV_DATABASE_URL:'postgresql://synthetic:synthetic@127.0.0.1:5433/petalpal_native_security_test?schema=public',API_DOCS_ENABLED:'false',
 AI_USER_DAILY_CALL_LIMIT:'0',AI_GLOBAL_DAILY_CALL_LIMIT:'0',AI_ASYNC_EXECUTION_MODE:'manual',
 FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',project_id:'petalpal-native-security-test',client_email:'synthetic@petalpal-native-security-test.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----synthetic'})};
const accounts={NATIVE_TEST_C_DISPOSABLE:'true'};
for(const label of ['A','B','C']){accounts[`NATIVE_TEST_${label}_EMAIL`]=`${label.toLowerCase()}@synthetic.invalid`;accounts[`NATIVE_TEST_${label}_PASSWORD`]='SYNTHETIC-PRIVATE-PASSWORD';}
function setup(){
 let time=0;const exists={A:true,B:true,C:true};
 const label=email=>['A','B','C'].find(l=>accounts[`NATIVE_TEST_${l}_EMAIL`]===email);
 const prisma={$queryRawUnsafe:async()=>[{db:'petalpal_native_security_test'}],user:{findUnique:async({where})=>{const l=label(where.email);return exists[l]?{id:`owner-${l}`,firebaseUid:`uid-${l}`}:null}}};
 const findUser=async email=>{const l=label(email);return exists[l]?{uid:`uid-${l}`,disabled:false,emailVerified:true}:null};
 const service=createNativeSecurityHarnessBridge({prisma,findUser,verifyToken:async token=>({uid:`uid-${token}`,email_verified:true}),env,readAccounts:()=>accounts,now:()=>time});
 return {service,prisma,findUser,exists,advance:()=>{time=7200001}};
}
test('bridge cannot be created in normal development/production or wrong project/database',()=>{
 for(const change of [{NATIVE_SECURITY_TEST:undefined},{NODE_ENV:'production'},{FIREBASE_PROJECT_ID:'production'},{DEV_DATABASE_URL:'postgresql://synthetic@localhost:5433/other'}]){
  assert.throws(()=>createNativeSecurityHarnessBridge({env:{...env,...change}}));
 }
});
test('only authenticated designated A bootstraps short-lived resume access; anonymous/B/C denied',async()=>{
 const h=setup();for(const label of [undefined,'B','C'])await assert.rejects(h.service.bootstrap(label));
 const access=await h.service.bootstrap('A');assert.match(access.capability,/^[a-f0-9]{64}$/);
 assert.equal((await h.service.session(access.capability)).credentials.C.disposable,true);
 h.advance();await assert.rejects(h.service.session(access.capability));
});
test('C-only deletion guard rejects A/B/unrelated/missing or non-disposable targets',()=>{
 for(const email of [accounts.NATIVE_TEST_A_EMAIL,accounts.NATIVE_TEST_B_EMAIL,'other@synthetic.invalid',null]){
  assert.throws(()=>assertNativeTestDeletion({email,firebaseUid:'synthetic'},env,accounts));
 }
 assert.doesNotThrow(()=>assertNativeTestDeletion({email:accounts.NATIVE_TEST_C_EMAIL,firebaseUid:'synthetic-C'},env,accounts));
 assert.throws(()=>assertNativeTestDeletion({email:accounts.NATIVE_TEST_C_EMAIL,firebaseUid:'synthetic'},env,{...accounts,NATIVE_TEST_C_DISPOSABLE:'false'}));
});
test('status is sanitized; deleted C is idempotently recognized while A/B missing or broken linkage blocks',async()=>{
 const h=setup(),access=await h.service.bootstrap('A');h.exists.C=false;
 const status=await h.service.status(access.capability);assert.equal(status.status.C.backendExists,false);
 for(const privateValue of ['SYNTHETIC-PRIVATE-PASSWORD','synthetic.invalid','uid-','owner-',access.capability])assert.ok(!JSON.stringify(status).includes(privateValue));
 h.exists.B=false;await assert.rejects(h.service.status(access.capability));
});
test('HTTPS route rejects anonymous/HTTP/query/body input; credential responses are no-store and revoke works',async()=>{
 const h=setup(),app=express();app.use(express.json());app.use('/native-security/harness',nativeSecurityHarnessRouter(h.service));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/native-security/harness`;
 try{
  const post=(path,headers={},body='{}')=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...headers},body});
  for(const [path,headers,body] of [['/bootstrap',{},'{}'],['/bootstrap',{'x-forwarded-proto':'https'},'{}'],['/bootstrap?x=1',{'x-forwarded-proto':'https',authorization:'Bearer A'},'{}'],['/bootstrap',{'x-forwarded-proto':'https',authorization:'Bearer A'},'{"x":1}']])assert.equal((await post(path,headers,body)).status,403);
  const response=await post('/bootstrap',{'x-forwarded-proto':'https',authorization:'Bearer A'});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const result=await response.json();
  await post('/revoke',{'x-forwarded-proto':'https',authorization:`Bearer ${result.capability}`});await assert.rejects(h.service.session(result.capability));
 }finally{await new Promise(r=>server.close(r))}
});

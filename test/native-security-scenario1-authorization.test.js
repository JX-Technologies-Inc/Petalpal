import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createScenarioOneAuthorization, scenarioOneAuthorizationRouter } from '../lib/native-security-scenario1-authorization.js';
const env={NATIVE_SECURITY_TEST:'1',NODE_ENV:'development',PORT:'3108',FIREBASE_PROJECT_ID:'petalpal-native-security-test',
  DEV_DATABASE_URL:'postgresql://synthetic@127.0.0.1:5433/petalpal_native_security_test',API_DOCS_ENABLED:'false',
  AI_USER_DAILY_CALL_LIMIT:'0',AI_GLOBAL_DAILY_CALL_LIMIT:'0',AI_ASYNC_EXECUTION_MODE:'manual',
  FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',project_id:'petalpal-native-security-test',
    client_email:'synthetic@petalpal-native-security-test.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----synthetic'})};
const boundary={environment:'native-security-test',firebaseProject:'petalpal-native-security-test',database:'petalpal_native_security_test',
  status:Object.fromEntries(['A','B','C'].map(label=>[label,{firebaseExists:true,backendExists:true}]))};
function options(){return {env,backendOrigin:'https://synthetic-backend.trycloudflare.com',savedA:{email:'a@synthetic.invalid',password:'SYNTHETIC-A-PASSWORD'},
  authenticatedA:{uid:'synthetic-A',project:'petalpal-native-security-test'},source:{...boundary,credentials:{
    A:{email:'a@synthetic.invalid',password:'SYNTHETIC-A-PASSWORD',uid:'synthetic-A',owner:'synthetic-owner-A',disposable:false},
    B:{password:'B-MUST-NOT-ESCAPE'},C:{password:'C-MUST-NOT-ESCAPE'}}},verifyBackend:async()=>structuredClone(boundary)}};
test('scoped renewal rejects normal/production modes, wrong DB/project and B/C substitutes',()=>{
  for(const change of [{NATIVE_SECURITY_TEST:undefined},{NODE_ENV:'production'},{FIREBASE_PROJECT_ID:'other'}, {DEV_DATABASE_URL:'postgresql://synthetic@127.0.0.1:5433/other'}])
    assert.throws(()=>createScenarioOneAuthorization({...options(),env:{...env,...change}}));
  for(const label of ['B','C'])assert.throws(()=>createScenarioOneAuthorization({...options(),authenticatedA:{uid:`synthetic-${label}`,project:'petalpal-native-security-test'}}));
  const o=options();o.source.credentials.A.email='other@synthetic.invalid';assert.throws(()=>createScenarioOneAuthorization(o));
});
test('renewed grant exposes only exact A and Scenario 1, with a sanitized status',async()=>{
  const service=createScenarioOneAuthorization(options()),session=await service.session(service.token);
  assert.deepEqual(Object.keys(session.credentials),['A']);assert.deepEqual(session.authorizedScenarios,[1]);
  assert.ok(!JSON.stringify(session).includes('B-MUST-NOT-ESCAPE'));assert.ok(!JSON.stringify(session).includes('C-MUST-NOT-ESCAPE'));
  const status=JSON.stringify(await service.status(service.token));
  for(const privateValue of ['synthetic.invalid','SYNTHETIC-A-PASSWORD','synthetic-A','synthetic-owner-A',service.token])assert.ok(!status.includes(privateValue));
});
test('backend restart invalidates the grant permanently until explicit renewed authorization',async()=>{
  let alive=true,calls=0;const o=options();o.verifyBackend=async()=>{calls++;if(!alive)throw Error('upstream map restarted');return boundary};
  const service=createScenarioOneAuthorization(o);await service.session(service.token);alive=false;await assert.rejects(service.session(service.token));
  alive=true;await assert.rejects(service.session(service.token));assert.equal(calls,2);
  const renewed=createScenarioOneAuthorization(o);await renewed.session(renewed.token);assert.notEqual(renewed.token,service.token);
});
test('grant expiry, revocation and changed live isolation fail closed',async()=>{
  let time=0;const service=createScenarioOneAuthorization({...options(),now:()=>time});time=900000;await assert.rejects(service.session(service.token));
  const revoked=createScenarioOneAuthorization(options());await revoked.revoke(revoked.token);await assert.rejects(revoked.status(revoked.token));
  const changed=createScenarioOneAuthorization({...options(),verifyBackend:async()=>({...boundary,database:'other'})});await assert.rejects(changed.session(changed.token));
});
test('scoped HTTPS route rejects anonymous/foreign grants and identity/scenario inputs; no deletion or generic proxy route exists',async()=>{
  const service=createScenarioOneAuthorization(options()),app=express();app.use(express.json());app.use('/native-security/scenario1',scenarioOneAuthorizationRouter(service));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/native-security/scenario1`;
  try{
    const post=(path,token=service.token,body='{}',https=true)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(https?{'x-forwarded-proto':'https'}:{}),...(token?{authorization:`Bearer ${token}`}:{})},body});
    for(const [path,token,body,https] of [['/session',null,'{}',true],['/session','a'.repeat(64),'{}',true],['/session',service.token,'{}',false],['/session?scenario=2',service.token,'{}',true],['/session',service.token,'{"identity":"B"}',true]])assert.equal((await post(path,token,body,https)).status,403);
    for(const path of ['/delete','/bootstrap','/scenario2'])assert.equal((await post(path)).status,404);
    const response=await post('/session');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(Object.keys((await response.json()).credentials),['A']);
  }finally{await new Promise(r=>server.close(r))}
});

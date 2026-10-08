import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import nacl from 'tweetnacl';
import { loadPlantingModules } from './loadPlantingModules.mjs';
const {createScenarioOneAuthorizationClient,createScenarioOneEncryptedHandoff}=loadPlantingModules()('../../../services/nativeSecurityHarness/scenarioOneAuthorization');
const grant={origin:'https://synthetic-relay.trycloudflare.com',capability:'f'.repeat(64)};
function setup(){
  let stored=null,original=[{scenario:1,code:'FAIL'}],retry=[],allowed=true;
  const calls=[];
  const source={environment:'native-security-test',firebaseProject:'petalpal-native-security-test',database:'petalpal_native_security_test',
    backendOrigin:'https://synthetic-backend.trycloudflare.com',authorizedScenarios:[1],
    status:Object.fromEntries(['A','B','C'].map(label=>[label,{firebaseExists:true,backendExists:true}])),
    credentials:{A:{email:'a@synthetic.invalid',password:'SYNTHETIC-A-PASSWORD',uid:'synthetic-A',owner:'synthetic-owner-A',disposable:false}}};
  const d={guard:()=>{if(!allowed)throw Error('isolated mode required')},apiOrigin:()=> 'https://synthetic-backend.trycloudflare.com',
    storage:{get:async()=>stored,set:async value=>{stored=value},remove:async()=>{stored=null}},
    original:async()=>original,retry:async()=>retry,request:async(g,method)=>{calls.push(method);return structuredClone(source)}};
  return {d,source,calls,client:()=>createScenarioOneAuthorizationClient(d),get stored(){return stored},set stored(v){stored=v},
    set original(v){original=v},set retry(v){retry=v},disable(){allowed=false}};
}
test('normal/production guard blocks secure handoff before requests or writes',async()=>{
  const h=setup();h.disable();await assert.rejects(h.client().install(grant));assert.deepEqual(h.calls,[]);assert.equal(h.stored,null);
});
test('handoff preserves history and never activates a scenario; SecureStore gets only the scoped grant',async()=>{
  const h=setup(),ack=await h.client().install(grant);assert.deepEqual(JSON.parse(JSON.stringify(ack)),{ready:true,scope:'scenario-1'});
  assert.deepEqual(h.calls,['session']);assert.deepEqual(JSON.parse(h.stored),grant);
  for(const value of ['SYNTHETIC-A-PASSWORD','synthetic.invalid','synthetic-A','synthetic-owner-A'])assert.ok(!h.stored.includes(value));
  assert.equal((await h.client().initialize()).source.credentials.A.disposable,false);
});
test('handoff refuses any already-started retry or original history outside failed Scenario 1',async()=>{
  for(const state of ['retry','scenario2','original-pass']){
    const h=setup();if(state==='retry')h.retry=[{scenario:1,code:'RUNNING'}];else h.original=[{scenario:state==='scenario2'?2:1,code:state==='original-pass'?'PASS':'FAIL'}];
    await assert.rejects(h.client().install(grant));assert.equal(h.stored,null);assert.deepEqual(h.calls,[]);
  }
});
test('scope escalation, B/C credentials and wrong project/database/backend are rejected before persistence',async()=>{
  for(const mutate of [s=>s.authorizedScenarios.push(2),s=>{s.credentials.B={...s.credentials.A}},s=>{s.credentials.C={...s.credentials.A}},
    s=>{s.firebaseProject='other'},s=>{s.database='other'},s=>{s.backendOrigin='https://other.trycloudflare.com'},s=>{s.credentials.A.disposable=true}]){
    const h=setup();mutate(h.source);await assert.rejects(h.client().install(grant));assert.equal(h.stored,null);
  }
});
test('untrusted origins and corrupt grants never reach the network',async()=>{
  for(const g of [{...grant,origin:'http://synthetic-relay.trycloudflare.com'},{...grant,origin:grant.origin+'?secret=x'},
    {...grant,origin:'https://unrelated.invalid'},{...grant,capability:'bad'},{...grant,identity:'B'}]){
    const h=setup();await assert.rejects(h.client().install(g));assert.deepEqual(h.calls,[]);assert.equal(h.stored,null);
  }
});
test('backend-rejected saved authorization fails closed without fallback/bootstrap',async()=>{
  const h=setup();await h.client().install(grant);let calls=0;h.d.request=async()=>{calls++;throw Error('revoked')};await assert.rejects(h.client().initialize());
  assert.equal(calls,1);assert.deepEqual(JSON.parse(h.stored),grant);
});
test('failed SecureStore persistence cannot acknowledge readiness; revocation removes only its own grant',async()=>{
  const h=setup();h.d.storage.set=async()=>{};await assert.rejects(h.client().install(grant));assert.equal(h.stored,null);
  const other=setup();await other.client().install(grant);await other.client().revoke();assert.equal(other.stored,null);assert.deepEqual(other.calls,['session','revoke']);
});
function envelope(publicKey){
  const sender=nacl.box.keyPair(),nonce=nacl.randomBytes(24);
  const ciphertext=nacl.box(new Uint8Array(Buffer.from(JSON.stringify(grant))),nonce,new Uint8Array(Buffer.from(publicKey,'hex')),sender.secretKey);
  return {publicKey:Buffer.from(sender.publicKey).toString('hex'),nonce:Buffer.from(nonce).toString('hex'),ciphertext:Buffer.from(ciphertext).toString('hex')};
}
test('native handoff carries only encrypted grant bytes and cannot be replayed',async()=>{
  let installed=null;const handoff=createScenarioOneEncryptedHandoff({guard:()=>{},randomBytes:n=>new Uint8Array(randomBytes(n)),install:async g=>{installed=g;return {ready:true}}});
  const packet=envelope(handoff.prepare().publicKey);assert.ok(!JSON.stringify(packet).includes(grant.capability));
  await handoff.install(packet);assert.deepEqual(JSON.parse(JSON.stringify(installed)),grant);await assert.rejects(handoff.install(packet));
});
test('tampered encrypted handoff fails before secret storage and consumes its one-use key',async()=>{
  let installs=0;const handoff=createScenarioOneEncryptedHandoff({guard:()=>{},randomBytes:n=>new Uint8Array(randomBytes(n)),install:async()=>{installs++}});
  const packet=envelope(handoff.prepare().publicKey);packet.ciphertext=(packet.ciphertext.startsWith('00')?'ff':'00')+packet.ciphertext.slice(2);
  await assert.rejects(handoff.install(packet));await assert.rejects(handoff.install(packet));assert.equal(installs,0);
});

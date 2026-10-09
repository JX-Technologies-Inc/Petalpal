import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadPlantingModules } from './loadPlantingModules.mjs';
const env = { EXPO_PUBLIC_NATIVE_SECURITY_TEST:'1', EXPO_PUBLIC_FIREBASE_PROJECT_ID:'petalpal-native-security-test',
 EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN:'petalpal-native-security-test.firebaseapp.com', EXPO_PUBLIC_FIREBASE_API_KEY:'synthetic',
 EXPO_PUBLIC_FIREBASE_APP_ID:'synthetic', EXPO_PUBLIC_API_BASE_URL:'https://synthetic-test.trycloudflare.com' };
function setup() {
 const items=new Map(), globals={}; let owner=null, journal=null, error='', reloads=0, deletes=0, witnessCalls=0, fresh=true;
 const remote={A:true,B:true,C:true};
 const storage={getAllKeys:async()=>[...items.keys()],getItem:async key=>items.get(key)??null,
  setItem:async(key,value)=>{items.set(key,value)},removeItem:async key=>{items.delete(key)}};
 let modules,cache,hooks,witness;
 function boot(){
  modules=loadPlantingModules(undefined,undefined,storage,false,{env,globalThis:globals},true);
  cache=modules('plantingPersistence');hooks=globals.__PETALPAL_NATIVE_SECURITY__;
  witness=modules('../../../services/nativeSecurityLogoutWitness');
 }
 boot();
 const core=modules('../../../services/nativeSecurityHarness/engine');
 const d={enabled:true,read:async()=>journal,write:async value=>{journal=value},
  boundary:async()=>({...remote}),login:async label=>{if(!remote[label])throw Error('Absent');owner=label;error='';await cache.scopeFlowerPlacements(label);cache.setNativeSecurityExpectedOwner(label)},
  identity:label=>{if(owner!==label||(label==='C'&&!remote.C))throw Error('Wrong owner')},signedOut:()=>owner===null,errorIsGeneric:()=>error==='generic',
  logout:async()=>{owner=null;cache.setNativeSecurityExpectedOwner(null);const erased=await cache.scopeFlowerPlacements(null);error=erased?'':'generic';await witness.recordNativeLogoutWitness(erased)},
  deleteC:async()=>{if(owner!=='C')throw Error('Only C');deletes++;remote.C=false;await d.logout()},
  inspect:()=>hooks.inspect(),fixture:()=>cache.saveFlowerPlacements([{id:'SAFE-TEST-MARKER'}]),readCount:async()=> (await cache.loadFlowerPlacements()).length,
  capture:()=>cache.capturePlacementSession(),staleWrite:session=>cache.saveFlowerPlacements([{id:'SAFE-TEST-MARKER'}],session),
  armWitness:cb=>witness.armNativeLogoutWitness(async erased=>{witnessCalls++;await cb(erased)}),disarmWitness:()=>witness.disarmNativeLogoutWitness(),
  resetHooks:()=>hooks.resetHooks(),holdWrite:()=>hooks.holdNextWrite(),releaseWrite:()=>hooks.releaseWrite(),failRemove:()=>hooks.failNext('remove'),
  preference:present=>present?hooks.prepareGlobalPreference():hooks.removeGlobalPreference(),recoverStorage:()=>cache.scopeFlowerPlacements(null),
  reload:()=>{reloads++;fresh=false},freshRuntime:()=>fresh,disposeAccess:async()=>{},pause:()=>new Promise(r=>setImmediate(r))};
 return {core,d,items,remote,get journal(){return journal},set journal(v){journal=v},get deletes(){return deletes},get reloads(){return reloads},get witnessCalls(){return witnessCalls},
  get hooks(){return hooks},get cache(){return cache},get witness(){return witness},async reboot(){boot();owner=null;fresh=true;await cache.scopeFlowerPlacements(null);cache.setNativeSecurityExpectedOwner(null)},engine:()=>core.createNativeSecurityScenarioHarness(d)};
}
const expectBlocked=async h=>{await assert.rejects(h.engine().runAllNativeSecurityScenarios(),/blocked/)};
test('production/normal builds reject harness and expose no logout witness',async()=>{
 const h=setup();h.d.enabled=false;await assert.rejects(h.engine().runAllNativeSecurityScenarios(),/disabled/);assert.equal(h.journal,null);
 for(const dev of [true,false]){const m=loadPlantingModules(undefined,undefined,{},false,{env:{}},dev)('../../../services/nativeSecurityLogoutWitness');assert.throws(()=>m.armNativeLogoutWitness(async()=>{}),/required/)}
});
test('seven scenarios execute in order across the actual reload boundary; A/B preserved and only C deleted once',async()=>{
 const h=setup();await h.engine().runAllNativeSecurityScenarios();assert.equal(h.reloads,1);assert.equal(JSON.parse(h.journal).at(-1).phase,'reload-requested');
 await h.reboot();await h.engine().runAllNativeSecurityScenarios();const saved=JSON.parse(h.journal);
 assert.deepEqual(saved.filter(c=>c.code==='PASS').map(c=>c.scenario),[1,2,3,4,5,6,7]);assert.equal(h.deletes,1);assert.equal(h.remote.A,true);assert.equal(h.remote.B,true);assert.equal(h.remote.C,false);
 assert.equal((await h.hooks.inspect()).failureArmed,null);assert.equal((await h.hooks.inspect()).writeHeld,false);
 assert.equal(h.items.size,0);
});
test('checkpoint schema rejects private data, unknown phases, wrong sequencing and fabricated PASS',async()=>{
 const h=setup();await h.engine().runAllNativeSecurityScenarios();const saved=JSON.parse(h.journal);
 for(const mutate of [x=>{x[0].email='PRIVATE'},x=>{x[0].phase='startup-clean'},x=>{x[1].scenario=2},x=>{x[1].phase='pass';x[1].code='PASS';x[1].completed=true},x=>{x[3].cleanupCompleted=false}]){
  const copy=structuredClone(saved);mutate(copy);assert.throws(()=>h.core.validateCheckpoints(copy));
 }
 assert.ok(!h.journal.includes('SAFE-TEST-MARKER'));assert.ok(!h.journal.includes('password'));assert.ok(!h.journal.includes('uid'));
});
test('startup cleanup cannot manufacture logout completion or false PASS after interruption',async()=>{
 const h=setup();h.d.logout=async()=>{await h.cache.scopeFlowerPlacements(null);throw Error('simulated runtime loss')};await expectBlocked(h);
 const before=JSON.parse(h.journal).filter(c=>c.phase!=='blocked');h.journal=JSON.stringify(before);
 await h.reboot();assert.equal((await h.hooks.inspect()).namespaceKeyCount,0);await expectBlocked(h);
 assert.equal(JSON.parse(h.journal).some(c=>c.code==='PASS'),false);assert.equal(h.witnessCalls,0);assert.equal(h.deletes,0);
});
test('a pre-restart logout witness resumes without repeating logout or confusing startup cleanup',async()=>{
 const h=setup();await h.engine().runAllNativeSecurityScenarios();h.journal=JSON.stringify(JSON.parse(h.journal).filter(c=>c.scenario===1&&c.phase!=='pass'));
 const calls=h.witnessCalls;await h.reboot();h.d.login=async()=>{throw Error('stop after resumed scenario 1')};await expectBlocked(h);
 assert.equal(JSON.parse(h.journal).find(c=>c.scenario===1&&c.code==='PASS')?.phase,'pass');assert.equal(h.witnessCalls,calls);
});
test('interrupted C deletion recognizes absence and blocks without retry or substituting A/B',async()=>{
 const h=setup();h.d.deleteC=async()=>{h.remote.C=false;throw Error('lost runtime before local witness')};await expectBlocked(h);
 h.journal=JSON.stringify(JSON.parse(h.journal).filter(c=>c.phase!=='blocked'));
 await h.reboot();let retry=0;h.d.deleteC=async()=>{retry++};await expectBlocked(h);
 assert.equal(retry,0);assert.equal(h.remote.A,true);assert.equal(h.remote.B,true);assert.equal(JSON.parse(h.journal).some(c=>c.scenario===2&&c.code==='PASS'),false);
});
test('completed C deletion resumes idempotently with provider confirmation and no second deletion',async()=>{
 const h=setup();await h.engine().runAllNativeSecurityScenarios();const saved=JSON.parse(h.journal);h.journal=JSON.stringify(saved.filter(c=>c.scenario<2||(c.scenario===2&&!['remote-deleted','pass'].includes(c.phase))));
 await h.reboot();h.d.login=async()=>{throw Error('stop before scenario 3')};await expectBlocked(h);assert.equal(h.deletes,1);
 assert.ok(JSON.parse(h.journal).some(c=>c.scenario===2&&c.code==='PASS'));
});
test('terminal report resume does not repeat any mutation',async()=>{
 const h=setup();await h.engine().runAllNativeSecurityScenarios();await h.reboot();await h.engine().runAllNativeSecurityScenarios();
 const prior=h.journal;await h.engine().runAllNativeSecurityScenarios();assert.equal(h.journal,prior);assert.equal(h.deletes,1);assert.equal(h.reloads,1);
});
test('failure injection and held write are always disarmed even on storage/runner failure',async()=>{
 const h=setup();await h.engine().runAllNativeSecurityScenarios();await h.reboot();
 h.d.errorIsGeneric=()=>{throw Error('PRIVATE-ERROR-PAYLOAD')};await expectBlocked(h);const snapshot=await h.hooks.inspect();
 assert.equal(snapshot.failureArmed,null);assert.equal(snapshot.writeHeld,false);assert.ok(!h.journal.includes('PRIVATE-ERROR-PAYLOAD'));
});
test('reload acceptance uses retained pre-activation key count, not successful startup erasure',async()=>{
 const h=setup();await h.engine().runAllNativeSecurityScenarios();h.items.set('petalpal_native_security_test_placements_v1:orphan','[]');await h.reboot();
 assert.equal((await h.hooks.inspect()).namespaceKeyCount,0);assert.equal((await h.hooks.inspect()).bootNamespaceKeyCount,1);
 await expectBlocked(h);assert.equal(JSON.parse(h.journal).some(c=>c.scenario===5&&c.code==='PASS'),false);
});
test('resuming in the same runtime cannot manufacture the required reload',async()=>{
 const h=setup();await h.engine().runAllNativeSecurityScenarios();await expectBlocked(h);
 assert.equal(JSON.parse(h.journal).some(c=>c.scenario===5&&c.code==='PASS'),false);
 assert.equal(h.reloads,1);assert.equal(h.deletes,1);
});
test('durable first-reload evidence is required even when the latest startup is clean',async()=>{
 const h=setup();await h.engine().runAllNativeSecurityScenarios();await h.reboot();h.d.reloadEvidence=async()=>false;
 await expectBlocked(h);assert.equal(JSON.parse(h.journal).some(c=>c.scenario===5&&c.code==='PASS'),false);assert.equal(h.deletes,1);
});
test('failed diagnostic write cannot create a durable logout witness or PASS',async()=>{
 const h=setup();const write=h.d.write;
 h.d.write=async value=>{if(JSON.parse(value).at(-1).phase==='logout-completed')throw Error('diagnostic write failed');await write(value)};
 await expectBlocked(h);const saved=JSON.parse(h.journal);
 assert.equal(saved.some(c=>c.phase==='logout-completed'||c.code==='PASS'),false);
 assert.equal((await h.hooks.inspect()).failureArmed,null);assert.equal(h.deletes,0);
});
test('final PASS waits for resume-access revocation and local credential cleanup',async()=>{
 const h=setup();await h.engine().runAllNativeSecurityScenarios();await h.reboot();
 h.d.disposeAccess=async()=>{throw Error('access cleanup failed')};await expectBlocked(h);
 assert.equal(JSON.parse(h.journal).some(c=>c.scenario===7&&c.code==='PASS'),false);
 assert.equal(JSON.parse(h.journal).at(-1).code,'BLOCKED');
});
test('logout completion witness is one-shot and only called from product logout, not clear/startup',async()=>{
 const h=setup();let observed=0;h.witness.armNativeLogoutWitness(async()=>{observed++});await h.cache.scopeFlowerPlacements(null);assert.equal(observed,0);
 await h.witness.recordNativeLogoutWitness(true);await h.witness.recordNativeLogoutWitness(true);assert.equal(observed,1);
 const source=fs.readFileSync(new URL('../src/services/auth.tsx',import.meta.url),'utf8');const logout=source.slice(source.indexOf('async function logout'),source.indexOf('async function deleteAccount'));
 assert.ok(logout.indexOf('await recordNativeLogoutWitness(erased)')>logout.indexOf('const erased = await cleanup'));
 assert.equal((source.match(/await recordNativeLogoutWitness\(erased\)/g)||[]).length,1);
});
test('Scenario 1 witness waits for the real queued sign-out observer cleanup before persisting',async()=>{
 const h=setup();let first;
 const inspect=h.d.inspect;
 h.d.armWitness=cb=>h.witness.armNativeLogoutWitness(async erased=>{
  const observerCleanup=h.cache.scopeFlowerPlacements(null);
  h.d.inspect=async()=>{const s=await inspect();first??=s;return s};
  await cb(erased);await observerCleanup;
 });
 await h.engine().runScenarioOneOnly();
 assert.equal(first.storageReady,false);assert.equal(first.cleanupResult,null);assert.ok(first.pendingErasureCount>0);
 const saved=JSON.parse(h.journal);assert.deepEqual(saved.map(c=>c.phase),['ready','fixture','logout-pending','logout-completed','pass']);
 assert.equal(saved.at(-1).code,'PASS');assert.equal(h.deletes,0);assert.equal(h.remote.C,true);
});
test('Scenario 1 never upgrades a false erasure result and preserves the precise failed check',async()=>{
 const h=setup();h.d.armWitness=cb=>h.witness.armNativeLogoutWitness(()=>cb(false));
 await assert.rejects(h.engine().runScenarioOneOnly(),/blocked/);
 const saved=JSON.parse(h.journal);assert.equal(saved.some(c=>c.phase==='logout-completed'),false);
 assert.deepEqual(saved.at(-1).failedChecks,['erasure-returned']);assert.equal(saved.at(-1).code,'FAIL');
 assert.equal(h.deletes,0);assert.equal(h.remote.C,true);
});
test('Scenario 1 stalled cleanup stops with allowlisted native failure properties, never a synthetic PASS',async()=>{
 const h=setup(),inspect=h.d.inspect;let stalled=false;
 h.d.armWitness=cb=>h.witness.armNativeLogoutWitness(async erased=>{stalled=true;await cb(erased)});
 h.d.inspect=async()=>{const s=await inspect();return stalled?{...s,storageReady:false,pendingErasureCount:1,cleanupResult:null}:s};
 await assert.rejects(h.engine().runScenarioOneOnly(),/blocked/);
 const saved=JSON.parse(h.journal);assert.deepEqual(saved.at(-1).failedChecks,['storage-ready','pending-erasure','cleanup-result']);
 assert.equal(saved.some(c=>c.phase==='logout-completed'),false);assert.equal(saved.at(-1).code,'FAIL');
 const corrupted=structuredClone(saved);corrupted.at(-1).failedChecks=['PRIVATE-ERROR'];assert.throws(()=>h.core.validateCheckpoints(corrupted));
 assert.equal((await h.hooks.inspect()).failureArmed,null);assert.equal(h.deletes,0);
});
test('Scenario 1 only rerun and terminal resume cannot start scenario 2 or touch C',async()=>{
 const h=setup();const login=h.d.login;h.d.login=label=>{assert.equal(label,'A');return login(label)};
 await h.engine().runScenarioOneOnly();const before=h.journal,calls=h.witnessCalls;
 await h.engine().runScenarioOneOnly();assert.equal(h.journal,before);assert.equal(h.witnessCalls,calls);
 assert.equal(JSON.parse(h.journal).every(c=>c.scenario===1),true);assert.equal(h.deletes,0);assert.equal(h.remote.C,true);
});
test('Scenario 1 preparation failure persists its own start and safe failing stage without product actions',async()=>{
 for(const stage of ['auth-settled','scenario1-authorization']){
  const h=setup();let productActions=0,authorizeCalls=0;
  h.d.login=async()=>{productActions++;throw Error('must not log in')};
  h.d.logout=async()=>{productActions++;throw Error('must not log out')};
  const preparation={settleAuth:async()=>{assert.equal(JSON.parse(h.journal).at(-1).phase,'ready');if(stage==='auth-settled')throw Error('PRIVATE-ADAPTER-PAYLOAD')},
   authorize:async()=>{authorizeCalls++;throw Error('PRIVATE-ADAPTER-PAYLOAD')}};
  await assert.rejects(h.engine().runScenarioOneOnly(preparation),/blocked/);
  const saved=JSON.parse(h.journal);assert.deepEqual(saved.map(c=>c.phase),['ready','blocked']);
  assert.equal(saved.at(-1).code,'BLOCKED');assert.equal(saved.at(-1).preparationFailure,stage);
  assert.equal(h.journal.includes('PRIVATE-ADAPTER-PAYLOAD'),false);assert.equal(productActions,0);assert.equal(h.deletes,0);
  const before=h.journal,calls=authorizeCalls;await h.engine().runScenarioOneOnly(preparation);assert.equal(h.journal,before);assert.equal(authorizeCalls,calls);
  const corrupt=structuredClone(saved);corrupt.at(-1).preparationFailure='PRIVATE-ADAPTER-PAYLOAD';assert.throws(()=>h.core.validateCheckpoints(corrupt));
 }
});
test('Scenario 1 preparation supports witnessed resume and cannot repeat preparation after a terminal result',async()=>{
 const h=setup();h.d.reload=()=>{};
 let prepared=0;const preparation={settleAuth:async()=>{},authorize:async()=>{prepared++}};
 await h.engine().runScenarioOneOnly(preparation);
 const witnessed=JSON.parse(h.journal).filter(c=>c.phase!=='pass');h.journal=JSON.stringify(witnessed);
 h.d.login=async()=>{throw Error('must not repeat login')};h.d.logout=async()=>{throw Error('must not repeat logout')};
 await h.engine().runScenarioOneOnly(preparation);assert.equal(JSON.parse(h.journal).at(-1).code,'PASS');assert.equal(prepared,2);
 const terminal=h.journal;await h.engine().runScenarioOneOnly(preparation);assert.equal(h.journal,terminal);assert.equal(prepared,2);
 assert.equal(h.deletes,0);assert.equal(h.remote.C,true);
});

test('Scenario 1 identified attempt preparation performs no scenario and execution records the full protected sequence',async()=>{
 const h=setup();h.d.attemptId='s1-'+'1'.repeat(32);let logins=0;const login=h.d.login;h.d.login=async label=>{logins++;return login(label)};
 const preparation={settleAuth:async()=>{},authorize:async()=>{}};
 await h.engine().prepareScenarioOne(preparation);
 assert.deepEqual(JSON.parse(h.journal).map(c=>c.phase),['preparing','ready']);assert.equal(logins,0);assert.equal(h.witnessCalls,0);assert.equal(h.items.size,0);
 await assert.rejects(h.engine().runAllNativeSecurityScenarios(),/boundary/);
 await h.engine().runScenarioOneOnly(preparation);
 const saved=JSON.parse(h.journal);assert.deepEqual(saved.map(c=>c.phase),['preparing','ready','fixture','logout-pending','logout-completed','verification','pass']);
 assert.ok(saved.every(c=>c.attemptId===h.d.attemptId&&c.scenario===1));assert.equal(h.deletes,0);assert.equal(h.remote.C,true);
 for(const omitted of ['preparing','ready','fixture','logout-pending','logout-completed','verification'])assert.throws(()=>h.core.validateCheckpoints(saved.filter(c=>c.phase!==omitted)));
 const mixed=structuredClone(saved);mixed.at(-1).attemptId='s1-'+'2'.repeat(32);assert.throws(()=>h.core.validateCheckpoints(mixed));
});
test('Scenario 1 identified preparation failures persist preparing and their own sanitized BLOCKED stage',async()=>{
 for(const stage of ['auth-settled','scenario1-authorization']){
  const h=setup();h.d.attemptId='s1-'+'3'.repeat(32);let actions=0;h.d.login=async()=>{actions++};
  await assert.rejects(h.engine().prepareScenarioOne({settleAuth:async()=>{if(stage==='auth-settled')throw Error('PRIVATE')},authorize:async()=>{throw Error('PRIVATE')}}));
  const report=JSON.parse(h.journal);assert.deepEqual(report.map(c=>c.phase),['preparing','blocked']);assert.equal(report.at(-1).preparationFailure,stage);
  assert.ok(report.every(c=>c.attemptId===h.d.attemptId));assert.equal(h.journal.includes('PRIVATE'),false);assert.equal(actions,0);assert.equal(h.witnessCalls,0);
 }
 const h=setup();h.d.enabled=false;h.d.attemptId='s1-'+'4'.repeat(32);await assert.rejects(h.engine().prepareScenarioOne({settleAuth:async()=>{},authorize:async()=>{}}));assert.equal(h.journal,null);
});
test('Scenario 1 identified startup cleanliness cannot manufacture a missing logout completion',async()=>{
 const h=setup();h.d.attemptId='s1-'+'5'.repeat(32);const prep={settleAuth:async()=>{},authorize:async()=>{}};
 await h.engine().runScenarioOneOnly(prep);
 const prior=JSON.parse(h.journal);h.journal=JSON.stringify(prior.slice(0,prior.findIndex(c=>c.phase==='logout-completed')));
 await h.reboot();h.d.login=async()=>{throw Error('do not repeat login')};h.d.logout=async()=>{throw Error('do not repeat logout')};
 await assert.rejects(h.engine().runScenarioOneOnly(prep));const result=JSON.parse(h.journal);
 assert.equal(result.at(-1).code,'BLOCKED');assert.equal(result.some(c=>c.phase==='logout-completed'||c.code==='PASS'),false);assert.equal(h.deletes,0);
});

test('authorized continuation preserves identified Scenario 1 and executes only 2–7 across reload',async()=>{
 const h=setup();h.d.attemptId='s1-'+'6'.repeat(32);const prep={settleAuth:async()=>{},authorize:async()=>{}};
 await h.engine().runScenarioOneOnly(prep);const original=JSON.parse(h.journal);h.d.continuationSource=original;let authorizations=0;h.d.prepareContinuation=async()=>{authorizations++};
 const labels=[],login=h.d.login;h.d.login=async label=>{labels.push(label);return login(label)};
 await assert.rejects(h.engine().runScenarioOneOnly(prep),/cannot execute/);
 await h.engine().runAllNativeSecurityScenarios();assert.equal(JSON.parse(h.journal).at(-1).phase,'reload-requested');assert.equal(h.deletes,1);assert.equal(labels[0],'C');
 await h.reboot();await h.engine().runAllNativeSecurityScenarios();const final=JSON.parse(h.journal);
 assert.deepEqual(final.slice(0,7),original);assert.deepEqual(final.filter(c=>c.code==='PASS').map(c=>c.scenario),[1,2,3,4,5,6,7]);assert.equal(h.deletes,1);assert.deepEqual(h.remote,{A:true,B:true,C:false});assert.equal(authorizations,2);
 await h.engine().runAllNativeSecurityScenarios();assert.equal(authorizations,2);assert.equal(h.deletes,1);
});
test('continuation requires exact persisted source and records authorization failure before any C action',async()=>{
 const h=setup();h.d.attemptId='s1-'+'7'.repeat(32);await h.engine().runScenarioOneOnly({settleAuth:async()=>{},authorize:async()=>{}});
 h.d.continuationSource=JSON.parse(h.journal);h.d.prepareContinuation=async()=>{throw Error('PRIVATE AUTH ERROR')};
 await assert.rejects(h.engine().runAllNativeSecurityScenarios());const saved=JSON.parse(h.journal);assert.equal(saved.at(-1).scenario,2);assert.equal(saved.at(-1).code,'BLOCKED');assert.equal(h.deletes,0);assert.equal(h.journal.includes('PRIVATE AUTH ERROR'),false);
});

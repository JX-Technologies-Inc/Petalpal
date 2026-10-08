import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const {createAttemptStore,attemptKey,ATTEMPT_INDEX_KEY}=loadPlantingModules()('../../../services/nativeSecurityHarness/attempts');
const id=n=>'s1-'+n.toString(16).padStart(32,'0');
const checkpoint=(attemptId,phase,code='RUNNING')=>({attemptId,scenario:1,phase,code,started:true,completed:false,timestamp:'2026-10-08T04:00:00.000Z',cachePresent:false,recordCount:0,memoryCachePresent:false,memoryRecordCount:0,expectedOwnerMatch:true,cleanupCompleted:false,preferencePreserved:false,failureInjectionArmed:false});
function setup(){const data=new Map([['petalpal_native_security_test_harness_v1','original historical evidence'],['petalpal_native_security_test_harness_scenario1_retry_v1','retry historical evidence']]);let n=0;const storage={getItem:async k=>data.get(k)||null,setItem:async(k,v)=>{data.set(k,v)}};return {data,storage,store:createAttemptStore(storage,()=>id(++n))}}
test('attempt generations retain historical evidence and never fall back to a prior FAIL',async()=>{
 const h=setup(),a=await h.store.allocate(),rows=[checkpoint(a.id,'preparing')];await h.store.write(a.id,JSON.stringify(rows));rows.push(checkpoint(a.id,'blocked','BLOCKED'));await h.store.write(a.id,JSON.stringify(rows));
 const b=await h.store.allocate();assert.equal(b.generation,2);assert.equal(b.legacyStatus,'historical-superseded');assert.notEqual(a.id,b.id);assert.deepEqual(Array.from(b.historical),[a.id]);assert.equal((await h.store.report()).journal.length,0);
 assert.equal(h.data.get(attemptKey(a.id)),JSON.stringify(rows));assert.equal(h.data.get('petalpal_native_security_test_harness_v1'),'original historical evidence');assert.equal(h.data.get('petalpal_native_security_test_harness_scenario1_retry_v1'),'retry historical evidence');
});
test('selected attempt rejects stale writes, mixed identity, overwrite and duplicate preparation',async()=>{
 const h=setup(),a=await h.store.allocate();await assert.rejects(h.store.allocate());
 await assert.rejects(h.store.write(a.id,JSON.stringify([checkpoint(id(9),'preparing')])));
 const rows=[checkpoint(a.id,'preparing')];await h.store.write(a.id,JSON.stringify(rows));await assert.rejects(h.store.write(a.id,JSON.stringify(rows)));
 rows.push(checkpoint(a.id,'blocked','BLOCKED'));await h.store.write(a.id,JSON.stringify(rows));await h.store.allocate();await assert.rejects(h.store.write(a.id,JSON.stringify(rows)));
});
test('current report rejects a wrong-attempt journal and corrupt index without exposing history',async()=>{
 const h=setup(),a=await h.store.allocate();h.data.set(attemptKey(a.id),JSON.stringify([checkpoint(id(9),'preparing')]));await assert.rejects(h.store.report());
 h.data.set(ATTEMPT_INDEX_KEY,JSON.stringify({id:a.id,generation:1,historical:[],privatePayload:'rejected'}));await assert.rejects(h.store.report());
});
test('failed native checkpoint persistence cannot acknowledge a prepared attempt',async()=>{
 const h=setup(),a=await h.store.allocate();h.storage.setItem=async()=>{};await assert.rejects(h.store.write(a.id,JSON.stringify([checkpoint(a.id,'preparing')])));assert.equal((await h.store.report()).journal.length,0);
});
test('a delayed historical read cannot become the current report after a generation switch',async()=>{
 const h=setup(),a=await h.store.allocate(),rows=[checkpoint(a.id,'preparing'),checkpoint(a.id,'blocked','BLOCKED')];
 h.data.set(attemptKey(a.id),JSON.stringify(rows));const get=h.storage.getItem;
 h.storage.getItem=async key=>{const result=await get(key);if(key===attemptKey(a.id))h.data.set(ATTEMPT_INDEX_KEY,JSON.stringify({id:id(2),generation:2,historical:[a.id],legacyStatus:'historical-superseded'}));return result};
 await assert.rejects(h.store.report(),/selection changed/);
});

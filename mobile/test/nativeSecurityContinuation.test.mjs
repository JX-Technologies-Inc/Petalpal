import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const {createContinuationStore,verifiedSource,continuationKey,reloadRecoveryKey}=loadPlantingModules()('../../../services/nativeSecurityHarness/continuation');
const id='s1-'+'8'.repeat(32);
function source(){return {id,generation:1,historical:[],legacyStatus:'historical-superseded',journal:['preparing','ready','fixture','logout-pending','logout-completed','verification','pass'].map(phase=>({attemptId:id,scenario:1,phase,code:phase==='pass'?'PASS':'RUNNING',started:true,completed:phase==='pass',timestamp:'2026-10-08T05:00:00.000Z',cachePresent:['fixture','logout-pending'].includes(phase),recordCount:['fixture','logout-pending'].includes(phase)?1:0,memoryCachePresent:['fixture','logout-pending'].includes(phase),memoryRecordCount:['fixture','logout-pending'].includes(phase)?1:0,expectedOwnerMatch:true,cleanupCompleted:true,preferencePreserved:false,failureInjectionArmed:false}))}}
function setup(){let original=source();const data=new Map();const storage={getItem:async k=>data.get(k)||null,setItem:async(k,v)=>{data.set(k,v)}};return {data,storage,store:createContinuationStore(storage,async()=>original),get original(){return original},set original(v){original=v}}}
test('continuation refuses missing or altered generation-1 completion evidence',()=>{
 assert.throws(()=>verifiedSource(null));for(const phase of ['preparing','ready','fixture','logout-pending','logout-completed','verification','pass']){const v=source();v.journal=v.journal.filter(c=>c.phase!==phase);assert.throws(()=>verifiedSource(v))}
 const v=source();v.generation=2;assert.throws(()=>verifiedSource(v));
});
test('continuation authorization preparation preserves original evidence and requires explicit activation',async()=>{
 const h=setup(),before=JSON.stringify(h.original);const prepared=await h.store.prepare();assert.equal(prepared.active,false);assert.deepEqual(JSON.parse(JSON.stringify(prepared.journal)),h.original.journal);assert.equal(JSON.stringify(h.original),before);
 await assert.rejects(h.store.write(JSON.stringify(h.original.journal)));await assert.rejects(h.store.prepare());await h.store.activate();await assert.rejects(h.store.activate());assert.equal((await h.store.read()).active,true);
});
test('continuation cannot change its source or skip/replace a checkpoint',async()=>{
 const h=setup();await h.store.prepare();await h.store.activate();const next=[...h.original.journal,{...h.original.journal[1],scenario:2}];await h.store.write(JSON.stringify(next));await assert.rejects(h.store.write(JSON.stringify(next)));
 const corrupted=JSON.parse(h.data.get(continuationKey(id)));corrupted.journal[0].timestamp='2026-10-08T05:00:01.000Z';h.data.set(continuationKey(id),JSON.stringify(corrupted));await assert.rejects(h.store.read());
});
function blockedReload(){
 const phases={2:['ready','fixture','delete-pending','logout-completed','remote-deleted','pass'],3:['ready','fixture','logout-pending','logout-completed','b-authorized','pass'],4:['ready','write-held','logout-pending','logout-completed','stale-fenced','pass'],5:['ready','fixture','logout-pending','logout-completed','reload-requested','blocked']};
 const journal=source().journal;
 for(const [number,names] of Object.entries(phases))for(const phase of names)journal.push({...source().journal[phase==='fixture'?2:1],scenario:Number(number),phase,code:phase==='pass'?'PASS':phase==='blocked'?'BLOCKED':'RUNNING',completed:phase==='pass'});
 return {sourceAttemptId:id,active:true,journal};
}
test('reload recovery preserves blocked evidence and copies only completed scenarios 1–4',async()=>{
 const h=setup(),original=JSON.stringify(blockedReload());h.data.set(continuationKey(id),original);
 const recovery=await h.store.prepareReloadRecovery();assert.equal(recovery.active,false);assert.equal(recovery.journal.at(-1).scenario,4);assert.equal(recovery.journal.at(-1).code,'PASS');
 assert.equal(h.data.get(continuationKey(id)),original);await h.store.activate();
 await h.store.write(JSON.stringify([...recovery.journal,{...source().journal[1],scenario:5}]));
 assert.equal((await h.store.read()).journal.at(-1).scenario,5);assert.equal(h.data.get(continuationKey(id)),original);await assert.rejects(h.store.prepareReloadRecovery());
});
test('reload recovery refuses ambiguous C deletion or a missing reload witness',async()=>{
 for(const trim of [j=>j.filter(c=>c.scenario<3),j=>j.filter(c=>c.phase!=='logout-completed'&&c.scenario===5),j=>j.slice(0,-2)]){
  const h=setup(),v=blockedReload();v.journal=trim(v.journal);h.data.set(continuationKey(id),JSON.stringify(v));await assert.rejects(h.store.prepareReloadRecovery());assert.equal(h.data.has(reloadRecoveryKey(id)),false);
 }
});
test('recovery cannot alter a previously accepted completed scenario',async()=>{
 const h=setup();h.data.set(continuationKey(id),JSON.stringify(blockedReload()));await h.store.prepareReloadRecovery();
 const v=JSON.parse(h.data.get(reloadRecoveryKey(id)));v.journal.find(c=>c.scenario===2).timestamp='2026-10-08T05:00:02.000Z';h.data.set(reloadRecoveryKey(id),JSON.stringify(v));await assert.rejects(h.store.read());
});

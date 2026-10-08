import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const {createReloadObservation,RELOAD_OBSERVATION_KEY}=loadPlantingModules()('../../../services/nativeSecurityHarness/reloadObservation');
function storage(){const data=new Map();return {data,getItem:async k=>data.get(k)||null,setItem:async(k,v)=>{data.set(k,v)},getAllKeys:async()=>[...data.keys()],removeItem:async k=>{data.delete(k)}}}
test('reload observation cannot pass in its originating runtime',async()=>{
 const s=storage(),o=createReloadObservation(s);await o.arm('boot-one');await o.observe('boot-one',0);assert.equal(await o.passed('boot-one'),false);assert.equal(await o.passed('boot-two'),false);
 await o.observe('boot-two',0);assert.equal(await o.passed('boot-two'),true);await assert.rejects(o.arm('boot-three'));
});
test('later startup cleanup cannot overwrite a dirty first reload observation',async()=>{
 const s=storage(),o=createReloadObservation(s);await o.arm('boot-one');await o.observe('boot-two',1);await o.observe('boot-three',0);assert.equal(await o.passed('boot-three'),false);
 assert.equal(JSON.parse(s.data.get(RELOAD_OBSERVATION_KEY)).count,1);
});
const env={EXPO_PUBLIC_NATIVE_SECURITY_TEST:'1',EXPO_PUBLIC_FIREBASE_PROJECT_ID:'petalpal-native-security-test',EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN:'petalpal-native-security-test.firebaseapp.com',EXPO_PUBLIC_FIREBASE_API_KEY:'fixture',EXPO_PUBLIC_FIREBASE_APP_ID:'fixture',EXPO_PUBLIC_API_BASE_URL:'https://fixture.trycloudflare.com'};
test('failed durable boot evidence prevents erasure until original dirty count is saved',async()=>{
 const s=storage(),o=createReloadObservation(s);await o.arm('previous-runtime');const key='petalpal_native_security_test_placements_v1:fixture';s.data.set(key,'[]');
 let fail=true;const write=s.setItem;s.setItem=async(k,v)=>{if(fail&&k===RELOAD_OBSERVATION_KEY)throw Error('fixture failure');await write(k,v)};
 const globals={},m=loadPlantingModules(null,null,s,false,{env,globalThis:globals},true),p=m('plantingPersistence');
 assert.equal(await p.scopeFlowerPlacements(null),false);assert.equal(s.data.has(key),true);
 assert.equal(await p.scopeFlowerPlacements(null),false);assert.equal(s.data.has(key),true);
 fail=false;assert.equal(await p.scopeFlowerPlacements(null),true);assert.equal(s.data.has(key),false);assert.equal(await globals.__PETALPAL_NATIVE_SECURITY__.reloadObservationPassed(),false);
 const nextGlobals={},next=loadPlantingModules(null,null,s,false,{env,globalThis:nextGlobals},true)('plantingPersistence');await next.scopeFlowerPlacements(null);
 assert.equal(await nextGlobals.__PETALPAL_NATIVE_SECURITY__.reloadObservationPassed(),false);
});
test('normal product cleanup neither reads nor writes reload instrumentation',async()=>{
 const s=storage();s.getItem=async k=>{if(k===RELOAD_OBSERVATION_KEY)throw Error('Unexpected test access');return s.data.get(k)||null};
 const p=loadPlantingModules(null,null,s,false,{env:{}},true)('plantingPersistence');assert.equal(await p.scopeFlowerPlacements(null),true);assert.equal(s.data.has(RELOAD_OBSERVATION_KEY),false);
});

import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const plain=x=>JSON.parse(JSON.stringify(x));
const storage=new Proxy({}, {get(){throw new Error('Visual generation must not access storage');}});
const load=loadPlantingModules(storage),api=load('productionGrowth');
const model=load('../flower-density-sandbox/monthly-growth/monthlyGrowthModel');
const fixture=(month,n)=>model.monthlyGrowthRecords(month,n).map(p=>({id:p.id,flowerId:`flower-${p.id}`,
  journalEntryId:`journal-${p.id}`,ownerUserId:'test-owner',month,landId:`Land${String(month).padStart(2,'0')}`,
  plantedDate:'2026-06-01',worldX:p.worldX,worldY:p.worldY,scale:1,rotation:0,placementVersion:1,
  speciesCode:p.speciesCode,flowerName:p.speciesCode}));
const records=fixture(6,30),before=JSON.stringify(records),started=performance.now();
const scene=api.productionGrowth(records)[0],cold=performance.now()-started;
const warmStart=performance.now();
assert.equal(api.productionGrowth(records)[0].growth,scene.growth);
const warm=performance.now()-warmStart;
assert.equal(scene.parents.length,30);assert.equal(scene.growth.records.length,30);
assert.equal(scene.growth.stage.name,'FULL MONTH');assert.equal(scene.growth.emotionEffects,false);
assert.ok(scene.growth.primary.length&&scene.growth.companions.length&&scene.growth.filler.length);
assert.ok(scene.growth.pieces.every(p=>records.some(r=>r.id===p.parentId)&&p.interactive===false));
assert.deepEqual(plain(scene.growth.records.map(p=>[p.id,p.worldX,p.worldY]).sort()),
  plain(records.map(p=>[p.id,p.worldX,p.worldY]).sort()));
assert.deepEqual(plain(api.productionGrowth([...records].reverse())[0].growth.pieces),plain(scene.growth.pieces));
const dx=3,dy=2,target=records[0];
const movedParents=records.map(p=>p===target?{...p,worldX:p.worldX+dx,worldY:p.worldY+dy}:p);
const moveStart=performance.now(),moved=api.productionGrowth(movedParents)[0].growth,moveMs=performance.now()-moveStart;
for(const a of scene.growth.primary){
  const b=moved.primary.find(p=>p.id===a.id),moves=a.parentId===target.id;
  assert.ok(Math.abs(b.worldX-a.worldX-(moves?dx:0))<1e-9);
  assert.ok(Math.abs(b.worldY-a.worldY-(moves?dy:0))<1e-9);
  assert.deepEqual(plain({...b,worldX:a.worldX,worldY:a.worldY}),plain(a));
  if(moves){assert.notEqual(b.worldX,a.worldX);assert.notEqual(b.worldY,a.worldY);}
}
assert.ok(moved.pieces.every(p=>movedParents.some(parent=>parent.id===p.parentId)),'Rebuilt bed has no orphan identities');
assert.notDeepEqual(plain(moved.filler),plain(scene.growth.filler),'Shared filler may recompute with changed neighborhoods');
assert.deepEqual(plain(api.productionGrowth(records)[0].growth.pieces),plain(scene.growth.pieces),'Cancel');
const fresh=loadPlantingModules(storage)('productionGrowth');
assert.deepEqual(plain(fresh.productionGrowth(plain(movedParents))[0].growth.pieces),plain(moved.pieces),
  'Fresh runtime reconstructs moved field without any rendering metadata');
assert.equal(JSON.stringify(records),before);
assert.ok(api.productionGrowth(records.slice(1))[0].growth.pieces.every(p=>p.parentId!==target.id));
assert.equal(api.parentForGrowthPiece(scene.growth.primary[0],records)?.id,scene.growth.primary[0].parentId);
for(const [count,name] of [[1,'NEW GARDEN'],[5,'NEW GARDEN'],[6,'EARLY GROWTH'],[10,'EARLY GROWTH'],
  [11,'ESTABLISHED'],[15,'ESTABLISHED'],[16,'LUSH'],[20,'LUSH'],[21,'MATURE'],[25,'MATURE'],[26,'FULL MONTH']]){
  const stage=api.productionGrowth(fixture(6,count))[0];
  assert.equal(stage.growth.stage.name,name);assert.equal(stage.parents.length,count);
}
const june=fixture(6,5),oct=fixture(10,1),combined=api.productionGrowth([...june,...oct]);
assert.deepEqual(plain(combined.map(s=>[s.month,s.parents.length])),[[6,5],[10,1]]);
assert.deepEqual(plain(combined[0].growth.pieces),plain(api.productionGrowth(june)[0].growth.pieces));
assert.deepEqual(plain(combined[1].growth.pieces),plain(api.productionGrowth(oct)[0].growth.pieces));
const unknown={...june[0],id:'unknown',flowerId:'unknown',speciesCode:'UNREGISTERED',flowerName:'Tulip'};
assert.equal(api.gardenSpecies(unknown),null,'Never silently alias an unknown species');
const mixed=api.productionGrowth([...june,unknown])[0];
assert.equal(mixed.growth.stage.name,'EARLY GROWTH','Missing artwork still counts its real parent');
assert.equal(mixed.unresolved[0],unknown);assert.ok(mixed.growth.pieces.every(p=>p.parentId!=='unknown'));
assert.equal(api.hitProductionFlower([unknown],unknown.worldX,unknown.worldY),unknown);
assert.deepEqual(plain(api.productionGrowth([])),[]);
const collision=load('flowerFootprintConfig');
assert.deepEqual(Object.fromEntries(Object.entries(collision.FLOWER_PLACEMENT_DEFINITIONS).map(([k,v])=>[k,v.footprintRadius])),
  {default:22,Sunflower:16,Tulip:12,Lotus:22,Lavender:9,'Cherry Blossom':22});
assert.deepEqual(plain(api.VISUAL_CLASS_RADII),{S:9,M:12,L:16});
console.log(JSON.stringify({test:'productionGrowth',coldMs:Math.round(cold),warmMs:Math.round(warm*100)/100,
  moveMs:Math.round(moveMs*100)/100,parents:records.length,pieces:scene.growth.pieces.length}));
console.log('Production growth: real anchors, deterministic reload/movement, Cancel, no orphans/storage, month isolation, stages, missing art and approved S/M/L collision passed.');

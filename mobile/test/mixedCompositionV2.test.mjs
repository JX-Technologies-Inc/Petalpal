import assert from 'node:assert/strict';
import {assertFlowerBaseline} from './assertFlowerBaseline.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadPlantingModules} from './loadPlantingModules.mjs';
let accesses=0;
const storage=new Proxy({}, {get(){accesses++;throw new Error('DEV review accessed persistence');}});
const load=loadPlantingModules(storage),plain=x=>JSON.parse(JSON.stringify(x));
const v1=load('../flower-density-sandbox/allSpeciesReviewModel');
const v2=load('../flower-density-sandbox/mixedV2ReviewModel');
const groups=load('../flower-density-sandbox/mixedNeighborhoods');
const recipes=load('../flower-density-sandbox/mixedV2Composition');
const batch=load('../flower-density-sandbox/batch-components/batchComposition');
const model=load('../flower-density-sandbox/flowerDensityModel');
const masks=load('approvedPlantingMasks');
const speciesCounts=flowers=>flowers.reduce((counts,f)=>(counts[f.speciesCode]=(counts[f.speciesCode]??0)+1,counts),{});
const canonical=x=>JSON.stringify(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)));
const reports=[];
for(const month of [6,4,10]){
  const layout=v1.generateAllSpeciesLayout(month,30),saved=JSON.stringify(layout);
  const old=v1.composeAllSpecies(layout.flowers,month),review=v2.composeMixedV2(layout.flowers,month);
  assert.equal(review.flowers.length,30);assert.equal(new Set(review.flowers.map(f=>f.id)).size,30);
  assert.equal(canonical(speciesCounts(review.flowers)),canonical(speciesCounts(old)),'Preserve monthly species counts');
  assert.equal(review.neighborhoods.length,6);assert.ok(review.neighborhoods.every(n=>n.flowerIds.length>=3&&n.flowerIds.length<=7));
  assert.equal(new Set(review.neighborhoods.flatMap(n=>n.flowerIds)).size,30);
  assert.deepEqual(plain(groups.buildNeighborhoods([...layout.flowers].reverse())),plain(review.neighborhoods));
  assert.ok(groups.affinityScore(review.flowers,review.neighborhoods)>groups.affinityScore(old,review.neighborhoods));
  assert.deepEqual(plain(review.counts),plain(review.targets));
  assert.ok(Math.abs(review.counts.sparse/30-.15)<.04);
  assert.ok(Math.abs(review.counts.normal/30-.5)<=.11);
  assert.ok(Math.abs(review.counts.full/30-.35)<=.12);
  let oldPieces=0,newPieces=0;
  for(let i=0;i<30;i++){
    const f=review.flowers[i],before=old[i];
    for(const key of ['id','worldX','worldY','flowerClass','footprintRadius'])assert.equal(f[key],before[key],key);
    assert.equal(f.composition.plantingObjectCount,1);assert.equal(f.composition.footprintRadius,f.footprintRadius);
    assert.deepEqual(plain(f.composition.secondaryEmotions),[]);
    assert.ok(masks.isFootprintInApprovedMonthMaskWorld(month,f.worldX,f.worldY,f.footprintRadius));
    for(const other of review.flowers.slice(0,i))assert.ok(Math.hypot(f.worldX-other.worldX,f.worldY-other.worldY)>=f.footprintRadius+other.footprintRadius);
    if(groups.isReferenceSpecies(before.speciesCode))assert.deepEqual(plain(f),plain(before),'Approved reference stays identical in A/B');
    oldPieces+=before.composition.parts.length;newPieces+=f.composition.parts.length;
  }
  assert.ok(newPieces>oldPieces,'More visual growth, no extra logical objects');
  assert.equal(review.flowers.filter(f=>f.flowerClass==='L').length,3);
  assert.equal(JSON.stringify(layout),saved);
  const fresh=loadPlantingModules()('../flower-density-sandbox/mixedV2ReviewModel');
  assert.deepEqual(plain(fresh.composeMixedV2(layout.flowers,month)),plain(review),'Deterministic fresh reload');
  const sorted=flowers=>plain([...flowers].sort((a,b)=>a.id.localeCompare(b.id)));
  assert.deepEqual(sorted(v2.composeMixedV2([...layout.flowers].reverse(),month).flowers),sorted(review.flowers),'Stable per ID even if input order changes');
  reports.push({month,objects:30,classCounts:{S:18,M:9,L:3},areaProfile:review.areaProfile,
    weights:review.weights,actualCompositionCounts:review.counts,speciesCounts:speciesCounts(review.flowers),
    v1CompositionCounts:v2.densityCounts(old),v1VisualPieces:oldPieces,v2VisualPieces:newPieces,
    neighborhoods:review.neighborhoods.map(n=>({...n,speciesCounts:speciesCounts(review.flowers.filter(f=>n.flowerIds.includes(f.id)))}))});
}
let combinations=0;
assert.deepEqual(Object.keys(recipes.MIXED_V2_RECIPES).sort(),batch.BATCH_SPECIES.map(s=>s.speciesCode).sort());
for(const species of batch.BATCH_SPECIES)for(const month of [6,4,10])for(const density of ['sparse','normal','full'])for(let i=0;i<20;i++){
  const c=recipes.composeMixedV2Batch(`recipe-${i}`,species.speciesCode,model.getRegionInfo(month),density);
  assert.deepEqual(plain(c),plain(recipes.composeMixedV2Batch(`recipe-${i}`,species.speciesCode,model.getRegionInfo(month),density)));
  const [min,max]=recipes.MIXED_V2_RECIPES[species.speciesCode][density];
  assert.ok(c.visualUnitCount>=min&&c.visualUnitCount<=max);
  assert.equal(c.parts.reduce((sum,p)=>sum+recipes.componentVisualUnits(p.componentId),0),c.visualUnitCount);
  assert.equal(c.footprintRadius,species.footprintRadius);assert.equal(c.plantingObjectCount,1);
  assert.ok(c.parts.every(p=>batch.batchComponentById(p.componentId).speciesCode===species.speciesCode));
  assert.ok(c.parts.every(p=>Number.isFinite(p.localX)&&Number.isFinite(p.localY)&&p.scale>0&&p.scale<1.13));
  assert.ok(c.bounds.width>0&&c.bounds.height>0);combinations++;
}
for(const count of [0,5,10,20,40]){
  const review=v2.generateMixedV2Review(10,count);assert.equal(review.flowers.length,review.placed);
  assert.equal(new Set(review.neighborhoods.flatMap(n=>n.flowerIds)).size,review.flowers.length);
}
assert.equal(accesses,0);
const baseline=JSON.parse(fs.readFileSync(new URL('../../docs/flower-visuals/MIXED_V2_PROTECTED_BASELINE.json',import.meta.url)));
for(const [path,hash] of Object.entries(baseline))assertFlowerBaseline(path,hash);
fs.writeFileSync(new URL('../../docs/flower-visuals/MIXED_V2_REVIEW_COUNTS.json',import.meta.url),JSON.stringify(reports,null,2)+'\n');
console.log(`Mixed V2: ${combinations} recipe cases; three 30-object A/B presets, six neighborhoods, affinity, fixed anchors/footprints/species totals, frozen references/art/V1, deterministic reload, neutral art and no persistence passed.`);

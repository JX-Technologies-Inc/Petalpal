import assert from 'node:assert/strict';
import {assertFlowerBaseline} from './assertFlowerBaseline.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const clean = x => JSON.parse(JSON.stringify(x));
let storageAccesses=0;
const storage = new Proxy({}, {get(){storageAccesses++;throw new Error('DEV batch accessed storage');}});
const load=loadPlantingModules(storage), root=new URL('../../',import.meta.url);
const batch=load('../flower-density-sandbox/batch-components/batchComposition');
const mixed=load('../flower-density-sandbox/allSpeciesReviewModel');
const model=load('../flower-density-sandbox/flowerDensityModel');
const areas=load('../flower-density-sandbox/tulip-components/tulipAreaProfiles');
const masks=load('approvedPlantingMasks');
const radius={S:9,M:12,L:16};
const ids=new Set();
for(const c of batch.BATCH_COMPONENTS){
  assert.ok(!ids.has(c.componentId));ids.add(c.componentId);
  assert.ok(c.anchorX>0&&c.anchorX<1&&c.anchorY>0&&c.anchorY<=1);
  assert.equal(c.anchorX*c.canvasWidth,c.canvasOffset[0]+c.sourceGroundPoint[0]-c.sourceRect[0]);
  assert.equal(c.anchorY*c.canvasHeight,c.canvasOffset[1]+c.sourceGroundPoint[1]-c.sourceRect[1]);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(c.asset,root))).digest('hex'),c.sha256);
}
let checked=0;
for(const species of batch.BATCH_SPECIES){
  assert.equal(species.footprintRadius,radius[species.flowerClass]);
  assert.equal(batch.BATCH_COMPONENTS.filter(c=>c.speciesCode===species.speciesCode).length,species.componentCount);
  for(const month of [6,4,10])for(const density of ['sparse','normal','full'])for(let i=0;i<20;i++){
    const region=model.getRegionInfo(month), id=`batch-test-${i}`;
    const c=batch.composeBatchFlower(id,species.speciesCode,region,density);
    assert.deepEqual(clean(c),clean(batch.composeBatchFlower(id,species.speciesCode,region,density)));
    assert.equal(c.plantingObjectCount,1);assert.equal(c.footprintRadius,species.footprintRadius);
    assert.deepEqual(clean(c.secondaryEmotions),[]);
    assert.equal(c.parts.length,species.pieceCounts[density]);
    assert.ok(c.parts.some(p=>!['bud','foliage'].includes(batch.batchComponentById(p.componentId).category)));
    assert.ok(c.parts.every(p=>batch.batchComponentById(p.componentId).speciesCode===species.speciesCode));
    const profile=areas.DEFAULT_AREA_PROFILES[c.areaProfile];
    assert.deepEqual(clean(c.compositionWeights),clean(profile.weights));assert.equal(c.internalSpread,profile.spread);
    assert.ok(Number.isFinite(c.bounds.width)&&c.bounds.width>0&&c.bounds.height>0);checked++;
  }
}
const reports=[];
for(const {month} of mixed.ALL_SPECIES_PRESETS){
  const layout=mixed.generateAllSpeciesLayout(month,30), before=JSON.stringify(layout);
  assert.equal(layout.placed,30);assert.equal(layout.failed,0);assert.equal(layout.flowers.length,30);
  assert.deepEqual(layout.flowers.reduce((a,f)=>(a[f.flowerClass]++,a),{S:0,M:0,L:0}),{S:18,M:9,L:3});
  assert.equal(new Set(layout.flowers.filter(f=>f.flowerClass==='L').map(f=>f.speciesCode)).size,3,'Heavy accents use distinct silhouettes');
  assert.ok(new Set(layout.flowers.map(f=>f.speciesCode)).size>=8);
  const flowers=mixed.composeAllSpecies(layout.flowers,month);
  for(let i=0;i<flowers.length;i++){
    const f=flowers[i],original=layout.flowers[i];
    assert.equal(f.worldX,original.worldX);assert.equal(f.worldY,original.worldY);
    assert.equal(f.footprintRadius,radius[f.flowerClass]);assert.equal(f.composition.footprintRadius,f.footprintRadius);
    assert.equal(f.composition.plantingObjectCount,1);assert.deepEqual(clean(f.composition.secondaryEmotions),[]);
    assert.equal(f.visualScale,(month===6?1:month===4?1.08:1.22)*(f.speciesCode==='OLIVE'?.9:1));
    assert.ok(masks.isFootprintInApprovedMonthMaskWorld(month,f.worldX,f.worldY,f.footprintRadius));
    for(const other of flowers.slice(0,i))assert.ok(Math.hypot(f.worldX-other.worldX,f.worldY-other.worldY)>=f.footprintRadius+other.footprintRadius);
  }
  assert.equal(JSON.stringify(layout),before);
  const fresh=loadPlantingModules()('../flower-density-sandbox/allSpeciesReviewModel');
  assert.deepEqual(clean(flowers),clean(fresh.composeAllSpecies(fresh.generateAllSpeciesLayout(month,30).flowers,month)));
  reports.push({month,placed:layout.placed,profile:flowers[0].composition.areaProfile,
    speciesCounts:flowers.reduce((a,f)=>(a[f.speciesCode]=(a[f.speciesCode]??0)+1,a),{})});
}
assert.equal(mixed.generateAllSpeciesLayout(6,0).placed,0);assert.equal(storageAccesses,0);
const baseline=JSON.parse(fs.readFileSync(new URL('docs/flower-visuals/BATCH_REFERENCE_BASELINE.json',root)));
for(const [path,hash] of Object.entries(baseline))assertFlowerBaseline(path,hash);
fs.writeFileSync(new URL('output/batch-mixed-test-report.json',root),JSON.stringify(reports,null,2)+'\n');
console.log(`${batch.BATCH_SPECIES.length} species / ${ids.size} components / ${checked} compositions: deterministic, neutral, rooted, reference hashes unchanged. Three Mixed 30 presets: 18 S / 9 M / 3 L, masks/collision/area/reload passed.`);

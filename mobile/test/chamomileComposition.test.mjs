import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { loadPlantingModules } from './loadPlantingModules.mjs';
const load=loadPlantingModules(), clean=value=>JSON.parse(JSON.stringify(value));
const cham=load('../flower-density-sandbox/chamomile-components/chamomileComposition');
const bindings=load('../flower-density-sandbox/chamomile-components/componentImages').COMPONENT_IMAGES;
const area=load('../flower-density-sandbox/tulip-components/tulipAreaProfiles');
const model=load('../flower-density-sandbox/flowerDensityModel');
assert.equal(cham.COMPONENTS.length,29);
assert.equal(new Set(cham.COMPONENTS.map(c=>c.componentId)).size,29);
assert.equal(new Set(cham.COMPONENTS.map(c=>c.sha256)).size,29,'No duplicated assets');
for(const c of cham.COMPONENTS) {
  assert.equal(c.speciesCode,'CHAMOMILE'); assert.equal(c.status,'APPROVED_S_CLASS_REFERENCE');
  assert.equal(c.worldUnitsPerPixel,.105); assert.equal(c.defaultVisualScale,1);
  assert.ok(bindings[c.componentId]); assert.equal(cham.componentById(c.componentId),c);
  const bytes=fs.readFileSync(new URL(`../../${c.asset}`,import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),c.sha256);
  assert.equal(c.anchorX*c.canvasWidth,c.canvasOffset[0]+c.sourceGroundPoint[0]-c.sourceRect[0]);
  assert.equal(c.anchorY*c.canvasHeight,c.canvasOffset[1]+c.sourceGroundPoint[1]-c.sourceRect[1]);
  assert.ok(c.anchorY>.8,'Ground anchor is a soil point, not canvas center');
}
assert.deepEqual(clean(area.AREA_THRESHOLDS),{medium:45000,large:90000});
for(const month of [6,7,10]) for(const density of ['sparse','normal','full']) for(let i=0;i<100;i++) {
  const id=`cham-${i}`, region=model.getRegionInfo(month), c=cham.composeChamomile(id,region,density);
  assert.deepEqual(clean(c),clean(cham.composeChamomile(id,region,density)));
  assert.equal(c.footprintRadius,9); assert.equal(c.plantingObjectCount,1);
  assert.deepEqual(clean(c.secondaryEmotions),[]); assert.equal(c.density,density);
  const [min,max]=cham.DENSITY_BLOOMS[density]; assert.ok(c.bloomCount>=min && c.bloomCount<=max);
  assert.equal(c.parts.reduce((sum,p)=>sum+cham.componentById(p.componentId).bloomCount,0),c.bloomCount);
  const profile=area.DEFAULT_AREA_PROFILES[area.classifyMaskArea(region.estimatedArea)];
  assert.deepEqual(clean(c.compositionWeights),clean(profile.weights)); assert.equal(c.internalSpread,profile.spread);
  assert.ok(c.bounds.width>0 && c.bounds.height>0);
}
assert.throws(()=>cham.componentById('missing'));
console.log('Chamomile: 29 unique source assets/anchors; 900 deterministic compositions; head ranges, radius 9, one object, shared profiles and no emotions passed.');

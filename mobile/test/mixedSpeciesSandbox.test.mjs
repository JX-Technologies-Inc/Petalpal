import assert from 'node:assert/strict';
import { loadPlantingModules } from './loadPlantingModules.mjs';
const load=loadPlantingModules(), clean=x=>JSON.parse(JSON.stringify(x));
const review=load('../flower-density-sandbox/speciesReviewModel');
const model=load('../flower-density-sandbox/flowerDensityModel');
const area=load('../flower-density-sandbox/tulip-components/tulipAreaProfiles');
const masks=load('approvedPlantingMasks');
const maskBefore=JSON.stringify([masks.APPROVED_MASK_CALIBRATION,masks.APPROVED_MASK_REFINEMENTS]);
for(const month of [6,10]) for(const species of ['CHAMOMILE','MIXED']) {
  const layout=review.generateSpeciesReviewLayout(month,30,species), before=JSON.stringify(layout);
  assert.equal(layout.placed,30); assert.equal(layout.failed,0); assert.equal(layout.requested,30);
  const counts={TULIP:0,CHAMOMILE:0}; layout.flowers.forEach(f=>counts[f.speciesCode]++);
  assert.deepEqual(counts,species==='MIXED'?{TULIP:15,CHAMOMILE:15}:{TULIP:0,CHAMOMILE:30});
  const composed=review.composeSpeciesReview(layout.flowers,month);
  assert.equal(composed.length,30);
  for(let i=0;i<30;i++) {
    const f=layout.flowers[i],c=composed[i];
    assert.equal(f.footprintRadius,f.speciesCode==='TULIP'?12:9);
    assert.ok(masks.isFootprintInApprovedMonthMaskWorld(month,f.worldX,f.worldY,f.footprintRadius));
    assert.equal(c.worldX,f.worldX); assert.equal(c.worldY,f.worldY); assert.equal(c.id,f.id);
    assert.equal(c.composition.footprintRadius,f.footprintRadius); assert.equal(c.composition.plantingObjectCount,1);
    assert.deepEqual(clean(c.composition.secondaryEmotions),[]);
    assert.equal(c.visualScale,month===6?1:1.22);
    if(f.speciesCode==='TULIP') assert.deepEqual(clean(c.composition),clean(area.composeAreaAwareTulip(f.id,model.getRegionInfo(month))));
    for(const other of layout.flowers.slice(0,i)) assert.ok(Math.hypot(f.worldX-other.worldX,f.worldY-other.worldY)>=f.footprintRadius+other.footprintRadius);
  }
  const tuned=review.composeSpeciesReview(layout.flowers,month,'full',1.3);
  assert.deepEqual(clean(tuned.map(f=>[f.id,f.worldX,f.worldY,f.footprintRadius])),clean(composed.map(f=>[f.id,f.worldX,f.worldY,f.footprintRadius])));
  assert.equal(JSON.stringify(layout),before);
  assert.deepEqual(clean(layout),clean(review.generateSpeciesReviewLayout(month,30,species)));
  // Fresh module caches simulate reload without relying on the first layout cache.
  const reload=loadPlantingModules()('../flower-density-sandbox/speciesReviewModel');
  assert.deepEqual(clean(composed),clean(reload.composeSpeciesReview(reload.generateSpeciesReviewLayout(month,30,species).flowers,month)));
  console.log(`${month===6?'June':'October'} ${species}: 30 total; ${counts.TULIP} Tulip + ${counts.CHAMOMILE} Chamomile; valid footprints, unchanged anchors and deterministic reload.`);
}
// Existing pure Tulip placement identity is preserved exactly.
for(const month of [6,10]) {
  const old=model.generateDensityLayout(month,30,'M');
  assert.deepEqual(clean(review.generateSpeciesReviewLayout(month,30,'TULIP').flowers.map(({speciesCode,...f})=>f)),clean(old.flowers));
}
assert.equal(JSON.stringify([masks.APPROVED_MASK_CALIBRATION,masks.APPROVED_MASK_REFINEMENTS]),maskBefore);

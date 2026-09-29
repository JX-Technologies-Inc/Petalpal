import assert from 'node:assert/strict';
import {assertFlowerBaseline} from './assertFlowerBaseline.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const load=loadPlantingModules(),clean=x=>JSON.parse(JSON.stringify(x));
const review=load('../flower-density-sandbox/speciesReviewModel');
const masks=load('approvedPlantingMasks');
const before=JSON.stringify([masks.APPROVED_MASK_CALIBRATION,masks.APPROVED_MASK_REFINEMENTS]);
for(const month of [6,10]){
  const layout=review.generateSpeciesReviewLayout(month,30,'MIXED_SML');
  assert.equal(layout.placed,30);assert.equal(layout.failed,0);assert.equal(layout.flowers.length,30);
  assert.deepEqual(layout.flowers.reduce((a,f)=>(a[f.speciesCode]++,a),{TULIP:0,CHAMOMILE:0,HYDRANGEA:0}),{TULIP:12,CHAMOMILE:12,HYDRANGEA:6});
  const saved=JSON.stringify(layout),composed=review.composeSpeciesReview(layout.flowers,month),tuned=review.composeSpeciesReview(layout.flowers,month,undefined,1,1.4);
  for(let i=0;i<30;i++){
    const f=layout.flowers[i],c=composed[i];
    assert.equal(f.footprintRadius,{TULIP:12,CHAMOMILE:9,HYDRANGEA:16}[f.speciesCode]);
    assert.equal(c.worldX,f.worldX);assert.equal(c.worldY,f.worldY);assert.equal(c.id,f.id);
    assert.equal(c.composition.footprintRadius,f.footprintRadius);assert.equal(c.composition.plantingObjectCount,1);
    assert.deepEqual(clean(c.composition.secondaryEmotions),[]);assert.equal(c.visualScale,month===6?1:1.22);
    assert.ok(masks.isFootprintInApprovedMonthMaskWorld(month,f.worldX,f.worldY,f.footprintRadius));
    for(const other of layout.flowers.slice(0,i))assert.ok(Math.hypot(f.worldX-other.worldX,f.worldY-other.worldY)>=f.footprintRadius+other.footprintRadius);
    const t=clean(tuned[i]);if(f.speciesCode==='HYDRANGEA'){assert.equal(t.visualScale,c.visualScale*1.4);t.visualScale=c.visualScale;}
    assert.deepEqual(t,clean(c),'Hydrangea tuning affects only its complete visual scale');
  }
  assert.equal(JSON.stringify(layout),saved);
  const fresh=loadPlantingModules()('../flower-density-sandbox/speciesReviewModel');
  assert.deepEqual(clean(composed),clean(fresh.composeSpeciesReview(fresh.generateSpeciesReviewLayout(month,30,'MIXED_SML').flowers,month)));
  const qa=review.generateSpeciesReviewLayout(month,20,'HYDRANGEA');assert.equal(qa.requested,20);
  assert.equal(qa.placed,month===6?11:20);assert.equal(qa.failed,20-qa.placed);assert.ok(qa.flowers.every(f=>f.footprintRadius===16));
  console.log(`${month===6?'June':'October'} Mixed: 30/30 = 12 Tulip + 12 Chamomile + 6 Hydrangea. Hydrangea QA: ${qa.placed}/20; unchanged validation/radius.`);
}
assert.equal(review.generateSpeciesReviewLayout(6,0,'MIXED_SML').placed,0);
assert.equal(JSON.stringify([masks.APPROVED_MASK_CALIBRATION,masks.APPROVED_MASK_REFINEMENTS]),before);
// The shared registry is intentionally extended; all protected reference code/art is byte-identical.
const baseline=JSON.parse(fs.readFileSync(new URL('../../output/hydrangea-baseline.json',import.meta.url)));
for(const [p,hash] of Object.entries(baseline)){
  if(p.endsWith('/speciesReviewModel.ts'))continue;
  assertFlowerBaseline(p,hash);
}
console.log('Approved Chamomile, all Tulip code/assets, planting masks/logic, Tea Set, production Garden and backend baseline unchanged.');

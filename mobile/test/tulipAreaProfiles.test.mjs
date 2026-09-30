import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const load=loadPlantingModules();
const {getRegionInfo,generateDensityLayout,DEFAULT_TUNING}=load('../flower-density-sandbox/flowerDensityModel');
const {classifyMaskArea,DEFAULT_AREA_PROFILES,cloneAreaProfiles,changeProfileWeight,composeAreaAwareTulip,composeReviewObjects}=load('../flower-density-sandbox/tulip-components/tulipAreaProfiles');
const {composeTulip}=load('../flower-density-sandbox/tulip-components/tulipComposition');
const {sortVisualsByGroundY}=load('../flower-visuals/flowerVisualResolver');
const clean=x=>JSON.parse(JSON.stringify(x));
const mask=new URL('../src/components/garden/planting/approvedPlantingMasks.json',import.meta.url);
const hash=()=>createHash('sha256').update(fs.readFileSync(mask)).digest('hex');const before=hash();
const regions=Array.from({length:12},(_,i)=>getRegionInfo(i+1));
assert.deepEqual(regions.map(r=>classifyMaskArea(r.estimatedArea)),[
  'SMALL','SMALL','SMALL','MEDIUM','SMALL','SMALL','MEDIUM','MEDIUM','LARGE','LARGE','LARGE','MEDIUM']);
for(const [area,profile] of [[44999,'SMALL'],[45000,'MEDIUM'],[89999,'MEDIUM'],[90000,'LARGE']])assert.equal(classifyMaskArea(area),profile);
assert.throws(()=>classifyMaskArea(NaN));
// Classification responds to supplied approved mask area, not the month name or PNG bounds.
assert.equal(composeAreaAwareTulip('id',{...regions[9],estimatedArea:33020}).areaProfile,'SMALL');
assert.equal(composeAreaAwareTulip('id',{...regions[5],estimatedArea:104592}).areaProfile,'LARGE');
const distributions={};
for(const month of [6,4,10]) {
  const region=regions[month-1],profile=classifyMaskArea(region.estimatedArea),counts={sparse:0,normal:0,full:0};
  for(let i=0;i<1200;i++) {
    const id=`area-review-${i}`,v=composeAreaAwareTulip(id,region),again=composeAreaAwareTulip(id,region);
    assert.deepEqual(clean(v),clean(again));counts[v.density]++;
    assert.equal(v.footprintRadius,12);assert.equal(v.plantingObjectCount,1);assert.equal(v.secondaryEmotions.length,0);
    const base=composeTulip(id,v.density);assert.equal(v.parts.length,base.parts.length);
    v.parts.forEach((p,index)=>{
      const b=base.parts[index];assert.equal(p.componentId,b.componentId);assert.equal(p.scale,b.scale);assert.equal(p.rotation,b.rotation);
      assert.equal(p.localX,b.localX*v.internalSpread);assert.equal(p.localY,b.localY*v.internalSpread);
    });
    assert.ok(v.bounds.width<85&&v.bounds.height<70,'Keep one coherent visual cluster');
  }
  distributions[profile]=counts;
  for(const key of ['sparse','normal','full'])assert.ok(Math.abs(counts[key]/1200-DEFAULT_AREA_PROFILES[profile].weights[key]/100)<.05);
}
assert.ok(distributions.LARGE.full>distributions.SMALL.full*2);
assert.ok(distributions.SMALL.sparse>distributions.LARGE.sparse*2);
// Exactly one result per record, including exactly 30 supplied Journal objects.
const entries=Array.from({length:30},(_,i)=>({id:`entry-${i}`,worldX:100+i*27,worldY:200+i%7,footprintRadius:12}));
for(const records of [entries,...[[10,30],[6,30],[10,10]].map(([month,count])=>generateDensityLayout(month,count,'M',DEFAULT_TUNING).flowers)]) {
  const snapshot=JSON.stringify(records);
  const v2=composeReviewObjects(records,regions[9],false),v3=composeReviewObjects(records,regions[9],true);
  assert.equal(v3.length,records.length);assert.equal(JSON.stringify(records),snapshot);
  const positions=objects=>clean(sortVisualsByGroundY(objects).map(({id,worldX,worldY,footprintRadius})=>({id,worldX,worldY,footprintRadius})));
  assert.deepEqual(positions(v2),positions(v3));
}
const profiles=cloneAreaProfiles();
profiles.LARGE=changeProfileWeight(profiles.LARGE,'full',100);
assert.equal(composeAreaAwareTulip('tuned',regions[9],profiles).density,'full');
assert.equal(DEFAULT_AREA_PROFILES.LARGE.weights.full,45);
for(const key of ['sparse','normal','full'])for(const value of [0,10,50,100]) {
  const changed=changeProfileWeight(profiles.SMALL,key,value);
  assert.equal(changed.weights[key],value);assert.equal(Object.values(changed.weights).reduce((a,b)=>a+b,0),100);
}
assert.equal(composeAreaAwareTulip('override',regions[9],profiles,'sparse').density,'sparse');
assert.equal(hash(),before);
console.table(regions.map(r=>({month:r.month,land:r.landId,area:r.estimatedArea,profile:classifyMaskArea(r.estimatedArea)})));
console.log('V3 area distributions, 1200 IDs per profile:',JSON.stringify(distributions));
console.log('V3 determinism, unchanged component sizes/anchors, 30-in/30-out, radius 12, mask preservation and V2/V3 placement/depth parity passed.');

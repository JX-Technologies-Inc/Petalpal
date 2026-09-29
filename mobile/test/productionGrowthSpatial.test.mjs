import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const storage=new Proxy({}, {get(){throw new Error('Spatial generation must never access storage');}});
const load=loadPlantingModules(storage),plain=x=>JSON.parse(JSON.stringify(x));
const qa=load('productionGrowthQAData'),api=load('productionGrowth'),metrics=load('growthReviewMetrics');
const masks=load('approvedPlantingMasks'),model=load('../flower-density-sandbox/monthly-growth/monthlyGrowthModel');
const coverage=load('../flower-density-sandbox/monthly-growth/growthCoverage'),land=load('landAwareGrowth');
const catalog=load('../flower-density-sandbox/monthly-growth/growthCatalog');
const region=load('../flower-density-sandbox/flowerDensityModel').getRegionInfo(6);
const reference=qa.approvedJuneGrowth(),baseline=metrics.measureGrowth(reference,6);
assert.equal(crypto.createHash('sha256').update(JSON.stringify(reference.pieces)).digest('hex'),
  '347f5a41794341e6032d88db308928a76e2e0b7e893010e776cbce2f2cec0f5c');
const reports=[];let previous=0;
for(const count of [1,5,10,20,30]){
  const parents=qa.productionQARecords(count),saved=JSON.stringify(parents),g=api.productionGrowth(parents)[0].growth;
  const report=metrics.measureGrowth(g,6);reports.push({count,...report});
  assert.equal(g.records.length,count);assert.equal(JSON.stringify(parents),saved);
  assert.equal(report.outsideOrigins,0,'No origin in water/outside authoritative usable grass');
  assert.ok(report.botanicalCoverage>previous,'Stage progression expands real visible coverage');previous=report.botanicalCoverage;
  for(const p of parents){
    assert.ok(g.primary.some(c=>c.parentId===p.id&&c.speciesCode===p.speciesCode));
    assert.equal(g.companions.filter(c=>c.parentId===p.id).length,model.growthStage(count).companions);
  }
  for(const p of g.pieces){
    const owner=parents.find(r=>r.id===p.parentId);assert.ok(owner);assert.equal(p.speciesCode,owner.speciesCode);
    assert.ok(masks.isPointInApprovedMonthMaskWorld(6,p.worldX,p.worldY));
    assert.ok(Math.hypot(p.worldX-owner.worldX,p.worldY-owner.worldY)<=Math.hypot(region.bounds.width,region.bounds.height));
  }
}
const mature=reports.at(-1),g=api.productionGrowth(qa.productionQARecords(30))[0].growth;
assert.equal(mature.pieceCount,baseline.pieceCount,'Restore distribution, never add pieces to hide the error');
assert.equal(mature.pieceCount,591);assert.equal(mature.occupiedSectors,6);
assert.ok(mature.botanicalCoverage>=.72&&mature.botanicalCoverage<=.78);
assert.ok(Math.abs(mature.botanicalCoverage-baseline.botanicalCoverage)<.02);
assert.ok(Math.abs(mature.visibleAlphaArea/baseline.visibleAlphaArea-1)<.05);
for(const [name,sector] of Object.entries(mature.sectors)){
  assert.ok(sector.coverage>.5,name);assert.ok(Math.abs(sector.coverage-baseline.sectors[name].coverage)<.05,name);
}
for(const name of ['LOW','MID','TALL']){
  assert.ok(mature.heightShare[name]>.1);assert.ok(Math.abs(mature.heightShare[name]-baseline.heightShare[name])<.03);
}
assert.equal(Object.keys(mature.speciesShare).length,7);
for(const [species,share] of Object.entries(mature.speciesShare)){
  assert.ok(share>.04&&share<.4,species);assert.ok(Math.abs(share-baseline.speciesShare[species])<.03,species);
}
assert.ok(Object.values(mature.speciesShare).sort((a,b)=>b-a).slice(0,2).reduce((a,b)=>a+b,0)<.55);
assert.ok(mature.distance.p90<=baseline.distance.p90*1.15);
// Actual visible alpha may cross the boundary even though every origin is valid.
assert.ok(g.pieces.some(p=>{
  const c=catalog.growthCatalog(p.speciesCode).lookup(p.componentId),[l,t,r,b]=c.contentBounds;
  for(let y=t;y<b;y+=8)for(let x=l;x<r;x+=8){
    const dx=(x-c.anchorX*c.canvasWidth)*p.scale,dy=(y-c.anchorY*c.canvasHeight)*p.scale;
    const wx=p.worldX+dx*Math.cos(p.rotation)-dy*Math.sin(p.rotation),wy=p.worldY+dx*Math.sin(p.rotation)+dy*Math.cos(p.rotation);
    if(coverage.alphaAt(p,wx,wy)>.5&&!masks.isPointInApprovedMonthMaskWorld(6,wx,wy))return true;
  }return false;
}),'Origin containment does not become pixel clipping');
// All changes to the approved QA pieces are origin placement corrections only.
assert.deepEqual(plain(g.primary),plain(reference.primary));
for(let i=0;i<g.pieces.length;i++)assert.deepEqual(plain({...g.pieces[i],worldX:reference.pieces[i].worldX,worldY:reference.pieces[i].worldY}),plain(reference.pieces[i]));
// Apply scale/rotation exactly once. Shared bed coordinates do not inherit an
// unrelated parent-space displacement or a second land transform.
const parents=qa.productionQARecords(30),owner=parents[0],raw=reference.primary.find(p=>p.parentId===owner.id);
const variant={...owner,scale:.8,rotation:12};
const transformed=land.bindLandAwareGrowth(reference,parents.map(p=>p.id===owner.id?variant:p),6);
const angle=12*Math.PI/180,dx=raw.worldX-owner.worldX,dy=raw.worldY-owner.worldY;
const expected=land.fitGrowthOrigin({...raw,worldX:owner.worldX+(dx*Math.cos(angle)-dy*Math.sin(angle))*.8,
  worldY:owner.worldY+(dx*Math.sin(angle)+dy*Math.cos(angle))*.8,scale:raw.scale*.8,rotation:raw.rotation+angle},6,reference.mask.points);
assert.deepEqual(plain(transformed.primary.find(p=>p.id===raw.id)),plain(expected));
const invalid={...raw,worldX:100000,worldY:-100000},fixed=land.fitGrowthOrigin(invalid,6,reference.mask.points);
assert.ok(masks.isPointInApprovedMonthMaskWorld(6,fixed.worldX,fixed.worldY));
assert.equal(fixed.scale,invalid.scale);assert.equal(fixed.componentId,invalid.componentId);
// Edge positions and arbitrary real IDs must also generate valid origins, with
// deterministic fresh-module reconstruction; no dependency on fixture IDs.
const changed=parents.map((p,i)=>({...p,id:`user-flower-${i}`,worldX:p.worldX+(i%2?1:-1),worldY:p.worldY+1}));
const a=api.productionGrowth(changed)[0].growth,b=loadPlantingModules(storage)('productionGrowth').productionGrowth(plain(changed))[0].growth;
assert.deepEqual(plain(a.pieces),plain(b.pieces));assert.ok(a.pieces.every(p=>masks.isPointInApprovedMonthMaskWorld(6,p.worldX,p.worldY)));
fs.writeFileSync(new URL('../../output/production-growth-integration-checks/land-aware-metrics.json',import.meta.url),JSON.stringify({reference:baseline,production:reports},null,2)+'\n');
fs.writeFileSync(new URL('../../output/production-growth-integration-checks/land-aware-alpha-geometry.json',import.meta.url),JSON.stringify([
  {name:'approved',area:region.estimatedArea,points:reference.mask.points,pieces:reference.pieces,runtimeCoverage:baseline.botanicalCoverage},
  {name:'production',area:region.estimatedArea,points:g.mask.points,pieces:g.pieces,runtimeCoverage:mature.botanicalCoverage}]));
console.log(JSON.stringify({reference:baseline.botanicalCoverage,production:mature.botanicalCoverage,pieces:mature.pieceCount,sectors:mature.occupiedSectors,
  height:mature.heightShare,species:mature.speciesShare,originsOutside:mature.outsideOrigins}));
console.log('Land-aware growth: valid origins, border-crossing pixels, transform consistency, six sectors, seven species, height/mass/coverage parity, stage expansion, stable ownership and reload passed.');

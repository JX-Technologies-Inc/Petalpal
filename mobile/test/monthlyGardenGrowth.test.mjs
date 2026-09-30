import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadPlantingModules} from './loadPlantingModules.mjs';
import {assertFlowerBaseline} from './assertFlowerBaseline.mjs';
let persistenceAccesses=0;
const storage=new Proxy({}, {get(){persistenceAccesses++;throw new Error('Growth accessed persistence');}});
const load=loadPlantingModules(storage),plain=x=>JSON.parse(JSON.stringify(x));
const growth=load('../flower-density-sandbox/monthly-growth/monthlyGrowthModel');
const coverage=load('../flower-density-sandbox/monthly-growth/growthCoverage');
const catalogs=load('../flower-density-sandbox/monthly-growth/growthCatalog');
const masks=load('approvedPlantingMasks'),model=load('../flower-density-sandbox/flowerDensityModel');
const review=load('../flower-density-sandbox/allSpeciesReviewModel');
const reports=[],geometry=[];
for(let n=1;n<=30;n++)assert.ok(growth.growthCoverageTarget(n)>growth.growthCoverageTarget(n-1),'Record-driven maturity target rises without a wall clock');
assert.deepEqual([5,10,15,20,25,30].map(n=>growth.growthStage(n).name),['NEW GARDEN','EARLY GROWTH','ESTABLISHED','LUSH','MATURE','FULL MONTH']);
let last=0;
for(const preset of growth.GROWTH_PRESETS){
  const {month,day}=preset,records=growth.monthlyGrowthRecords(month,day),saved=JSON.stringify(records);
  assert.equal(records.length,day);
  const scene=growth.buildMonthlyGrowth(records,month);
  assert.equal(new Set(records.map(f=>f.id)).size,day);
  assert.equal(scene.supportTargetIds.length,day);assert.equal(new Set(scene.supportTargetIds).size,day);
  assert.deepEqual(plain(records),plain(growth.monthlyGrowthRecords(month,30).slice(0,day)),'Stable stage-prefix anchors');
  assert.equal(JSON.stringify(records),saved);
  assert.deepEqual(plain(scene.pieces),plain(growth.buildMonthlyGrowth([...records].reverse(),month).pieces),'Child placement is stable under input reorder');
  for(let i=0;i<records.length;i++){
    const f=records[i];assert.equal(f.footprintRadius,{S:9,M:12,L:16}[f.flowerClass]);
    assert.ok(masks.isFootprintInApprovedMonthMaskWorld(month,f.worldX,f.worldY,f.footprintRadius));
    for(const other of records.slice(0,i))assert.ok(Math.hypot(f.worldX-other.worldX,f.worldY-other.worldY)>=f.footprintRadius+other.footprintRadius);
    assert.equal(growth.primaryHitTarget(records,f.worldX,f.worldY),f.id);
  }
  assert.equal(growth.primaryHitTarget(records,-100,-100),null);
  assert.equal(new Set(scene.pieces.map(p=>p.id)).size,scene.pieces.length);
  for(const p of scene.pieces){
    const parent=growth.parentForVisual(p,records);assert.ok(parent);
    assert.equal(p.speciesCode,parent.speciesCode);assert.equal(p.interactive,false);
    assert.ok(Number.isFinite(p.scale)&&p.scale>0);
  }
  // Primary recipe pixels and transforms remain those of the reference pipeline.
  for(const f of review.composeAllSpecies(records,month))for(const part of f.composition.parts){
    const p=scene.primary.find(p=>p.id===`${f.id}:primary:${part.order}`),c=catalogs.growthCatalog(f.speciesCode).lookup(part.componentId);
    assert.equal(p.worldX,f.worldX+part.localX*f.visualScale);assert.equal(p.worldY,f.worldY+part.localY*f.visualScale);
    assert.equal(p.scale,c.worldUnitsPerPixel*c.defaultVisualScale*part.scale*f.visualScale);assert.equal(p.rotation,part.rotation);
  }
  for(const p of scene.mask.points)assert.ok(masks.isPointInApprovedMonthMaskWorld(month,p.x,p.y));
  // Clip scanlines must stay inside the approved predicate, including boundary cells.
  for(const m of scene.mask.path.matchAll(/M([\d.-]+) ([\d.-]+)h([\d.-]+)v1h[\d.-]+Z/g)){
    const x=Number(m[1]),y=Number(m[2]),w=Number(m[3]);
    for(const px of [x,x+w/2,x+w])for(const py of [y,y+.5,y+1])assert.ok(masks.isPointInApprovedMonthMaskWorld(month,px,py));
  }
  const independent=coverage.accumulateCoverage(scene.pieces,scene.mask.points);
  assert.equal(coverage.coverageFraction(independent),scene.coverage);
  assert.equal(scene.emotionEffects,false);
  if(month===6){assert.ok(scene.approvedMaskCoverage>last);last=scene.approvedMaskCoverage;}
  if(day===30){
    assert.ok(scene.approvedMaskCoverage>=.7&&scene.approvedMaskCoverage<=.85);
    const counts=records.reduce((a,f)=>(a[f.speciesCode]=(a[f.speciesCode]??0)+1,a),{});
    assert.deepEqual(Object.entries(counts).sort(),Object.entries(growth.BEAUTY_MIXES[month]).sort());
    assert.equal(Object.keys(counts).length,7);
    geometry.push({month,area:model.getRegionInfo(month).estimatedArea,points:scene.mask.points,pieces:scene.pieces,
      sampledCoverage:scene.approvedMaskCoverage});
  }
  reports.push({month,day,stage:scene.stage.name,realRecordCount:records.length,primaryPieces:scene.primary.length,
    companionPieces:scene.companions.length,fillerPieces:scene.filler.length,nonInteractiveVisualPieces:scene.pieces.length,
    approvedMaskCoverage:scene.approvedMaskCoverage,clipCoverage:scene.coverage,
    speciesCounts:records.reduce((a,f)=>(a[f.speciesCode]=(a[f.speciesCode]??0)+1,a),{})});
}
const fresh=loadPlantingModules()('../flower-density-sandbox/monthly-growth/monthlyGrowthModel');
const same=growth.monthlyGrowthRecords(6,10);
assert.deepEqual(plain(fresh.buildMonthlyGrowth(fresh.monthlyGrowthRecords(6,10),6)),plain(growth.buildMonthlyGrowth(same,6)));
assert.equal(growth.buildMonthlyGrowth([],6).pieces.length,0);assert.equal(persistenceAccesses,0);
const baseline=JSON.parse(fs.readFileSync(new URL('../../docs/flower-visuals/MONTHLY_GROWTH_PROTECTED_BASELINE.json',import.meta.url)));
for(const [p,hash] of Object.entries(baseline))assertFlowerBaseline(p,hash);
fs.writeFileSync(new URL('../../docs/flower-visuals/MONTHLY_GROWTH_COUNTS.json',import.meta.url),JSON.stringify(reports,null,2)+'\n');
fs.writeFileSync(new URL('../../output/monthly-growth-alpha-geometry.json',import.meta.url),JSON.stringify(geometry));
console.log('Monthly Growth: six presets, 30 parent records, stable anchors/radii, deterministic owned children/stages, seven-species mixes, alpha coverage, Final Mask clip, parent-only targets, no persistence/effects and protected hashes passed.');

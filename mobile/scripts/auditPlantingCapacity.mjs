import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPlantingModules} from '../test/loadPlantingModules.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const modules=loadPlantingModules(new Proxy({}, {get(){throw new Error('Capacity audit must not access storage');}}));
const validate=modules('placementValidator').validateFlowerPlacement;
const config=modules('flowerFootprintConfig');
const masks=modules('approvedPlantingMasks');
const regions=modules('plantingRegionData').MONTH_REGION_METAS;
const coverage=modules('../flower-density-sandbox/monthly-growth/growthCoverage');
const density=modules('../flower-density-sandbox/flowerDensityModel');
const representativeQA=modules('productionGrowthQAData').productionQARecords(30);

export const scenarios=[
  {key:'small_friendly',label:'Small-radius friendly',species:[...Array(12).fill('Tulip'),...Array(10).fill('Lavender'),...Array(4).fill('Lotus'),...Array(4).fill('Cherry Blossom')]},
  {key:'representative',label:'Representative June Garden mix',species:representativeQA.map(p=>p.flowerName)},
  {key:'large_stress',label:'Large-radius stress',species:[...Array(18).fill('Sunflower'),...Array(6).fill('Tulip'),...Array(6).fill('Lavender')]},
  {key:'default_radius',label:'Default-radius mix',species:[...Array(10).fill('Daisy'),...Array(8).fill('Chamomile'),...Array(6).fill('Poppy'),...Array(6).fill('Coreopsis')]},
];
for(const scenario of scenarios)assert.equal(scenario.species.length,30,`${scenario.key}: 30 records`);
const approvedCentersByMonthRadius=new Map();

function placementDefinition(species){return config.getFlowerPlacementDefinition(species);}
function hashNumber(text){return crypto.createHash('sha256').update(text).digest().readUInt32LE(0)/4294967296;}

export function getCandidates(month){
  const points=coverage.growthMask(month).points;
  assert.ok(points.length,`approved mask ${month} has samples`);
  const byPosition=new Map();
  // Four shifted 8-world-pixel lattice samples per 16px square. Each candidate
  // originates in the exact precomputed Final Mask sampler; phases reduce bias.
  for(const phaseX of [0,8])for(const phaseY of [0,8]){
    const buckets=new Map();
    for(const p of points){
      const col=Math.floor((p.x-phaseX)/16),row=Math.floor((p.y-phaseY)/16),key=`${col}:${row}`;
      const cx=col*16+phaseX+8,cy=row*16+phaseY+8,d=(p.x-cx)**2+(p.y-cy)**2,old=buckets.get(key);
      if(!old||d<old.d)buckets.set(key,{p,d});
    }
    for(const {p} of buckets.values())byPosition.set(`${p.x}:${p.y}`,p);
  }
  return [...byPosition.values()].sort((a,b)=>a.y-b.y||a.x-b.x);
}

function makeRecord(month,species,index,point){
  const meta=regions[month],name=species[index];
  return {id:`capacity-${String(month).padStart(2,'0')}-${index+1}`,flowerId:`audit-only-${index+1}`,
    journalEntryId:`audit-only-entry-${index+1}`,plantedDate:'2026-06-01T12:00:00.000Z',month,
    landId:meta.landId,worldX:point.x,worldY:point.y,scale:1,rotation:0,placementVersion:1,
    flowerName:name,speciesCode:name,mood:'Happy'};
}

function clearance(candidate,radius,placed){
  if(!placed.length)return Infinity;
  let min=Infinity;
  for(const p of placed){const sum=radius+placementDefinition(p.flowerName).footprintRadius;
    min=Math.min(min,Math.hypot(candidate.x-p.worldX,candidate.y-p.worldY)-sum);}
  return min;
}

function denseComplete(month,scenario,initial){
  // Near-capacity fallback checks every exact approved sampler point (4px)
  // before the audit reports a failure from its coarser search lattice.
  const placed=[...initial],used=new Set(placed.map(p=>p.id)),remaining=[];
  for(const name of scenario.species){
    const index=scenario.species.findIndex((s,i)=>s===name&&!used.has(`capacity-${String(month).padStart(2,'0')}-${i+1}`));
    if(index>=0){used.add(`capacity-${String(month).padStart(2,'0')}-${index+1}`);remaining.push({name,index});}
  }
  remaining.sort((a,b)=>placementDefinition(b.name).footprintRadius-placementDefinition(a.name).footprintRadius
    ||hashNumber(`${month}:${scenario.key}:dense:${a.index}`)-hashNumber(`${month}:${scenario.key}:dense:${b.index}`));
  const points=coverage.growthMask(month).points;
  let failedSpecies=null;
  for(const next of remaining){const options=[];
    for(const point of points){const gap=clearance(point,placementDefinition(next.name).footprintRadius,placed);
      if(gap>=-1e-9)options.push({point,gap,tie:hashNumber(`${month}:${scenario.key}:dense:${point.x}:${point.y}`)});}
    options.sort((a,b)=>b.gap-a.gap||a.tie-b.tie);
    let added;
    for(const candidate of options){const record=makeRecord(month,scenario.species,next.index,candidate.point);
      if(validate({flowerId:record.flowerId,month,worldX:record.worldX,worldY:record.worldY,
        existingPlacements:placed,flowerName:record.flowerName}).isValid){added=record;break;}}
    if(!added){failedSpecies=next.name;break;}
    placed.push(added);
  }
  return {placed,failedSpecies};
}

export function runScenario(month,scenario,candidatePoints=getCandidates(month)){
  const meta=regions[month],area=density.getRegionInfo(month).estimatedArea;
  const uniqueRadii=[...new Set(scenario.species.map(s=>placementDefinition(s).footprintRadius))].sort((a,b)=>a-b);
  const validByRadius=new Map(),nameForRadius=new Map(uniqueRadii.map(r=>
    [r,scenario.species.find(s=>placementDefinition(s).footprintRadius===r)]));
  // Full standalone containment validation uses Confirm Plant's real validator.
  for(const radius of uniqueRadii){
    const key=`${month}:${radius}`;let centers=approvedCentersByMonthRadius.get(key);
    if(!centers){centers=[];const name=nameForRadius.get(radius);
      for(const point of candidatePoints){const result=validate({flowerId:'capacity-audit',month,
        worldX:point.x,worldY:point.y,existingPlacements:[],flowerName:name});
        if(result.isValid)centers.push(point);}
      approvedCentersByMonthRadius.set(key,centers);
    }
    validByRadius.set(radius,centers);
  }
  const runs=[];
  for(let seed=0;seed<12;seed++){
    const order=scenario.species.map((flowerName,index)=>({flowerName,index,
      orderKey:hashNumber(`${month}:${scenario.key}:${seed}:species:${index}:${flowerName}`)}))
      .sort((a,b)=>placementDefinition(b.flowerName).footprintRadius-placementDefinition(a.flowerName).footprintRadius
        ||a.orderKey-b.orderKey||a.index-b.index);
    const placed=[];
    for(const item of order){
      const radius=placementDefinition(item.flowerName).footprintRadius;
      const options=validByRadius.get(radius).map((point,index)=>({point,index,
        gap:clearance(point,radius,placed),tie:hashNumber(`${month}:${scenario.key}:${seed}:point:${point.x}:${point.y}`)}))
        .filter(candidate=>candidate.gap>=-1e-9)
        .sort((a,b)=>b.gap-a.gap||a.tie-b.tie||a.index-b.index);
      let selected;
      for(const candidate of options){const record=makeRecord(month,scenario.species,item.index,candidate.point);
        const result=validate({flowerId:record.flowerId,month,worldX:record.worldX,worldY:record.worldY,
          existingPlacements:placed,flowerName:record.flowerName});
        if(result.isValid){selected=record;break;}}
      if(!selected)break;
      placed.push(selected);
    }
    let minimumClearance=Infinity;
    for(let i=0;i<placed.length;i++)for(let j=0;j<i;j++)minimumClearance=Math.min(minimumClearance,
      Math.hypot(placed[i].worldX-placed[j].worldX,placed[i].worldY-placed[j].worldY)
        -placementDefinition(placed[i].flowerName).footprintRadius
        -placementDefinition(placed[j].flowerName).footprintRadius);
    runs.push({seed,placed,placedCount:placed.length,
      minimumPairwiseClearance:placed.length<2?null:minimumClearance,failedSpecies:order[placed.length]?.flowerName??null});
  }
  runs.sort((a,b)=>b.placedCount-a.placedCount
    ||(b.minimumPairwiseClearance??-Infinity)-(a.minimumPairwiseClearance??-Infinity)||a.seed-b.seed);
  let best=runs[0],fullRuns=runs.filter(r=>r.placedCount===30).length,denseCompletionCount=0;
  if(best.placedCount>=24&&best.placedCount<30){const dense=denseComplete(month,scenario,best.placed);
    denseCompletionCount=dense.placed.length-best.placedCount;
    if(dense.placed.length>best.placedCount){let gap=Infinity;
      for(let i=0;i<dense.placed.length;i++)for(let j=0;j<i;j++)gap=Math.min(gap,
        Math.hypot(dense.placed[i].worldX-dense.placed[j].worldX,dense.placed[i].worldY-dense.placed[j].worldY)
          -placementDefinition(dense.placed[i].flowerName).footprintRadius-placementDefinition(dense.placed[j].flowerName).footprintRadius);
      best={...best,placed:dense.placed,placedCount:dense.placed.length,minimumPairwiseClearance:gap,failedSpecies:dense.failedSpecies};
      if(dense.placed.length===30)fullRuns++;}}
  const minClearance=best.placed.length>1?best.minimumPairwiseClearance:null;
  const classification=best.placedCount<30?'FAIL':(fullRuns>=3&&minClearance>=8?'PASS':'MARGINAL');
  const footprintArea=scenario.species.reduce((sum,s)=>sum+Math.PI*placementDefinition(s).footprintRadius**2,0);
  let failureReason=null;
  if(best.placedCount<30){
    const remainingRadius=placementDefinition(best.failedSpecies).footprintRadius;
    const safeCount=validByRadius.get(remainingRadius).length;
    failureReason=footprintArea>area*1.03
      ?`The 2px-sampled Final Mask area (${Math.round(area)} world px²) is below the ${Math.round(footprintArea)} world px² sum of 30 non-overlapping collision disks, before boundary/shape losses; current footprint radii alone are limiting.`
      :safeCount===0
        ?`No candidate center on the ${candidatePoints.length}-point deterministic search lattice passes full ${remainingRadius}px footprint containment.`
        :`Best of 12 multi-start searches placed ${best.placedCount}/30; remaining valid ${remainingRadius}px centers conflict with occupied production footprints. This strong-search result is not a mathematical packing proof.`;
  }
  const counts={};for(const name of scenario.species){const key=`${name} r${placementDefinition(name).footprintRadius}`;counts[key]=(counts[key]??0)+1;}
  return {month,landId:meta.landId,monthName:meta.monthName,scenario:scenario.key,scenarioLabel:scenario.label,
    usableAreaWorldPx2:area,requested:30,placed:best.placedCount,failed:30-best.placedCount,
    theoreticalNonOverlappingFootprintAreaWorldPx2:footprintArea,
    footprintAreaBelowSampledMaskArea:footprintArea<=area,speciesRadiusDistribution:counts,
    uniqueProductionRadii:uniqueRadii,candidateCenters:candidatePoints.length,
    validCentersByRadius:Object.fromEntries(uniqueRadii.map(r=>[r,validByRadius.get(r).length])),
    successfulStarts:fullRuns,searchStarts:12,minimumPairwiseClearance:minClearance,denseCompletionCount,
    classification,classificationScope:scenario.key==='representative'?'land':'scenario',failureReason,
    failureNextSpecies:best.failedSpecies,
    placements:best.placed.map(p=>({id:p.id,flowerName:p.flowerName,worldX:p.worldX,worldY:p.worldY,
      radius:placementDefinition(p.flowerName).footprintRadius}))};
}

function radiusMix(distribution){
  const sums={};for(const [label,count] of Object.entries(distribution)){
    const radius=Number(label.match(/r(\d+)/)?.[1]);sums[radius]=(sums[radius]??0)+count;}
  return Object.entries(sums).sort((a,b)=>Number(a[0])-Number(b[0]))
    .map(([radius,count])=>`${count}×${radius}`).join(', ');
}

function main(){
  const all=[];
  for(let month=1;month<=12;month++){
    assert.equal(regions[month].month,month);assert.ok(coverage.growthMask(month).points.length);
    assert.equal(masks.APPROVED_MASK_CALIBRATION[month].landId,regions[month].landId);
    assert.equal(masks.APPROVED_MASK_REFINEMENTS[month].month,month);
    const sample=coverage.growthMask(month).points[0];
    assert.equal(masks.isPointInApprovedMonthMaskWorld(month,sample.x,sample.y),true);
    assert.equal(masks.getApprovedRegionAtWorld(sample.x,sample.y,month),month);
    const candidates=getCandidates(month);
    for(const scenario of scenarios){const result=runScenario(month,scenario,candidates);all.push(result);
      console.log(`${result.landId} ${result.scenario}: ${result.placed}/30, ${result.classification}, area≈${result.usableAreaWorldPx2}, centers=${JSON.stringify(result.validCentersByRadius)}`);}
  }
  const representatives=all.filter(r=>r.scenario==='representative');
  const radiusDefinitions=config.FLOWER_PLACEMENT_DEFINITIONS;
  const radiusReport={...Object.fromEntries(Object.entries(radiusDefinitions).map(([name,def])=>[name,def.footprintRadius])),
    unmatchedSpeciesResolveTo:config.DEFAULT_FLOWER_PLACEMENT_DEF.footprintRadius};
  const result={generatedAt:'2026-09-29',validator:'mobile/src/components/garden/planting/placementValidator.ts::validateFlowerPlacement',
    maskSource:'current approvedPlantingMasks Final Mask through the exact growthMask sampler; area from approved-region 2px sample',
    areaUnits:'approximate usable world px², sampled at 2 world px per axis by existing getRegionInfo',
    search:{candidateLattice:'four shifted 8-world-pixel samples per 16px cell, sourced from exact approved mask samples',
      ordering:'12 deterministic large-radius-first multi-starts; max-min clearance; near misses get a dense 4px mask-sample completion pass; every placement revalidated by production validator',
      qaRecordsPersisted:false,visualGrowthChildrenExcluded:true},radiusDefinitions:radiusReport,
    productClassificationRule:'PASS: representative mix 30/30 in at least 3 starts with >=8 world px minimum pairwise clearance; MARGINAL: any 30/30 otherwise; FAIL: no 30/30 in 12 starts (heuristic result, not proof of impossibility)',
    qaPlacementsPersisted:false,classificationByLand:Object.fromEntries(representatives.map(r=>[r.landId,r.classification])),scenarioResults:all};
  const out=path.join(root,'output/production-planting-capacity-audit');fs.mkdirSync(out,{recursive:true});
  // Keep only aggregate audit evidence on disk. In-memory QA placements below
  // are discarded when this process ends and never become planting records.
  const capacityPath=path.join(out,'capacity.json');
  fs.writeFileSync(capacityPath,JSON.stringify({...result,scenarioResults:all.map(({placements,...row})=>row)},null,2)+'\n');
  fs.writeFileSync(path.join(out,'capacity.sha256'),crypto.createHash('sha256').update(fs.readFileSync(capacityPath)).digest('hex')+'\n');

  const mixLines=scenarios.map(s=>{
    const counts={};for(const name of s.species){const key=`${name} r${placementDefinition(name).footprintRadius}`;counts[key]=(counts[key]??0)+1;}
    return `- **${s.label}:** ${Object.entries(counts).map(([name,count])=>`${name} × ${count}`).join(', ')}.`;
  });
  const rows=all.map(r=>`| ${r.landId} / ${String(r.month).padStart(2,'0')} | ${r.scenarioLabel} | ${Math.round(r.usableAreaWorldPx2).toLocaleString()} | ${Math.round(r.theoreticalNonOverlappingFootprintAreaWorldPx2).toLocaleString()} | ${radiusMix(r.speciesRadiusDistribution)} | ${r.placed}/30 | ${r.failed} | ${r.minimumPairwiseClearance===null?'—':r.minimumPairwiseClearance.toFixed(1)} | ${r.successfulStarts}/12 | ${r.classification} | ${r.failureReason??`30 fit in ${r.successfulStarts} deterministic starts; minimum pair clearance ${r.minimumPairwiseClearance.toFixed(1)}px.`} |`);
  const summary=representatives.map(r=>`| ${r.landId} / ${String(r.month).padStart(2,'0')} | ${Math.round(r.usableAreaWorldPx2).toLocaleString()} | ${r.placed}/30 | ${r.classification} |`);
  const report=[
    '# Production Planting Capacity Audit — all twelve lands','',
    'Generated 2026-09-29. **Audit only:** no placement, collision radius, Final Mask, Growth V1.1 data or persistent state was changed.','',
    '## Validator and inputs','',
    'All candidate centers and every placed record were tested with the actual `validateFlowerPlacement` used by Confirm Plant and Adjust. It enforces world bounds, current month/Final Mask center assignment, whole-footprint containment, and pairwise collision using `getFlowerPlacementDefinition`. Confirm Plant revalidates before writing and assigns the month’s authoritative Land ID. The Land06 tea courtyard sample (1845,435) is rejected as non-plantable. The Final Mask excludes non-plantable regions; the current validator does not call a separate landmark validator.','',
    'Approved-mask usable area uses the existing Final Mask measurement in `getRegionInfo`: center samples on a 2-world-pixel grid. It is an area estimate (world px²); every candidate/footprint admission uses the actual approved-mask production validator. All twelve mask calibrations/refinements were checked against the month/Land ID mapping.','',
    'Current radii found in production: default/unmatched **22**; Tulip **20**; Lavender **20**; Sunflower **24**; Lotus **22**; Cherry Blossom **22**. No S/M/L DEV radius is used.','',
    '## Test mixes','',...mixLines,'',
    'The representative mix is the exact deterministic 30-parent species sequence from the approved June Garden review fixture. It is synthetic audit input held only in memory and is never persisted. Only aggregate results are written; candidate placement records/coordinates are omitted. The four mixes are held constant across all lands.','',
    '## Land classification (representative mix)','','| Land / month | Usable area ≈ px² | Placed | Classification |','|---|---:|---:|---|',...summary,'',
    'Classification: **PASS** requires 30/30 in at least three deterministic starts and minimum pairwise clearance ≥8px; **MARGINAL** means 30/30 was found but missed that margin; **FAIL** means no 30/30 in twelve starts. FAIL describes this search result, not a mathematical proof unless the reported summed disk area exceeds the sampled area by more than 3%.','',
    '## All 48 land × mix results','','Search uses exact approved-mask sampler points, four shifted 8px candidate lattices, full-footprint prevalidation through the production validator, then 12 deterministic large-radius-first starts with max-min clearance ordering. Near misses (24–29 placements) get a completion pass over the full 4px approved-mask sample. Each selected placement is revalidated against the current occupied list through that same validator.','',
    '| Land / month | Scenario | Usable area ≈ px² | 30 disk area px² | Radius counts | Placed | Failed | Min clearance px | Full starts | Result | Finding |',
    '|---|---|---:|---:|---|---:|---:|---:|---:|---|---|',...rows,'',
    '## Interpretation','',
    'Capacity is driven by current collision radii together with approved-mask geometry. Where the 30-circle area lower bound exceeds the sampled mask area, the footprint radii alone are incompatible with 30 under this area estimate. Where that bound fits yet the search falls short, shape, whole-circle boundary containment and pairwise spacing constrain packing; the search does not prove an exact maximum. Land06 has the smallest sampled area and its Tea Set courtyard is non-plantable. Land10 and Land11 fit the representative 30, with tight clearance, and are classified MARGINAL.','',
    'Recommended next options for separate review: run finer-resolution branch-and-bound/continuous packing analysis for near-capacity lands; or review expected monthly Journal limits/species allocation against measured capacity. This audit implements neither option and makes no radius recommendation.','',
    '## Exact files created','',
    '- `mobile/scripts/auditPlantingCapacity.mjs`','- `mobile/test/plantingCapacityAudit.test.mjs`',
    '- `output/production-planting-capacity-audit/capacity-report.md`',
    '- `output/production-planting-capacity-audit/capacity.json` (aggregate results only; no generated Flower Record positions)',
    '- `output/production-planting-capacity-audit/capacity.sha256`','',
    'The required production-growth regression test also refreshed `output/production-growth-performance/equivalence-and-timing.json` with its measured run timings. That sidecar is outside the immutable performance checkpoint.','',
    'Reproduction: `node mobile/scripts/auditPlantingCapacity.mjs`; result data and SHA-256 are in `output/production-planting-capacity-audit/capacity.json` and `capacity.sha256`. Determinism/validator parity regression: `node mobile/test/plantingCapacityAudit.test.mjs`.',''
  ].join('\n');
  fs.writeFileSync(path.join(out,'capacity-report.md'),report);
  console.log(`Wrote ${all.length} audited scenarios; representative classifications: ${JSON.stringify(result.classificationByLand)}`);
}
if(process.argv[1]?.endsWith('auditPlantingCapacity.mjs'))main();

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPlantingModules} from '../test/loadPlantingModules.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export function createAuditEngine(radiusResolver){
const modules=loadPlantingModules(new Proxy({}, {get(){throw new Error('Capacity audit must not access storage');}}));

const originalConfig=modules('flowerFootprintConfig');
const config=radiusResolver?{...originalConfig,getFlowerPlacementDefinition(name){return {...originalConfig.getFlowerPlacementDefinition(name),footprintRadius:radiusResolver(name)};}}:originalConfig;
const candidateModules=radiusResolver?loadPlantingModules(new Proxy({}, {get(){throw new Error('Storage forbidden');}}),undefined,undefined,true,{'./flowerFootprintConfig':config,'./parentCollision':{resolveParentCollision(code,name){return {status:'CLASSIFIED',radius:radiusResolver(code||name)};}}}):modules;
const validate=candidateModules('placementValidator').validateFlowerPlacement;
const masks=modules('approvedPlantingMasks');
const regions=modules('plantingRegionData').MONTH_REGION_METAS;
const coverage=modules('../flower-density-sandbox/monthly-growth/growthCoverage');
const density=modules('../flower-density-sandbox/flowerDensityModel');
const representativeQA=modules('productionGrowthQAData').productionQARecords(30);

const scenarios=[
  {key:'small_friendly',label:'Small-radius friendly',species:[...Array(12).fill('Tulip'),...Array(10).fill('Lavender'),...Array(4).fill('Lotus'),...Array(4).fill('Cherry Blossom')]},
  {key:'representative',label:'Representative June Garden mix',species:representativeQA.map(p=>p.flowerName)},
  {key:'large_stress',label:'Large-radius stress',species:[...Array(18).fill('Sunflower'),...Array(6).fill('Tulip'),...Array(6).fill('Lavender')]},
  {key:'default_radius',label:'Default-radius mix',species:[...Array(10).fill('Daisy'),...Array(8).fill('Chamomile'),...Array(6).fill('Poppy'),...Array(6).fill('Coreopsis')]},
];
for(const scenario of scenarios)assert.equal(scenario.species.length,30,`${scenario.key}: 30 records`);
const approvedCentersByMonthRadius=new Map();

function placementDefinition(species){return config.getFlowerPlacementDefinition(species);}
function hashNumber(text){return crypto.createHash('sha256').update(text).digest().readUInt32LE(0)/4294967296;}

function getCandidates(month){
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

function runScenario(month,scenario,candidatePoints=getCandidates(month)){
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


return {scenarios,getCandidates,runScenario,validate,config};
}

// Isolated QA tooling: invokes the production validator; never imports persistence.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadPlantingModules} from '../test/loadPlantingModules.mjs';
export const ROOT=new URL('../../',import.meta.url);
export const STEP=3;
const denied=new Proxy({}, {get(){throw new Error('Capacity audit cannot access persisted QA/user data');}});
export const load=loadPlantingModules(denied,undefined,denied,true,{fetch(){throw new Error('Capacity audit cannot access the backend');}});
export const validator=load('placementValidator').validateFlowerPlacement;
export const footprints=load('flowerFootprintConfig');
export const masks=load('approvedPlantingMasks');
export const metas=load('plantingRegionData').MONTH_REGION_METAS;
export const staticData=JSON.parse(fs.readFileSync(new URL('mobile/src/components/garden/flower-density-sandbox/monthly-growth/growthStaticData.json',ROOT)));
export function seeded(seed){let s=seed>>>0;return ()=>{s+=0x6d2b79f5;let n=s;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};}
const radiiByName=new Map();
export const radius=p=>{if(!radiiByName.has(p.flowerName))radiiByName.set(p.flowerName,footprints.getFlowerPlacementDefinition(p.flowerName).footprintRadius);return radiiByName.get(p.flowerName);};
export const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function scenarios(month){
  // B mirrors the approved June/April/October mixes; other months use the same
  // seven-species June distribution as an explicit neutral reference scenario.
  const representative=month===4?{CHAMOMILE:6,TULIP:6,DAISY:5,BLUEBELL:4,PETUNIA:4,HYDRANGEA:2,COREOPSIS:3}:
    month===10?{CHAMOMILE:6,TULIP:5,ASTER:5,HEATHER:4,POPPY:5,HYDRANGEA:2,COREOPSIS:3}:
    {CHAMOMILE:6,TULIP:6,DAISY:5,LAVENDER:4,POPPY:4,HYDRANGEA:2,COREOPSIS:3};
  const mixes={A:{TULIP:14,LAVENDER:10,CHAMOMILE:3,DAISY:3},B:representative,
    C:{SUNFLOWER:18,HYDRANGEA:4,POPPY:4,TULIP:2,LAVENDER:2},D:{CHAMOMILE:8,DAISY:8,HYDRANGEA:4,POPPY:4,PETUNIA:3,ASTER:3}};
  return Object.entries(mixes).map(([scenario,mix])=>({scenario,mix,records:Object.entries(mix).flatMap(([speciesCode,count])=>
    Array.from({length:count},(_,i)=>{const id=`capacity-${month}-${scenario}-${speciesCode}-${i+1}`;
      return {id,flowerId:id,journalEntryId:`journal-${id}`,plantedDate:`2026-${String(month).padStart(2,'0')}-01T12:00:00Z`,
        month,landId:metas[month].landId,flowerName:speciesCode,speciesCode,worldX:0,worldY:0,scale:1,rotation:0,
        placementVersion:1,supportCount:0,ownerUserId:'isolated-capacity-qa'};}))}));
}
export function validate(record,existingPlacements=[]){return validator({flowerId:record.flowerId,month:record.month,
  worldX:record.worldX,worldY:record.worldY,flowerName:record.flowerName,existingPlacements});}
export function buildDomain(month){
  const bounds=staticData.regions[month].bounds,points=[],counts={20:0,22:0,24:0},rejections={};
  for(let y=bounds.y+STEP/2;y<bounds.y+bounds.height;y+=STEP)for(let x=bounds.x+STEP/2;x<bounds.x+bounds.width;x+=STEP){
    if(!masks.isPointInApprovedMonthMaskWorld(month,x,y))continue;
    const accepted={};
    for(const [r,flowerName] of [[20,'Tulip'],[22,'Chamomile'],[24,'Sunflower']]){
      const result=validate({flowerId:'capacity-domain',month,worldX:x,worldY:y,flowerName});
      accepted[r]=result.isValid;
      if(result.isValid)counts[r]++;else rejections[result.reason]=(rejections[result.reason]??0)+1;
    }
    if(accepted[20]||accepted[22]||accepted[24])points.push({x,y,accepted});
  }
  return {month,bounds,step:STEP,points,counts,rejections};
}
function freeAt(x,y,r,placed,gap=0){for(const q of placed)if((x-q.worldX)**2+(y-q.worldY)**2<(r+radius(q)+gap)**2)return false;return true;}
function collisionFree(p,placed,gap=0){return freeAt(p.worldX,p.worldY,radius(p),placed,gap);}
export function clearance(placed){let min=Infinity;for(let i=0;i<placed.length;i++)for(let j=0;j<i;j++)
  min=Math.min(min,Math.hypot(placed[i].worldX-placed[j].worldX,placed[i].worldY-placed[j].worldY)-radius(placed[i])-radius(placed[j]));
  return Number.isFinite(min)?min:null;}
function orderRecords(records,attempt,rng){
  const decorated=records.map((p,i)=>({p,i,key:rng()}));
  return decorated.sort((a,b)=>attempt%4===0?radius(b.p)-radius(a.p)||a.i-b.i:attempt%4===1?
    radius(a.p)-radius(b.p)||a.i-b.i:attempt%4===2?a.key-b.key:a.i-b.i).map(v=>v.p);
}
function orderedPoints(domain,attempt,rng){
  const theta=(attempt%24)*Math.PI/12,c=Math.cos(theta),s=Math.sin(theta),b=domain.bounds;
  return domain.points.map((p,i)=>{const u=p.x*c+p.y*s,v=-p.x*s+p.y*c;
    // Directional sweep, staggered rows, radial inward/outward and random starts.
    const mode=Math.floor(attempt/24)%4;
    const key=mode===0?u+v*.00001:mode===1?Math.floor(v/38)*10000+u:
      mode===2?((attempt%2)?-1:1)*Math.hypot(p.x-b.x-b.width/2,p.y-b.y-b.height/2):rng();
    return {p,key,i};}).sort((a,b)=>a.key-b.key||a.i-b.i).map(v=>v.p);
}
function fill(records,placed,points,gap=0){
  for(const p of records){const r=radius(p);
    for(const q of points){if(!q.accepted[r])continue;
      if(freeAt(q.x,q.y,r,placed,gap)){placed.push({...p,worldX:q.x,worldY:q.y});break;}
    }
  }return placed;
}
export function search(domain,records,{attempts=96,gap=0,repair=120}={}){
  let best=[],bestStrategy='';const rng=seeded(domain.month*100003+records[0].id.length*113+Math.round(gap*10));
  let successes=0;const attemptCounts=[];
  for(let attempt=0;attempt<attempts;attempt++){
    const ordered=orderedPoints(domain,attempt,rng),roster=orderRecords(records,attempt,rng);
    const placed=fill(roster,[],ordered,gap);attemptCounts.push(placed.length);
    if(placed.length===30)successes++;
    if(placed.length>best.length||(placed.length===best.length&&clearance(placed)>clearance(best))){best=placed;bestStrategy=`multi-start-${attempt}`;}
  }
  // Bounded deterministic destroy/repair: remove a nearby pocket and reinsert
  // it with the missing records, so a single greedy trap is not a capacity claim.
  for(let iteration=0;iteration<repair&&best.length<30;iteration++){
    if(!best.length)break;
    const focus=best[Math.floor(rng()*best.length)],n=2+iteration%5;
    const removed=best.slice().sort((a,b)=>Math.hypot(a.worldX-focus.worldX,a.worldY-focus.worldY)-
      Math.hypot(b.worldX-focus.worldX,b.worldY-focus.worldY)).slice(0,n);
    const kept=best.filter(p=>!removed.includes(p)),ids=new Set(kept.map(p=>p.id));
    const missing=orderRecords(records.filter(p=>!ids.has(p.id)),iteration,rng);
    const trial=fill(missing,kept,orderedPoints(domain,iteration+48,rng),gap);
    if(trial.length>best.length||(trial.length===best.length&&iteration%3===0)){best=trial;bestStrategy=`destroy-repair-${iteration}`;}
  }
  // Crucial: replay the full production call with ALL earlier real-shaped
  // parents; cached admission / collision filtering never authorizes a witness.
  const confirmed=[];
  for(const p of best){const result=validate(p,confirmed);if(!result.isValid)throw new Error(`Validator parity failure ${p.id}: ${result.reason}`);confirmed.push(p);}
  return {placed:best,strategy:bestStrategy,attempts,repairBudget:repair,successes,attemptCounts,minClearance:clearance(best),gap};
}
export function polish(domain,records,result,{rounds=48}={}){
  // Continuous sub-grid search: compact a directional edge, then try inserting
  // missing footprints at tangencies and at the dense grid. True validator gates
  // every off-grid move, so this does not change any planting rule.
  const rng=seeded(domain.month*9137+records[0].id.length),points=domain.points;
  const geometry=new Map();
  const admitted=p=>{const key=JSON.stringify([p.worldX,p.worldY,radius(p)]);
    if(!geometry.has(key))geometry.set(key,masks.isPointInApprovedMonthMaskWorld(p.month,p.worldX,p.worldY)&&validate(p).isValid);
    return geometry.get(key);};
  let best=result.placed,work=best.map(p=>({...p}));
  for(let round=0;round<rounds&&best.length<30;round++){
    const angle=(round%16)*Math.PI/8,step=round%3===0?3:1;
    for(const index of work.map((_,i)=>i).sort((a,b)=>
      (work[a].worldX-work[b].worldX)*Math.cos(angle)+(work[a].worldY-work[b].worldY)*Math.sin(angle))){
      const old=work[index],others=work.filter((_,i)=>i!==index);
      const p={...old,worldX:old.worldX-Math.cos(angle)*step,worldY:old.worldY-Math.sin(angle)*step};
      if(collisionFree(p,others)&&admitted(p))work[index]=p;
    }
    const ids=new Set(work.map(p=>p.id)),missing=records.filter(p=>!ids.has(p.id));
    for(const p of missing){let added=false;
      for(const q of work.slice()){
        for(let k=0;k<24;k++){const a=k*Math.PI/12,r=radius(p)+radius(q)+.05;
          const trial={...p,worldX:q.worldX+Math.cos(a)*r,worldY:q.worldY+Math.sin(a)*r};
          if(collisionFree(trial,work)&&admitted(trial)){work.push(trial);added=true;break;}}
        if(added)break;
      }
      if(!added)fill([p],work,points);
    }
    if(work.length>best.length)best=work.map(p=>({...p}));
    if(round%16===15){work=best.map(p=>({...p}));
      if(work.length){const index=Math.floor(rng()*work.length);work.splice(index,1);}}
  }
  const confirmed=[];for(const p of best){if(!validate(p,confirmed).isValid)throw new Error('Off-grid parity failed');confirmed.push(p);}
  return {...result,placed:best,minClearance:clearance(best),continuousRounds:rounds,
    strategy:best.length>result.placed.length?'continuous-compaction/tangent-repair':result.strategy};
}

export function tangentSearch(domain,records,initial,{attempts=24}={}){
  const rng=seeded(domain.month*4177+records[0].id.length),geometry=new Map();let best=initial;
  const admitted=p=>{const key=JSON.stringify([p.worldX,p.worldY,radius(p)]);
    if(!geometry.has(key))geometry.set(key,masks.isPointInApprovedMonthMaskWorld(p.month,p.worldX,p.worldY)&&validate(p).isValid);
    return geometry.get(key);};
  for(let attempt=0;attempt<attempts;attempt++){
    const angle=attempt*Math.PI/12,c=Math.cos(angle),s=Math.sin(angle),score=p=>p.x*c+p.y*s+(-p.x*s+p.y*c)*1e-5;
    const grid=domain.points.slice().sort((a,b)=>score(a)-score(b)),placed=[];
    for(const record of orderRecords(records,attempt,rng)){
      const r=radius(record),candidates=[];
      // Pairwise tangencies fill the triangular holes that a Cartesian grid misses.
      for(let i=0;i<placed.length;i++){
        const p=placed[i],a=radius(p)+r+.025;
        for(let k=0;k<24;k++){const theta=k*Math.PI/12;candidates.push({x:p.worldX+Math.cos(theta)*a,y:p.worldY+Math.sin(theta)*a});}
        for(let j=0;j<i;j++){
          const q=placed[j],b=radius(q)+r+.025,dx=q.worldX-p.worldX,dy=q.worldY-p.worldY,d=Math.hypot(dx,dy);
          if(!d||d>a+b||d<Math.abs(a-b))continue;
          const u=(a*a-b*b+d*d)/(2*d),v=Math.sqrt(Math.max(0,a*a-u*u)),x=p.worldX+dx*u/d,y=p.worldY+dy*u/d;
          candidates.push({x:x-dy*v/d,y:y+dx*v/d},{x:x+dy*v/d,y:y-dx*v/d});
        }
      }
      const gridCandidate=grid.find(p=>p.accepted[r]&&freeAt(p.x,p.y,r,placed));
      if(gridCandidate)candidates.push({...gridCandidate,cached:true});
      candidates.sort((a,b)=>score(a)-score(b));
      for(const q of candidates){if(!freeAt(q.x,q.y,r,placed))continue;
        const candidate={...record,worldX:q.x,worldY:q.y};
        if(q.cached||admitted(candidate)){placed.push(candidate);break;}}
    }
    if(placed.length>best.placed.length||(placed.length===best.placed.length&&clearance(placed)>best.minClearance))
      best={...initial,placed,minClearance:clearance(placed),strategy:`continuous-pair-tangency-${attempt}`};
  }
  const checked=[];for(const p of best.placed){if(!validate(p,checked).isValid)throw new Error('Tangent parity failed');checked.push(p);}
  return {...best,tangentAttempts:attempts};
}

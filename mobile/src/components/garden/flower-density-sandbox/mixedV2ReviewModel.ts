import { composeAllSpecies, generateAllSpeciesLayout } from './allSpeciesReviewModel';
import { getRegionInfo, type DensityFlower } from './flowerDensityModel';
import { classifyMaskArea } from './tulip-components/tulipAreaProfiles';
import { clusterVisualScale } from './tulip-components/clusterVisualScale';
import { seeded } from './tulip-components/tulipComposition';
import { batchSpecies } from './batch-components/batchComposition';
import { buildNeighborhoods, applyNeighborhoodAffinity, isReferenceSpecies } from './mixedNeighborhoods';
import { composeMixedV2Batch, MIXED_V2_WEIGHTS } from './mixedV2Composition';
import type { Composition } from '../flower-visuals/flowerVisualTypes';

export const MIXED_V2_PRESETS=[{month:6,label:'June · Mixed V2 · 30'},
  {month:4,label:'April · Mixed V2 · 30'},{month:10,label:'October · Mixed V2 · 30'}] as const;
const DENSITIES=['sparse','normal','full'] as const;
export function densityCounts(flowers:readonly {composition:{density:Composition}}[]) {
  return flowers.reduce((counts,f)=>(counts[f.composition.density]++,counts),{sparse:0,normal:0,full:0});
}
export function targetDensityCounts(count:number,weights:Record<Composition,number>) {
  const result={sparse:0,normal:0,full:0};
  for(const key of DENSITIES)result[key]=Math.floor(count*weights[key]/100);
  const remainders=[...DENSITIES].sort((a,b)=>(count*weights[b]/100-result[b])-(count*weights[a]/100-result[a]));
  const remaining=count-result.sparse-result.normal-result.full;
  for(let i=0;i<remaining;i++)result[remainders[i%3]]++;
  return result;
}

export function composeMixedV2(flowers:readonly (DensityFlower & {speciesCode:string})[],month:number,override?:Composition) {
  const neighborhoods=buildNeighborhoods(flowers),assigned=applyNeighborhoodAffinity(flowers,neighborhoods);
  const v1=composeAllSpecies(flowers,month,override),byId=new Map(v1.map(f=>[f.id,f]));
  const region=getRegionInfo(month),areaProfile=classifyMaskArea(region.estimatedArea),weights=MIXED_V2_WEIGHTS[areaProfile];
  const targets=targetDensityCounts(flowers.length,weights);
  const frozen=v1.filter(f=>isReferenceSpecies(f.speciesCode)),current=densityCounts(frozen);
  const neighborhoodByFlower=new Map(neighborhoods.flatMap(n=>n.flowerIds.map(id=>[id,n] as const)));
  const priority=(f:typeof assigned[number])=>{
    const n=neighborhoodByFlower.get(f.id)!;
    const members=flowers.filter(member=>n.flowerIds.includes(member.id));
    const radius=Math.max(1,...members.map(member=>Math.hypot(member.worldX-n.x,member.worldY-n.y)));
    return Math.hypot(f.worldX-n.x,f.worldY-n.y)/radius+seeded(`mixed-v2-density:${f.id}`)()*.12;
  };
  const mutable=assigned.filter(f=>!isReferenceSpecies(f.speciesCode)).sort((a,b)=>priority(a)-priority(b)||a.id.localeCompare(b.id));
  const chosen=new Map<string,Composition>();
  // Richer cores, lighter edges. Reference recipes and their existing density
  // assignments are frozen; fill the remaining monthly budget around them.
  for(const f of mutable) {
    const density=override??(['full','normal','sparse'] as const).find(key=>current[key]<targets[key])??'normal';
    chosen.set(f.id,density);current[density]++;
  }
  const composed=assigned.map(f=>{
    if(isReferenceSpecies(f.speciesCode))return byId.get(f.id)!;
    const composition=composeMixedV2Batch(f.id,f.speciesCode,region,chosen.get(f.id)!);
    return {...f,composition,visualScale:clusterVisualScale(batchSpecies(f.speciesCode).baseVisualScale,true,areaProfile)};
  });
  return {flowers:composed,neighborhoods,weights,targets,counts:densityCounts(composed),areaProfile};
}
export function generateMixedV2Review(month:number,count=30) {
  const layout=generateAllSpeciesLayout(month,count);
  return {...layout,...composeMixedV2(layout.flowers,month)};
}

import type { FlowerPlacementRecord } from './plantingPersistence';
import { getFlowerPlacementDefinition } from './flowerFootprintConfig';
import { AVAILABLE_SPECIES } from '../flower-density-sandbox/allSpeciesReviewModel';
import { buildMonthlyGrowth, type GrowthRecord, type MonthlyGrowth } from '../flower-density-sandbox/monthly-growth/monthlyGrowthModel';
import { buildLayeredBed } from '../flower-density-sandbox/monthly-growth/layeredBedModel';
import { alphaAt, type GrowthPiece } from '../flower-density-sandbox/monthly-growth/growthCoverage';
import { bindLandAwareGrowth } from './landAwareGrowth';

// Initial integration: DEV comparison/recovery toggle; release rollout awaits
// manual verification. This flag never changes stored records or collision.
export const USE_MONTHLY_GARDEN_GROWTH_V1_1 = __DEV__;
// Visual composition metadata ONLY. Production planting uses flowerFootprintConfig.
export const VISUAL_CLASS_RADII = {S:9,M:12,L:16} as const;
export interface ProductionMonth {
  month:number; parents:readonly FlowerPlacementRecord[]; growth:MonthlyGrowth;
  unresolved:readonly FlowerPlacementRecord[];
}
const frames=new Map<string,MonthlyGrowth>();
function remember<T>(cache:Map<string,T>,key:string,value:T) {
  cache.set(key,value);if(cache.size>32)cache.delete(cache.keys().next().value!);return value;
}
export function gardenSpecies(record:Pick<FlowerPlacementRecord,'speciesCode'|'flowerName'>) {
  const code=(record.speciesCode||record.flowerName||'').trim().toUpperCase().replace(/[ -]+/g,'_');
  return AVAILABLE_SPECIES.find(s=>s.speciesCode===code)??null;
}
function growthRecord(record:FlowerPlacementRecord):GrowthRecord {
  const species=gardenSpecies(record)!,flowerClass=species.flowerClass as 'S'|'M'|'L';
  return {id:record.id,speciesCode:species.speciesCode,worldX:record.worldX,worldY:record.worldY,flowerClass,
    footprintRadius:VISUAL_CLASS_RADII[flowerClass],scaleVariation:1,rotationDegrees:0,compositionVariant:0};
}
/** Real anchors and their current neighborhood drive the approved bed engine.
 * All children are stateless, seeded and parent-owned. A move can rebuild shared
 * bed growth; no old field, synthetic reference anchors or rendering metadata
 * survive it. The real parent's coordinates are never changed by this adapter. */
export function productionGrowth(parents:readonly FlowerPlacementRecord[]):ProductionMonth[] {
  const groups=new Map<number,FlowerPlacementRecord[]>();
  for(const p of parents){
    if(!Number.isInteger(p.month)||p.month<1||p.month>12||!Number.isFinite(p.worldX)||!Number.isFinite(p.worldY))continue;
    const group=groups.get(p.month)??[];group.push(p);groups.set(p.month,group);
  }
  return [...groups].sort(([a],[b])=>a-b).map(([month,records])=>{
    const sorted=[...records].sort((a,b)=>a.id.localeCompare(b.id));
    const usable=sorted.filter(p=>gardenSpecies(p)),unresolved=sorted.filter(p=>!gardenSpecies(p));
    const pose=JSON.stringify([month,sorted.length,usable.map(p=>[p.id,p.flowerId,p.ownerUserId??'',
      gardenSpecies(p)!.speciesCode,p.worldX,p.worldY,p.scale,p.rotation])]);
    let growth=frames.get(pose);
    if(!growth){
      const base=buildMonthlyGrowth(usable.map(growthRecord),month,sorted.length);
      growth=remember(frames,pose,bindLandAwareGrowth(buildLayeredBed(base,month),sorted,month));
    }
    return {month,parents:records,growth,unresolved};
  });
}
export function parentForGrowthPiece(piece:GrowthPiece,parents:readonly FlowerPlacementRecord[]) {
  return parents.find(p=>p.id===piece.parentId)??null;
}
export function hitProductionFlower(parents:readonly FlowerPlacementRecord[],x:number,y:number) {
  const primary=productionGrowth(parents).flatMap(s=>s.growth.primary).sort((a,b)=>b.worldY-a.worldY||b.id.localeCompare(a.id));
  for(const piece of primary)if(alphaAt(piece,x,y)>.15)return parentForGrowthPiece(piece,parents);
  return [...parents].sort((a,b)=>b.worldY-a.worldY||b.id.localeCompare(a.id)).find(p=>
    Math.hypot(x-p.worldX,y-p.worldY)<=getFlowerPlacementDefinition(p.flowerName).footprintRadius)??null;
}

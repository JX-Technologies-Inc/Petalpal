import { isPointInApprovedMonthMaskWorld } from './approvedPlantingMasks';
import type { FlowerPlacementRecord } from './plantingPersistence';
import { accumulateCoverage, coverageFraction, type GrowthPiece, type MaskSample } from '../flower-density-sandbox/monthly-growth/growthCoverage';
import { getGrowthRegionInfo as getRegionInfo } from '../flower-density-sandbox/monthly-growth/growthStatic';
import type { MonthlyGrowth } from '../flower-density-sandbox/monthly-growth/monthlyGrowthModel';

/** Generation domain, not a rendering clip: origins use approved usable grass.
 * A botanical sprite's pixels are still free to cross this boundary. */
const originDomains=new WeakMap<readonly MaskSample[],Map<string,{x:number;y:number}>>();
export function fitGrowthOrigin(piece:GrowthPiece,month:number,points:readonly MaskSample[]):GrowthPiece {
  let origins=originDomains.get(points);
  if(!origins){origins=new Map();originDomains.set(points,origins);}
  const key=JSON.stringify([month,piece.worldX,piece.worldY]);
  const cached=origins.get(key);
  if(cached)return cached.x===piece.worldX&&cached.y===piece.worldY?piece:{...piece,worldX:cached.x,worldY:cached.y};
  const remember=(point:{x:number;y:number})=>{
    origins.set(key,point);if(origins.size>4096)origins.delete(origins.keys().next().value!);
  };
  if(isPointInApprovedMonthMaskWorld(month,piece.worldX,piece.worldY)){
    remember({x:piece.worldX,y:piece.worldY});return piece;
  }
  if(!points.length)throw new Error(`No approved growth region for month ${month}`);
  let nearest=points[0],distance=Infinity;
  for(const point of points){
    const d=(point.x-piece.worldX)**2+(point.y-piece.worldY)**2;
    if(d<distance){nearest=point;distance=d;}
  }
  remember(nearest);return {...piece,worldX:nearest.x,worldY:nearest.y};
}

/** The bed engine already outputs WORLD-space positions around REAL anchors.
 * Never transplant those offsets from a synthetic reference frame. Only primary
 * local offsets rotate/scale around their parent; shared bed positions stay in
 * land space and rebuild from the current neighborhood on an anchor change. */
export function bindLandAwareGrowth(base:MonthlyGrowth,parents:readonly FlowerPlacementRecord[],month:number):MonthlyGrowth {
  const owners=new Map(parents.map(p=>[p.id,p]));
  const pieces=base.pieces.map(piece=>{
    const parent=owners.get(piece.parentId)!;
    const scale=Number.isFinite(parent.scale)&&parent.scale>0?parent.scale:1;
    const rotation=Number.isFinite(parent.rotation)?parent.rotation*Math.PI/180:0;
    const dx=piece.worldX-parent.worldX,dy=piece.worldY-parent.worldY;
    const transformed={...piece,
      worldX:piece.kind==='primary'?parent.worldX+(dx*Math.cos(rotation)-dy*Math.sin(rotation))*scale:piece.worldX,
      worldY:piece.kind==='primary'?parent.worldY+(dx*Math.sin(rotation)+dy*Math.cos(rotation))*scale:piece.worldY,
      scale:piece.scale*scale,rotation:piece.rotation+rotation};
    return fitGrowthOrigin(transformed,month,base.mask.points);
  });
  const alpha=accumulateCoverage(pieces,base.mask.points),coverage=coverageFraction(alpha);
  return {...base,pieces,primary:pieces.filter(p=>p.kind==='primary'),companions:pieces.filter(p=>p.kind==='companion'),
    filler:pieces.filter(p=>p.kind==='filler'),coverage,
    approvedMaskCoverage:coverage*base.mask.points.length*base.mask.step**2/getRegionInfo(month).estimatedArea,
    coveredSamples:base.mask.points.filter((_,i)=>alpha[i]>=.5),supportTargetIds:parents.map(p=>p.id)};
}

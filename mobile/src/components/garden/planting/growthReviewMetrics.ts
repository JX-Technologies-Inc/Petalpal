import { alphaAt, type GrowthPiece, type MaskSample } from '../flower-density-sandbox/monthly-growth/growthCoverage';
import { GROWTH_COMPONENTS, growthCatalog } from '../flower-density-sandbox/monthly-growth/growthCatalog';
import { bedDepth } from '../flower-density-sandbox/monthly-growth/layeredBedModel';
import type { MonthlyGrowth } from '../flower-density-sandbox/monthly-growth/monthlyGrowthModel';
import { getRegionInfo } from '../flower-density-sandbox/flowerDensityModel';
import { isPointInApprovedMonthMaskWorld } from './approvedPlantingMasks';

export type GrowthHeight='LOW'|'MID'|'TALL';
export const HEIGHT_COLORS={LOW:'#eccf53',MID:'#d775a3',TALL:'#7265c4'};
const categories=new Map(GROWTH_COMPONENTS.map(c=>[`${c.speciesCode}:${c.componentId}`,c.category]));
export function growthHeight(piece:GrowthPiece):GrowthHeight {
  if(piece.kind==='filler'||categories.get(`${piece.speciesCode}:${piece.componentId}`)==='foliage'||['CHAMOMILE','DAISY','ASTER'].includes(piece.speciesCode))return 'LOW';
  return ['HYDRANGEA','LAVENDER','HEATHER','SUNFLOWER','BIRD_OF_PARADISE'].includes(piece.speciesCode)?'TALL':'MID';
}
export function growthSectors(points:readonly MaskSample[]) {
  const xs=points.map(p=>p.x).sort((a,b)=>a-b),depth=bedDepth(points);
  const cuts=[xs[Math.floor(xs.length/3)],xs[Math.floor(xs.length*2/3)]];
  return (p:MaskSample)=>`${p.x<cuts[0]?'LEFT':p.x<cuts[1]?'CENTER':'RIGHT'}_${depth(p)<.5?'BACK':'FRONT'}`;
}
/** DEV measurement of FINAL world-space pixels. Mass is visible src-over alpha
 * attributed in the actual low-underlay / ground-Y draw order, not piece count.
 * It includes only approved grass samples, using the existing 8px alpha atlas. */
export function measureGrowth(growth:MonthlyGrowth,month:number) {
  const sort=(a:GrowthPiece,b:GrowthPiece)=>a.worldY-b.worldY||a.id.localeCompare(b.id);
  const draw=[...growth.filler.filter(p=>!p.baseCover).sort(sort),
    ...[...growth.primary,...growth.companions,...growth.filler.filter(p=>p.baseCover)].sort(sort)];
  const species:Record<string,number>={},height:Record<GrowthHeight,number>={LOW:0,MID:0,TALL:0};
  const sectors:Record<string,{samples:number;covered:number;alphaMass:number}>={};
  const sectorFor=growthSectors(growth.mask.points),cellArea=growth.mask.step**2;
  const prepared=draw.map(p=>{const c=growthCatalog(p.speciesCode).lookup(p.componentId);
    return {p,height:growthHeight(p),radius:Math.hypot(c.canvasWidth,c.canvasHeight)*p.scale};});
  let covered=0,mass=0;
  for(const point of growth.mask.points){
    let remaining=1;
    for(let i=prepared.length-1;i>=0&&remaining>.001;i--){
      const {p,height:layer,radius}=prepared[i];
      if(Math.abs(point.x-p.worldX)>=radius||Math.abs(point.y-p.worldY)>=radius)continue;
      const contribution=alphaAt(p,point.x,point.y)*remaining;
      species[p.speciesCode]=(species[p.speciesCode]??0)+contribution*cellArea;
      height[layer]+=contribution*cellArea;remaining-=contribution;
    }
    const alpha=1-remaining,key=sectorFor(point),s=sectors[key]??{samples:0,covered:0,alphaMass:0};
    s.samples++;s.covered+=Number(alpha>=.5);s.alphaMass+=alpha*cellArea;sectors[key]=s;
    covered+=Number(alpha>=.5);mass+=alpha*cellArea;
  }
  const parents=new Map(growth.records.map(p=>[p.id,p]));
  const distances=growth.pieces.map(p=>{const parent=parents.get(p.parentId)!;
    return Math.hypot(p.worldX-parent.worldX,p.worldY-parent.worldY);}).sort((a,b)=>a-b);
  const fraction=(values:Record<string,number>)=>Object.fromEntries(Object.entries(values).map(([k,v])=>[k,mass?v/mass:0]));
  return {parentCount:growth.records.length,pieceCount:growth.pieces.length,
    botanicalCoverage:covered*cellArea/getRegionInfo(month).estimatedArea,
    sampledCoverage:growth.mask.points.length?covered/growth.mask.points.length:0,
    visibleAlphaArea:mass,heightShare:fraction(height),speciesShare:fraction(species),
    sectors:Object.fromEntries(Object.entries(sectors).sort(([a],[b])=>a.localeCompare(b)).map(([k,s])=>
      [k,{coverage:s.covered/s.samples,alphaMass:s.alphaMass,samples:s.samples}])),
    occupiedSectors:Object.values(sectors).filter(s=>s.covered/s.samples>=.25).length,
    outsideOrigins:growth.pieces.filter(p=>!isPointInApprovedMonthMaskWorld(month,p.worldX,p.worldY)).length,
    distance:{p50:distances[Math.floor(distances.length*.5)]??0,p90:distances[Math.floor(distances.length*.9)]??0,
      max:distances[distances.length-1]??0}};
}

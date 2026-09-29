import samples from './alphaSamples.json';
import { isPointInApprovedMonthMaskWorld } from '../../planting/approvedPlantingMasks';
import { getRegionInfo } from '../flowerDensityModel';
import { growthCatalog } from './growthCatalog';
import staticData from './growthStaticData.json';
export interface GrowthPiece {
  id:string; parentId:string; speciesCode:string; componentId:string;
  kind:'primary'|'companion'|'filler'; worldX:number; worldY:number; scale:number; rotation:number;
  interactive:false;
  /** V1.1 low root cover participates in ground-Y depth, rather than the underlay. */
  baseCover?:boolean;
}
interface AlphaSample {left:number;top:number;width:number;height:number;alpha:number[]}
const ALPHA:Record<string,AlphaSample>=samples.components;
const components=new Map<string,{a:AlphaSample;anchorX:number;anchorY:number;diagonal:number}>();
type Prepared={species:string;component:string;x:number;y:number;scale:number;rotation:number;cos:number;sin:number;
  a:AlphaSample;anchorX:number;anchorY:number;radius:number};
const preparedPieces=new WeakMap<GrowthPiece,Prepared>();
function prepare(piece:GrowthPiece):Prepared {
  const old=preparedPieces.get(piece);
  if(old&&old.x===piece.worldX&&old.y===piece.worldY&&old.scale===piece.scale&&old.rotation===piece.rotation
    &&old.species===piece.speciesCode&&old.component===piece.componentId)return old;
  const key=`${piece.speciesCode}:${piece.componentId}`;
  let c=components.get(key);
  if(!c){const source=growthCatalog(piece.speciesCode).lookup(piece.componentId);
    c={a:ALPHA[key],anchorX:source.anchorX*source.canvasWidth,anchorY:source.anchorY*source.canvasHeight,
      diagonal:Math.hypot(source.canvasWidth,source.canvasHeight)};components.set(key,c);}
  const result={species:piece.speciesCode,component:piece.componentId,x:piece.worldX,y:piece.worldY,scale:piece.scale,
    rotation:piece.rotation,cos:Math.cos(piece.rotation),sin:Math.sin(piece.rotation),...c,radius:c.diagonal*piece.scale};
  preparedPieces.set(piece,result);return result;
}
function sampleAlpha(p:Prepared,x:number,y:number):number {
  const dx=x-p.x,dy=y-p.y;
  // Keep the original floating-point operation order, including division.
  const u=Math.floor(((dx*p.cos+dy*p.sin)/p.scale+p.anchorX)/8)-p.a.left;
  const v=Math.floor(((-dx*p.sin+dy*p.cos)/p.scale+p.anchorY)/8)-p.a.top;
  return u<0||v<0||u>=p.a.width||v>=p.a.height?0:p.a.alpha[v*p.a.width+u]/255;
}
export function alphaAt(piece:GrowthPiece,x:number,y:number):number {
  return sampleAlpha(prepare(piece),x,y);
}
export interface MaskSample {x:number;y:number}
const masks=new Map<number,{path:string;points:MaskSample[];step:number}>();
// Read-only conservative world-pixel clip. Every included cell's center/corners
// pass the approved Final Mask predicate; never substitutes for planting validity.
export function growthMask(month:number) {
  const cached=masks.get(month);if(cached)return cached;
  const baked=(staticData.masks as Record<string,{path:string;points:MaskSample[];step:number}>)[month];
  if(baked){masks.set(month,baked);return baked;}
  return sampleGrowthMask(month);
}
/** Offline regeneration/audit of the EXACT original sampler; not a runtime approximation. */
export function sampleGrowthMask(month:number) {
  const b=getRegionInfo(month).bounds,points:MaskSample[]=[];let path='';
  const inside=(x:number,y:number)=>isPointInApprovedMonthMaskWorld(month,x,y);
  for(let y=Math.floor(b.y);y<b.y+b.height;y++) {
    let start=-1;
    for(let x=Math.floor(b.x);x<=b.x+b.width;x++) {
      const accepted=x<b.x+b.width&&inside(x+.5,y+.5)&&inside(x,y)&&inside(x+1,y)&&inside(x,y+1)&&inside(x+1,y+1)
        &&inside(x+.5,y)&&inside(x+.5,y+1)&&inside(x,y+.5)&&inside(x+1,y+.5);
      if(accepted&&start<0)start=x;
      if(!accepted&&start>=0){path+=`M${start} ${y}h${x-start}v1h${start-x}Z`;start=-1;}
      if(accepted&&x%4===0&&y%4===0)points.push({x:x+.5,y:y+.5});
    }
  }
  const result={path,points,step:4};masks.set(month,result);return result;
}
export function accumulateCoverage(pieces:readonly GrowthPiece[],points:readonly MaskSample[]) {
  const alpha=new Float32Array(points.length);
  for(const piece of pieces)paintCoverage(piece,points,alpha);
  return alpha;
}
export function paintCoverage(piece:GrowthPiece,points:readonly MaskSample[],alpha:Float32Array) {
  const raster=rasterFor(piece,points);
  for(let n=0;n<raster.indices.length;n++){
    const i=raster.indices[n];
    if(alpha[i]<.995)alpha[i]+=raster.values[n]*(1-alpha[i]);
  }
}
export function coverageFraction(alpha:Float32Array) {
  if(!alpha.length)return 0;
  let covered=0;for(let i=0;i<alpha.length;i++)if(alpha[i]>=.5)covered++;
  return covered/alpha.length;
}

interface Raster {indices:number[];values:number[]}
interface SampleIndex {buckets:Map<string,number[]>;minCol:number;maxCol:number;minRow:number;maxRow:number;
  rasters:Map<string,Raster>;objects:WeakMap<GrowthPiece,{prepared:Prepared;raster:Raster}>}
const indexes=new WeakMap<readonly MaskSample[],SampleIndex>();
const stats={gridBuilds:0,rasterBuilds:0,rasterHits:0,objectHits:0,evictions:0};
export const growthCoverageCacheStats=()=>({...stats});
const CELL=32,RASTER_LIMIT=2048;
function rasterFor(piece:GrowthPiece,points:readonly MaskSample[]):Raster {
  let index=indexes.get(points);
  if(!index){const buckets=new Map<string,number[]>();
    let minCol=Infinity,maxCol=-Infinity,minRow=Infinity,maxRow=-Infinity;
    points.forEach((p,i)=>{const col=Math.floor(p.x/CELL),row=Math.floor(p.y/CELL),key=`${col}:${row}`;
      minCol=Math.min(minCol,col);maxCol=Math.max(maxCol,col);minRow=Math.min(minRow,row);maxRow=Math.max(maxRow,row);
      const bucket=buckets.get(key)??[];bucket.push(i);buckets.set(key,bucket);});
    index={buckets,minCol,maxCol,minRow,maxRow,rasters:new Map(),objects:new WeakMap()};indexes.set(points,index);stats.gridBuilds++;}
  const prepared=prepare(piece),object=index.objects.get(piece);
  if(object?.prepared===prepared){stats.objectHits++;return object.raster;}
  const key=JSON.stringify([prepared.species,prepared.component,prepared.x,prepared.y,prepared.scale,prepared.rotation]);
  let raster=index.rasters.get(key);
  if(raster){stats.rasterHits++;}
  else{
    stats.rasterBuilds++;raster={indices:[],values:[]};
    const {x,y,radius}=prepared,indices:number[]=[];
    // Query only occupied grid bounds, including for very large valid visual scales.
    for(let row=Math.max(index.minRow,Math.floor((y-radius)/CELL));row<=Math.min(index.maxRow,Math.floor((y+radius)/CELL));row++)
      for(let col=Math.max(index.minCol,Math.floor((x-radius)/CELL));col<=Math.min(index.maxCol,Math.floor((x+radius)/CELL));col++)
        indices.push(...(index.buckets.get(`${col}:${row}`)??[]));
    indices.sort((a,b)=>a-b);
    for(const i of indices){const p=points[i];
      if(Math.abs(p.x-x)>=radius||Math.abs(p.y-y)>=radius)continue;
      const a=sampleAlpha(prepared,p.x,p.y);
      if(a){raster.indices.push(i);raster.values.push(a);}}
    // Alpha remains double precision until the same original Float32 accumulation.
    index.rasters.set(key,raster);
    if(index.rasters.size>RASTER_LIMIT){index.rasters.delete(index.rasters.keys().next().value!);stats.evictions++;}
  }
  index.objects.set(piece,{prepared,raster});return raster;
}

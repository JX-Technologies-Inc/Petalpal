import { seeded } from '../tulip-components/tulipComposition';
import { GROWTH_COMPONENTS, growthCatalog } from './growthCatalog';
import { accumulateCoverage, coverageFraction, type GrowthPiece, type MaskSample } from './growthCoverage';
import type { MonthlyGrowth } from './monthlyGrowthModel';

const low = (s:string) => ['CHAMOMILE','DAISY','ASTER'].includes(s);
const vertical = (s:string) => ['LAVENDER','HEATHER','BLUEBELL','SUNFLOWER','BIRD_OF_PARADISE','COREOPSIS'].includes(s);
const distance = (a:MaskSample,b:MaskSample) => Math.hypot(a.x-b.x,a.y-b.y);
export function botanicalCenter(p:GrowthPiece):MaskSample {
  const c=growthCatalog(p.speciesCode).lookup(p.componentId),[l,t,r,b]=c.contentBounds;
  const x=((l+r)/2-c.anchorX*c.canvasWidth)*p.scale,y=((t+b)/2-c.anchorY*c.canvasHeight)*p.scale;
  return {x:p.worldX+x*Math.cos(p.rotation)-y*Math.sin(p.rotation),y:p.worldY+x*Math.sin(p.rotation)+y*Math.cos(p.rotation)};
}
function atCenter(p:GrowthPiece,point:MaskSample):GrowthPiece {
  const old=botanicalCenter(p);
  return {...p,worldX:p.worldX+point.x-old.x,worldY:p.worldY+point.y-old.y};
}
// Local world-Y depth follows the curved bed instead of flattening Land06 into
// a rectangular band. Lower Y is the back; higher Y approaches the inner edge.
export function bedDepth(points:readonly MaskSample[]) {
  const columns=new Map<number,{min:number;max:number}>();
  for(const p of points){const key=Math.floor(p.x/16),c=columns.get(key);columns.set(key,{min:Math.min(c?.min??p.y,p.y),max:Math.max(c?.max??p.y,p.y)});}
  return (p:MaskSample)=>{const c=columns.get(Math.floor(p.x/16));return c?Math.max(0,Math.min(1,(p.y-c.min)/Math.max(4,c.max-c.min))):.5;};
}
export const fillerPocket=(p:MaskSample)=>.5+.3*Math.sin(p.x*.047+p.y*.021)+.2*Math.cos(p.x*.023-p.y*.053);
const layeredCache=new WeakMap<MonthlyGrowth,MonthlyGrowth>();
function minimumPoint(points:readonly MaskSample[],score:(p:MaskSample)=>number):MaskSample {
  let best=points[0],bestScore=score(best);
  for(let i=1;i<points.length;i++){
    const value=score(points[i]);if(value<bestScore){best=points[i];bestScore=value;}
  }
  return best;
}
// Static field values and first-in-order tie breaks are identical to the
// original reductions. Cache them independently of moving parent coordinates.
const fields=new WeakMap<readonly MaskSample[],ReturnType<typeof createField>>();
function createField(points:readonly MaskSample[]) {
  const rawDepth=bedDepth(points),depths=new Map(points.map(p=>[p,rawDepth(p)]));
  const pockets=new Map(points.map(p=>[p,fillerPocket(p)]));
  const depth=(p:MaskSample)=>depths.get(p)??rawDepth(p);
  const pocket=(p:MaskSample)=>pockets.get(p)??fillerPocket(p);
  const xs=points.map(p=>p.x).sort((a,b)=>a-b);
  const focalPockets=[.18,.51,.83].map(q=>minimumPoint(points,p=>
    Math.abs(p.x-xs[Math.floor(xs.length*q)])+Math.abs(depth(p)-.42)*80));
  return {depth,pocket,focalPockets,daisyPoints:points.filter(p=>pocket(p)>.6)};
}

/** June Day 30 only. Derives visuals from V1; never calls the planting solver. */
export function buildLayeredBed(base:MonthlyGrowth,month:number):MonthlyGrowth {
  if(month!==6||base.records.length!==30)return base;
  const cached=layeredCache.get(base);if(cached)return cached;
  const points=base.mask.points,parents=new Map(base.records.map(f=>[f.id,f]));
  let field=fields.get(points);if(!field){field=createField(points);fields.set(points,field);}
  const {depth,pocket,focalPockets,daisyPoints}=field;
  const choose=(template:GrowthPiece,index:number,foliage:boolean):GrowthPiece=>{
    const rng=seeded(`layered-art:${template.id}`),all=GROWTH_COMPONENTS.filter(c=>c.speciesCode===template.speciesCode);
    const leaves=all.filter(c=>c.category==='foliage'),small=all.filter(c=>['single','sparse','small','partial','bud'].includes(c.category));
    const pool=foliage&&leaves.length?leaves:small.length?small:all;
    const c=pool[Math.floor(rng()*pool.length)],[l,t,r,b]=c.contentBounds;
    const height=template.kind==='filler'?10+rng()*6:foliage?13+rng()*6:
      low(template.speciesCode)?12+rng()*7:vertical(template.speciesCode)?(index%4===0?36+rng()*9:24+rng()*9):20+rng()*9;
    return {...template,componentId:c.componentId,scale:Math.min(height/(b-t),(template.kind==='filler'?34:42)/(r-l)),rotation:(rng()-.5)*.18};
  };
  const companions=base.companions.map((piece,index)=>{
    const parent=parents.get(piece.parentId)!,rng=seeded(`layered-position:${piece.id}`);
    const heavy=piece.speciesCode==='HYDRANGEA',leaves=heavy&&index%3!==0;
    const template=choose(piece,index,leaves);
    const targetDepth=low(piece.speciesCode)?.68+rng()*.25:vertical(piece.speciesCode)?.12+rng()*.27:.35+rng()*.3;
    const origin=heavy?focalPockets[Math.floor(index/3)%3]:{x:parent.worldX,y:parent.worldY};
    const targetX=origin.x+(rng()-.5)*(heavy?35:105);
    // Neighboring pockets overlap; ownership/species still refer to the original parent.
    const target=minimumPoint(points,p=>Math.abs(p.x-targetX)+Math.abs(depth(p)-targetDepth)*95);
    return atCenter(template,target);
  });
  const neighbors=new Map(base.records.map(parent=>[parent.id,base.records.filter(f=>f.id!==parent.id)
    .sort((a,b)=>Math.hypot(a.worldX-parent.worldX,a.worldY-parent.worldY)-Math.hypot(b.worldX-parent.worldX,b.worldY-parent.worldY))]));
  const filler=base.filler.map((piece,index)=>{
    const rng=seeded(`layered-filler:${piece.id}`),parent=parents.get(piece.parentId)!;
    const nearby=neighbors.get(parent.id)!;
    // Some low leaves cross a neighboring species' roots. They retain their own
    // parent identity; borrowing a position never changes either parent's species.
    const root=index%3===0?(nearby[index%Math.min(4,nearby.length)]??parent):parent;
    const old=botanicalCenter(piece),baseCover=index%4===0;
    const center=baseCover?{x:root.worldX+(rng()-.5)*15,y:root.worldY+2+rng()*6}:old;
    const template=choose(piece,index,true);
    const eligible=piece.speciesCode==='DAISY'&&!baseCover?daisyPoints:points;
    const target=minimumPoint(eligible,p=>distance(p,center)+(1-pocket(p))*22);
    return {...atCenter(template,target),baseCover};
  });
  // Fixed-budget redistribution: preserve V1's measured coverage, never add
  // pieces or raise its target. Moving existing filler can trade crowded overlap
  // for gaps (or vice versa), with a preference for uneven botanical pockets.
  let pieces=[...base.primary,...companions,...filler],alpha=accumulateCoverage(pieces,points);
  const target=base.coverage,tolerance=.012;
  for(let i=0;i<filler.length&&Math.abs(coverageFraction(alpha)-target)>tolerance;i++){
    if(filler[i].baseCover)continue;
    const rng=seeded(`layered-balance:${filler[i].id}`),old=filler[i];
    let best:GrowthPiece=old,bestAlpha=alpha,bestError=Math.abs(coverageFraction(alpha)-target);
    const rest=accumulateCoverage([...base.primary,...companions,...filler.filter((_,j)=>j!==i)],points);
    for(let attempt=0;attempt<12;attempt++){
      const p=points[Math.floor(rng()*points.length)];
      if(pocket(p)<(old.speciesCode==='DAISY'?.6:.28))continue;
      const candidate=atCenter(old,p),trial=new Float32Array(rest);
      // Evaluation uses the same alpha sampler as V1, not a new density target.
      const own=accumulateCoverage([candidate],points);
      for(let j=0;j<trial.length;j++)trial[j]+=own[j]*(1-trial[j]);
      const error=Math.abs(coverageFraction(trial)-target);
      if(error<bestError){best=candidate;bestAlpha=trial;bestError=error;}
    }
    filler[i]={...best,baseCover:old.baseCover};alpha=bestAlpha;
  }
  pieces=[...base.primary,...companions,...filler];
  const coverage=coverageFraction(alpha);
  const result={...base,companions,filler,pieces,coverage,coveredSamples:points.filter((_,i)=>alpha[i]>=.5),
    approvedMaskCoverage:base.approvedMaskCoverage*coverage/base.coverage};
  layeredCache.set(base,result);
  return result;
}

import { generateDensityLayout, DEFAULT_TUNING, type DensityFlower, type FlowerClass } from '../flowerDensityModel';
import { getGrowthRegionInfo as getRegionInfo } from './growthStatic';
import { composeAllSpecies } from '../allSpeciesReviewModel';
import { seeded } from '../tulip-components/tulipComposition';
import { GROWTH_COMPONENTS, growthCatalog } from './growthCatalog';
import { growthMask, accumulateCoverage, paintCoverage, coverageFraction, type GrowthPiece, type MaskSample } from './growthCoverage';

export interface GrowthRecord extends DensityFlower {speciesCode:string}
export const BEAUTY_MIXES:Record<number,Record<string,number>>={
  6:{CHAMOMILE:6,TULIP:6,DAISY:5,LAVENDER:4,POPPY:4,HYDRANGEA:2,COREOPSIS:3},
  4:{CHAMOMILE:6,TULIP:6,DAISY:5,BLUEBELL:4,PETUNIA:4,HYDRANGEA:2,COREOPSIS:3},
  10:{CHAMOMILE:6,TULIP:5,ASTER:5,HEATHER:4,POPPY:5,HYDRANGEA:2,COREOPSIS:3},
};
export const GROWTH_PRESETS=[{month:6,day:5,label:'June — Day 5'},{month:6,day:10,label:'June — Day 10'},
  {month:6,day:20,label:'June — Day 20'},{month:6,day:30,label:'June — Day 30'},
  {month:4,day:30,label:'April — Day 30'},{month:10,day:30,label:'October — Day 30'}] as const;
export const GROWTH_STAGES=[
  {max:5,name:'NEW GARDEN',coverage:.09,reach:.65,companions:2},
  {max:10,name:'EARLY GROWTH',coverage:.22,reach:1,companions:4},
  {max:15,name:'ESTABLISHED',coverage:.38,reach:1.4,companions:6},
  {max:20,name:'LUSH',coverage:.54,reach:1.9,companions:8},
  {max:25,name:'MATURE',coverage:.67,reach:2.3,companions:10},
  {max:30,name:'FULL MONTH',coverage:.78,reach:3,companions:12},
] as const;
export const growthStage=(count:number)=>GROWTH_STAGES.find(s=>count<=s.max)??GROWTH_STAGES[5];
export function growthCoverageTarget(count:number) {
  const index=GROWTH_STAGES.indexOf(growthStage(count)),stage=GROWTH_STAGES[index];
  const previous=index?GROWTH_STAGES[index-1]:{max:0,coverage:0};
  return previous.coverage+(stage.coverage-previous.coverage)*Math.max(0,Math.min(1,(count-previous.max)/(stage.max-previous.max)));
}
const classFor=(species:string):FlowerClass=>species==='HYDRANGEA'?'L':['TULIP','POPPY','PETUNIA'].includes(species)?'M':'S';
const fixtures=new Map<number,GrowthRecord[]>();
// Disposable fixtures, not Journal records. Generate once at 30 and reveal a
// stable prefix, so Day 5/10/20/30 never repacks an existing primary anchor.
export function monthlyGrowthRecords(month:number,count=30):GrowthRecord[] {
  if(!fixtures.has(month)) {
    const mix=BEAUTY_MIXES[month]??BEAUTY_MIXES[6];
    const species=Object.entries(mix).flatMap(([code,n])=>Array<string>(n).fill(code))
      .sort((a,b)=>({L:0,M:1,S:2}[classFor(a)]-{L:0,M:1,S:2}[classFor(b)]));
    const layout=generateDensityLayout(month,30,'mixed',DEFAULT_TUNING,species.map(classFor));
    const records=layout.flowers.map((f,i)=>({...f,id:`growth-${month}-${i+1}`,speciesCode:species[i]}));
    records.sort((a,b)=>seeded(`growth-day:${a.id}`)()-seeded(`growth-day:${b.id}`)());
    fixtures.set(month,records);
  }
  return fixtures.get(month)!.slice(0,Math.max(0,Math.min(30,Math.floor(count)))).map(f=>({...f}));
}
export function primaryHitTarget(records:readonly GrowthRecord[],x:number,y:number):string|null {
  return [...records].sort((a,b)=>b.worldY-a.worldY).find(f=>Math.hypot(x-f.worldX,y-f.worldY)<=f.footprintRadius)?.id??null;
}
export const parentForVisual=(piece:GrowthPiece,records:readonly GrowthRecord[])=>records.find(f=>f.id===piece.parentId)??null;
const candidateFields=new WeakMap<readonly MaskSample[],Map<number,{p:MaskSample;i:number;rank:number;eligible:boolean}[]>>();
function candidatesFor(points:readonly MaskSample[],month:number) {
  let months=candidateFields.get(points);if(!months){months=new Map();candidateFields.set(points,months);}
  let field=months.get(month);
  if(!field){const rng=seeded(`bed-field:${month}`);
    field=points.map((p,i)=>({p,i,rank:rng(),eligible:Math.sin(p.x*.035+month)*Math.cos(p.y*.029)+.5*Math.sin((p.x+p.y)*.047)<1.05}));
    months.set(month,field);}
  return field;
}

export function buildMonthlyGrowth(records:readonly GrowthRecord[],month:number,plantedCount=records.length) {
  const parents=[...records].sort((a,b)=>a.id.localeCompare(b.id)),stage=growthStage(plantedCount),mask=growthMask(month);
  const primary:GrowthPiece[]=composeAllSpecies(parents,month).flatMap(f=>f.composition.parts.map(p=>{
    const c=growthCatalog(f.speciesCode).lookup(p.componentId);
    return {id:`${f.id}:primary:${p.order}`,parentId:f.id,speciesCode:f.speciesCode,componentId:p.componentId,
      kind:'primary' as const,worldX:f.worldX+p.localX*f.visualScale,worldY:f.worldY+p.localY*f.visualScale,
      scale:c.worldUnitsPerPixel*c.defaultVisualScale*p.scale*f.visualScale,rotation:p.rotation,interactive:false as const};
  }));
  const companions:GrowthPiece[]=[],filler:GrowthPiece[]=[];
  const make=(parent:GrowthRecord,kind:'companion'|'filler',index:number,x:number,y:number):GrowthPiece=>{
    const rng=seeded(`${month}:${parent.id}:${kind}:${index}`);
    const all=GROWTH_COMPONENTS.filter(c=>c.speciesCode===parent.speciesCode);
    const foliage=all.filter(c=>['foliage','bud','partial'].includes(c.category));
    const small=all.filter(c=>['single','sparse','small','partial','bud'].includes(c.category));
    const pool=kind==='filler'&&foliage.length?foliage:small.length?small:all;
    const c=pool[Math.floor(rng()*pool.length)],[l,t,r,b]=c.contentBounds;
    const low=['CHAMOMILE','DAISY','ASTER'].includes(parent.speciesCode);
    const tall=['HYDRANGEA','LAVENDER','HEATHER'].includes(parent.speciesCode);
    const height=kind==='filler'?9+rng()*7:low?12+rng()*8:tall?22+rng()*10:18+rng()*10;
    const scale=Math.min(height/(b-t),(kind==='filler'?34:42)/(r-l));
    // Target the visible botanical body, not the padded PNG center. Soil roots
    // remain owned by the parent; these coordinates are never planting anchors.
    return {id:`${parent.id}:${kind}:${index}`,parentId:parent.id,speciesCode:parent.speciesCode,componentId:c.componentId,kind,
      worldX:x-((l+r)/2-c.anchorX*c.canvasWidth)*scale,
      worldY:y-((t+b)/2-c.anchorY*c.canvasHeight)*scale,
      scale,rotation:(rng()-.5)*.16,interactive:false};
  };
  const area=getRegionInfo(month).estimatedArea,spacing=Math.sqrt(area/Math.max(1,records.length));
  for(const parent of parents) {
    const rng=seeded(`companions:${parent.id}`),near=parents.filter(f=>f.id!==parent.id)
      .sort((a,b)=>Math.hypot(a.worldX-parent.worldX,a.worldY-parent.worldY)-Math.hypot(b.worldX-parent.worldX,b.worldY-parent.worldY))[0];
    for(let i=0;i<stage.companions;i++) {
      const angle=rng()*Math.PI*2,radius=(8+rng()*spacing*.45)*Math.min(1,records.length/10);
      const bridge=near&&i%3===0?Math.min(.45,records.length/75):0;
      const x=parent.worldX+Math.cos(angle)*radius+(near?near.worldX-parent.worldX:0)*bridge;
      const y=parent.worldY+Math.sin(angle)*radius+(near?near.worldY-parent.worldY:0)*bridge;
      companions.push(make(parent,'companion',i,x,y));
    }
  }
  const alpha=accumulateCoverage([...primary,...companions],mask.points);
  if(parents.length) {
    const candidates=candidatesFor(mask.points,month).map(({p,i,rank,eligible})=>{
      let parent=parents[0],bestDistance=Math.hypot(parent.worldX-p.x,parent.worldY-p.y);
      for(let j=1;j<parents.length;j++){
        const f=parents[j],d=Math.hypot(f.worldX-p.x,f.worldY-p.y);
        if(d<bestDistance){parent=f;bestDistance=d;}
      }
      return {p,i,rank,eligible,parent};
    })
      .filter(({p,parent,eligible})=>Math.hypot(p.x-parent.worldX,p.y-parent.worldY)<spacing*stage.reach&&eligible)
      .sort((a,b)=>a.rank-b.rank);
    const target=growthCoverageTarget(plantedCount);
    for(const {p,i,parent} of candidates) {
      if(coverageFraction(alpha)>=target||filler.length>=2400)break;
      if(alpha[i]>=.6)continue;
      const piece=make(parent,'filler',i,p.x,p.y);
      filler.push(piece);paintCoverage(piece,mask.points,alpha);
    }
  }
  const pieces=[...primary,...companions,...filler];
  return {records:records.map(f=>({...f})),stage,primary,companions,filler,pieces,mask,
    coverage:coverageFraction(alpha),coveredSamples:mask.points.filter((_,i)=>alpha[i]>=.5),
    approvedMaskCoverage:coverageFraction(alpha)*mask.points.length*mask.step**2/area,
    supportTargetIds:parents.map(f=>f.id),emotionEffects:false as const};
}
export type MonthlyGrowth=ReturnType<typeof buildMonthlyGrowth>;

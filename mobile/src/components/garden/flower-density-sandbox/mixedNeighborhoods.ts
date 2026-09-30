import { seeded } from './tulip-components/tulipComposition';

export interface NeighborhoodFlower { id:string; worldX:number; worldY:number; speciesCode:string; flowerClass:string }
export interface Neighborhood { id:string; flowerIds:string[]; x:number; y:number }
export const isReferenceSpecies = (code:string) => ['TULIP','CHAMOMILE','HYDRANGEA'].includes(code);
const distance = (a:{x:number;y:number},b:{x:number;y:number}) => (a.x-b.x)**2+(a.y-b.y)**2;

// Group existing anchors, never generate or relocate an anchor. Capacity constraints
// prevent one broad group and many isolated singles on irregular approved masks.
export function buildNeighborhoods(flowers:readonly NeighborhoodFlower[]):Neighborhood[] {
  if (!flowers.length) return [];
  const points=[...flowers].sort((a,b)=>a.id.localeCompare(b.id)).map(f=>({id:f.id,x:f.worldX,y:f.worldY}));
  const k=Math.min(7,Math.max(1,Math.round(points.length/5)));
  const centers=[points[Math.floor(seeded(`mixed-neighborhoods:${points[0].id}`)()*points.length)]];
  while(centers.length<k) centers.push([...points].sort((a,b)=>
    Math.min(...centers.map(c=>distance(b,c)))-Math.min(...centers.map(c=>distance(a,c))) || a.id.localeCompare(b.id))[0]);
  const capacities=Array.from({length:k},(_,i)=>Math.floor(points.length/k)+Number(i<points.length%k));
  if(points.length===30) capacities.splice(0,k,5,6,4,5,4,6);
  let groups:typeof points[]=centers.map(()=>[]);
  for(let iteration=0;iteration<10;iteration++) {
    groups=centers.map(()=>[]);
    const pairs=points.flatMap((p,pi)=>centers.map((c,ci)=>({pi,ci,cost:distance(p,c)})))
      .sort((a,b)=>a.cost-b.cost || a.pi-b.pi || a.ci-b.ci);
    const assigned=new Set<number>();
    for(const {pi,ci} of pairs) if(!assigned.has(pi)&&groups[ci].length<capacities[ci]) {
      groups[ci].push(points[pi]);assigned.add(pi);
    }
    groups.forEach((g,i)=>{centers[i]={id:centers[i].id,x:g.reduce((s,p)=>s+p.x,0)/g.length,y:g.reduce((s,p)=>s+p.y,0)/g.length};});
  }
  // Pair exchanges improve compactness without breaking the 4–6 member capacities.
  const cost=(g:typeof points)=>{const x=g.reduce((s,p)=>s+p.x,0)/g.length,y=g.reduce((s,p)=>s+p.y,0)/g.length;return g.reduce((s,p)=>s+distance(p,{x,y}),0);};
  for(let pass=0;pass<20;pass++) {
    let best=0,swap:number[]|undefined;
    for(let a=0;a<k;a++)for(let b=a+1;b<k;b++)for(let i=0;i<groups[a].length;i++)for(let j=0;j<groups[b].length;j++) {
      const ga=[...groups[a]],gb=[...groups[b]],before=cost(ga)+cost(gb);
      [ga[i],gb[j]]=[gb[j],ga[i]];const gain=before-cost(ga)-cost(gb);
      if(gain>best+1e-6){best=gain;swap=[a,b,i,j];}
    }
    if(!swap)break;
    const [a,b,i,j]=swap;[groups[a][i],groups[b][j]]=[groups[b][j],groups[a][i]];
  }
  return groups.map((g,i)=>({id:`neighborhood-${i+1}`,flowerIds:g.map(p=>p.id).sort(),
    x:g.reduce((s,p)=>s+p.x,0)/g.length,y:g.reduce((s,p)=>s+p.y,0)/g.length}));
}

const COMPANIONS=[['TULIP','CHAMOMILE','BLUEBELL'],['DAISY','LAVENDER','WHITE_ROSE'],
  ['COREOPSIS','BLUEBELL','YELLOW_RAPESEED_FLOWER'],['POPPY','DAISY','ASTER','CHAMOMILE'],
  ['HYDRANGEA','CHAMOMILE','SNOWDROP'],['ANEMONE','HEATHER','GENTIAN'],
  ['SUNFLOWER','COREOPSIS','DANDELION'],['BIRD_OF_PARADISE','OLIVE','PETUNIA'],['YELLOW_DAFFODIL','SNOWDROP','CHINESE_VIOLET_CRESS']];
export function affinityScore(flowers:readonly NeighborhoodFlower[],neighborhoods:readonly Neighborhood[]) {
  const byId=new Map(flowers.map(f=>[f.id,f]));
  return neighborhoods.reduce((total,n)=>{
    const members=n.flowerIds.map(id=>byId.get(id)!);
    let value=-8*Math.max(0,new Set(members.map(f=>f.speciesCode)).size-4);
    for(let i=0;i<members.length;i++)for(const b of members.slice(i+1)) {
      const a=members[i],compatible=a.speciesCode===b.speciesCode?1.3:
        COMPANIONS.some(c=>c.includes(a.speciesCode)&&c.includes(b.speciesCode))?1:0;
      value+=compatible/(1+Math.hypot(a.worldX-b.worldX,a.worldY-b.worldY)/40);
    }
    return total+value;
  },0);
}

// DEV preview assignment only: exchange non-reference species within a class.
// Monthly species totals, reference identities, IDs, positions and radii stay fixed.
export function applyNeighborhoodAffinity<T extends NeighborhoodFlower>(flowers:readonly T[],neighborhoods:readonly Neighborhood[]):T[] {
  const result=[...flowers].sort((a,b)=>a.id.localeCompare(b.id)).map(f=>({...f}));
  const eligible=result.map((f,i)=>i).filter(i=>result[i].flowerClass!=='L'&&!isReferenceSpecies(result[i].speciesCode));
  for(let pass=0;pass<40;pass++) {
    let best=affinityScore(result,neighborhoods),swap:number[]|undefined;
    for(let ai=0;ai<eligible.length;ai++)for(const j of eligible.slice(ai+1)) {
      const i=eligible[ai];if(result[i].flowerClass!==result[j].flowerClass||result[i].speciesCode===result[j].speciesCode)continue;
      [result[i].speciesCode,result[j].speciesCode]=[result[j].speciesCode,result[i].speciesCode];
      const score=affinityScore(result,neighborhoods);
      [result[i].speciesCode,result[j].speciesCode]=[result[j].speciesCode,result[i].speciesCode];
      if(score>best+1e-7){best=score;swap=[i,j];}
    }
    if(!swap)break;
    const [i,j]=swap;[result[i].speciesCode,result[j].speciesCode]=[result[j].speciesCode,result[i].speciesCode];
  }
  const byId=new Map(result.map(f=>[f.id,f]));
  return flowers.map(f=>byId.get(f.id)!);
}

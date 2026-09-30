import manifest from './componentManifest.json';
import { seeded, clusterBounds, type ComponentPart } from '../tulip-components/tulipComposition';
import { selectAreaComposition, DEFAULT_AREA_PROFILES } from '../tulip-components/tulipAreaProfiles';
import type { DensityRegionInfo } from '../flowerDensityModel';
import type { Composition } from '../../flower-visuals/flowerVisualTypes';

export const COMPONENTS=manifest.components;
export const HYDRANGEA_RADIUS=16;
export const DENSITY_HEADS: Record<Composition,readonly [number,number]>={sparse:[1,1],normal:[1,2],full:[2,3]};
export function componentById(id:string) {
  const component=COMPONENTS.find(c=>c.componentId===id);
  if(!component)throw new Error(`Unknown Hydrangea component: ${id}`);
  return component;
}

/** DEV base-species recipe; all art colors are supplied pixels, never emotion effects. */
export function composeHydrangea(flowerId:string,region:Pick<DensityRegionInfo,'month'|'landId'|'estimatedArea'>,
  densityOverride?:Composition) {
  const {areaProfile,profile,density}=selectAreaComposition(flowerId,region,DEFAULT_AREA_PROFILES,densityOverride,'HYDRANGEA');
  const random=seeded(`hydrangea-components-v2:${flowerId}:${density}`);
  const bloomCount=density==='sparse'?1:density==='normal'?(random()<.35?2:1):(random()<.15?3:2);
  const palette=['blue','pink','lavender'] as const;
  const colorFamily=palette[Math.floor(random()*palette.length)];
  const mixed=bloomCount>1 && random()<.25;
  const used=new Set<string>(),parts:ComponentPart[]=[];
  const choose=(pool:typeof COMPONENTS)=>{
    const fresh=pool.filter(c=>!used.has(c.componentId)),options=fresh.length?fresh:pool;
    const c=options[Math.floor(random()*options.length)];used.add(c.componentId);return c;
  };
  const mirror=random()<.5?-1:1;
  const add=(c:typeof COMPONENTS[number],x:number,y:number,scale:number,support=false)=>{
    parts.push({componentId:c.componentId,localX:x*profile.spread,localY:y*profile.spread,
      scale,rotation:(random()-.5)*(support?12:8)*Math.PI/180,order:parts.length});
  };
  // A small fraction of two-head identities reuse the source's asymmetric patches.
  // Most objects are built from partial/side blooms with staggered size and depth.
  const sourcePatch=bloomCount===2 && (mixed || colorFamily==='lavender') && random()<.15;
  if(sourcePatch){
    add(choose(COMPONENTS.filter(c=>c.category==='asymmetric' && c.colorFamily===(mixed?'mixed':'lavender'))),
      (random()-.5)*2,(random()-.5)*2,.65+random()*.12);
  } else {
    for(let i=0;i<bloomCount;i++){
      const color=mixed && i>0?palette[(palette.indexOf(colorFamily)+1+Math.floor(random()*2))%3]:colorFamily;
      const category=i>0 || density==='sparse' || random()<.8?'partial':'head';
      const c=choose(COMPONENTS.filter(c=>c.category===category && c.colorFamily===color));
      const x=i===0?(random()-.5)*2:i===1?mirror*(2.5+random()*3):-mirror*(1+random()*2);
      const y=i===0?-.5+random():i===1?.8+random()*.5:-1.3+random()*.5;
      const size=i===0?.85+random()*.13:i===1?.58+random()*.2:.48+random()*.14;
      add(c,x,y,size);
    }
  }
  // Always give the main bloom a rooted foliage companion; no floating head-only object.
  const foliageCount=density==='full'?2:1;
  for(let i=0;i<foliageCount;i++)add(choose(COMPONENTS.filter(c=>c.category==='foliage')),
    mirror*(i===0?-1:1)*(1+random()*2),.8+random()*.8,.38+random()*.12,true);
  if(random()<(density==='sparse'?.5:.3))add(choose(COMPONENTS.filter(c=>c.category==='bud')),
    -mirror*(1+random()*2),-.5+random(),.4+random()*.14,true);
  parts.sort((a,b)=>a.localY-b.localY || a.order-b.order);
  return {flowerId,density,colorFamily:mixed?'mixed':colorFamily,bloomCount,footprintRadius:HYDRANGEA_RADIUS,
    plantingObjectCount:1 as const,secondaryEmotions:[] as const,parts,bounds:clusterBounds(parts,componentById),
    areaProfile,internalSpread:profile.spread,compositionWeights:{...profile.weights}};
}

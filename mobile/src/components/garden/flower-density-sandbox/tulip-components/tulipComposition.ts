import manifest from './componentManifest.json';
import { compositionForId } from '../../flower-visuals/flowerVisualResolver';
import type { Composition } from '../../flower-visuals/flowerVisualTypes';

export type ColorFamily = 'pink-only' | 'yellow-only' | 'pink-dominant' | 'yellow-dominant' | 'mixed';
export const COLOR_WEIGHTS: Record<ColorFamily, number> = {
  'pink-only': .25, 'yellow-only': .20, 'pink-dominant': .25, 'yellow-dominant': .15, mixed: .15,
};
export const DENSITY_BLOOMS: Record<Composition, readonly [number, number]> = {
  sparse: [1, 2], normal: [2, 3], full: [3, 5],
};
export const COMPONENTS = manifest.components;
export type TulipComponent = typeof COMPONENTS[number];
export interface ComponentPart {
  componentId: string; localX: number; localY: number; scale: number; rotation: number; order: number;
}
export interface Bounds { x: number; y: number; width: number; height: number }
export interface TulipComposition {
  flowerId: string; density: Composition; colorFamily: ColorFamily; bloomCount: number;
  footprintRadius: 12; plantingObjectCount: 1; secondaryEmotions: readonly [];
  parts: ComponentPart[]; bounds: Bounds;
}

export function seeded(seed: string) {
  let state = 2166136261;
  for (let i=0;i<seed.length;i++) state = Math.imul(state ^ seed.charCodeAt(i),16777619) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function componentById(id: string) {
  const component = COMPONENTS.find(c => c.componentId === id);
  if (!component) throw new Error(`Unknown Tulip component: ${id}`);
  return component;
}
// Bounds use visible alpha content, not the 512px padded canvas or soil footprint.
export type ComponentGeometry = Pick<TulipComponent, 'worldUnitsPerPixel' | 'defaultVisualScale' | 'contentBounds' | 'anchorX' | 'anchorY' | 'canvasWidth' | 'canvasHeight'>;
export function partBounds(part: ComponentPart, lookup: (id: string) => ComponentGeometry = componentById): Bounds {
  const c = lookup(part.componentId), s = c.worldUnitsPerPixel * c.defaultVisualScale * part.scale;
  const [left, top, right, bottom] = c.contentBounds;
  const cos = Math.cos(part.rotation), sin = Math.sin(part.rotation);
  const points = [[left,top],[right,top],[right,bottom],[left,bottom]].map(([x,y]) => {
    const dx = (x-c.anchorX*c.canvasWidth)*s, dy = (y-c.anchorY*c.canvasHeight)*s;
    return { x: part.localX + dx*cos-dy*sin, y: part.localY+dx*sin+dy*cos };
  });
  const x = Math.min(...points.map(p=>p.x)), y = Math.min(...points.map(p=>p.y));
  return { x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y };
}
export function clusterBounds(parts: readonly ComponentPart[], lookup: (id: string) => ComponentGeometry = componentById): Bounds {
  const boxes=parts.map(part=>partBounds(part,lookup)), x=Math.min(...boxes.map(b=>b.x)), y=Math.min(...boxes.map(b=>b.y));
  return {x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};
}

// DEV neutral-art rules only. Never called by production planting or backend semantics.
export function composeTulip(flowerId: string, densityOverride?: Composition): TulipComposition {
  const density=densityOverride ?? compositionForId(flowerId);
  const rng=seeded(`tulip-components-v2:${flowerId}:${density}`);
  let draw=rng(), colorFamily: ColorFamily='mixed';
  for(const [family,weight] of Object.entries(COLOR_WEIGHTS)) {
    draw-=weight;if(draw<0){colorFamily=family as ColorFamily;break;}
  }
  const [min,max]=DENSITY_BLOOMS[density];
  let bloomCount=min+Math.floor(rng()*(max-min+1));
  // A visibly mixed/dominant identity needs both colors; sparse remains within 1–2.
  if(!colorFamily.endsWith('-only')) bloomCount=Math.max(2,bloomCount);
  const pinkCount=colorFamily==='pink-only'?bloomCount:colorFamily==='yellow-only'?0:
    colorFamily==='pink-dominant'?Math.min(bloomCount-1,Math.ceil(bloomCount*.7)):
    colorFamily==='yellow-dominant'?Math.max(1,Math.floor(bloomCount*.3)):Math.ceil(bloomCount/2);
  const colors: string[]=Array.from({length:bloomCount},(_,i)=>i<pinkCount?'pink':'yellow');
  for(let i=colors.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[colors[i],colors[j]]=[colors[j],colors[i]];}
  const parts: ComponentPart[]=[], used=new Set<string>();
  const choose=(pool:TulipComponent[])=>{
    const fresh=pool.filter(c=>!used.has(c.componentId));const options=fresh.length?fresh:pool;
    const c=options[Math.floor(rng()*options.length)];used.add(c.componentId);return c;
  };
  const add=(c:TulipComponent,foliage=false)=>{
    let x=0,y=0;
    for(let attempt=0;attempt<16;attempt++) {
      x=(rng()-.5)*(density==='sparse'?7:12);y=(rng()-.5)*5;
      if(foliage || parts.every(p=>Math.hypot(x-p.localX,y-p.localY)>1.6))break;
    }
    const dominant=colorFamily==='pink-dominant'?'pink':colorFamily==='yellow-dominant'?'yellow':null;
    const emphasis=dominant && c.dominantColorFamily!==dominant ? .93 : 1;
    parts.push({componentId:c.componentId,localX:x,localY:foliage?y+1:y,
      scale:foliage ? .42+rng()*.15 : (.88+rng()*.18)*emphasis,
      rotation:(rng()-.5)*(foliage?20:c.category==='small'?8:14)*Math.PI/180,order:parts.length});
  };
  // Occasional two-bloom component plus independently arranged stems. Medium/full
  // extracted references are retained for review, not repeated as the final prefab.
  if(bloomCount>=3 && rng()<.3) {
    const family=colors[0]===colors[1]?colors[0]:'mixed';
    add(choose(COMPONENTS.filter(c=>c.category==='small' && c.dominantColorFamily===family)));
    colors.splice(0,2);
  }
  for(const color of colors) add(choose(COMPONENTS.filter(c=>c.category==='single' && c.dominantColorFamily===color)));
  const foliageCount=density==='sparse'?(rng()<.25?1:0):density==='normal'?1:1+Math.floor(rng()*2);
  for(let i=0;i<foliageCount;i++)add(choose(COMPONENTS.filter(c=>c.category==='foliage')),true);
  parts.sort((a,b)=>a.localY-b.localY || a.order-b.order);
  return {flowerId,density,colorFamily,bloomCount,footprintRadius:12,plantingObjectCount:1,
    secondaryEmotions:[],parts,bounds:clusterBounds(parts)};
}

import { BATCH_COMPONENTS, batchSpecies, batchComponentById } from './batch-components/batchComposition';
import { seeded, clusterBounds, type ComponentPart } from './tulip-components/tulipComposition';
import { classifyMaskArea, DEFAULT_AREA_PROFILES } from './tulip-components/tulipAreaProfiles';
import type { DensityRegionInfo } from './flowerDensityModel';
import type { Composition } from '../flower-visuals/flowerVisualTypes';

type Range=readonly [number,number];
interface Recipe { unit:string; sparse:Range; normal:Range; full:Range; upright?:boolean }
export const MIXED_V2_RECIPES:Record<string,Recipe>={
  DAISY:{unit:'heads',sparse:[2,3],normal:[4,6],full:[6,9]},
  COREOPSIS:{unit:'open heads',sparse:[2,3],normal:[3,5],full:[5,8]},
  ASTER:{unit:'open heads',sparse:[2,3],normal:[4,6],full:[6,9]},
  DANDELION:{unit:'flower/seed heads',sparse:[1,2],normal:[2,4],full:[4,6]},
  BLUEBELL:{unit:'bell stems',sparse:[1,2],normal:[2,3],full:[3,5]},
  HEATHER:{unit:'sprays',sparse:[1,2],normal:[2,4],full:[4,6],upright:true},
  LAVENDER:{unit:'spikes',sparse:[1,2],normal:[2,4],full:[4,6],upright:true},
  YELLOW_RAPESEED_FLOWER:{unit:'flowering stems',sparse:[1,2],normal:[2,4],full:[4,6],upright:true},
  SNOWDROP:{unit:'rooted bell groups',sparse:[1,2],normal:[2,3],full:[3,4],upright:true},
  CHINESE_VIOLET_CRESS:{unit:'flowering stems',sparse:[1,2],normal:[2,4],full:[4,6]},
  GERBERA_DAISY:{unit:'heads',sparse:[1,1],normal:[2,2],full:[2,3]},
  ANEMONE:{unit:'heads',sparse:[1,2],normal:[2,3],full:[3,4]},
  GENTIAN:{unit:'open trumpets',sparse:[1,2],normal:[2,3],full:[3,4],upright:true},
  PETUNIA:{unit:'open heads',sparse:[1,2],normal:[2,3],full:[3,5]},
  POPPY:{unit:'open heads',sparse:[1,2],normal:[2,3],full:[3,4]},
  WHITE_ROSE:{unit:'open heads',sparse:[1,1],normal:[1,2],full:[2,3]},
  YELLOW_DAFFODIL:{unit:'trumpet stems',sparse:[1,2],normal:[2,3],full:[3,4],upright:true},
  SUNFLOWER:{unit:'heads',sparse:[1,1],normal:[1,2],full:[2,2]},
  BIRD_OF_PARADISE:{unit:'architectural stems',sparse:[1,1],normal:[1,1],full:[1,2]},
  OLIVE:{unit:'foliage branches',sparse:[1,1],normal:[1,2],full:[2,3]},
};
// Visible units in intact supplied pieces, not collision objects. Multi-head/spike
// pieces contribute their full count so richness never blindly multiplies prefabs.
const MULTI_UNITS:Record<string,number>={
  'daisy/single/branching':2,'daisy/single/side':2,'coreopsis/sparse/branching':2,
  'dandelion/single/yellow':2,'petunia/single/branching':2,
  'lavender/single/left':3,'lavender/single/right':2,
  'yellow_rapeseed_flower/single/branching':2,'yellow_rapeseed_flower/single/side':2,
};
export function componentVisualUnits(id:string) {
  const component=batchComponentById(id);
  return ['foliage','bud'].includes(component.category)?0:MULTI_UNITS[id]??1;
}
export const MIXED_V2_WEIGHTS={
  SMALL:{sparse:15,normal:60,full:25},MEDIUM:{sparse:15,normal:50,full:35},LARGE:{sparse:15,normal:45,full:40},
} as const;
export function composeMixedV2Batch(flowerId:string,speciesCode:string,region:DensityRegionInfo,density:Composition) {
  const recipe=MIXED_V2_RECIPES[speciesCode];if(!recipe)throw new Error(`No Mixed V2 recipe: ${speciesCode}`);
  const species=batchSpecies(speciesCode),areaProfile=classifyMaskArea(region.estimatedArea);
  const spread=DEFAULT_AREA_PROFILES[areaProfile].spread,rng=seeded(`mixed-v2:${flowerId}:${speciesCode}:${density}`);
  const [min,max]=recipe[density],target=min+Math.floor(rng()*(max-min+1));
  const pieces=BATCH_COMPONENTS.filter(c=>c.speciesCode===speciesCode),parts:ComponentPart[]=[];
  let remaining=target;
  const used=new Set<string>();
  const add=(id:string,companion=false)=>{
    const span=Math.min(species.footprintRadius*1.85,5+Math.sqrt(target)*4)*spread;
    let x=0,y=0;
    if(parts.length)for(let attempt=0;attempt<16;attempt++){
      x=(rng()-.5)*span;y=(rng()-.5)*(recipe.upright?4:6)*spread;
      if(parts.every(p=>Math.hypot(x-p.localX,y-p.localY)>2.5))break;
    }
    parts.push({componentId:id,localX:x,localY:y,scale:companion?.8+rng()*.12:.96+rng()*.16,
      rotation:(rng()-.5)*(recipe.upright?6:12)*Math.PI/180,order:parts.length});used.add(id);
  };
  while(remaining>0) {
    let pool=pieces.filter(c=>componentVisualUnits(c.componentId)>0&&componentVisualUnits(c.componentId)<=remaining);
    // A Sparse one-head Dandelion can use the supplied seed stem; never crop a
    // two-head source into a fabricated single head to meet an integer target.
    if(speciesCode==='DANDELION'&&remaining>=2&&rng()<.9)pool=pool.filter(c=>!c.componentId.endsWith('seed_head'));
    const fresh=pool.filter(c=>!used.has(c.componentId)),choices=fresh.length?fresh:pool;
    const component=choices[Math.floor(rng()*choices.length)];
    if(!component)throw new Error(`Cannot satisfy intact component budget: ${speciesCode}/${remaining}`);
    add(component.componentId);remaining-=componentVisualUnits(component.componentId);
  }
  const companions=pieces.filter(c=>componentVisualUnits(c.componentId)===0);
  if(companions.length&&density!=='sparse'&&rng()<.3)add(companions[Math.floor(rng()*companions.length)].componentId,true);
  parts.sort((a,b)=>a.localY-b.localY||a.order-b.order);
  return {flowerId,speciesCode,density,parts,visualUnitCount:target,visualUnit:recipe.unit,
    footprintRadius:species.footprintRadius,plantingObjectCount:1 as const,secondaryEmotions:[] as const,
    bounds:clusterBounds(parts,batchComponentById),areaProfile,internalSpread:spread,
    compositionWeights:MIXED_V2_WEIGHTS[areaProfile]};
}

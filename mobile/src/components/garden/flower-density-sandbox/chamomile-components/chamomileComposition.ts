import manifest from './componentManifest.json';
import { seeded, clusterBounds, type ComponentPart } from '../tulip-components/tulipComposition';
import { selectAreaComposition, DEFAULT_AREA_PROFILES } from '../tulip-components/tulipAreaProfiles';
import type { DensityRegionInfo } from '../flowerDensityModel';
import type { Composition } from '../../flower-visuals/flowerVisualTypes';

export const COMPONENTS = manifest.components;
export const CHAMOMILE_RADIUS = 9;
export const DENSITY_BLOOMS: Record<Composition, readonly [number, number]> = {
  sparse: [2, 4], normal: [4, 7], full: [7, 11],
};
export function componentById(id: string) {
  const component = COMPONENTS.find(c=>c.componentId===id);
  if (!component) throw new Error(`Unknown Chamomile component: ${id}`);
  return component;
}

/** Species recipe only: shared seeded generator, area selection, bounds and renderer. */
export function composeChamomile(flowerId: string, region: Pick<DensityRegionInfo,'month'|'landId'|'estimatedArea'>,
  densityOverride?: Composition) {
  const { areaProfile, profile, density } = selectAreaComposition(flowerId,region,DEFAULT_AREA_PROFILES,densityOverride,'CHAMOMILE');
  const random = seeded(`chamomile-components-v1:${flowerId}:${density}`);
  const [min,max] = DENSITY_BLOOMS[density];
  const bloomCount = min + Math.floor(random()*(max-min+1));
  const parts: ComponentPart[] = [], used = new Set<string>();
  const choose = (pool: typeof COMPONENTS) => {
    const fresh = pool.filter(c=>!used.has(c.componentId));
    const options = fresh.length ? fresh : pool;
    const component = options[Math.floor(random()*options.length)]; used.add(component.componentId);
    return component;
  };
  const add = (component: typeof COMPONENTS[number], foliage = false) => {
    const spread = density==='sparse'?4:density==='normal'?6:8;
    parts.push({componentId:component.componentId,
      localX:(random()-.5)*spread*profile.spread, localY:((random()-.5)*3+(foliage?1:0))*profile.spread,
      scale:foliage?.45+random()*.1:.88+random()*.12,
      rotation:(random()-.5)*(component.category==='single'?12:6)*Math.PI/180,order:parts.length});
  };
  let remaining = bloomCount;
  // Existing airy clusters supply the core; single stems vary its silhouette.
  const category = density==='sparse'?'small':density==='normal'?'medium':'full';
  const core = choose(COMPONENTS.filter(c=>c.category===category && c.bloomCount>=2 && c.bloomCount<=remaining));
  add(core); remaining -= core.bloomCount;
  for (let i=0;i<remaining;i++) add(choose(COMPONENTS.filter(c=>c.category==='single' && c.bloomCount===1)));
  if (density!=='full' && random()<.2) add(choose(COMPONENTS.filter(c=>c.category==='foliage' && c.bloomCount===0)),true);
  parts.sort((a,b)=>a.localY-b.localY || a.order-b.order);
  return {flowerId,density,bloomCount,footprintRadius:CHAMOMILE_RADIUS,plantingObjectCount:1 as const,
    secondaryEmotions:[] as const,parts,bounds:clusterBounds(parts,componentById),areaProfile,
    internalSpread:profile.spread,compositionWeights:{...profile.weights}};
}

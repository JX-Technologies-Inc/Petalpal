import manifest from './componentManifest.json';
import { clusterBounds, seeded, type ComponentPart } from '../tulip-components/tulipComposition';
import { selectAreaComposition } from '../tulip-components/tulipAreaProfiles';
import type { DensityRegionInfo } from '../flowerDensityModel';
import type { Composition } from '../../flower-visuals/flowerVisualTypes';

export const BATCH_SPECIES = manifest.species;
export const BATCH_COMPONENTS = manifest.components;
export function batchComponentById(id: string) {
  const component = BATCH_COMPONENTS.find(c => c.componentId === id);
  if (!component) throw new Error(`Unknown batch component: ${id}`);
  return component;
}
export function batchSpecies(code: string) {
  const species = BATCH_SPECIES.find(s => s.speciesCode === code);
  if (!species) throw new Error(`Unavailable Garden candidate: ${code}`);
  return species;
}

// DEV only: neutral source pixels, one soil anchor/footprint regardless of part count.
export function composeBatchFlower(flowerId: string, speciesCode: string, region: DensityRegionInfo, override?: Composition) {
  const species = batchSpecies(speciesCode);
  const {areaProfile, profile, density} = selectAreaComposition(flowerId, region, undefined, override, speciesCode);
  const rng = seeded(`garden-batch:${speciesCode}:${flowerId}:${density}`);
  const pieces = BATCH_COMPONENTS.filter(c => c.speciesCode === speciesCode);
  const mains = pieces.filter(c => !['bud','foliage'].includes(c.category));
  const accessories = pieces.filter(c => ['bud','foliage'].includes(c.category));
  const count = species.pieceCounts[density], used = new Set<string>();
  const parts: ComponentPart[] = [];
  for (let i = 0; i < count; i++) {
    // Always a soil-rooted main. Buds/foliage are companions, never the sole plant.
    let pool = i > 0 && accessories.length && rng() < .28 ? accessories : mains;
    if (speciesCode === 'DANDELION' && rng() < .82) {
      const yellowOrCompanions = pool.filter(c => !c.componentId.endsWith('seed_head'));
      if (yellowOrCompanions.length) pool = yellowOrCompanions;
    }
    const fresh = pool.filter(c => !used.has(c.componentId));
    const choices = fresh.length ? fresh : pool;
    const component = choices[Math.floor(rng() * choices.length)];
    used.add(component.componentId);
    // Narrow spike species retain upright silhouettes; offsets only spread local roots.
    const upright = ['LAVENDER','HEATHER','SNOWDROP','YELLOW_DAFFODIL'].includes(speciesCode);
    const span = density === 'sparse' ? 3 : upright ? 6 : 9;
    parts.push({componentId:component.componentId,
      localX:(rng()-.5)*span*profile.spread, localY:(rng()-.5)*3*profile.spread,
      scale:(density === 'sparse' ? .87 : density === 'normal' ? .95 : 1)*( .94 + rng()*.12),
      rotation:(rng()-.5)*(upright ? 6 : 12)*Math.PI/180, order:i});
  }
  parts.sort((a,b) => a.localY-b.localY || a.order-b.order);
  return {flowerId, speciesCode, density, parts, partCount:parts.length,
    footprintRadius:species.footprintRadius, plantingObjectCount:1 as const, secondaryEmotions:[] as const,
    bounds:clusterBounds(parts,batchComponentById), areaProfile, maskArea:region.estimatedArea,
    internalSpread:profile.spread, compositionWeights:{...profile.weights}};
}

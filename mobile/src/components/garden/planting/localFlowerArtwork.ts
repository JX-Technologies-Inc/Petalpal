import { GROWTH_COMPONENTS, growthCatalog } from '../flower-density-sandbox/monthly-growth/growthCatalog';

/** Presentation lookup only. Unknown species keep their existing source art. */
export function localFlowerArtwork(speciesCode?: string, flowerName?: string) {
  const code = (speciesCode || flowerName || '').trim().toUpperCase().replace(/[ -]+/g, '_');
  const component = GROWTH_COMPONENTS.find(candidate => candidate.speciesCode === code
    && !['foliage', 'bud'].includes(candidate.category) && !/(?:^|[/_])bud/.test(candidate.componentId));
  return component ? { component, source: growthCatalog(code).images[component.componentId] } : null;
}

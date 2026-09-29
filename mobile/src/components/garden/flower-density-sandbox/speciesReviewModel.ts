import { DEFAULT_TUNING, generateDensityLayout, getRegionInfo, type DensityFlower, type FlowerClass } from './flowerDensityModel';
import { composeAreaAwareTulip } from './tulip-components/tulipAreaProfiles';
import { clusterVisualScale, DEFAULT_CLUSTER_VISUAL_SCALES } from './tulip-components/clusterVisualScale';
import { composeChamomile, CHAMOMILE_RADIUS } from './chamomile-components/chamomileComposition';
import { composeHydrangea, HYDRANGEA_RADIUS } from './hydrangea-components/hydrangeaComposition';
import type { Composition } from '../flower-visuals/flowerVisualTypes';

export type SpeciesReview = 'TULIP' | 'CHAMOMILE' | 'HYDRANGEA' | 'MIXED' | 'MIXED_SML';
export const SPECIES_REVIEW_PRESETS = [
  { month:6, species:'MIXED', label:'June · Mixed · 30' },
  { month:10, species:'MIXED', label:'October · Mixed · 30' },
  { month:6, species:'CHAMOMILE', label:'June · Chamomile · 30' },
  { month:10, species:'CHAMOMILE', label:'October · Chamomile · 30' },
] as const;
export const HYDRANGEA_REVIEW_PRESETS = [
  {month:6,species:'MIXED_SML',count:30,label:'June · Mixed S + M + L · 30'},
  {month:10,species:'MIXED_SML',count:30,label:'October · Mixed S + M + L · 30'},
  {month:6,species:'HYDRANGEA',count:20,label:'June · Hydrangea · 20 (QA)'},
  {month:10,species:'HYDRANGEA',count:20,label:'October · Hydrangea · 20 (QA)'},
] as const;

// Pack the six largest footprints first, then alternate M/S. This uses the existing
// candidate selection/collision logic and lets June fit all 30 without shrinking radii.
export function threeSpeciesSequence(count:number):FlowerClass[] {
  return [...Array<FlowerClass>(Math.round(count*.2)).fill('L'),
    ...Array.from({length:count-Math.round(count*.2)},(_,i):FlowerClass=>i%2?'S':'M')];
}

export function generateSpeciesReviewLayout(month: number, count: number, species: SpeciesReview) {
  const layout = generateDensityLayout(month,count,species==='MIXED' || species==='MIXED_SML'?'mixed':species==='CHAMOMILE'?'S':species==='HYDRANGEA'?'L':'M',
    DEFAULT_TUNING,species==='MIXED_SML' && count>0?threeSpeciesSequence(count):['M','S']);
  return {...layout,flowers:layout.flowers.map(f=>({...f,
    id:species==='MIXED_SML'?f.id.replace('-mixed-','-mixed-sml-'):f.id,
    speciesCode:f.flowerClass==='S'?'CHAMOMILE' as const:f.flowerClass==='L'?'HYDRANGEA' as const:'TULIP' as const}))};
}
export function composeSpeciesReview(flowers: readonly (DensityFlower & {speciesCode:'TULIP'|'CHAMOMILE'|'HYDRANGEA'})[],
  month: number, densityOverride?: Composition, chamomileScale=1, hydrangeaScale=1) {
  const region=getRegionInfo(month);
  return flowers.map(f=>{
    const composition=f.speciesCode==='TULIP' ? composeAreaAwareTulip(f.id,region,undefined,densityOverride)
      :f.speciesCode==='HYDRANGEA'?composeHydrangea(f.id,region,densityOverride):composeChamomile(f.id,region,densityOverride);
    return {...f,composition,visualScale:clusterVisualScale(f.speciesCode==='CHAMOMILE'?chamomileScale:f.speciesCode==='HYDRANGEA'?hydrangeaScale:1,
      true,composition.areaProfile,DEFAULT_CLUSTER_VISUAL_SCALES)};
  });
}
export const SPECIES_REVIEW_FOOTPRINTS = {CHAMOMILE:CHAMOMILE_RADIUS,TULIP:12,HYDRANGEA:HYDRANGEA_RADIUS} as const;

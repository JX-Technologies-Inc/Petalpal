import { DEFAULT_TUNING, generateDensityLayout, type FlowerClass, type DensityFlower } from './flowerDensityModel';
import { getGrowthRegionInfo as getRegionInfo } from './monthly-growth/growthStatic';
import { BATCH_SPECIES, batchSpecies, composeBatchFlower } from './batch-components/batchComposition';
import { seeded } from './tulip-components/tulipComposition';
import { composeAreaAwareTulip } from './tulip-components/tulipAreaProfiles';
import { clusterVisualScale } from './tulip-components/clusterVisualScale';
import { composeChamomile } from './chamomile-components/chamomileComposition';
import { composeHydrangea } from './hydrangea-components/hydrangeaComposition';
import type { Composition } from '../flower-visuals/flowerVisualTypes';

export const ALL_SPECIES_PRESETS = [
  {month:6,label:'June · All Species Mixed · 30'},
  {month:10,label:'October · All Species Mixed · 30'},
  {month:4,label:'April · All Species Mixed · 30 (Medium)'},
] as const;
export const AVAILABLE_SPECIES = [
  {speciesCode:'CHAMOMILE',flowerClass:'S',weight:2},
  {speciesCode:'TULIP',flowerClass:'M',weight:2},
  {speciesCode:'HYDRANGEA',flowerClass:'L',weight:1},
  ...BATCH_SPECIES.map(s => ({speciesCode:s.speciesCode,flowerClass:s.flowerClass,
    weight:s.speciesCode==='OLIVE' ? .5 : ['COREOPSIS','DAISY'].includes(s.speciesCode) ? 1.5 : 1})),
];
// At 30: 18 S / 9 M / 3 L. Place large footprints first with the existing solver.
// Weighted species draws are intentionally unequal; this is a monthly garden, not a catalog.
export function allSpeciesClassSequence(count: number): FlowerClass[] {
  const l = Math.min(3,Math.round(count*.1)), m = Math.round(count*.3);
  return [...Array<FlowerClass>(l).fill('L'), ...Array<FlowerClass>(m).fill('M'), ...Array<FlowerClass>(count-l-m).fill('S')];
}
export function generateAllSpeciesLayout(month: number, count=30) {
  const total = Math.max(0,Math.min(40,Math.floor(Number.isFinite(count)?count:0)));
  const layout = generateDensityLayout(month,total,'mixed',DEFAULT_TUNING,total ? allSpeciesClassSequence(total) : ['S']);
  const usedAccents = new Set<string>();
  return {...layout,flowers:layout.flowers.map(f => {
    const id = f.id.replace('-mixed-','-all-species-');
    // Heavy accents use distinct silhouettes instead of repeating the same large plant.
    const pool = AVAILABLE_SPECIES.filter(s => s.flowerClass === f.flowerClass && !usedAccents.has(s.speciesCode));
    let roll = seeded(`all-garden-species:${id}`)()*pool.reduce((sum,s)=>sum+s.weight,0);
    const species = pool.find(s => (roll-=s.weight)<0) ?? pool[pool.length-1];
    if (f.flowerClass === 'L') usedAccents.add(species.speciesCode);
    return {...f,id,speciesCode:species.speciesCode};
  })};
}
export function composeAllSpecies(flowers: readonly (DensityFlower & {speciesCode:string})[], month: number, override?: Composition) {
  const region = getRegionInfo(month);
  return flowers.map(f => {
    const composition = f.speciesCode==='TULIP' ? composeAreaAwareTulip(f.id,region,undefined,override)
      : f.speciesCode==='CHAMOMILE' ? composeChamomile(f.id,region,override)
      : f.speciesCode==='HYDRANGEA' ? composeHydrangea(f.id,region,override)
      : composeBatchFlower(f.id,f.speciesCode,region,override);
    const baseScale = ['TULIP','CHAMOMILE','HYDRANGEA'].includes(f.speciesCode) ? 1 : batchSpecies(f.speciesCode).baseVisualScale;
    return {...f,composition,visualScale:clusterVisualScale(baseScale,true,composition.areaProfile)};
  });
}

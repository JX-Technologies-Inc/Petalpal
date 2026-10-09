import type { DensityRegionInfo } from '../flowerDensityModel';
import type { Composition } from '../../flower-visuals/flowerVisualTypes';
import { clusterBounds, composeTulip } from './tulipComposition';

export type AreaProfileName = 'SMALL' | 'MEDIUM' | 'LARGE';
export interface AreaProfile { weights: Record<Composition, number>; spread: number }
// Rounded gaps in the twelve approved-mask samples: 41,818→53,976 and 84,312→90,340.
// World px² of accepted mask samples, never the enclosing land-art rectangle.
export const AREA_THRESHOLDS = { medium: 45000, large: 90000 } as const;
export const DEFAULT_AREA_PROFILES: Record<AreaProfileName, AreaProfile> = {
  SMALL: { weights: { sparse:45,normal:45,full:10 }, spread:1 },
  MEDIUM: { weights: { sparse:25,normal:50,full:25 }, spread:1.08 },
  LARGE: { weights: { sparse:10,normal:45,full:45 }, spread:1.15 },
};
export const cloneAreaProfiles = () => Object.fromEntries(Object.entries(DEFAULT_AREA_PROFILES)
  .map(([name,profile])=>[name,{weights:{...profile.weights},spread:profile.spread}])) as Record<AreaProfileName,AreaProfile>;
export function classifyMaskArea(area: number): AreaProfileName {
  if(!Number.isFinite(area)||area<0)throw new Error('Invalid approved mask area');
  return area<AREA_THRESHOLDS.medium?'SMALL':area<AREA_THRESHOLDS.large?'MEDIUM':'LARGE';
}
// Keep percentage sliders exactly at 100%, redistributing the other two proportionally.
export function changeProfileWeight(profile: AreaProfile, key: Composition, requested: number): AreaProfile {
  const value=Math.round(Math.max(0,Math.min(100,Number.isFinite(requested)?requested:profile.weights[key])));
  const others=(['sparse','normal','full'] as const).filter(k=>k!==key);
  const sum=profile.weights[others[0]]+profile.weights[others[1]];
  const first=Math.round((100-value)*(sum?profile.weights[others[0]]/sum:.5));
  return {...profile,weights:{...profile.weights,[key]:value,[others[0]]:first,[others[1]]:100-value-first}};
}
function drawFor(seed: string) {
  let h=2166136261;
  for(let i=0;i<seed.length;i++)h=Math.imul(h^seed.charCodeAt(i),16777619)>>>0;
  h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;
  return (h>>>0)/4294967296;
}
type Region = Pick<DensityRegionInfo,'month'|'landId'|'estimatedArea'>;
export function selectAreaComposition(flowerId: string, region: Region,
  profiles=DEFAULT_AREA_PROFILES, densityOverride?: Composition, speciesCode = 'TULIP') {
  const areaProfile=classifyMaskArea(region.estimatedArea), profile=profiles[areaProfile];
  const total=profile.weights.sparse+profile.weights.normal+profile.weights.full;
  if(!(total>0)||Object.values(profile.weights).some(w=>!Number.isFinite(w)||w<0)
    ||!Number.isFinite(profile.spread)||profile.spread<.8||profile.spread>1.3)throw new Error('Invalid DEV area profile');
  const roll=drawFor(`tulip-area-v3:${speciesCode}:${flowerId}:${region.month}:${region.landId}:${areaProfile}`)*total;
  const density=densityOverride??(roll<profile.weights.sparse?'sparse':roll<profile.weights.sparse+profile.weights.normal?'normal':'full');
  return { areaProfile, profile, density };
}
export function composeAreaAwareTulip(flowerId: string, region: Region,
  profiles=DEFAULT_AREA_PROFILES, densityOverride?: Composition) {
  const { areaProfile, profile, density } = selectAreaComposition(flowerId,region,profiles,densityOverride);
  // Reuse reviewed V2 art selection and component scales for the chosen density.
  // Only local root offsets spread; the supplied object identity and world anchor never move.
  const base=composeTulip(flowerId,density);
  const parts=base.parts.map(part=>({...part,localX:part.localX*profile.spread,localY:part.localY*profile.spread}));
  return {...base,parts,bounds:clusterBounds(parts),areaProfile,maskArea:region.estimatedArea,
    internalSpread:profile.spread,compositionWeights:{...profile.weights}};
}

export function composeReviewObjects<T extends {id:string;worldX:number;worldY:number}>(
  flowers:readonly T[], region:Region, areaAware:boolean, profiles=DEFAULT_AREA_PROFILES, densityOverride?:Composition) {
  return flowers.map(flower=>({...flower,composition:areaAware
    ?composeAreaAwareTulip(flower.id,region,profiles,densityOverride):composeTulip(flower.id,densityOverride)}));
}

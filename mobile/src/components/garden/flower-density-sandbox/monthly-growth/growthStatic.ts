import data from './growthStaticData.json';
import type { DensityRegionInfo } from '../flowerDensityModel';

// Baked by buildGrowthStaticData.mjs from the unchanged approved geometry.
// The regeneration gate checks every sample and source hash before shipping.
export function getGrowthRegionInfo(month:number):DensityRegionInfo {
  const region=(data.regions as Record<string,DensityRegionInfo>)[month];
  if(!region)throw new Error(`Invalid sandbox month: ${month}`);
  return region;
}

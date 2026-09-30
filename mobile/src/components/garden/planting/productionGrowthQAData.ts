import { monthlyGrowthRecords, buildMonthlyGrowth } from '../flower-density-sandbox/monthly-growth/monthlyGrowthModel';
import { buildLayeredBed } from '../flower-density-sandbox/monthly-growth/layeredBedModel';
import type { FlowerPlacementRecord } from './plantingPersistence';

// DEV-only fixtures: same seven-species stable prefix as the approved June bed.
// Never imported by productionGrowth, PlantingContext or persistence.
export function productionQARecords(count:number):FlowerPlacementRecord[] {
  return monthlyGrowthRecords(6,count).map(p=>({id:p.id,flowerId:p.id,journalEntryId:`qa-${p.id}`,
    ownerUserId:'qa-only',plantedDate:'2026-06-01T12:00:00Z',month:6,landId:'Land06',
    worldX:p.worldX,worldY:p.worldY,scale:1,rotation:0,placementVersion:1,
    flowerName:p.speciesCode,speciesCode:p.speciesCode,supportCount:0}));
}
export function approvedJuneGrowth(){
  return buildLayeredBed(buildMonthlyGrowth(monthlyGrowthRecords(6,30),6),6);
}

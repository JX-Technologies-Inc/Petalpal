import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadPlantingModules} from '../test/loadPlantingModules.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),load=loadPlantingModules();
const model=load('../flower-density-sandbox/flowerDensityModel');
const coverage=load('../flower-density-sandbox/monthly-growth/growthCoverage');
const sources=['mobile/src/components/garden/planting/approvedPlantingMasks.json',
  'mobile/src/components/garden/planting/approvedPlantingMasks.ts',
  'mobile/src/components/garden/planting/plantingMaskRefinement.ts',
  'mobile/src/components/garden/planting/plantingRegionGeometry.ts',
  'mobile/src/components/garden/planting/plantingRegionData.ts',
  'mobile/src/components/garden/gardenMapLayout.ts'];
const result={version:'growth-static-v1',sourceHashes:Object.fromEntries(sources.map(p=>
  [p,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')])),regions:{},masks:{}};
for(let month=1;month<=12;month++){
  result.regions[month]=(model.sampleRegionInfo??model.getRegionInfo)(month);
  result.masks[month]=(coverage.sampleGrowthMask??coverage.growthMask)(month);
  console.log(`Exact static growth region ${month}: ${result.masks[month].points.length} samples`);
}
const target=path.join(root,'mobile/src/components/garden/flower-density-sandbox/monthly-growth/growthStaticData.json');
if(process.argv.includes('--check')){
  if(JSON.stringify(JSON.parse(fs.readFileSync(target)))!==JSON.stringify(result))throw new Error('Static growth data is stale');
  console.log('Static geometry regeneration matches exactly');
}else fs.writeFileSync(target,JSON.stringify(result)+'\n');

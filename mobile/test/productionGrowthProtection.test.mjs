import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root=new URL('../../',import.meta.url);
const collision=JSON.parse(fs.readFileSync(new URL('docs/flower-visuals/PRODUCTION_COLLISION_SML_HASHES.json',root)));
const performance=JSON.parse(fs.readFileSync(new URL('docs/flower-visuals/PRODUCTION_GROWTH_PERFORMANCE_HASHES.json',root)));
const manifest=JSON.parse(fs.readFileSync(new URL('output/flower-visual-checkpoints/MONTHLY_GARDEN_GROWTH_V1_1_APPROVED/manifest.json',root)));
const allowed=new Set(['mobile/src/components/garden/GardenScene.tsx','mobile/src/components/garden/planting/PlantedFlowerLayer.tsx',
  'mobile/src/components/garden/flower-density-sandbox/monthly-growth/monthlyGrowthModel.ts','mobile/src/app/garden-test.tsx']);
let checked=0;
for(const row of manifest.files){
  if(!/^(mobile\/(src|assets|public)\/|Resources\/|lib\/|prisma\/|server\.js$)/.test(row.path)||allowed.has(row.path))continue;
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(row.path,root))).digest('hex'),collision[row.path]??performance[row.path]??row.sha256,row.path);
  checked++;
}
console.log(`DEV checkpoint protection: ${checked} source/art/data hashes checked, excluding four named integration files; exact recorded performance hashes apply only to authorized source changes.`);
const production=JSON.parse(fs.readFileSync(new URL('output/flower-visual-checkpoints/PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED/manifest.json',root)));
let productionChecked=0;
for(const row of production.files){
  if(!/^(mobile\/(src|assets|public)\/|Resources\/|lib\/|prisma\/|server\.js$)/.test(row.path))continue;
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(row.path,root))).digest('hex'),collision[row.path]??performance[row.path]??row.sha256,row.path);
  productionChecked++;
}
console.log(`Production checkpoint protection: ${productionChecked} source/art/data files verified against the snapshot or named exact-output-tested performance hashes.`);
for(const [name,hash] of Object.entries(performance)){
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(name,root))).digest('hex'),hash,name);
}

for(const [name,hash] of Object.entries(collision))assert.equal(crypto.createHash("sha256").update(fs.readFileSync(new URL(name,root))).digest("hex"),hash,name);

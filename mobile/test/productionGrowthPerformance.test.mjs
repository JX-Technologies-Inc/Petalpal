import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const plain=x=>JSON.parse(JSON.stringify(x));
const reference=JSON.parse(fs.readFileSync(new URL('../../output/flower-visual-checkpoints/PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED/reference.json',import.meta.url)));
const storage=new Proxy({}, {get(){throw new Error('Performance cache must not persist children or rendering metadata');}});
const load=loadPlantingModules(storage),api=load('productionGrowth'),coverage=load('../flower-density-sandbox/monthly-growth/growthCoverage');
const timings={},parents=reference.cases.cold30.parents;
let start=performance.now();const first=api.productionGrowth(parents)[0].growth;timings.cold30=performance.now()-start;
assert.equal(crypto.createHash('sha256').update(JSON.stringify(first.pieces)).digest('hex'),reference.pieceSha256,'Exact approved production pixels/transforms');
assert.deepEqual(plain(first),reference.cases.cold30.growth,'Complete approved generation output including coverage/records');
const built=coverage.growthCoverageCacheStats();
start=performance.now();const same=api.productionGrowth(plain(parents))[0].growth;timings.unchanged30=performance.now()-start;
assert.equal(same,first,'No-change and duplicate rendering pass reuse the exact positioned field');
assert.deepEqual(coverage.growthCoverageCacheStats(),built,'No sampling/raster work on a cache hit');
start=performance.now();const moved=api.productionGrowth(reference.cases.move30.parents)[0].growth;timings.move30=performance.now()-start;
assert.deepEqual(plain(moved),reference.cases.move30.growth,'Move invalidates the shared field without changing the approved algorithm');
assert.notEqual(moved,first);
assert.equal(api.productionGrowth(parents)[0].growth,first,'Cancel restores original cached output');
assert.ok(coverage.growthCoverageCacheStats().rasterHits>built.rasterHits,'Unchanged piece transforms reused across movement');
const fresh=loadPlantingModules(storage),freshAPI=fresh('productionGrowth');
freshAPI.productionGrowth(reference.cases.beforeAdd29.parents);
start=performance.now();const added=freshAPI.productionGrowth(parents)[0].growth;timings.add29to30=performance.now()-start;
assert.deepEqual(plain(added),reference.cases.add29to30.growth,'Add matches pre-optimization output exactly');
const reload=loadPlantingModules(storage)('productionGrowth').productionGrowth(reference.cases.move30.parents)[0].growth;
assert.deepEqual(plain(reload),reference.cases.move30.growth,'Fresh reload is independent of cache history');
const metrics=load('growthReviewMetrics').measureGrowth(first,6);
assert.deepEqual(plain(metrics),reference.metrics,'Exact coverage, sectors, visible mass, species and distances');
assert.equal(first.pieces.length,591);assert.equal(first.records.length,30);assert.equal(metrics.outsideOrigins,0);
// Cache invalidation of every rendering input, including scale/rotation/species,
// compared with a fresh runtime rather than an implementation-shaped expected value.
for(const [name,value] of [['scale',.8],['rotation',12],['speciesCode','TULIP']]){
  const source=reference.cases.beforeAdd29.parents.slice(0,1).map(p=>({...p,[name]:value}));
  assert.deepEqual(plain(api.productionGrowth(source)[0].growth),
    plain(loadPlantingModules(storage)('productionGrowth').productionGrowth(source)[0].growth),name);
}
const file=new URL('../../output/production-growth-performance/equivalence-and-timing.json',import.meta.url);
fs.writeFileSync(file,JSON.stringify({timingsMs:timings,cache:coverage.growthCoverageCacheStats(),metrics,pieceSha256:reference.pieceSha256},null,2)+'\n');
console.log(JSON.stringify({timingsMs:timings,cache:coverage.growthCoverageCacheStats()}));
console.log('Exact pre-optimization output gate passed: cold, cached, move, Cancel, add, reload, input invalidation, 591 pieces, all quantitative metrics, no persistence.');

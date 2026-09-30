import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const load=loadPlantingModules(),coverage=load('../flower-density-sandbox/monthly-growth/growthCoverage');
const catalog=load('../flower-density-sandbox/monthly-growth/growthCatalog');
const alpha=JSON.parse(fs.readFileSync(new URL('../src/components/garden/flower-density-sandbox/monthly-growth/alphaSamples.json',import.meta.url))).components;
const approved=JSON.parse(fs.readFileSync(new URL('../../output/flower-visual-checkpoints/PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED/reference.json',import.meta.url))).cases.cold30.growth;
// Independent pre-optimization arithmetic, including Float32 writes and saturation.
function originalAt(piece,x,y){
  const c=catalog.growthCatalog(piece.speciesCode).lookup(piece.componentId),a=alpha[`${piece.speciesCode}:${piece.componentId}`];
  const dx=x-piece.worldX,dy=y-piece.worldY,cos=Math.cos(piece.rotation),sin=Math.sin(piece.rotation);
  const u=Math.floor(((dx*cos+dy*sin)/piece.scale+c.anchorX*c.canvasWidth)/8)-a.left;
  const v=Math.floor(((-dx*sin+dy*cos)/piece.scale+c.anchorY*c.canvasHeight)/8)-a.top;
  return u<0||v<0||u>=a.width||v>=a.height?0:a.alpha[v*a.width+u]/255;
}
function original(pieces,points){
  const result=new Float32Array(points.length);
  for(const p of pieces){const c=catalog.growthCatalog(p.speciesCode).lookup(p.componentId),r=Math.hypot(c.canvasWidth,c.canvasHeight)*p.scale;
    points.forEach((q,i)=>{if(result[i]<.995&&Math.abs(q.x-p.worldX)<r&&Math.abs(q.y-p.worldY)<r){
      const a=originalAt(p,q.x,q.y);result[i]+=a*(1-result[i]);}});
  }return result;
}
const cases=[approved.pieces,approved.pieces.slice().reverse(),approved.pieces.slice(0,50).map((p,i)=>({...p,
  worldX:p.worldX+i*.03,worldY:p.worldY-i*.17,rotation:p.rotation+(i-20)*.12,scale:p.scale*(.5+i*.023)})),
  [{...approved.pieces[0],scale:1e100}]];
for(const pieces of cases){
  const actual=coverage.accumulateCoverage(pieces,approved.mask.points),expected=original(pieces,approved.mask.points);
  assert.deepEqual(Array.from(actual),Array.from(expected),'Every Float32 cell is identical, not merely total coverage');
}
const p={...approved.pieces[0]},points=approved.mask.points;
coverage.accumulateCoverage([p],points);p.worldX+=9;p.rotation+=.2;p.scale*=.83;
assert.deepEqual(Array.from(coverage.accumulateCoverage([p],points)),Array.from(original([p],points)), 'Mutation invalidates prepared geometry/raster');
const subset=points.slice(20,80).reverse();
assert.deepEqual(Array.from(coverage.accumulateCoverage([p],subset)),Array.from(original([p],subset)), 'Different sample sets/orders never reuse wrong indices');
const before=coverage.growthCoverageCacheStats();coverage.accumulateCoverage(approved.pieces,points);
const first=coverage.growthCoverageCacheStats();coverage.accumulateCoverage(approved.pieces,points);
const second=coverage.growthCoverageCacheStats();assert.equal(second.rasterBuilds,first.rasterBuilds);assert.ok(second.objectHits>first.objectHits);
assert.ok(before.gridBuilds>=2);
console.log('Sparse alpha cache matches original arithmetic cell-for-cell across order, transforms, mutations and sample domains; unchanged work is reused.');

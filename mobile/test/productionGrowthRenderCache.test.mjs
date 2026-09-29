import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const reference=JSON.parse(fs.readFileSync(new URL('../../output/flower-visual-checkpoints/PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED/reference.json',import.meta.url)));
const jsx=(type,props)=>({type,props});
function harness(cache){
  const slots=[];let cursor=0,factories=0;
  const react={memo:fn=>fn,useEffect:()=>{},useCallback:fn=>fn,useState:()=>[{},()=>{}],
    useMemo(fn,deps){const i=cursor++,old=slots[i];
      if(cache&&old&&deps.every((d,n)=>Object.is(d,old.deps[n])))return old.value;
      factories++;const value=fn();slots[i]={deps,value};return value;}};
  const load=loadPlantingModules(undefined,react,undefined,true,{
    'react/jsx-runtime':{jsx,jsxs:jsx},'@shopify/react-native-skia':{Group:'Group',Image:'Image',useImage:()=>null}});
  const draw=load('ProductionGrowthLayer').ProductionGrowthLayer;
  return {draw(growth){cursor=0;return draw({growth});},factories:()=>factories};
}
const growth=reference.cases.cold30.growth,optimized=harness(true),uncached=harness(false);
// Materialize host-realm arrays: each harness has its own VM Array prototype.
function signature(tree){return Array.from(tree.props.children,items=>Array.from(items,n=>({piece:n.props.piece.id,image:n.props.image})));}
const first=optimized.draw(growth);assert.equal(optimized.factories(),2);
assert.deepEqual(signature(first),signature(uncached.draw(growth)),'Identical drawing order/asset requests');
for(let i=0;i<10;i++)optimized.draw(growth);
assert.equal(optimized.factories(),2,'Image-load rerenders do not sort/deduplicate the unchanged field again');
optimized.draw(reference.cases.move30.growth);assert.equal(optimized.factories(),4,'Moved field invalidates both memoized arrays');
assert.deepEqual(signature(optimized.draw(growth)),signature(first),'Cancel restores original drawing order');
function measure(h){const started=performance.now();for(let i=0;i<500;i++)h.draw(growth);return (performance.now()-started)/500;}
const result={scope:'JavaScript element/array preparation only; hook/Skia stubs, no React reconciliation, GPU drawing, decoding or upload measurement',
  unchanged591PiecePreparationMs:{withoutMemoization:measure(uncached),withMemoization:measure(optimized)}};
fs.writeFileSync(new URL('../../output/production-growth-performance/render-preparation.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
console.log('Render memoization preserves order and requests, reuses unchanged arrays, invalidates on move and restores Cancel.');

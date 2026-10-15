import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {loadPlantingModules} from '../test/loadPlantingModules.mjs';
const jsx=(type,props)=>({type,props});
const react={memo:f=>f,useMemo:f=>f(),useCallback:f=>f,useEffect:()=>{},useState:()=>[new Proxy({}, {get:()=> 'decoded-image'}),()=>{}]};
const load=loadPlantingModules(new Proxy({}, {get(){throw Error('No storage in rendering audit');}}),react,undefined,true,{
  'react/jsx-runtime':{jsx,jsxs:jsx},'@shopify/react-native-skia':{Group:'Group',Image:'Image',Circle:'Circle',Shader:'Shader',Skia:{RuntimeEffect:{Make:()=>null}},useImage:()=> 'decoded-image'},
});
const {productionGrowth}=load('productionGrowth'),{ProductionGrowthLayer}=load('ProductionGrowthLayer');
const {productionQARecords}=load('productionGrowthQAData');
const {growthCatalog}=load('../flower-density-sandbox/monthly-growth/growthCatalog');
const {hitProductionFlower}=load('productionGrowth');
const textures=JSON.parse(fs.readFileSync(new URL('../../output/garden-runtime-performance/textures.json',import.meta.url)));
function expand(node,counts){if(Array.isArray(node)){for(const child of node)expand(child,counts);return;}if(!node||typeof node!=='object')return;
  if(typeof node.type==='function'){counts.componentFunctions++;expand(node.type(node.props),counts);return;}
  counts[node.type]=(counts[node.type]??0)+1;expand(node.props?.children,counts);
}
const rows=[];
for(const count of [0,1,10,20,30]){
  const parents=productionQARecords(count),start=performance.now(),scenes=productionGrowth(parents),generationMs=performance.now()-start;
  const growth=scenes[0]?.growth,times=[],counts={componentFunctions:0};
  if(growth)for(let run=0;run<40;run++){const before=performance.now(),current={componentFunctions:0};expand(ProductionGrowthLayer({growth}),current);times.push(performance.now()-before);if(run===0)Object.assign(counts,current);}
  const a=performance.now();productionGrowth(parents);const cacheHitMs=performance.now()-a;
  const sorted=[...times].sort((a,b)=>a-b),unique=growth?new Set(growth.pieces.map(p=>`${p.speciesCode}:${p.componentId}`)).size:0;
  const row={parents:count,pieces:growth?.pieces.length??0,uniqueComponentImages:unique,componentFunctionCallsPerExpandedRender:counts.componentFunctions,
    skiaImageDescriptors:counts.Image??0,skiaGroupDescriptors:counts.Group??0,generationMs,cacheHitMs,
    descriptorConstructionP50Ms:sorted[Math.ceil(sorted.length*.5)-1]??0,descriptorConstructionP95Ms:sorted[Math.ceil(sorted.length*.95)-1]??0};
  const requested=new Map();for(const p of growth?.pieces??[]){const ref=growthCatalog(p.speciesCode).images[p.componentId];const path='mobile/'+ref.slice(ref.indexOf('assets/'));const found=textures.files.find(r=>r.path===path);if(!found)throw Error(`Missing texture inventory: ${path}`);requested.set(path,found.rgbaBytes);}
  row.requestedTextureRgbaMiB=[...requested.values()].reduce((a,b)=>a+b,0)/1048576;
  if(count===30){const moveTimes=[];for(let i=1;i<=6;i++){
    const moved=parents.map((p,index)=>index===0?{...p,worldX:p.worldX+i,worldY:p.worldY+i}:p);
    const before=performance.now();productionGrowth(moved);moveTimes.push(performance.now()-before);
  }row.sixPreviewMutationsMs=moveTimes;
    const before=performance.now();for(let i=0;i<100;i++)hitProductionFlower(parents,parents[0].worldX,parents[0].worldY);
    row.meanHitLookupMs=(performance.now()-before)/100;
  }
  rows.push(row);console.log(JSON.stringify(row));
}
const out=new URL('../../output/garden-runtime-performance/',import.meta.url);fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(new URL('flower-render-proxy.json',out),JSON.stringify({scope:'Actual productionGrowth + ProductionGrowthLayer functions under a deterministic hook/decoded-image mock. This measures descriptor JS only, not live React reconciliation, Skia draw, FPS, decode/upload or GPU.',rows},null,2)+'\n');

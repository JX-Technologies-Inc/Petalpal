import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const ts=createRequire(import.meta.url)('typescript');
const zip=fileURLToPath(new URL('../../output/flower-visual-checkpoints/PRODUCTION_PLANTING_COLLISION_SML_V1_APPROVED/snapshot.zip',import.meta.url));
const original=spawnSync('python',['-c','import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))',zip,'mobile/src/components/garden/LandmarkLayer.tsx'],{encoding:'utf8'});
assert.equal(original.status,0,original.stderr);
const current=fs.readFileSync(new URL('../src/components/garden/LandmarkLayer.tsx',import.meta.url),'utf8');
const placement={x:10,y:20,scale:.5,rotation:3};
function load(source){const exports={};const jsx=(type,props)=>({type,props});
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,__DEV__:true,require:name=>{
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
    if(name.endsWith('/performance/runtimeAudit'))return {runtimeAudit:{render(){}}};
    if(name.endsWith('/performance/GardenRuntimePanel'))return {GardenProfile:'Profile'};
    if(name==='@shopify/react-native-skia')return new Proxy({}, {get:(_,key)=>key});
    return new Proxy({__esModule:true,default:name},{get:(o,k)=>{
      if(k in o)return o[k];if(k==='useWaterTopFlow')return ()=>({});
      if(k==='STATIC_LANDMARK_MAP_PLACEMENTS')return {gardenArch:placement,pavilion:placement};
      if(String(k).startsWith('INITIAL_'))return placement;return 1;
    }});
  }});return exports.default;
}
function normalize(node){
  if(Array.isArray(node))return node.flatMap(normalize);
  if(!node||typeof node!=='object')return [];
  if(node.type==='Profile')return node.props.enabled===false?[]:normalize(node.props.children);
  const {children,...props}=node.props??{};
  return [{type:node.type,props:JSON.parse(JSON.stringify(props)),children:normalize(children)}];
}
const before=load(original.stdout),after=load(current);
const flowers={type:'Flowers',props:{id:'unchanged-slot'}};
for(const waterfallVersion of ['legacy','v2'])for(const active of [true,false]){
  const props={waterfallVersion,waterfallActive:active,behindTeaSet:flowers,teaSetPlacement:placement};
  const clean=node=>JSON.parse(JSON.stringify(normalize(node)));
  assert.deepEqual(clean(after(props)),clean(before(props)),'Default landmark host nodes/props/order exactly match collision checkpoint');
}
console.log('Runtime instrumentation default draw parity: legacy/V2, active/background, all landmark transforms/art/animation props and Tea Set flower slot match approved checkpoint.');

for(const waterfallVersion of ['legacy','v2'])for(const active of [true,false]){
 const props={waterfallVersion,waterfallActive:active,behindTeaSet:flowers,teaSetPlacement:placement};
 const clean=node=>JSON.parse(JSON.stringify(normalize(node)))[0].children;
 assert.deepEqual([...clean(after({...props,renderPass:'motion'})),...clean(after({...props,renderPass:'static-front'}))],clean(after(props)),
  'Independent landmark planes preserve the exact flattened source-over sequence');
}
console.log('Motion + static-front passes exactly reconstruct all legacy/V2 active/background landmark draws and flower occlusion slots.');

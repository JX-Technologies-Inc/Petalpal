import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
const ts=createRequire(import.meta.url)('typescript');
const jsx=(type,props)=>({type,props});
function execute(source,require,extra={}){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,__DEV__:false,...extra});return exports;}
const assets=execute(fs.readFileSync(new URL('../src/components/garden/waterfallAssets.ts',import.meta.url),'utf8'),s=>s);
const rows=[];
for(const animationEnabled of [false,true]){
 let now=0,cursor=0,renders=0,updates=0,timerCalls=0,dirty=false,totalMs=0;
 const states=[],effects=[],pending=[],timers=new Map(),requests=new Set();let nextId=0;
 const react={memo:f=>f,useCallback:f=>f,useState:init=>{const i=cursor++;if(!(i in states))states[i]=init;return[states[i],value=>{const v=typeof value==='function'?value(states[i]):value;if(v!==states[i]){states[i]=v;updates++;dirty=true;}}];},useEffect:(fn,deps)=>{const i=cursor++;if(!effects[i]||deps.some((v,j)=>v!==effects[i][j])){effects[i]=deps;pending.push(fn);}}};
 const image={width:()=>600,height:()=>656};
 const mod=execute(fs.readFileSync(new URL('../src/components/garden/WaterfallEntity.tsx',import.meta.url),'utf8'),name=>{
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};
  if(name==='./waterfallAssets')return assets;
  if(name==='react-native')return{AppState:{currentState:'active',addEventListener:()=>({remove(){}})}};
  if(name==='react-native-reanimated')return{useReducedMotion:()=>false};
  if(name.includes('runtimeAudit'))return{runtimeAudit:{render(){renders++;}}};
  if(name==='@shopify/react-native-skia')return{Group:'Group',Image:'Image',useImage:ref=>{requests.add(ref);return image;}};
  throw Error(name);
 },{Date:{now:()=>now},setInterval:(fn,ms)=>{const id=++nextId;timers.set(id,{fn,ms,next:now+ms});return id;},clearInterval:id=>timers.delete(id)});
 let node;
 function render(){cursor=0;dirty=false;const start=performance.now();node=mod.default({assetQuality:'map',animationEnabled});totalMs+=performance.now()-start;while(pending.length)pending.shift()();}
 render();while(true){const t=[...timers.values()].sort((a,b)=>a.next-b.next)[0];if(!t||t.next>30000)break;now=t.next;t.next+=t.ms;timerCalls++;t.fn();if(dirty)render();}
 const counts={};function expand(n){if(Array.isArray(n)){n.forEach(expand);return;}if(!n||typeof n!=='object')return;if(typeof n.type==='function'){expand(n.type(n.props));return;}counts[n.type]=(counts[n.type]??0)+1;expand(n.props?.children);}expand(node);
 rows.push({animationEnabled,virtualObservationMs:30000,timerCallbacks:timerCalls,stateUpdates:updates,functionCalls:renders,componentFunctionCpuMs:totalMs,uniqueImageRequests:requests.size,finalHostDescriptors:counts});
}
const result={scope:'Actual WaterfallEntity function/effects with deterministic virtual 33ms timer and hook/image mocks. NOT live React commits, frame timing, real decoding or Canvas replay. No scheduling stalls simulated.',rows};
fs.writeFileSync(new URL('../../output/garden-runtime-performance/waterfall-virtual-timer.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

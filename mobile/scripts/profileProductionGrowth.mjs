import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import inspector from 'node:inspector';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {loadPlantingModules} from '../test/loadPlantingModules.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const phase=process.argv.includes('--before')?'before':'after';
const out=path.join(root,'output/production-growth-performance');fs.mkdirSync(out,{recursive:true});
const load=loadPlantingModules(new Proxy({}, {get(){throw new Error('Profiler must not access user storage');}}));
const qa=load('productionGrowthQAData'),api=load('productionGrowth');
const rows={},stages={};let scenario='';
for(const [module,name] of [
  ['../flower-density-sandbox/monthly-growth/monthlyGrowthModel','buildMonthlyGrowth'],
  ['../flower-density-sandbox/monthly-growth/layeredBedModel','buildLayeredBed'],
  ['../flower-density-sandbox/monthly-growth/growthCoverage','growthMask'],
  ['../flower-density-sandbox/monthly-growth/growthCoverage','accumulateCoverage'],
  ['../flower-density-sandbox/monthly-growth/growthCoverage','paintCoverage'],
  ['../flower-density-sandbox/allSpeciesReviewModel','composeAllSpecies'],
  ['landAwareGrowth','bindLandAwareGrowth'],
]){
  const mod=load(module),fn=mod[name];mod[name]=(...args)=>{const start=performance.now();try{return fn(...args);}
    finally{const table=stages[scenario]??(stages[scenario]={}),row=table[name]??(table[name]={calls:0,ms:0});row.calls++;row.ms+=performance.now()-start;}};
}
const parents=qa.productionQARecords(30),moved=parents.map((p,i)=>i? p:{...p,worldX:p.worldX+3,worldY:p.worldY+2});
const cases={};
function run(name,input){scenario=name;const start=performance.now(),result=api.productionGrowth(input)[0].growth;
  rows[name]=performance.now()-start;cases[name]={parents:input,growth:result};return result;}
const session=new inspector.Session();session.connect();
const post=(method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(error,result)=>error?reject(error):resolve(result)));
await post('Profiler.enable');await post('Profiler.start');
const cold=run('cold30',parents);run('unchanged30',parents);run('move30',moved);run('cancel30',parents);
run('beforeAdd29',parents.slice(0,29));
// Fresh runtime gives add29->30 its own cache history: it must not merely hit cold30.
const addLoad=loadPlantingModules(),addAPI=addLoad('productionGrowth');addAPI.productionGrowth(parents.slice(0,29));
let start=performance.now();const add=addAPI.productionGrowth(parents)[0].growth;rows.add29to30=performance.now()-start;
cases.add29to30={parents,growth:add};
const {profile}=await post('Profiler.stop');session.disconnect();
fs.writeFileSync(path.join(out,`${phase}.cpuprofile`),JSON.stringify(profile));
const hits=profile.nodes.filter(n=>n.hitCount).sort((a,b)=>b.hitCount-a.hitCount).slice(0,18)
  .map(n=>({function:n.callFrame.functionName,file:n.callFrame.url,line:n.callFrame.lineNumber+1,hits:n.hitCount}));
const metrics=load('growthReviewMetrics').measureGrowth(cold,6);
const result={phase,node:process.version,timingsMs:rows,nestedStages:stages,cpuSampleHotspots:hits,metrics};
fs.writeFileSync(path.join(out,`${phase}.json`),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--capture')){
  const folder=path.join(root,'output/flower-visual-checkpoints/PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED');
  fs.mkdirSync(folder,{recursive:true});const target=path.join(folder,'reference.json');
  if(fs.existsSync(target))throw new Error('Refusing to replace an existing approved production reference');
  const reference={status:'PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED',approvedDate:'2026-09-29',cases,metrics,
    pieceSha256:crypto.createHash('sha256').update(JSON.stringify(cold.pieces)).digest('hex')};
  fs.writeFileSync(target,JSON.stringify(reference));
  console.log('Captured exact approved production reference:',reference.pieceSha256);
}

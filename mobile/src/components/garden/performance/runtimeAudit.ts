/** Local, bounded DEV instrumentation. No records, coordinates, storage or network. */
export const MAX_AUDIT_SAMPLES = 3600;
export const DEFAULT_ISOLATION = {Land:true,Infrastructure:true,Landmarks:true,Water:true,
  Waterfall:true,Fish:true,Lotus:true,Flowers:true,LandmarkAnimation:true,WaterAnimation:true,DebugUI:true,Environment:false};
export type GardenIsolation = typeof DEFAULT_ISOLATION;
export function frameSummary(samples:readonly number[], budgetMs=1000/60) {
  const valid=samples.filter(n=>Number.isFinite(n)&&n>0),sorted=[...valid].sort((a,b)=>a-b);
  const percentile=(p:number)=>sorted.length?sorted[Math.ceil(p*sorted.length)-1]:null;
  return {samples:valid.length,averageCallbackFps:valid.length?1000*valid.length/valid.reduce((a,b)=>a+b,0):null,
    p50Ms:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),
    overBudgetFrames:valid.filter(n=>n>budgetMs*1.5).length,longFrames50ms:valid.filter(n=>n>50).length,
    estimatedMissedIntervals:valid.reduce((sum,n)=>sum+Math.max(0,Math.round(n/budgetMs)-1),0),budgetMs};
}
const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
type Bucket={calls:number;totalMs:number;samples:number[]};
let active=false,started=0,metadata:Record<string,unknown>={},frames:number[]=[],longTasks:number[]=[];
let renders:Record<string,number>={},work:Record<string,Bucket>={},commits:Record<string,Bucket>={};
function record(target:Record<string,Bucket>,name:string,ms:number) {
  if(!active)return;const b=target[name]??(target[name]={calls:0,totalMs:0,samples:[]});
  b.calls++;b.totalMs+=ms;if(b.samples.length<MAX_AUDIT_SAMPLES)b.samples.push(ms);
}
export const runtimeAudit={
  get active(){return active;},
  start(meta:Record<string,unknown>={}) {
    if(!__DEV__)return false;
    metadata=meta;started=now();frames=[];longTasks=[];renders={};work={};commits={};active=true;return true;
  },
  render(name:string){if(active)renders[name]=(renders[name]??0)+1;},
  frame(ms:number){if(active&&frames.length<MAX_AUDIT_SAMPLES)frames.push(ms);},
  longTask(ms:number){if(active&&longTasks.length<MAX_AUDIT_SAMPLES)longTasks.push(ms);},
  commit(name:string,ms:number){record(commits,name,ms);},
  stop(uiFrames:readonly number[]=[],budgetMs=1000/60){
    const durationMs=now()-started;active=false;
    return {metadata,durationMs,jsCallbackCadence:frameSummary(frames,budgetMs),uiCallbackCadence:frameSummary(uiFrames,budgetMs),
      componentFunctionCalls:renders,reactSubtreeCommits:commits,jsWork:work,longTasks,
      sampleLimit:MAX_AUDIT_SAMPLES,skiaRedraws:null,gpuTiming:null,imageDecodeUploadTiming:null,
      caveat:'Callback cadence is not presented FPS; Profiler buckets overlap; native UI/GPU and redraw counts need platform tracing.'};
  },
};
export function timeGardenWork<T>(name:string,fn:()=>T):T {
  if(!runtimeAudit.active)return fn();const start=now();try{return fn();}finally{record(work,name,now()-start);}
}

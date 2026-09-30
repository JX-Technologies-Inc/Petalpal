import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {ROOT,buildDomain,scenarios,search,polish,radius,hash,footprints,staticData} from './productionCapacityAudit.mjs';
const output=new URL('output/production-capacity-audit/',ROOT);fs.mkdirSync(output,{recursive:true});
const only=process.argv.slice(2).map(Number);const months=only.length?only:Array.from({length:12},(_,i)=>i+1);
for(const month of months){
  const start=performance.now(),domain=buildDomain(month);
  console.log(`Land${String(month).padStart(2,'0')} domain: ${JSON.stringify(domain.counts)} (${((performance.now()-start)/1000).toFixed(1)} s)`);
  const results=[];
  for(const scenario of scenarios(month)){
    const started=performance.now();
    let result=search(domain,scenario.records);
    console.log(`${month}/${scenario.scenario}: grid search ${result.placed.length}/30, refining`);
    if(result.placed.length<30)result=polish(domain,scenario.records,result);
    let margin=null;if(result.placed.length===30)margin=search(domain,scenario.records,{attempts:48,gap:2,repair:48});
    const distribution={};for(const p of scenario.records)distribution[radius(p)]=(distribution[radius(p)]??0)+1;
    const requestedArea=scenario.records.reduce((n,p)=>n+Math.PI*radius(p)**2,0);
    const row={month,landId:staticData.regions[month].landId,scenario:scenario.scenario,mix:scenario.mix,radiusDistribution:distribution,
      maskAreaEstimate:staticData.regions[month].estimatedArea,requestedFootprintArea:requestedArea,requested:30,
      placedCount:result.placed.length,failed:30-result.placed.length,achieved:result.placed.length===30,
      ...result,margin2px:margin?{count:margin.placed.length,minClearance:margin.minClearance,successes:margin.successes,placed:margin.placed}:null,
      elapsedMs:performance.now()-started};
    results.push(row);console.log(`${month}/${scenario.scenario}: ${row.placedCount}/30; +2px ${margin?.placed.length??'-'}; ${(row.elapsedMs/1000).toFixed(1)}s`);
  }
  const result={month,domain:{bounds:domain.bounds,step:domain.step,counts:domain.counts,rejections:domain.rejections},results,
    semanticHash:hash(results.map(({elapsedMs,...r})=>r)),elapsedMs:performance.now()-start};
  fs.writeFileSync(new URL(`land${String(month).padStart(2,'0')}.json`,output),JSON.stringify(result,null,2)+'\n');
}

import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {ROOT,buildDomain,scenarios,tangentSearch,hash} from './productionCapacityAudit.mjs';
const folder=new URL('output/production-capacity-audit/',ROOT);
const selected=process.argv.slice(2).map(Number),months=selected.length?selected:Array.from({length:12},(_,i)=>i+1);
for(const month of months){
  const file=new URL(`land${String(month).padStart(2,'0')}.json`,folder),land=JSON.parse(fs.readFileSync(file));
  if(land.results.every(r=>r.achieved))continue;
  const domain=buildDomain(month);
  for(const row of land.results){
    if(row.achieved)continue;
    const start=performance.now(),records=scenarios(month).find(s=>s.scenario===row.scenario).records;
    const refined=tangentSearch(domain,records,row);
    Object.assign(row,refined,{placedCount:refined.placed.length,failed:30-refined.placed.length,achieved:refined.placed.length===30,
      elapsedMs:row.elapsedMs+performance.now()-start});
    console.log(`Tangent refinement ${month}/${row.scenario}: ${row.placedCount}/30`);
  }
  land.semanticHash=hash(land.results.map(({elapsedMs,...r})=>r));
  fs.writeFileSync(file,JSON.stringify(land,null,2)+'\n');
}

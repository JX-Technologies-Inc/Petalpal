import fs from 'node:fs';
import crypto from 'node:crypto';
import {createAuditEngine} from './collisionAuditEngine.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root));
const manifest=JSON.parse(read('mobile/src/components/garden/flower-density-sandbox/batch-components/componentManifest.json'));
export const classes={...Object.fromEntries(manifest.species.map(s=>[s.speciesCode,s.flowerClass])),CHAMOMILE:'S',TULIP:'M',HYDRANGEA:'L'};
export const code=name=>(name??'').toUpperCase().replaceAll(' ','_');
export function candidateEngine(radii){
  const production=createAuditEngine();
  return createAuditEngine(name=>classes[code(name)]?radii[classes[code(name)]]:production.config.getFlowerPlacementDefinition(name).footprintRadius);
}
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function inventory(){
  const result={};
  for(const directory of ['mobile/src','Resources','output/flower-visual-checkpoints']){
    const walk=url=>{for(const entry of fs.readdirSync(url,{withFileTypes:true})){const child=new URL(encodeURIComponent(entry.name)+(entry.isDirectory()?'/':''),url);if(entry.isDirectory())walk(child);else result[decodeURIComponent(child.pathname.slice(root.pathname.length))]=sha(fs.readFileSync(child));}};
    walk(new URL(directory+'/',root));
  }
  return result;
}
function main(){
  const before=inventory(),baseline=JSON.parse(read('output/production-planting-capacity-audit/capacity.json'));
  const models=[];
  for(const radii of [{S:9,M:12,L:16},{S:8,M:10,L:14}]){
    const engine=candidateEngine(radii),rows=[];
    for(let month=1;month<=12;month++){
      const candidates=engine.getCandidates(month);
      for(const scenario of engine.scenarios){
        const {placements,...row}=engine.runScenario(month,scenario,candidates);
        row.classification=row.classification==='PASS'?'PASS_ROBUST':row.classification==='MARGINAL'?'PASS_TIGHT':'FAIL';
        const occupied=placements.reduce((sum,p)=>sum+Math.PI*p.radius**2,0);
        row.remainingUnoccupiedAreaEstimateWorldPx2=Math.max(0,row.usableAreaWorldPx2-occupied);
        rows.push(row);console.log(`${JSON.stringify(radii)} ${row.landId} ${row.scenario} ${row.placed}/30 ${row.classification}`);
      }
    }
    models.push({radii,rows});
    if(rows.filter(r=>r.scenario==='representative').every(r=>r.placed===30))break;
  }
  const after=inventory();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Protected inventory changed');
  const mapping=Object.entries(classes).sort().map(([species,flowerClass])=>({species,flowerClass,radius:({S:9,M:12,L:16})[flowerClass]}));
  const output=new URL('output/collision-model-candidate-audit/',root);fs.mkdirSync(output,{recursive:true});
  const data={mapping,unclassifiedRetained:{LOTUS:22,CHERRY_BLOSSOM:22},models,qaPlacementsPersisted:false,protectedHashes:before};
  const json=JSON.stringify(data,null,2)+'\n';fs.writeFileSync(new URL('candidate-results.json',output),json);
  fs.writeFileSync(new URL('candidate-results.sha256',output),sha(json)+'\n');
  const lines=['# Collision model candidate audit','','Simulation only. Production source, artwork, masks and both approved checkpoint trees were hashed before/after and remain identical. No storage access or generated placement coordinates are persisted.','',
    '## Species mapping','','| Species | Class | Radius |','|---|---|---:|',...mapping.map(m=>`| ${m.species} | ${m.flowerClass} | ${m.radius} |`),'| LOTUS | UNRESOLVED — retained production | 22 |','| CHERRY_BLOSSOM | UNRESOLVED — retained production | 22 |','',
    'The legacy small-friendly mix contains eight unclassified Lotus/Cherry Blossom parents. Their radius is held at 22 rather than inventing classes. This scenario is therefore a hybrid candidate audit. Representative/default/stress scenarios have defined classes.','',
    '## Method','','Exact previous four mixes, candidate lattice, twelve deterministic starts, species ordering seeds, max-min clearance ranking and 4px near-miss completion pass. Only radius resolution is substituted inside an isolated VM dependency of the unchanged production validator, for both pending and occupied parents. The engine is copied verbatim from the prior audit with dependency injection only. PASS_ROBUST requires 30 in at least three starts and minimum pairwise clearance ≥8px; PASS_TIGHT means 30 otherwise. FAIL is a search result, not proof of impossibility. Clearance is disk-edge to disk-edge. Mask containment is validated separately; no claim of an 8px boundary margin. Remaining space = sampled mask area minus accepted disk area; it is not available-center capacity and includes unusable slivers. Visual children are excluded.',''];
  for(const model of models){lines.push(`## Candidate ${JSON.stringify(model.radii)}`,'','| Land | Mix | Placed | Min clearance px | Full starts /12 | Dense additions | Candidate centers | Remaining area ≈ px² | Result |','|---|---|---:|---:|---:|---:|---:|---:|---|',...model.rows.map(r=>`| ${r.landId} | ${r.scenario} | ${r.placed}/30 | ${r.minimumPairwiseClearance?.toFixed(2)} | ${r.successfulStarts} | ${r.denseCompletionCount} | ${r.candidateCenters} | ${Math.round(r.remainingUnoccupiedAreaEstimateWorldPx2)} | ${r.classification} |`),'','| Land | Current representative | Candidate | Difference |','|---|---:|---:|---:|',...model.rows.filter(r=>r.scenario==='representative').map(r=>{const old=baseline.scenarioResults.find(b=>b.month===r.month&&b.scenario===r.scenario);return `| ${r.landId} | ${old.placed}/30 | ${r.placed}/30 | +${r.placed-old.placed} |`;}),'');}
  lines.push('## Migration and future integration','','All classified candidate radii are smaller than their current production values. Unclassified radii are unchanged. Existing valid bounds, mask containment and pairwise separations therefore remain valid: no coordinate migration or persisted radius field is required. This is an architecture/monotonicity conclusion, not an inventory of live saved flowers. Storage is never opened. Invalid historical records are not automatically repaired.','',
    'Plant, Adjust preview and Confirm share validateFlowerPlacement and flowerName-based radius resolution; a separately authorized integration should change one shared resolver and its preview circle consistently. Adjust must continue ignoring only its own placement ID; Confirm must revalidate. A canonical species/name mapping and explicit unknown-species policy need review before rollout. Derived Growth V1.1 children must remain outside collision accounting. Journal/Support parent relationships do not change.','',
    models.length===1?'9/12/16 meets representative 30/30 on all twelve masks; no smaller candidate was required. Recommend this classified logical-anchor model for a separate production change, subject to manual planting/Adjust review and an explicit unresolved-species policy.':'9/12/16 failed at least one representative land, so 8/10/14 was tested as a conservative 11–17% radius reduction. Review its results before any production decision. Do not reduce further in this task.','',
    'Protection: complete mobile/src, Resources and checkpoint file hashes are included in candidate-results.json. Saved coordinates remain untouched because no persistence API is available to the simulation. No production, Journal or Support source is edited.','');
  fs.writeFileSync(new URL('candidate-report.md',output),lines.join('\n'));
}
if(process.argv[1]?.endsWith('auditCollisionCandidates.mjs'))main();

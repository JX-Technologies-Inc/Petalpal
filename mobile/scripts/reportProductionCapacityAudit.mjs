import fs from 'node:fs';
import {ROOT,staticData,scenarios,radius,validate,hash} from './productionCapacityAudit.mjs';
const folder=new URL('output/production-capacity-audit/',ROOT);
const lands=Array.from({length:12},(_,i)=>JSON.parse(fs.readFileSync(new URL(`land${String(i+1).padStart(2,'0')}.json`,folder))));
const names=['January','February','March','April','May','June','July','August','September','October','November','December'];
const rows=lands.flatMap(l=>l.results);
const category=land=>{
  const b=land.results.find(r=>r.scenario==='B');
  if(b.achieved&&b.margin2px?.count===30&&land.results.every(r=>r.achieved))return 'PASS';
  return land.results.some(r=>r.achieved)?'MARGINAL':'FAIL';
};
const requestedMix=r=>Object.entries(r.mix).map(([s,n])=>`${s}×${n}`).join(', ');
const radiusMix=r=>Object.entries(r.radiusDistribution).map(([n,count])=>`${n}×${count}`).join(' / ');
const scenarioStatus=r=>!r.achieved?'FAIL (search)':r.margin2px?.count===30?'robust':'marginal';
const jitter=[];
for(const r of rows.filter(r=>r.achieved)){
  const placed=r.margin2px?.count===30?r.margin2px.placed:r.placed;let accepted=0;
  for(const p of placed)for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]])
    if(validate({...p,worldX:p.worldX+dx,worldY:p.worldY+dy},placed.filter(q=>q.id!==p.id)).isValid)accepted++;
  jitter.push({month:r.month,scenario:r.scenario,accepted,total:placed.length*8});
}
const reference=JSON.parse(fs.readFileSync(new URL('output/flower-visual-checkpoints/PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED/reference.json',ROOT)));
const qaAccepted=[],qaRejected={};
for(const p of reference.cases.cold30.parents){const v=validate(p,qaAccepted);if(v.isValid)qaAccepted.push(p);else qaRejected[v.reason]=(qaRejected[v.reason]??0)+1;}
const summary={classification:Object.fromEntries(lands.map(l=>[l.month,category(l)])),jitter,
  approvedVisualFixture:{acceptedInSavedOrder:qaAccepted.length,rejected:qaRejected},
  combinedSemanticHash:hash(lands.map(l=>l.semanticHash))};
fs.writeFileSync(new URL('summary.json',folder),JSON.stringify(summary,null,2)+'\n');
const lines=[`# Production planting capacity audit — all 12 lands`,
``, `Audit date: 2026-09-29. The production Growth V1.1 visual and performance baselines are user-approved. This audit changes no production source, radii, masks, coordinates, artwork or Growth rules.`,
``, `## Result and interpretation`,
``, `${lands.filter(l=>category(l)==='PASS').length} PASS, ${lands.filter(l=>category(l)==='MARGINAL').length} MARGINAL, ${lands.filter(l=>category(l)==='FAIL').length} FAIL under the tested production mixes. PASS requires representative B to fit 30 with an extra 2 world px of pairwise clearance and all four mixes to reach 30. MARGINAL means some mix reaches 30 but that criterion is unmet. FAIL means none of the four searches reaches 30.`,
``, `**FAIL is a practical, bounded-search finding, not a mathematical proof of the continuous maximum.** Placed counts below 30 are best-found valid lower bounds. No finite heuristic proves that every possible arrangement fails. Successful witnesses are independently replayed through the real production validator. A passing planned layout does not guarantee that 30 fit after arbitrary earlier user placements without Adjust Position.`,
``, `| Land | Approx. Final Mask area (world px²) | A small-friendly | B representative | C large stress | D default | Classification |`,
`|---|---:|---:|---:|---:|---:|---|`,
...lands.map(l=>`| ${names[l.month-1]} / Land${String(l.month).padStart(2,'0')} | ${staticData.regions[l.month].estimatedArea.toLocaleString('en-US')} | ${l.results.map(r=>`${r.placedCount}/30`).join(' | ')} | ${category(l)} |`),
``, `## Production authority`,
``, `The audit imports validateFlowerPlacement from placementValidator.ts, the same function called again by PlantingContext.confirmPlacement immediately before saving. It passes flowerName and actual month/world coordinates with no definition override. Every selected witness is validated against all previously accepted parents; Adjust parity ignores only the selected record ID.`,
``, `Current collision radii: **Tulip 20, Lavender 20, Sunflower 24, Lotus 22, Cherry Blossom 22, default 22** world px. Resolution is case-insensitive exact-or-substring matching of flowerName. speciesCode does not select the collision radius. Names such as pink/purple and unlisted species resolve to 22; ORANGE_TULIP resolves to 20. Scale, rotation, hitbox size and DEV visual metadata 9/12/16 do not change the production collision circle.`,
``, `Rules: world bounds; target-month Final Mask center membership (otherwise other-month detection); conservative entire-circle mask containment; squared-distance parent collision with strict '<' (touching is allowed). Confirm sets landId from MONTH_REGION_METAS. Approved calibration, Add/Remove operations and offsets are loaded from approvedPlantingMasks.json; no baseline-only, editable localStorage or DEV mask is substituted.`,
``, `There is no additional Tea Set/landmark-object exclusion in this Confirm validator: relevant excluded ground is encoded in the Final Mask. Foreground Tea Set occlusion is visual and does not subtract extra capacity. The audit does not import or place Growth Primary/Companion/Filler children. Owner/session/duplicate-Journal rules are outside geometric capacity; QA parents have unique IDs and represent an authorized user's records.`,
``, `All areas are the locked Final Mask's **2-world-pixel center-sampled estimates**, with current source hashes checked. They are not analytic areas or eroded center areas. Reported valid-center counts use a separate 3 px grid and the real full-footprint validator. These estimates are diagnostics, never placement acceptance criteria.`,
``, `## Mixes`,
``, `A: ${requestedMix(rows.find(r=>r.scenario==='A'))}.`,
``, `B June-reference (January–March, May–September, November–December): ${requestedMix(rows.find(r=>r.month===6&&r.scenario==='B'))}.`,
``, `B April: ${requestedMix(rows.find(r=>r.month===4&&r.scenario==='B'))}.`,
``, `B October: ${requestedMix(rows.find(r=>r.month===10&&r.scenario==='B'))}.`,
``, `B copies the approved June/April/October monthly mix definitions. Months without a dedicated approved mix use the declared June neutral reference, not an invented claim of twelve approved seasonal species mixes.`,
``, `C: ${requestedMix(rows.find(r=>r.scenario==='C'))}.`,
``, `D: ${requestedMix(rows.find(r=>r.scenario==='D'))}. All 30 resolve to default radius 22.`,
``, `## Full 48-scenario table`,
``, `Radius distribution is radius × number requested, not the subset that happened to fit. Requested count is 30 in every row. Clearance is minimum circle-edge-to-circle-edge distance of the reported successful subset. +2 px shows the achieved count under the additional pairwise gap; '-' means the base search failed and no margin run was requested.`,
``, `| Month / land | Mask area ≈ | Scenario | Requested radii | Placed | Failed | 30/30 | Min clearance px | +2 px count | Full starts / 96 | Assessment |`,
`|---|---:|---|---|---:|---:|---|---:|---:|---:|---|`,
...rows.map(r=>`| ${names[r.month-1]} / ${r.landId} | ${r.maskAreaEstimate} | ${r.scenario} | ${radiusMix(r)} | ${r.placedCount} | ${r.failed} | ${r.achieved?'yes':'no'} | ${r.minClearance?.toFixed(3)??'—'} | ${r.margin2px?.count??'—'} | ${r.successes} | ${scenarioStatus(r)} |`),
``, `## Search strength and uncertainty`,
``, `For each land, enumerate a deterministic 3 px center grid spanning the full transformed baseline plus Add-stroke bounds. Centers must pass the approved point predicate and candidate radii 20/22/24 are individually admitted by the real validator. Each mix receives 96 starts combining 24 directions, directional sweeps, staggered rows, radial and seeded-random candidate orders, plus large-first/small-first/original/seeded record orders. Up to 120 local destroy/repair passes remove nearby pockets and reinsert missing records. Failures receive 48 continuous compaction rounds with true off-grid validation and tangent insertion, then 24 additional searches using pairwise circle-intersection tangencies and directional packing. Every final witness receives a full sequential production-validator replay.`,
``, `Margin runs use 48 starts and up to 48 repairs with an extra 2 px between pairs; actual radii and mask containment stay unchanged. This is additional QA spacing, not a new validator rule. summary.json also records ±1 px individual-parent perturbation acceptance in eight directions. It diagnoses sensitivity and is not a guarantee against moving all parents together. Candidate/grid restrictions and finite restart budgets may miss a better continuous solution.`,
``, `## Failure causes`,
``, `| Land | Radius-20/22/24 valid-center area estimates (px²) | B disk area / mask area | Evidence and cause |`,
`|---|---|---:|---|`,
...lands.filter(l=>category(l)==='FAIL').map(l=>{const b=l.results.find(r=>r.scenario==='B'),ratio=b.requestedFootprintArea/b.maskAreaEstimate;
  return `| ${names[l.month-1]} / Land${String(l.month).padStart(2,'0')} | ${[20,22,24].map(r=>`${r}: ${l.domain.counts[r]*9}`).join(' / ')} | ${(ratio*100).toFixed(1)}% | ${b.placedCount} accepted, ${b.failed} unplaced in B after all search stages. ${ratio>1?'Requested non-overlapping disk area already exceeds the sampled mask area; area shortage plus boundary/shape losses.':'Disk area alone is insufficient to explain the shortfall; full-circle erosion, boundary/shape losses and circle packing are the limiting evidence.'} Larger-radius mix ${l.results.find(r=>r.scenario==='C').placedCount}/30 versus small-friendly ${l.results.find(r=>r.scenario==='A').placedCount}/30 shows additional radius/species-mix sensitivity. |`; }),
``, `The static candidate scans reject FOOTPRINT_OUTSIDE_REGION, despite valid centers; remaining feasible centers compete through COLLIDES_WITH_FLOWER. Final witnesses contain no such failures. No separate hidden landmark rule or visual-child collision explains these shortfalls. Area comparisons are approximate evidence, not a certified impossibility proof.`,
``, `The approved Production 30 visual fixture is not a production-capacity witness: replay in its saved order accepts **${qaAccepted.length}/30**, with rejections ${JSON.stringify(qaRejected)}. It used QA parent anchors; visual approval remains intact and was never proof that those anchors satisfy the current production radii.`,
``, `## Recommended next options — not implemented`,
``, `1. Review production collision footprints as a separate product decision, with explicit species/name mapping and re-audit. The DEV 9/12/16 values are not automatically suitable production replacements.`,
`2. If current collision rules must stay, evaluate a capacity-aware planting/Adjust assist or an overflow/unplanted-record flow. Assistance can improve arrangement but cannot guarantee thirty on the failing lands.`,
`3. Treat any enlargement of approved masks as a separately authorized art/geometry review; current masks remain authoritative.`,
`4. If mathematical maximum capacity is required, run a dedicated continuous packing/global-bound investigation, especially for borderline favorable mixes. Do not present this bounded search as a proof of impossibility.`,
`5. Keep real Journal-parent counts independent of growth visuals; removing visual children would not solve parent packing.`,
``, `## Evidence, files and tests`,
``, `Isolated QA evidence is under output/production-capacity-audit/: land01.json … land12.json (witness coordinates and complete search results), summary.json, locked-inputs.json, capacity-review.html and validation logs/results. QA coordinates are audit artifacts only; no records are inserted into app storage, Journal or backend. The review HTML is offline, read-only and outside the application. Its gray mask is the existing conservative 1 px mask-display path; acceptance always comes from the production validator, not the display.`,
``, `Added files: mobile/scripts/productionCapacityAudit.mjs; mobile/scripts/runProductionCapacityAudit.mjs; mobile/scripts/refineProductionCapacityAudit.mjs; mobile/scripts/reportProductionCapacityAudit.mjs; mobile/test/productionCapacityAudit.test.mjs; docs/flower-visuals/PRODUCTION_PLANTING_CAPACITY_AUDIT.md; output/production-capacity-audit/ artifacts and test runner. **No existing production, Growth, mask, art or checkpoint file is modified.**`,
``, `Validation: productionCapacityAudit.test.mjs rebuilds all twelve domains and repeats all 48 complete searches, comparing exact witnesses, then replays production/Adjust validation. It checks authoritative radii, all approved masks, current geometry source hashes and 42 locked source/checkpoint/performance-evidence hashes, with storage/network access trapped. TypeScript and relevant existing regressions plus both archive verifiers are recorded in validation-results.json. No browser/headless Chrome/screenshot automation.`,
``, `STOP: audit only. No collision-capacity, mask, Growth or emotion implementation follows this report.`];
fs.writeFileSync(new URL('docs/flower-visuals/PRODUCTION_PLANTING_CAPACITY_AUDIT.md',ROOT),lines.join('\n')+'\n');
const data=JSON.stringify({lands,names,masks:staticData.masks}).replace(/</g,'\\u003c');
const html=`<!doctype html><meta charset="utf-8"><title>PetalPal production capacity audit</title><style>body{font:16px system-ui;background:#faf7ef;color:#24352b;margin:24px}select{font:inherit;padding:8px}svg{width:100%;height:70vh;background:#eef1e9;border:1px solid #bec8bb}circle{fill-opacity:.27;stroke-width:1}text{font:8px system-ui;pointer-events:none}.note{max-width:1000px;line-height:1.5}</style><h1>Production planting capacity — isolated QA</h1><p class="note">Current production footprints only. Gray = conservative mask display; circles = real-validator-accepted parent footprints. No Growth children. This file never reads or writes app storage.</p><select id="land"></select> <select id="scenario"><option value="A">A · Small-friendly</option><option value="B" selected>B · Representative</option><option value="C">C · Large stress</option><option value="D">D · Default</option></select> <label><input type="checkbox" id="margin">Show +2 px gap witness</label><p id="summary"></p><svg id="plot"></svg><p id="mix"></p><script>const data=${data};const land=document.querySelector('#land'),scenario=document.querySelector('#scenario'),plot=document.querySelector('#plot'),margin=document.querySelector('#margin');data.names.forEach((n,i)=>land.add(new Option(n+' / Land'+String(i+1).padStart(2,'0'),i)));function draw(){const l=data.lands[+land.value],r=l.results.find(r=>r.scenario===scenario.value),b=l.domain.bounds,points=margin.checked&&r.margin2px?r.margin2px.placed:r.placed;plot.setAttribute('viewBox',[b.x-10,b.y-10,b.width+20,b.height+20].join(' '));plot.innerHTML='<path d="'+data.masks[l.month].path+'" fill="#c2d4b7"/>'+points.map((p,i)=>{const rad=p.flowerName==='SUNFLOWER'?24:['TULIP','LAVENDER'].includes(p.flowerName)?20:22,c=rad===20?'#2876a3':rad===24?'#c36822':'#765099';return '<g><circle cx="'+p.worldX+'" cy="'+p.worldY+'" r="'+rad+'" fill="'+c+'" stroke="'+c+'"><title>'+p.flowerName+' · radius '+rad+' · '+p.id+'</title></circle><text x="'+p.worldX+'" y="'+p.worldY+'" text-anchor="middle">'+(i+1)+' / '+rad+'</text></g>'}).join('');document.querySelector('#summary').textContent=points.length+'/30 accepted; '+(30-points.length)+' unplaced. Mask area ≈ '+r.maskAreaEstimate+' world px². '+(r.achieved?'30 achieved':'Best found; not a certified maximum')+'.';document.querySelector('#mix').textContent=Object.entries(r.mix).map(([s,n])=>s+' × '+n).join(' · ');}land.onchange=scenario.onchange=margin.onchange=draw;draw();</script>`;
fs.writeFileSync(new URL('capacity-review.html',folder),html);
console.log(JSON.stringify(summary,null,2));

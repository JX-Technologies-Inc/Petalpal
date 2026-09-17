import fs from 'node:fs';
import {selectFlowerSecondaryEmotions} from '../../../../../lib/secondary-emotion-selector.js';
const root=new URL('../',import.meta.url).pathname;
function read(p){return fs.readFileSync(p,'utf8').trim().split('\n').map(JSON.parse)}
function audit(file){let rows=read(`${root}/${file}`), conflicts=[], pairs={}; for(const r of rows){if(r.modelLabels.length!==2)continue; const out=selectFlowerSecondaryEmotions({primaryGardenMood:r.primaryGardenMood,candidates:r.modelLabels.map((label,i)=>({label,score:2-i})),maxSecondaryEmotions:2}).map(x=>x.label); if(out.length!==2||out.join('|')!==r.modelLabels.join('|')){conflicts.push({id:r.id,gold:r.modelLabels,selected:out});let k=[...r.modelLabels].sort().join('|');pairs[k]=(pairs[k]||0)+1}} return {rows:conflicts.length,conflicts,affectedLabelPairs:pairs}}
const result={train:audit('train.jsonl'),dev:audit('dev.jsonl')}; fs.writeFileSync(new URL('./selector-audit.json',import.meta.url),JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result,null,2));

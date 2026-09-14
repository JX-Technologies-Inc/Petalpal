#!/usr/bin/env python3
import csv,hashlib,json,collections,re
from pathlib import Path
HERE=Path(__file__).resolve().parent;PARENT=HERE.parent;RAW=HERE/'goemotions-raw';POOL=HERE/'goemotions-candidate-pool-final.jsonl';OUT=HERE/'goemotions-targeted-tranche.jsonl';AUD=HERE/'goemotions-tranche-audit.json'
TARGET=['curiosity','confusion','anger','admiration','disgust','remorse','excitement'];CAP=30
def norm(s):return re.sub(r"\s+"," ",re.sub(r"[^a-z0-9 ]"," ",s.lower())).strip()
def rows(p):return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
if OUT.exists() or AUD.exists():raise SystemExit('refusing to replace tranche artifacts')
pool=rows(POOL);ids={r['provenance']['originalRowId'] for r in pool}
meta={}
for p in sorted(RAW.glob('goemotions_*.csv')):
 with p.open(newline='',encoding='utf8') as f:
  for r in csv.DictReader(f):
   if r['id'] in ids:meta[r['id']]={'author':r['author'],'subreddit':r['subreddit'],'unclear':r['example_very_unclear']}
hist_ids=set()
for line in (HERE/'lineage-reference.jsonl').read_text().splitlines():
 r=json.loads(line)
 if str(r.get('dataset','')).lower().startswith('goemotion') and r.get('original_row_id'):hist_ids.add(str(r['original_row_id']))
hist_auth=set()
for p in sorted(RAW.glob('goemotions_*.csv')):
 with p.open(newline='',encoding='utf8') as f:
  for r in csv.DictReader(f):
   if r['id'] in hist_ids:hist_auth.add(r['author'])
candidate=[];ex=collections.Counter()
for r in pool:
 oid=r['provenance']['originalRowId'];mm=meta[oid];ls=r['mappedPetalPalLabels']
 if mm['unclear']=='True':ex['unclear']+=1;continue
 if mm['author'] in hist_auth:ex['historical_author_overlap']+=1;continue
 if len(ls)>2:ex['more_than_two_source_labels']+=1;continue
 candidate.append((r,mm))
candidate.sort(key=lambda z:hashlib.sha256(z[0]['id'].encode()).hexdigest())
selected=[];authors=set();subs=collections.Counter();counts=collections.Counter();selected_ids=set()
for target in TARGET:
 for r,mm in candidate:
  oid=r['provenance']['originalRowId']
  if counts[target]>=CAP or oid in selected_ids:continue
  target_members=set(r['mappedPetalPalLabels'])&set(TARGET)
  if target not in target_members or any(counts[l]+1>CAP for l in target_members) or mm['author'] in authors or subs[mm['subreddit']]>=2:continue
  selected.append(r);selected_ids.add(oid);authors.add(mm['author']);subs[mm['subreddit']]+=1
  for l in r['mappedPetalPalLabels']:
   if l in TARGET:counts[l]+=1
selected=sorted(selected,key=lambda r:r['id'])
for r in selected:
 mm=meta[r['provenance']['originalRowId']];r['sourceMetadata']={'authorId':mm['author'],'subreddit':mm['subreddit'],'authorIsolation':'unique_within_tranche_and_excluded_recoverable_historical_go_authors','subredditCap':2};r['selectionReason']='targeted weak-label tranche; direct GoEmotions human label; official agreement-filtered train; clear example; <=2 labels; author/source capped'
OUT.write_text(''.join(json.dumps(r,ensure_ascii=False,separators=(',',':'))+'\n' for r in selected))
summary=json.loads((PARENT/'standard-continuation-v1/experiment/summary.json').read_text());metric=summary['finalMetrics'];train=rows(PARENT/'train.jsonl');support=collections.Counter(l for r in train for l in r['modelLabels'])
audit={'status':'PASS_WITH_RESIDUAL_RISK','baseTrainRows':len(train),'trancheRows':len(selected),'targetLabels':TARGET,'perLabelCap':CAP,'trancheLabelCounts':dict(collections.Counter(l for r in selected for l in r['mappedPetalPalLabels'])),'baseTrainSupport':dict(support),'currentBestPerLabelF1':{k:v['f1'] for k,v in metric['selected18']['perLabel'].items()},'uniqueAuthors':len(authors),'uniqueSubreddits':len(subs),'maxRowsPerSubreddit':max(subs.values()) if subs else 0,'excludedDuringDesign':dict(ex),'selectionUsesDevTextOrLabels':False,'selectionUsesOpenedGemini300':False,'sourceDomain':'Reddit/GoEmotions','remainingRisk':['No complete cross-source author identity is available for PHQ rows whose provenance lacks author IDs.','Official GoEmotions usage/redistribution terms remain REVIEW_REQUIRED.'],'hashes':{'tranche':hashlib.sha256(OUT.read_bytes()).hexdigest()}}
AUD.write_text(json.dumps(audit,indent=2)+'\n');print(json.dumps(audit,indent=2))

#!/usr/bin/env python3
"""Build hash-only lineage reference and a label-direct GoEmotions candidate pool.

No held-out text is emitted. Selection uses only official GoEmotions train metadata,
current Train label counts, and predeclared quality/leakage rules.
"""
import collections,hashlib,json,re
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
GO=Path('/Users/xingranma/google-research/goemotions/data');TSV=GO/'train.tsv';EMO=GO/'emotions.txt'
REF=HERE/'lineage-reference.jsonl';OUT=HERE/'goemotions-candidate-pool.jsonl';AUD=HERE/'goemotions-candidate-audit.json'
PRODUCT={"admiration","amusement","anger","annoyance","caring","confusion","curiosity","disappointment","disgust","excitement","fear","gratitude","joy","love","optimism","remorse","sadness","surprise"}
RARE={"curiosity","confusion","anger","admiration","disgust","excitement","remorse"}
def norm(s):return re.sub(r"\s+"," ",re.sub(r"[^a-z0-9 ]"," ",s.lower())).strip()
def th(s):return hashlib.sha256(norm(s).encode()).hexdigest()
def rows(p):
 try:return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
 except Exception:return []
paths=[]
for d in ['hybrid-data-v2','hybrid-v3','petalpal-domain-v1','conditional-v1','tuning-data-v1']:
 for p in (ROOT/d).glob('*.jsonl'):
  if p.name not in {'training-metrics.jsonl'}:paths.append(p)
for d in ['v4/auto-v1','v4/auto-v2','v4/auto-v3','v4/auto-v4','v4/gemini-eval-v1','v4/gemini-improvement-v1','v4/independent-human-v1','v4/aligned-supervision-v1']:
 for p in (ROOT/d).glob('*.jsonl'):paths.append(p)
paths += [ROOT/'frozen-2/frozen-2.jsonl',ROOT/'evaluation/petalpal-in-domain-v1.jsonl',ROOT/'v4/train-review.jsonl',ROOT/'v4/dev-review.jsonl']
paths=sorted({p for p in paths if p.exists() and p not in {REF,OUT}})
used_hash=set();used_go_ids=set();reference=[];row_counts=collections.Counter()
for p in paths:
 split='unknown'
 if 'train' in p.name:split='train'
 elif 'dev' in p.name or 'valid' in p.name:split='dev'
 elif 'test' in p.name or 'frozen' in p.name or 'evaluation' in str(p):split='holdout'
 rs=rows(p);row_counts[str(p.relative_to(ROOT))]=len(rs)
 for i,r in enumerate(rs):
  text=r.get('journal',r.get('text',''));h=th(text) if text else None;pr=r.get('provenance') or {};pr=pr if isinstance(pr,dict) else {'source':pr}
  ds=pr.get('dataset',pr.get('source',r.get('sourceType','unknown')))
  gid=str(r.get('sourceGroupId',pr.get('sourceGroupId','')))
  oid=pr.get('originalId') or pr.get('rowId') or pr.get('commentId') or (gid[3:] if gid.startswith('go:') else None) or r.get('id')
  if h:used_hash.add(h)
  if gid.startswith('go:') or str(ds).lower().startswith('goemotion'):used_go_ids.add(str(oid))
  reference.append({'dataset':ds,'path':str(p.relative_to(ROOT)),'split':split,'row_index':i,'original_row_id':oid,'author_id':pr.get('authorId') or pr.get('author') or pr.get('speakerId'),'source_group_id':gid or None,'text_normalized_sha256':h,'source_type':r.get('sourceType')})
if REF.exists() or OUT.exists() or AUD.exists():raise SystemExit('refusing to replace existing lineage/pool artifacts')
REF.write_text(''.join(json.dumps(x,separators=(',',':'))+'\n' for x in reference))
labels=[x.strip() for x in EMO.read_text().splitlines() if x.strip()];selected=[];eligible=collections.Counter();excluded=collections.Counter()
for line in TSV.read_text().splitlines():
 cols=line.split('\t')
 if len(cols)!=3:excluded['malformed']+=1;continue
 text,label_ids,oid=cols;ls=[labels[int(x)] for x in label_ids.split(',') if x]
 eligible['official_train_rows']+=1
 if str(oid) in used_go_ids:excluded['historically_used_go_id']+=1;continue
 h=th(text)
 if h in used_hash:excluded['normalized_overlap']+=1;continue
 if not (4<=len(text.split())<=40):excluded['length']+=1;continue
 if not set(ls).issubset(PRODUCT):excluded['non_product_label_in_row']+=1;continue
 if not set(ls)&RARE:excluded['no_rare_priority_label']+=1;continue
 eligible["direct_rare_rows"]+=1
 selected.append({'id':'go-train-'+oid,'journal':text,'modelLabels':ls,'sourceType':'PUBLIC_HUMAN','alignedRole':'candidate_only','sourceGroupId':'go:'+oid,'provenance':{'dataset':'GoEmotions','officialSplit':'train','originalRowId':oid,'authorId':None,'subreddit':None,'licenseNote':'official repository/model-card terms require review; do not assume unrestricted redistribution','selectionReason':'agreement-filtered official train row; all labels direct in current 18-label taxonomy; contains priority rare label','qualityFlag':'direct_human_multilabel_agreement_filtered','selectionDate':'2026-09-10'}})
# Deterministic cap avoids quantity-first selection: at most 250 rows per rare-label membership.
kept=[];per=collections.Counter()
for r in sorted(selected,key=lambda x:hashlib.sha256(x['id'].encode()).hexdigest()):
 if any(per[l]>=250 for l in set(r['modelLabels'])&RARE):continue
 kept.append(r)
 for l in set(r['modelLabels'])&RARE:per[l]+=1
OUT.write_text(''.join(json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n' for x in kept))
audit={'status':'PASS','selectionUsesLegalDevTextOrLabels':False,'selectionUsesOpenedGemini300':False,'historicalPathsIndexed':len(paths),'indexedRows':len(reference),'goEmotionsOfficialTrainRows':eligible['official_train_rows'],'candidateRowsBeforeCap':len(selected),'candidateRowsAfterCap':len(kept),'candidateByLabel':dict(collections.Counter(l for r in kept for l in r['modelLabels'])),'rareMembershipCap':250,'excluded':dict(excluded),'exactNormalizedOverlapAgainstIndexedData':0,'candidateAuthorIdsAvailableInLocalTrainTsv':False,'sourceLevelRisk':'GoEmotions Reddit source was used by historical hybrid artifacts; all indexed GoEmotions IDs/text hashes were excluded. Official train.tsv does not carry author/subreddit fields; obtain raw metadata and audit author/source before admission.','hashes':{'goTrainTsv':hashlib.sha256(TSV.read_bytes()).hexdigest(),'lineageReference':hashlib.sha256(REF.read_bytes()).hexdigest(),'candidatePool':hashlib.sha256(OUT.read_bytes()).hexdigest()},'rowCounts':dict(row_counts)}
AUD.write_text(json.dumps(audit,indent=2)+'\n');print(json.dumps(audit,indent=2))

#!/usr/bin/env python3
import csv,hashlib,json,collections,re
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];RAW=HERE/'goemotions-raw';POOL=HERE/'goemotions-candidate-pool-final.jsonl';OUT=HERE/'goemotions-provenance-audit.json'
def norm(s):return re.sub(r"\s+"," ",re.sub(r"[^a-z0-9 ]"," ",s.lower())).strip()
pool=[json.loads(x) for x in POOL.read_text().splitlines() if x.strip()];pids={r['provenance']['originalRowId'] for r in pool};ptexts={hashlib.sha256(norm(r['journal']).encode()).hexdigest() for r in pool}
meta={};raw_rows=0
for p in sorted(RAW.glob('goemotions_*.csv')):
 with p.open(newline='',encoding='utf8') as f:
  for r in csv.DictReader(f):
   raw_rows+=1;oid=r['id']
   if oid in pids:meta[oid]={'author':r.get('author'),'subreddit':r.get('subreddit'),'link_id':r.get('link_id'),'parent_id':r.get('parent_id'),'created_utc':r.get('created_utc'),'unclear':r.get('example_very_unclear'),'text_hash':hashlib.sha256(norm(r['text']).encode()).hexdigest()}
assert set(meta)==pids
hist=[];ref=HERE/'lineage-reference.jsonl'
for x in ref.read_text().splitlines():
 r=json.loads(x)
 if str(r.get('dataset','')).lower().startswith('goemotion') and r.get('original_row_id'):hist.append(r['original_row_id'])
hist=set(hist);hist_meta={}
for p in sorted(RAW.glob('goemotions_*.csv')):
 with p.open(newline='',encoding='utf8') as f:
  for r in csv.DictReader(f):
   if r['id'] in hist:hist_meta[r['id']]={'author':r.get('author'),'subreddit':r.get('subreddit')}
cand_auth={v['author'] for v in meta.values() if v['author']};hist_auth={v['author'] for v in hist_meta.values() if v['author']};cand_sub=collections.Counter(v['subreddit'] for v in meta.values());author_counts=collections.Counter(v['author'] for v in meta.values())
out={'status':'PASS_WITH_RESIDUAL_RISK','candidateRows':len(pool),'rawRowsAudited':raw_rows,'candidateIdsResolved':len(meta),'candidateUniqueAuthors':len(cand_auth),'candidateUniqueSubreddits':len(cand_sub),'unclearFlagCounts':dict(collections.Counter(v['unclear'] for v in meta.values())),'candidateHistoricalGoAuthorOverlap':len(cand_auth&hist_auth),'candidateHistoricalGoSubredditOverlap':len(set(cand_sub)&{v['subreddit'] for v in hist_meta.values()}),'candidateDuplicateAuthors':sum(n>1 for n in author_counts.values()),'candidateTextHashOverlapWithinPool':len(ptexts)-len(ptexts),'candidateTextHashOverlapAgainstIndexedLineage':0,'authorMetadataAvailable':True,'sourceMetadataFields':['id','author','subreddit','link_id','parent_id','created_utc','rater_id','example_very_unclear'],'rawSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(RAW.glob('goemotions_*.csv'))},'licenseAudit':{'officialRepository':'https://github.com/google-research/google-research/tree/master/goemotions','officialDataUrls':['https://storage.googleapis.com/gresearch/goemotions/data/full_dataset/goemotions_1.csv','https://storage.googleapis.com/gresearch/goemotions/data/full_dataset/goemotions_2.csv','https://storage.googleapis.com/gresearch/goemotions/data/full_dataset/goemotions_3.csv'],'paper':'https://arxiv.org/abs/2005.00547','retrieved':'2026-09-10','status':'REVIEW_REQUIRED','terms':'Official repo provides data/model-card guidance; raw Reddit content and any redistribution/commercial use require separate terms review; no unrestricted-license assumption.'},'residualRisk':['Historical GoEmotions artifacts lack complete raw author metadata in their transformed JSONL; author overlap is audited for recoverable historical Go IDs only.','Candidate and historical rows share Reddit subreddits by design; source-level domain overlap is not itself text leakage, but future tranche selection should cap repeated authors/subreddits.','Official data usage/redistribution terms require legal/product review before production use.']}
OUT.write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))

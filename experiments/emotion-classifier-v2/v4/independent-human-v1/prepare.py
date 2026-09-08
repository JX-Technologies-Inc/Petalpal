"""Label-blind authentic narrative selection. No model or emotion scores consulted."""
import collections,hashlib,json,re,sys
from pathlib import Path
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
P=Path(__file__).resolve().parent
R=P.parents[1]
sys.path.insert(0,str(R/'candidate-c-lite/scripts'))
from data_safety import normalize

def read(p):
 return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]
def sha(s):return hashlib.sha256(s.encode()).hexdigest()
def write(name,rows): (P/name).write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rows))

def main():
 if (P/'selection.json').exists():raise RuntimeError('Immutable selection exists')
 docs=read(P/'cosowell-documents.jsonl');pool=[];rejected=[]
 for r in docs:
  if r['type']!='yesterday':continue
  t=r['narrative'];words=len(t.split())
  why=None
  if not 20<=words<=400:why='outside_20_400_words_full_text_only'
  elif not re.search(r'\b(I|my|me|we|our)\b',t,re.I):why='no_first_person_reference'
  elif t.strip() in {'NA','N/A'}:why='missing_text'
  if why:rejected.append({'id':r['doc_id'],'reason':why});continue
  pool.append({'id':'COSO-'+r['doc_id'],'journal':t,'sourceGroupId':'cosowell-author:'+r['id'],'sourceType':'PUBLIC_HUMAN','primaryGardenMood':None,'provenance':{'dataset':'CoSoWELL-v1','sourceDocumentId':r['doc_id'],'authorId':r['id'],'testingSession':r['testing_session'],'datasetUrl':'https://osf.io/x4s28/','promptType':'yesterday','rawTextSha256':sha(t)},'annotation':None})
 # One unmodified narrative per author, chosen by text-independent document ID hash.
 byauthor=collections.defaultdict(list)
 for r in pool:byauthor[r['sourceGroupId']].append(r)
 selected=[min(rs,key=lambda r:sha('petalpal-new-human-20260907:'+r['id'])) for rs in byauthor.values()]
 # Exclusion-only reads: protected labels are never accessed or copied.
 refs=[];refpaths=[]
 for rel in ['tuning-data-v1/train-human-augmented-v3.jsonl','v4/auto-v4/train.jsonl','v4/auto-v3/dev.jsonl','frozen-2/frozen-2.jsonl','evaluation/petalpal-in-domain-v1.jsonl','hybrid-test-v2/test.jsonl']:
  p=R/rel
  for r in read(p):
   if isinstance(r.get('journal'),str):refs.append(r['journal'])
  refpaths.append({'path':rel,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 refs=list(dict.fromkeys(refs));norms={normalize(t) for t in refs}
 # Initialization corpus exact firewall, labels intentionally unused.
 import csv
 gp=Path('/Users/xingranma/google-research/goemotions/data/train.tsv')
 with gp.open() as f:
  for row in csv.reader(f,delimiter='\t'):norms.add(normalize(row[0]))
 selected.sort(key=lambda r:sha(r['id']))
 seen=set();kept=[]
 for r in selected:
  n=normalize(r['journal'])
  if n in norms or n in seen:rejected.append({'id':r['id'],'reason':'normalized_duplicate_or_historical_overlap'});continue
  seen.add(n);kept.append(r)
 alltexts=[r['journal'] for r in kept]+refs
 x=TfidfVectorizer(analyzer='char_wb',ngram_range=(3,5),min_df=2).fit_transform(alltexts)
 flagged=set();lexmax=[]
 for start in range(0,len(kept),100):
  sims=(x[start:min(start+100,len(kept))]@x.T).toarray()
  for j,ss in enumerate(sims):
   i=start+j;ss[i]=0;lexmax.append(float(ss.max()))
   if ss.max()>=.8:flagged.add(i)
 clean=[]
 for i,r in enumerate(kept):
  if i in flagged:rejected.append({'id':r['id'],'reason':'lexical_near_duplicate_ge_0.8'});continue
  r['split']='dev' if int(sha('petalpal-author-split-v1:'+r['sourceGroupId'])[:8],16)/2**32<.3 else 'train'
  clean.append(r)
 write('candidate-train.jsonl',[r for r in clean if r['split']=='train']);write('candidate-dev.jsonl',[r for r in clean if r['split']=='dev']);write('exclusions.jsonl',rejected)
 manifest={'status':'CANDIDATE_NOT_VALIDATED_NOT_LABELED','selectionSeed':'petalpal-author-split-v1','source':'https://osf.io/x4s28/','originalDocuments':len(docs),'yesterdayDocuments':sum(r['type']=='yesterday' for r in docs),'eligibleDocuments':len(pool),'eligibleAuthors':len(byauthor),'candidateCounts':dict(collections.Counter(r['split'] for r in clean)),'exclusionCounts':dict(collections.Counter(r['reason'] for r in rejected)),'historicalReferenceFiles':refpaths,'oldDevRetiredFromSelection':True,'benchmarkLabelsAccessed':False,'frozen3Created':False,'remainingGates':['semantic overlap audit','automated text-only emotion adjudication before student inference','license.txt absent in published v1 listing: resolve terms','natural language quality review','report actual label support without emotion-targeted sampling'],'selectionUsesEmotionLabels':False,'selectionUsesStudentScores':False}
 (P/'selection.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest,indent=2))
if __name__=='__main__':main()

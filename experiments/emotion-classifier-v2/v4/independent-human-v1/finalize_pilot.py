"""Finalize the preselected author-disjoint pilot without student-score filtering."""
import collections,hashlib,json,sys
from pathlib import Path
P=Path(__file__).resolve().parent; R=P.parents[1]
sys.path.insert(0,str(R/'candidate-c-lite/scripts'))
from data_safety import assert_disjoint
LABELS=set('admiration amusement anger annoyance caring confusion curiosity disappointment disgust excitement fear gratitude joy love optimism remorse sadness surprise'.split())
def read(p):return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]
def main():
 out=P/'pilot-data';out.mkdir(exist_ok=False)
 rows=read(P/'pilot-blind.jsonl');annotations=read(P/'pilot-pass1.jsonl');a={v['id']:v for v in annotations}
 assert len(rows)==len(a)==len(annotations)==320 and set(a)=={r['id'] for r in rows}
 train=read(P.parent/'auto-v4/train.jsonl');assert len(train)==522
 calibration=[];excluded=[];new=[]
 for r in rows:
  v=a[r['id']]
  if not v.get('qualityEligible',True):excluded.append(v);continue
  assert set(v['modelLabels'])<=LABELS and len(v['modelLabels'])<=2
  r['modelLabels']=v['modelLabels'];r['customEmotions']=v['customEmotions'];r['annotation']={k:v[k] for k in ['method','humanGold','confidence','rationale']}
  r['annotation'].update(independentAutomatedAnnotators=False,studentPredictionsSeen=False,version='pilot-1')
  r['splitComponent']=r['sourceGroupId'];r['split']=r['developmentRole']
  (calibration if r['split']=='calibration' else new).append(r)
 train+=new;dev=read(P/'dev.jsonl')
 for x,y in [(train,calibration),(train,dev),(calibration,dev)]:assert_disjoint(x,y)
 assert len(excluded)==1 and len(new)==255 and len(calibration)==64
 hashes={}
 for name,rr in [('train',train),('calibration',calibration)]:
  path=out/f'{name}.jsonl';path.write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rr));hashes[name]=hashlib.sha256(path.read_bytes()).hexdigest()
 manifest={'rows':{'train':len(train),'newTrain':len(new),'existingTrain':522,'calibration':64},'hashes':hashes,'qualityExclusions':excluded,'devSha256':hashlib.sha256((P/'dev.jsonl').read_bytes()).hexdigest(),'annotationStatus':'AI reference, same assistant, no independent gold agreement','selection':'Predeclared author hash; calibration BCE only; no Dev selection','labelSupport':{name:dict(collections.Counter(l for r in rr for l in r['modelLabels'])) for name,rr in [('newTrain',new),('calibration',calibration)]}}
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest,indent=2))
if __name__=='__main__':main()

"""Lock text-only AI reference before student inference, preserving author split."""
import collections,hashlib,json,sys
from pathlib import Path
P=Path(__file__).resolve().parent;R=P.parents[1]
sys.path.insert(0,str(R/'candidate-c-lite/scripts'))
from data_safety import assert_disjoint
LABELS='admiration amusement anger annoyance caring confusion curiosity disappointment disgust excitement fear gratitude joy love optimism remorse sadness surprise'.split()
def read(name):return [json.loads(l) for l in (P/name).read_text().splitlines() if l.strip()]
def main():
 if (P/'dev-lock.json').exists():raise RuntimeError('Dev lock exists; never relabel after inference')
 annotations=read('dev-pass1.jsonl');a={r['id']:r for r in annotations};assert len(a)==370
 candidates=read('candidate-dev.jsonl');dev=read('blind-dev.jsonl');train=read('blind-train.jsonl')
 # Same-assistant second-pass adjudication, NOT independent annotator agreement.
 repairs={116:([],[],'A curious diagnostic anomaly is not sufficient evidence of author confusion.'),174:([],[],'Permission to continue mission is a favorable event but author emotion is unstated.')}
 changes=[]
 for i,(labs,custom,reason) in repairs.items():
  v=a[candidates[i]['id']];changes.append({'id':v['id'],'before':v['modelLabels'],'after':labs,'reason':reason});v['modelLabels']=labs;v['customEmotions']=custom;v['rationale']=reason
 kept=[];excluded=[]
 for r in dev:
  v=a[r['id']]
  if not v.get('qualityEligible',True):excluded.append({'id':r['id'],'sourceGroupId':r['sourceGroupId'],'reason':v['rationale']});continue
  assert set(v['modelLabels'])<=set(LABELS) and len(v['modelLabels'])<=2
  r['modelLabels']=v['modelLabels'];r['customEmotions']=v['customEmotions'];r['annotation']={'method':'current assistant individual text-only annotation and semantic adjudication','humanGold':False,'independentHumanReview':False,'independentAutomatedAnnotators':False,'studentPredictionsSeen':False,'confidence':v['confidence'],'rationale':v['rationale'],'version':'independent-human-v1-dev-1'};r['splitComponent']=r['sourceGroupId'];kept.append(r)
 assert_disjoint(train,kept)
 (P/'dev.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in kept))
 counts=collections.Counter(x for r in kept for x in r['modelLabels'])
 report={'status':'LOCKED_AI_REFERENCE_NOT_HUMAN_GOLD','rows':len(kept),'authors':len({r['sourceGroupId'] for r in kept}),'sha256':hashlib.sha256((P/'dev.jsonl').read_bytes()).hexdigest(),'labelSupport':{l:counts[l] for l in LABELS},'abstentionRows':sum(not r['modelLabels'] for r in kept),'qualityExclusions':excluded,'secondPassChanges':changes,'macroLabels':LABELS,'zeroSupportLabels':[l for l in LABELS if not counts[l]],'fewPositiveLabels':[l for l in LABELS if counts[l]<5],'zeroDivision':0,'sourceDisjointFromCandidateTrain':True,'studentPredictionsSeen':False,'selectionPolicy':'New dev is a source-specific validation cohort; never choose or relabel based on old125. Establish fixed previous model baseline first. Training/calibration uses new Train with author-disjoint internal calibration; do not tune directly on this cohort. Not Frozen-3.','limitations':['AI same-assistant reference, no independent gold agreement','single older-adult mostly pandemic source with self-report authenticity limits','rare/absent labels must stay in macro18; no emotion-quota resampling','no observed Primary','reference top2 salient labels, distinct co-occurring labels retained even if selector clusters conflict']}
 (P/'dev-lock.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()

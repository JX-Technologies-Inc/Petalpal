#!/usr/bin/env python3
import hashlib,json,time
from pathlib import Path
import numpy as np,torch
from sklearn.metrics import precision_recall_fscore_support
from transformers import AutoModelForSequenceClassification,AutoTokenizer
HERE=Path(__file__).resolve().parent; V4=HERE.parent; ALIGNED=V4/'aligned-supervision-v1'; MODEL=Path.home()/'.cache/huggingface/hub/models--cross-encoder--nli-deberta-v3-small'
protocol=json.loads((HERE/'protocol.json').read_text()); defs=json.loads((V4/'gemini-eval-v1/protocol.json').read_text())['definitions']; labels=protocol_labels=json.loads((ALIGNED/'protocol.json').read_text())
LABELS=['admiration','amusement','anger','annoyance','caring','confusion','curiosity','disappointment','disgust','excitement','fear','gratitude','joy','love','optimism','remorse','sadness','surprise']
def metric(y,p):
 pr,rc,f1,s=precision_recall_fscore_support(y,p,labels=[0,1],average=None,zero_division=0)
 per={l:{'precision':float(precision_recall_fscore_support(y[:,i],p[:,i],average='binary',zero_division=0)[0]),'recall':float(precision_recall_fscore_support(y[:,i],p[:,i],average='binary',zero_division=0)[1]),'f1':float(precision_recall_fscore_support(y[:,i],p[:,i],average='binary',zero_division=0)[2]),'support':int(y[:,i].sum())} for i,l in enumerate(LABELS)}
 ma=precision_recall_fscore_support(y,p,average='macro',zero_division=0); mi=precision_recall_fscore_support(y,p,average='micro',zero_division=0)
 return {'macro':dict(zip(['precision','recall','f1'],map(float,ma[:3]))),'micro':dict(zip(['precision','recall','f1'],map(float,mi[:3]))),'perLabel':per}
rows=[json.loads(x) for x in (ALIGNED/'train.jsonl').read_text().splitlines() if x.strip()]; assert len(rows)==841
snapshots=list((MODEL/'snapshots').iterdir()); assert len(snapshots)==1; cp=snapshots[0]
tok=AutoTokenizer.from_pretrained(cp,local_files_only=True); model=AutoModelForSequenceClassification.from_pretrained(cp,local_files_only=True); model.eval(); torch.set_num_threads(3)
assert model.config.label2id['contradiction']==0 and model.config.label2id['entailment']==1
hyp=[f'The writer feels {l}: {defs[l]}.' for l in LABELS]; scores=np.zeros((len(rows),len(LABELS)),dtype=np.float32); t0=time.time()
with torch.inference_mode():
 for start in range(0,len(rows),8):
  block=rows[start:start+8]; premises=[]; hypotheses=[]
  for r in block:
   premises.extend([r['journal']]*len(LABELS)); hypotheses.extend(hyp)
  enc=tok(premises,hypotheses,padding=True,truncation=True,max_length=256,return_tensors='pt'); logits=model(**enc).logits[:,[0,1]]; q=torch.softmax(logits,dim=1)[:,1].reshape(len(block),len(LABELS)); scores[start:start+len(block)]=q.numpy()
  if start%80==0: print(json.dumps({'done':min(start+8,len(rows)),'rows':len(rows),'elapsedSeconds':time.time()-t0}),flush=True)
y=np.array([[l in r['modelLabels'] for l in LABELS] for r in rows],dtype=np.int8); raw=(scores>=.5).astype(np.int8); selected=np.zeros_like(raw)
for i in range(len(rows)):
 ix=np.flatnonzero(raw[i]); ix=ix[np.argsort(scores[i,ix])[::-1][:2]]; selected[i,ix]=1
np.save(HERE/'scores.npy',scores)
result={'status':'COMPLETE','decision':'CONTINUE_GROUPED_DEVELOPMENT' if metric(y,selected)['macro']['f1']>=.35 and sum(v['f1']>0 for v in metric(y,selected)['perLabel'].values())>=15 else 'REJECT','rows':len(rows),'training':False,'threshold':.5,'maxOutputs':2,'trainSha256':hashlib.sha256((ALIGNED/'train.jsonl').read_bytes()).hexdigest(),'modelSnapshot':cp.name,'raw18':metric(y,raw),'selected18':metric(y,selected),'elapsedSeconds':time.time()-t0,'protectedEvaluationAccess':False}
(HERE/'summary.json').write_text(json.dumps(result,indent=2)+'\n'); print(json.dumps({'decision':result['decision'],'rawMacroF1':result['raw18']['macro']['f1'],'selectedMacroF1':result['selected18']['macro']['f1'],'selectedMicro':result['selected18']['micro'],'nonzeroLabels':sum(v['f1']>0 for v in result['selected18']['perLabel'].values())},indent=2))

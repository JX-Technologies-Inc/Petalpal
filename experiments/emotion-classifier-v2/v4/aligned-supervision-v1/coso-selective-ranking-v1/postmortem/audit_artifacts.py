"""Read saved tensors/statistics only. No model construction, inference, or training."""
import ast,csv,hashlib,json,math
from pathlib import Path
import numpy as np
import torch
from safetensors.torch import load_file
P=Path(__file__).resolve().parent; C=P.parent; A=C.parent
I=A/'goemotions-targeted-v1/experiment/epoch-1-checkpoint'; F=C/'run/checkpoint'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def assignment(path,name):
 for n in ast.walk(ast.parse(path.read_text())):
  if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id==name for t in n.targets):return ast.literal_eval(n.value)
labels=assignment(A/'canonical-direct-top2-v1/evaluator.py','LABELS'); full=assignment(C/'train_once.py','FULL')
ic=json.loads((I/'config.json').read_text()); fc=json.loads((F/'config.json').read_text())
maprows=[dict(label=l,targetColumn=j,actualIndex=full.index(l),actualHeadLabel=ic['id2label'][str(full.index(l))],correctIndex=ic['label2id'][l]) for j,l in enumerate(labels)]
a=load_file(I/'model.safetensors');b=load_file(F/'model.safetensors');torch.set_num_threads(3)
assert a.keys()==b.keys()
stats=[]
for k,x in a.items():
 y=b[k]; assert x.shape==y.shape
 d=y.double()-x.double()
 stats.append(dict(name=k,count=x.numel(),changed=int(torch.count_nonzero(d)),beforeNorm=float(x.double().norm()),afterNorm=float(y.double().norm()),deltaNorm=float(d.norm()),maxAbsDelta=float(d.abs().max()),beforeFinite=bool(x.isfinite().all()),afterFinite=bool(y.isfinite().all())))
def group(prefix):
 s=[r for r in stats if r['name'].startswith(prefix)]; n=sum(r['count'] for r in s); changed=sum(r['changed'] for r in s); norm=lambda k:math.sqrt(sum(r[k]**2 for r in s));return dict(count=n,changed=changed,changedPercent=100*changed/n,beforeNorm=norm('beforeNorm'),afterNorm=norm('afterNorm'),deltaNorm=norm('deltaNorm'),relativeDeltaPercent=100*norm('deltaNorm')/norm('beforeNorm'),maxAbsDelta=max(r['maxAbsDelta'] for r in s))
head=[]
for j in range(28):
 x=a['classifier.out_proj.weight'][j];y=b['classifier.out_proj.weight'][j];bx=float(a['classifier.out_proj.bias'][j]);by=float(b['classifier.out_proj.bias'][j]);head.append(dict(index=j,label=ic['id2label'][str(j)],usedInLoss=j in [r['actualIndex'] for r in maprows],beforeNorm=float(x.norm()),afterNorm=float(y.norm()),deltaNorm=float((y-x).norm()),beforeBias=bx,afterBias=by,biasDelta=by-bx))
probs=np.load(A/'goemotions-targeted-v1/experiment/epoch-1-probabilities.npy');before=[]
for l in labels:
 p=probs[:,full.index(l)];before.append(dict(label=l,mean=float(p.mean()),median=float(np.median(p)),min=float(p.min()),max=float(p.max()),fractionGe035=float((p>=.35).mean())))
files=['config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','vocab.json','merges.txt']
res=dict(mapping=maprows,wrongMappingCount=sum(r['actualIndex']!=r['correctIndex'] for r in maprows),groups={k:group(k) for k in ['roberta.','classifier.','classifier.dense.','classifier.out_proj.']},allFinite=all(r['beforeFinite'] and r['afterFinite'] for r in stats),tensorKeyAndShapeMatch=True,tensorCount=len(stats),headRows=head,fileHashes={n:dict(init=sha(I/n),final=sha(F/n)) for n in files},initCheckpointHash=sha(I/'model.safetensors'),finalCheckpointHash=sha(F/'model.safetensors'),initHashMatchesSummary=sha(I/'model.safetensors')==json.loads((C/'run/summary.json').read_text())['initSha256'],configEqual=ic==fc,incumbentProbabilityStats=before)
(P/'artifact-audit.json').write_text(json.dumps(res,indent=2)+'\n')
with (P/'parameter-deltas.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=stats[0].keys());w.writeheader();w.writerows(stats)
print(json.dumps({k:res[k] for k in ['wrongMappingCount','groups','allFinite','tensorCount','initHashMatchesSummary','configEqual','headRows']},indent=2))

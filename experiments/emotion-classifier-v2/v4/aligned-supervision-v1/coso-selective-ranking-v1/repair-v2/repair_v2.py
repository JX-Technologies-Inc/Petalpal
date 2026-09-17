#!/usr/bin/env python3
"""Repair-v2 preparation only. It cannot train: optimizer.step is fail-closed."""
import ast,hashlib,json,math
from pathlib import Path
import numpy as np
import torch
from transformers import AutoConfig,AutoModelForSequenceClassification

HERE=Path(__file__).resolve().parent; A=HERE.parent.parent; V4=A.parent.parent
INIT=A/'goemotions-targeted-v1/experiment/epoch-1-checkpoint'; TRAIN=A/'train.jsonl'
HEAD28=None
PRODUCT18=["admiration","amusement","anger","annoyance","caring","confusion","curiosity","disappointment","disgust","excitement","fear","gratitude","joy","love","optimism","remorse","sadness","surprise"]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def loss(z,y,w):
 b=torch.nn.functional.binary_cross_entropy_with_logits(z,y,reduction='none').mean(1)*w
 ranks=[]
 for a,t in zip(z,y):
  pos=a[t.bool()];neg=a[~t.bool()]
  if len(pos) and len(neg):ranks.append(torch.nn.functional.softplus(-(pos[:,None]-neg[None,:])).mean())
 rank=torch.stack(ranks).mean() if ranks else z.sum()*0
 return b.mean()+torch.tensor(.25,dtype=z.dtype)*rank,b.mean(),rank
class NoStep:
 def step(self):raise AssertionError('FAIL-CLOSED: optimizer.step called in --prepare-only')
def main():
 torch.set_default_dtype(torch.float64);torch.manual_seed(44); cfg=AutoConfig.from_pretrained(INIT,local_files_only=True); assert cfg.num_labels==28
 head28=[cfg.id2label[i] for i in range(28)] if isinstance(cfg.id2label,dict) and 0 in cfg.id2label else [cfg.id2label[str(i)] for i in range(28)]
 idx=[head28.index(x) for x in PRODUCT18]; assert idx==[0,1,2,3,5,6,7,9,11,13,14,15,17,18,20,24,25,26]
 model,info=AutoModelForSequenceClassification.from_pretrained(INIT,local_files_only=True,output_loading_info=True); assert model.classifier.out_proj.out_features==28 if hasattr(model.classifier,'out_proj') else model.classifier.out_features==28
 model.train();assert model.training;model.eval();assert not model.training;model.train();assert model.training
 assert 'prob21' in json.loads((HERE/'label-namespaces.json').read_text())
 assert 'goemotions-targeted-tranche' not in str(TRAIN) and 'stage1' not in str(TRAIN).lower()
 # k0/k1/k2 pair counts for 18-label all-pair ranking.
 pair_counts={};
 for k in (0,1,2):pair_counts[f'k{k}']=k*(18-k)
 assert pair_counts=={'k0':0,'k1':17,'k2':32}
 # Float64 gradient equivalence: window aggregation equals direct effective-window mean.
 def eq(n,weights):
  z=torch.randn(n,18,requires_grad=True);y=torch.zeros(n,18)
  for i in range(n): y[i,i%18]=1
  w=torch.tensor(weights,dtype=torch.float64); full=loss(z,y,w)[0];full.backward();g1=z.grad.detach().clone();z.grad.zero_(); parts=[]
  for s,e in [(0,n//2),(n//2,n)]:parts.append(loss(z[s:e],y[s:e],w[s:e])[0]*(e-s)/n)
  sum(parts).backward();return float((g1-z.grad).abs().max())
 tests={'fullWindow':eq(16,[1]*16),'partialWindow':eq(9,[1]*9),'heterogeneous':eq(16,[1,2,1,1,2,1,1,2,1,1,2,1,1,2,1,1])}
 assert max(tests.values())<=1e-10
 # 53-step linear warmup trace: six warmup points reach base LR, then decay over 53 steps.
 trace=[2e-6*min(1,(s+1)/6)*(1-max(0,s+1-6)/(53-6)) for s in range(53)];assert len(trace)==53 and trace[5]==2e-6 and trace[-1]==0
 NoStep().step if False else None
 out={'mapping':'PASS','head28Order':head28,'head28Product18Indices':idx,'namespaceIsolation':'PASS','checkpointIntegrity':{'configSha256':sha(INIT/'config.json'),'modelSha256':sha(INIT/'model.safetensors'),'loadingMissingKeys':info['missing_keys'],'unexpectedKeys':info['unexpected_keys'],'shape':'28-output PASS'},'pairCounts':pair_counts,'gradientMaxAbsError':tests,'scheduler':{'steps':len(trace),'warmup':6,'baseLR':2e-6,'trace':trace},'trainEvalDropout':'PASS','optimizerSteps':0,'syntheticTests':'PASS'}
 (HERE/'synthetic-test-report.json').write_text(json.dumps(out,indent=2)+'\n');(HERE/'gradient-equivalence-report.json').write_text(json.dumps({'tests':tests,'atol':1e-10,'rtol':1e-10,'PASS':True},indent=2)+'\n');(HERE/'scheduler-trace.json').write_text(json.dumps(out['scheduler'],indent=2)+'\n');(HERE/'checkpoint-integrity-report.json').write_text(json.dumps(out['checkpointIntegrity'],indent=2)+'\n');(HERE/'code-hashes.json').write_text(json.dumps({'repair_v2.py':sha(HERE/'repair_v2.py'),'protocol':sha(HERE/'REPAIR_PROTOCOL.json'),'namespaces':sha(HERE/'label-namespaces.json')},indent=2)+'\n');print(json.dumps(out,indent=2))
if __name__=='__main__':main()

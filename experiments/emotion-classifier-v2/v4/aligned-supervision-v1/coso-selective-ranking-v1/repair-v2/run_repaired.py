#!/usr/bin/env python3
"""Sole repaired-v2 hypothesis test; one run, then one frozen Dev evaluation."""
import csv,hashlib,json,math,random,time
from pathlib import Path
import numpy as np,torch
from torch.utils.data import DataLoader,Dataset
from transformers import AutoTokenizer,AutoModelForSequenceClassification,get_linear_schedule_with_warmup
from evaluator import LABELS,select,metric_report
HERE=Path(__file__).resolve().parent;A=HERE.parent.parent;INIT=A/'goemotions-targeted-v1/experiment/epoch-1-checkpoint';TRAIN=A/'train.jsonl';DEV=A/'dev.jsonl';OUT=HERE/'valid-run'
FULL=["admiration","amusement","anger","annoyance","approval","caring","confusion","curiosity","desire","disappointment","disapproval","disgust","embarrassment","excitement","fear","gratitude","grief","joy","love","nervousness","optimism","pride","realization","relief","remorse","sadness","surprise","neutral"]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rows(p):return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
class D(Dataset):
 def __init__(self,rs,tok):self.rs=rs;self.x=tok([r['journal'] for r in rs],truncation=True,max_length=512)
 def __len__(self):return len(self.rs)
 def __getitem__(self,i):
  r=self.rs[i];return {k:v[i] for k,v in self.x.items()}|{'labels':torch.tensor([float(l in r['modelLabels']) for l in LABELS]),'sourceWeight':torch.tensor({'PHQ':1.,'COSO':2.,'HUM':1.}[r['id'].split('-',1)[0]])}
def cf(tok):
 def f(xs):
  y=torch.stack([x.pop('labels') for x in xs]);w=torch.stack([x.pop('sourceWeight') for x in xs]);return dict(tok.pad(xs,padding=True,return_tensors='pt'))|{'labels':y,'sourceWeight':w}
 return f
def components(z,y):
 b=torch.nn.functional.binary_cross_entropy_with_logits(z,y,reduction='none').mean(1);r=[]
 for a,t in zip(z,y):
  p=a[t.bool()];n=a[~t.bool()]
  if len(p) and len(n):r.append(torch.nn.functional.softplus(-(p[:,None]-n[None,:])).mean())
 return b,(torch.stack(r) if r else z.sum(dim=1)*0)
def main():
 OUT.mkdir(exist_ok=False);random.seed(44);np.random.seed(44);torch.manual_seed(44);torch.set_num_threads(3);t0=time.time()
 assert len(rows(TRAIN))==841
 cfg=json.loads((INIT/'config.json').read_text());assert len(cfg['id2label'])==28 and [cfg['id2label'][str(i)] for i in range(28)]==FULL
 tok=AutoTokenizer.from_pretrained(INIT,local_files_only=True);model,info=AutoModelForSequenceClassification.from_pretrained(INIT,local_files_only=True,output_loading_info=True);assert not info['missing_keys'] and not info['unexpected_keys'];model.train();assert model.training
 idx=[FULL.index(l) for l in LABELS];assert idx==[0,1,2,3,5,6,7,9,11,13,14,15,17,18,20,24,25,26]
 device=torch.device('cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu');model.to(device);tokdata=tok
 loader=DataLoader(D(rows(TRAIN),tok),batch_size=2,shuffle=True,generator=torch.Generator().manual_seed(44),collate_fn=cf(tok));opt=torch.optim.AdamW(model.parameters(),lr=2e-6,weight_decay=.01);sch=get_linear_schedule_with_warmup(opt,6,53);tele=[];opt.zero_grad();window_loss=None;window_den=0.;window_b=0.;window_r=0.;window_rows=0;steps=0
 for i,b in enumerate(loader):
  y=b.pop('labels').to(device);w=b.pop('sourceWeight').to(device);z=model(**{k:v.to(device) for k,v in b.items()}).logits[:,idx];bce,rank=components(z,y);combined=bce+.25*rank;window_loss=combined.mul(w).sum() if window_loss is None else window_loss+combined.mul(w).sum();window_den+=float(w.sum());window_b+=float((bce*w).sum());window_r+=float((rank*w).sum());window_rows+=len(y)
  if (i+1)%8==0 or i+1==len(loader):
   assert window_rows in (16,9);(window_loss/window_den).backward();gn=float(torch.nn.utils.clip_grad_norm_(model.parameters(),1.));assert math.isfinite(gn);opt.step();sch.step();steps+=1;lr=float(opt.param_groups[0]['lr']);tele.append({'step':steps,'lr':lr,'BCE':window_b/window_den,'rank':window_r/window_den,'combinedLoss':(window_b+.25*window_r)/window_den,'denominator':window_den,'gradientNorm':gn,'finite':True});opt.zero_grad();window_loss=None;window_den=window_b=window_r=0.;window_rows=0
 assert steps==53;model.save_pretrained(OUT/'checkpoint');tok.save_pretrained(OUT/'checkpoint');(OUT/'telemetry.json').write_text(json.dumps(tele,indent=2)+'\n')
 # post-training integrity precedes exactly one Dev evaluation
 assert (OUT/'checkpoint/config.json').exists() and json.loads((OUT/'checkpoint/config.json').read_text())['num_labels']==28;model.eval();assert not model.training
 dv=rows(DEV);assert len(dv)==149;dl=DataLoader(D(dv,tok),batch_size=2,collate_fn=cf(tok));pp=[]
 with torch.inference_mode():
  for b in dl:b.pop('labels');b.pop('sourceWeight');pp.append(torch.sigmoid(model(**{k:v.to(device) for k,v in b.items()}).logits[:,idx]).cpu().numpy())
 probs=np.concatenate(pp);assert probs.shape==(149,18);np.save(OUT/'candidate-probabilities.npy',probs);(OUT/'candidate-provenance.json').write_text(json.dumps({'shape':[149,18],'labelOrder':LABELS,'rowIds':[r['id'] for r in dv],'sha256':sha(OUT/'candidate-probabilities.npy')},indent=2)+'\n');pred=[select(dict(zip(LABELS,p)),LABELS) for p in probs];yt=np.array([[int(l in r['modelLabels']) for l in LABELS] for r in dv]);yp=np.array([[int(l in q) for l in LABELS] for q in pred]);m=metric_report(yt,yp);tp=int(((yt==1)&(yp==1)).sum());fp=int(((yt==0)&(yp==1)).sum());fn=int(((yt==1)&(yp==0)).sum());ex=sum(set(r['modelLabels'])==set(q) for r,q in zip(dv,pred));rep={'status':'COMPLETE','validRunStarted':True,'optimizerSteps':steps,'trainingIntegrity':'PASS','postTrainingIntegrity':'PASS','metrics':m,'TP':tp,'FP':fp,'FN':fn,'predictedCardinality':{str(k):int((yp.sum(1)==k).sum()) for k in range(3)},'exactSetCorrect':ex,'exactSetAccuracy':ex/149,'gateVerdict':'RESEARCH_SUCCESS' if m['macro']['f1']>=.3765010477 and m['micro']['precision']>=.58 and m['micro']['recall']>=.5151515152 and fp<=61 and ex>=54 else 'REJECT','runtimeSeconds':time.time()-t0,'trainSha256':sha(TRAIN),'initModelSha256':sha(INIT/'model.safetensors')};(OUT/'summary.json').write_text(json.dumps(rep,indent=2)+'\n');print(json.dumps(rep,indent=2))
if __name__=='__main__':main()

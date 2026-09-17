#!/usr/bin/env python3
"""The sole authorized run. No Dev access until after the single training epoch."""
import csv,hashlib,json,math,random,time
from pathlib import Path
import numpy as np,torch
from torch.utils.data import DataLoader,Dataset
from transformers import AutoTokenizer,AutoModelForSequenceClassification
from evaluator import LABELS,THRESHOLD,select,metric_report

HERE=Path(__file__).resolve().parent; A=HERE.parent
INIT=A/'goemotions-targeted-v1/experiment/epoch-1-checkpoint'; TRAIN=A/'train.jsonl'; DEV=A/'dev.jsonl'
FULL=["admiration","amusement","anger","annoyance","approval","caring","confusion","curiosity","disappointment","disapproval","disgust","excitement","fear","gratitude","joy","love","neutral","optimism","remorse","sadness","surprise"]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rows(p):return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
class D(Dataset):
 def __init__(self,rs,tok):self.rs=rs;self.x=tok([r['journal'] for r in rs],truncation=True,max_length=512)
 def __len__(self):return len(self.rs)
 def __getitem__(self,i):
  r=self.rs[i]; y=torch.tensor([float(l in r['modelLabels']) for l in LABELS]); sw={'PHQ':1.,'COSO':2.,'HUM':1.}[r['id'].split('-',1)[0]]
  return {k:v[i] for k,v in self.x.items()}|{'labels':y,'sourceWeight':torch.tensor(sw)}
def collate(tok):
 def f(xs):
  y=torch.stack([x.pop('labels') for x in xs]);w=torch.stack([x.pop('sourceWeight') for x in xs]);return dict(tok.pad(xs,padding=True,return_tensors='pt'))|{'labels':y,'sourceWeight':w}
 return f
def rank_loss(z,y):
 vals=[]
 for row,t in zip(z,y):
  pos=row[t.bool()];neg=row[~t.bool()]
  if len(pos) and len(neg): vals.append(torch.nn.functional.softplus(-(pos[:,None]-neg[None,:])).mean())
 return torch.stack(vals).mean() if vals else z.sum()*0
def main():
 random.seed(44);np.random.seed(44);torch.manual_seed(44);torch.set_num_threads(3);start=time.time();out=HERE/'run';out.mkdir(exist_ok=False)
 tr=rows(TRAIN);assert len(tr)==841 and not DEV.exists() is False
 tok=AutoTokenizer.from_pretrained(INIT,local_files_only=True);model=AutoModelForSequenceClassification.from_pretrained(INIT,local_files_only=True)
 pos={l:FULL.index(l) for l in LABELS};device=torch.device('cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu');model.to(device)
 loader=DataLoader(D(tr,tok),batch_size=2,shuffle=True,generator=torch.Generator().manual_seed(44),collate_fn=collate(tok));opt=torch.optim.AdamW(model.parameters(),lr=2e-6,weight_decay=.01);opt.zero_grad();total=0.;steps=0
 for i,b in enumerate(loader):
  y=b.pop('labels').to(device);sw=b.pop('sourceWeight').to(device);z=model(**{k:v.to(device) for k,v in b.items()}).logits[:,[pos[l] for l in LABELS]];loss=(torch.nn.functional.binary_cross_entropy_with_logits(z,y,reduction='none').mean(1)*sw).mean()+.25*rank_loss(z,y);(loss/8).backward();total+=float(loss); 
  if (i+1)%8==0 or i+1==len(loader):
   torch.nn.utils.clip_grad_norm_(model.parameters(),1.);opt.step();steps+=1;print(json.dumps({'event':'FIRST_OPTIMIZER_STEP' if steps==1 else 'optimizer_step','step':steps}),flush=True);opt.zero_grad()
 model.save_pretrained(out/'checkpoint');tok.save_pretrained(out/'checkpoint')
 # Exactly one frozen Dev evaluation, after training.
 dv=rows(DEV);assert len(dv)==149; enc=tok([r['journal'] for r in dv],truncation=True,max_length=512);dl=DataLoader(D(dv,tok),batch_size=2,collate_fn=collate(tok));model.eval();pp=[]
 with torch.inference_mode():
  for b in dl:b.pop('labels');b.pop('sourceWeight');pp.append(torch.sigmoid(model(**{k:v.to(device) for k,v in b.items()}).logits[:,[pos[l] for l in LABELS]]).cpu().numpy())
 probs=np.concatenate(pp);pred=[select(dict(zip(LABELS,p)),LABELS) for p in probs];yt=np.array([[int(l in r['modelLabels']) for l in LABELS] for r in dv]);yp=np.array([[int(l in q) for l in LABELS] for q in pred]);m=metric_report(yt,yp);tp=int(((yt==1)&(yp==1)).sum());fp=int(((yt==0)&(yp==1)).sum());fn=int(((yt==1)&(yp==0)).sum());exact=sum(set(r['modelLabels'])==set(q) for r,q in zip(dv,pred));report={'status':'COMPLETE','validTrainingRunStarted':True,'optimizerSteps':steps,'metrics':m,'TP':tp,'FP':fp,'FN':fn,'predictedCardinality':{str(k):int((yp.sum(1)==k).sum()) for k in range(3)},'exactSetCorrect':exact,'exactSetAccuracy':exact/149,'evaluator':'research_direct_top2','threshold':.35,'initSha256':sha(INIT/'model.safetensors'),'trainSha256':sha(TRAIN),'runtimeSeconds':time.time()-start,'gateVerdict':'REJECT'}
 (out/'summary.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()

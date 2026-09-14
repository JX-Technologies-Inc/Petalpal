#!/usr/bin/env python3
import json, math, random, time
from pathlib import Path
import numpy as np, torch
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModelForSequenceClassification, get_linear_schedule_with_warmup

HERE=Path(__file__).resolve().parent; V4=HERE.parent
import sys; sys.path.insert(0,str(V4/'auto-v1'))
from experiment import LABELS, label_positions, collate
from data_safety import accumulation_weight
MAXLEN=512; BATCH=2; ACCUM=8; EPOCHS=2; LR=5e-6; WD=.01
TRAIN=V4/'aligned-supervision-v1/train.jsonl'; CP=V4.parent/'candidate-c/artifacts/checkpoint'
rows=[json.loads(x) for x in TRAIN.read_text().splitlines() if x.strip()]
assign=json.loads((V4/'group-oof-tfidf-v1/fold-assignment.json').read_text())
assert len(rows)==841 and len(assign['rowFold'])==len(rows)
folds=np.array([assign['rowFold'][r['id']] for r in rows]); assert sorted(set(folds))==list(range(5))
class Data(Dataset):
 def __init__(self,rs,tok): self.rs=rs; self.enc=tok([r['journal'] for r in rs],truncation=True,max_length=MAXLEN)
 def __len__(self): return len(self.rs)
 def __getitem__(self,i): return {k:v[i] for k,v in self.enc.items()}|{'labels':[float(l in self.rs[i]['modelLabels']) for l in LABELS]}
@torch.inference_mode()
def infer(model,loader,pos):
 model.eval(); out=[]
 for b in loader:
  b.pop('labels'); out.append(torch.sigmoid(model(**b).logits[:,pos]).cpu().numpy())
 return np.concatenate(out)
torch.set_num_threads(3); torch.manual_seed(42); random.seed(42); np.random.seed(42)
tok=AutoTokenizer.from_pretrained(CP,local_files_only=True); base=AutoModelForSequenceClassification.from_pretrained(CP,local_files_only=True); pos=label_positions(base)
probs=np.zeros((len(rows),len(LABELS)),dtype=np.float32); t0=time.time()
for f in range(5):
 tr=np.flatnonzero(folds!=f); va=np.flatnonzero(folds==f); model=AutoModelForSequenceClassification.from_pretrained(CP,local_files_only=True)
 train=Data([rows[i] for i in tr],tok); valid=Data([rows[i] for i in va],tok)
 gen=torch.Generator().manual_seed(42); loader=DataLoader(train,batch_size=BATCH,shuffle=True,generator=gen,collate_fn=collate(tok)); vloader=DataLoader(valid,batch_size=BATCH,collate_fn=collate(tok))
 opt=torch.optim.AdamW(model.parameters(),lr=LR,weight_decay=WD); steps=math.ceil(len(loader)/ACCUM)*EPOCHS
 sched=get_linear_schedule_with_warmup(opt,math.ceil(.1*steps),steps)
 for epoch in range(EPOCHS):
  model.train(); opt.zero_grad(set_to_none=True)
  for i,b in enumerate(loader):
   y=b.pop('labels'); loss=torch.nn.functional.binary_cross_entropy_with_logits(model(**b).logits[:,pos],y)
   (loss*accumulation_weight(i,len(tr),BATCH,ACCUM)).backward()
   if (i+1)%ACCUM==0 or i+1==len(loader):
    torch.nn.utils.clip_grad_norm_(model.parameters(),1.); opt.step(); sched.step(); opt.zero_grad(set_to_none=True)
 probs[va]=infer(model,vloader,pos)
 print(json.dumps({'fold':f,'train':len(tr),'validation':len(va),'groups':len(set(folds[tr])),'elapsed':time.time()-t0}),flush=True)
np.save(HERE/'oof-probabilities.npy',probs)
(HERE/'summary.json').write_text(json.dumps({'status':'COMPLETE','rows':len(rows),'folds':5,'foldSizes':[int((folds==f).sum()) for f in range(5)],'config':{'checkpoint':str(CP),'maxLength':MAXLEN,'batchSize':BATCH,'accumulation':ACCUM,'epochs':EPOCHS,'learningRate':LR,'weightDecay':WD,'seed':42},'thresholdEvaluation':'not performed','externalEvaluationLoaded':False},indent=2)+'\n')
print(json.dumps({'status':'COMPLETE','elapsed':time.time()-t0},indent=2))

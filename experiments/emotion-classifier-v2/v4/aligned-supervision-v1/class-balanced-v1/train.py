#!/usr/bin/env python3
import hashlib,json,math,random,sys,time
from pathlib import Path
import numpy as np,torch
from torch.utils.data import DataLoader,Dataset
from transformers import AutoTokenizer,AutoModelForSequenceClassification,get_linear_schedule_with_warmup
HERE=Path(__file__).resolve().parent; PARENT=HERE.parent; ROOT=PARENT.parents[1]
sys.path.insert(0,str(PARENT.parent/"auto-v1"))
from experiment import LABELS,label_positions,collate,report
from data_safety import assert_disjoint,accumulation_weight
MAXLEN=512;BATCH=2;ACCUM=8
def rows(p):return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
class Data(Dataset):
 def __init__(self,rs,tok):self.rs=rs;self.enc=tok([r["journal"] for r in rs],truncation=True,max_length=MAXLEN)
 def __len__(self):return len(self.rs)
 def __getitem__(self,i):return {k:v[i] for k,v in self.enc.items()}|{"labels":[float(l in self.rs[i]["modelLabels"]) for l in LABELS]}
@torch.inference_mode()
def infer(model,loader,pos):
 model.eval();out=[]
 for b in loader:b.pop("labels");out.append(torch.sigmoid(model(**b).logits[:,pos]).cpu().numpy())
 return np.concatenate(out)
def main():
 out=HERE/"experiment";out.mkdir(exist_ok=False)
 lock=json.loads((PARENT/"annotation-lock.json").read_text()); train=rows(PARENT/"train.jsonl");dev=rows(PARENT/"dev.jsonl")
 assert lock["status"]=="LOCKED" and sha(PARENT/"train.jsonl")==lock["hashes"]["train.jsonl"] and sha(PARENT/"dev.jsonl")==lock["hashes"]["dev.jsonl"]
 assert_disjoint(train,dev)
 torch.set_num_threads(3);torch.manual_seed(43);random.seed(43);np.random.seed(43)
 cp=PARENT/"experiment"/"epoch-2-checkpoint";tok=AutoTokenizer.from_pretrained(cp,local_files_only=True);model=AutoModelForSequenceClassification.from_pretrained(cp,local_files_only=True);pos=label_positions(model)
 tr=DataLoader(Data(train,tok),batch_size=BATCH,shuffle=True,generator=torch.Generator().manual_seed(43),collate_fn=collate(tok));dv=DataLoader(Data(dev,tok),batch_size=BATCH,collate_fn=collate(tok))
 counts=np.array([sum(l in r["modelLabels"] for r in train) for l in LABELS]);weights=np.clip(np.sqrt((len(train)-counts)/counts),1,4).astype(np.float32);pw=torch.tensor(weights)
 prior=json.loads((PARENT/"experiment"/"summary.json").read_text());p0=np.load(PARENT/"experiment"/"epoch-2-probabilities.npy");base=prior["records"][2]["metrics"]
 rec=[{"epoch":0,"trainLoss":None,"metrics":base}];t0=time.time();opt=torch.optim.AdamW(model.parameters(),lr=2e-6,weight_decay=.01);steps=math.ceil(len(tr)/ACCUM)*2;sched=get_linear_schedule_with_warmup(opt,math.ceil(.1*steps),steps)
 for epoch in [1,2]:
  model.train();opt.zero_grad(set_to_none=True);total=0;n=0
  for i,b in enumerate(tr):
   y=b.pop("labels");loss=torch.nn.functional.binary_cross_entropy_with_logits(model(**b).logits[:,pos],y,pos_weight=pw);(loss*accumulation_weight(i,len(train),BATCH,ACCUM)).backward();total+=loss.item()*len(y);n+=len(y)
   if (i+1)%ACCUM==0 or i+1==len(tr):torch.nn.utils.clip_grad_norm_(model.parameters(),1.);opt.step();sched.step();opt.zero_grad(set_to_none=True)
   if (i+1)%100==0:print(json.dumps({"epoch":epoch,"batch":i+1,"batches":len(tr),"elapsed":time.time()-t0}),flush=True)
  p=infer(model,dv,pos);np.save(out/f"epoch-{epoch}-probabilities.npy",p);m=report(dev,p,.35);rec.append({"epoch":epoch,"trainLoss":total/n,"metrics":m});model.save_pretrained(out/f"epoch-{epoch}-checkpoint");tok.save_pretrained(out/f"epoch-{epoch}-checkpoint");print(json.dumps({"epoch":epoch,"macroF1":m["selected18"]["macro"]["f1"],"micro":m["selected18"]["micro"]}),flush=True)
 eligible=[r for r in rec if r["metrics"]["selected18"]["micro"]["precision"]>=.5];selected=max(eligible,key=lambda r:(r["metrics"]["selected18"]["macro"]["f1"],-r["epoch"]))
 blend=None;candidates=[("epoch",selected["metrics"])]
 if selected["epoch"]>0:
  p=np.load(out/f"epoch-{selected['epoch']}-probabilities.npy");bp=.5*p0+.5*p;np.save(out/"fixed-blend-probabilities.npy",bp);blend=report(dev,bp,.35);candidates.append(("fixedBlend",blend))
 eligible_c=[x for x in candidates if x[1]["selected18"]["micro"]["precision"]>=.5];best=max(eligible_c,key=lambda x:x[1]["selected18"]["macro"]["f1"])
 baseline=base["selected18"]["macro"]["f1"];score=best[1]["selected18"]["macro"]["f1"]
 summary={"status":"COMPLETE","trainPositiveCounts":dict(zip(LABELS,map(int,counts))),"positiveWeights":dict(zip(LABELS,map(float,weights))),"records":rec,"selectedEpoch":selected["epoch"],"fixedBlend":blend,"finalDevelopmentCandidate":best[0],"finalMetrics":best[1],"decision":"PROMOTE" if score>baseline else "REJECT","baselineMacroF1":baseline,"selectedMacroF1":score,"externalEvaluationLoaded":False,"elapsedSeconds":time.time()-t0}
 (out/"summary.json").write_text(json.dumps(summary,indent=2)+"\n");print(json.dumps({k:v for k,v in summary.items() if k not in ["records","fixedBlend","finalMetrics","positiveWeights","trainPositiveCounts"]},indent=2))
if __name__=="__main__":main()

#!/usr/bin/env python3
import hashlib, json, math, random, sys, time
from pathlib import Path
import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup

HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE.parent/"auto-v1"))
from experiment import LABELS, label_positions, collate, report
from data_safety import assert_disjoint, accumulation_weight
MAXLEN=512; BATCH=2; ACCUM=8

def read(p): return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
class Data(Dataset):
    def __init__(self,rows,tok): self.rows=rows; self.enc=tok([r["journal"] for r in rows],truncation=True,max_length=MAXLEN)
    def __len__(self): return len(self.rows)
    def __getitem__(self,i): return {k:v[i] for k,v in self.enc.items()}|{"labels":[float(l in self.rows[i]["modelLabels"]) for l in LABELS]}

def asymmetric_loss(logits,y):
    p=torch.sigmoid(logits); eps=1e-8
    pn=(p-0.05).clamp(min=0,max=1-eps)
    pos=y*torch.log(p.clamp(min=eps))*1.0
    neg=(1-y)*torch.log((1-pn).clamp(min=eps))*pn.pow(2)
    return -(pos+neg).mean()

@torch.inference_mode()
def infer(model,loader,pos):
    model.eval(); out=[]
    for b in loader:
        b.pop("labels"); out.append(torch.sigmoid(model(**b).logits[:,pos]).cpu().numpy())
    return np.concatenate(out)

def main():
    out=HERE/"experiment"; out.mkdir(exist_ok=False)
    protocol=json.loads((HERE/"protocol.json").read_text()); manifest=json.loads((HERE/"split-manifest.json").read_text())
    assert manifest["status"]=="LOCKED" and sha(HERE/"protocol.json")==manifest["hashes"]["protocol"]
    for s in ["train","dev"]: assert sha(HERE/f"{s}.jsonl")==manifest["hashes"][s]
    train=read(HERE/"train.jsonl"); dev=read(HERE/"dev.jsonl"); assert_disjoint(train,dev)
    torch.set_num_threads(3); torch.manual_seed(42); random.seed(42); np.random.seed(42)
    cp=ROOT/"candidate-c/artifacts/checkpoint"; tok=AutoTokenizer.from_pretrained(cp,local_files_only=True)
    model=AutoModelForSequenceClassification.from_pretrained(cp,local_files_only=True); pos=label_positions(model)
    tr=DataLoader(Data(train,tok),batch_size=BATCH,shuffle=True,generator=torch.Generator().manual_seed(42),collate_fn=collate(tok))
    dv=DataLoader(Data(dev,tok),batch_size=BATCH,collate_fn=collate(tok))
    records=[]; t0=time.time(); probs=infer(model,dv,pos); np.save(out/"epoch-0-probabilities.npy",probs)
    records.append({"epoch":0,"trainLoss":None,"metrics":report(dev,probs,.35)})
    opt=torch.optim.AdamW(model.parameters(),lr=5e-6,weight_decay=.01)
    steps=math.ceil(len(tr)/ACCUM)*2; sched=get_linear_schedule_with_warmup(opt,math.ceil(.1*steps),steps)
    for epoch in [1,2]:
        model.train(); opt.zero_grad(set_to_none=True); total=0.; n=0
        for i,b in enumerate(tr):
            y=b.pop("labels"); loss=asymmetric_loss(model(**b).logits[:,pos],y)
            (loss*accumulation_weight(i,len(train),BATCH,ACCUM)).backward(); total+=loss.item()*len(y); n+=len(y)
            if (i+1)%ACCUM==0 or i+1==len(tr):
                torch.nn.utils.clip_grad_norm_(model.parameters(),1.); opt.step(); sched.step(); opt.zero_grad(set_to_none=True)
            if (i+1)%80==0: print(json.dumps({"epoch":epoch,"batch":i+1,"batches":len(tr),"elapsed":time.time()-t0}),flush=True)
        probs=infer(model,dv,pos); np.save(out/f"epoch-{epoch}-probabilities.npy",probs)
        metrics=report(dev,probs,.35); records.append({"epoch":epoch,"trainLoss":total/n,"metrics":metrics})
        model.save_pretrained(out/f"epoch-{epoch}-checkpoint"); tok.save_pretrained(out/f"epoch-{epoch}-checkpoint")
        print(json.dumps({"epoch":epoch,"macroF1":metrics["selected18"]["macro"]["f1"],"microPrecision":metrics["selected18"]["micro"]["precision"],"elapsed":time.time()-t0}),flush=True)
    eligible=[r for r in records if r["metrics"]["selected18"]["micro"]["precision"]>=.5]
    selected=max(eligible,key=lambda r:(r["metrics"]["selected18"]["macro"]["f1"],-r["epoch"])) if eligible else records[0]
    baseline=records[0]["metrics"]["selected18"]["macro"]["f1"]; best=selected["metrics"]["selected18"]["macro"]["f1"]
    decision="PROMOTE_FOR_FURTHER_DEVELOPMENT" if selected["epoch"]>0 and best>baseline else "REJECT"
    summary={"status":"COMPLETE","hypothesis":protocol["hypothesis"],"records":records,"selectedEpoch":selected["epoch"],
             "baselineMacroF1":baseline,"selectedMacroF1":best,"decision":decision,"externalEvaluationLoaded":False,"elapsedSeconds":time.time()-t0}
    (out/"summary.json").write_text(json.dumps(summary,indent=2)+"\n"); print(json.dumps({k:v for k,v in summary.items() if k!="records"},indent=2))
if __name__=="__main__": main()

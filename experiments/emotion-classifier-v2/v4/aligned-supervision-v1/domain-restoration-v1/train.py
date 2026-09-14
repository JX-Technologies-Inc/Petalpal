#!/usr/bin/env python3
import hashlib,json,math,os,random,time
from pathlib import Path
import numpy as np,torch
from torch.utils.data import DataLoader,Dataset
from transformers import AutoTokenizer,AutoModelForSequenceClassification,get_linear_schedule_with_warmup
HERE=Path(__file__).resolve().parent; PARENT=HERE.parent
import sys
sys.path.insert(0,str(PARENT.parent/"auto-v1"))
from experiment import LABELS,label_positions,collate,report
from data_safety import assert_disjoint,accumulation_weight
MAXLEN=512; BATCH=2; ACCUM=8
def rows(p): return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
class Data(Dataset):
    def __init__(self,rs,tok): self.rs=rs; self.enc=tok([r["journal"] for r in rs],truncation=True,max_length=MAXLEN)
    def __len__(self): return len(self.rs)
    def __getitem__(self,i): return {k:v[i] for k,v in self.enc.items()}|{"labels":[float(l in self.rs[i]["modelLabels"]) for l in LABELS]}
@torch.inference_mode()
def infer(model,loader,pos):
    model.eval(); out=[]
    for b in loader: b.pop("labels"); out.append(torch.sigmoid(model(**b).logits[:,pos]).cpu().numpy())
    return np.concatenate(out)
def main():
    out=Path(os.environ["RESTORATION_OUT"]); out.mkdir(exist_ok=False)
    lock=json.loads((PARENT/"annotation-lock.json").read_text()); train=rows(PARENT/"train.jsonl"); dev=rows(PARENT/"dev.jsonl")
    assert lock["status"]=="LOCKED" and sha(PARENT/"train.jsonl")==lock["hashes"]["train.jsonl"] and sha(PARENT/"dev.jsonl")==lock["hashes"]["dev.jsonl"]
    assert_disjoint(train,dev)
    torch.set_num_threads(3); torch.manual_seed(44); random.seed(44); np.random.seed(44)
    cp=Path(os.environ["RESTORATION_INIT"]); tok=AutoTokenizer.from_pretrained(cp,local_files_only=True); model=AutoModelForSequenceClassification.from_pretrained(cp,local_files_only=True); pos=label_positions(model)
    tr=DataLoader(Data(train,tok),batch_size=BATCH,shuffle=True,generator=torch.Generator().manual_seed(44),collate_fn=collate(tok)); dv=DataLoader(Data(dev,tok),batch_size=BATCH,collate_fn=collate(tok))
    prior=json.loads(Path(os.environ["RESTORATION_PRIOR_SUMMARY"]).read_text()); prior_probs=np.load(Path(os.environ["RESTORATION_PRIOR_PROBS"]))
    base=prior["finalMetrics"]; rec=[{"epoch":0,"trainLoss":None,"metrics":base}]
    opt=torch.optim.AdamW(model.parameters(),lr=2e-6,weight_decay=.01); steps=math.ceil(len(tr)/ACCUM); sched=get_linear_schedule_with_warmup(opt,math.ceil(.1*steps),steps); t0=time.time(); model.train(); opt.zero_grad(set_to_none=True); total=0; n=0
    for i,b in enumerate(tr):
        y=b.pop("labels"); loss=torch.nn.functional.binary_cross_entropy_with_logits(model(**b).logits[:,pos],y); (loss*accumulation_weight(i,len(train),BATCH,ACCUM)).backward(); total+=loss.item()*len(y); n+=len(y)
        if (i+1)%ACCUM==0 or i+1==len(tr): torch.nn.utils.clip_grad_norm_(model.parameters(),1.); opt.step(); sched.step(); opt.zero_grad(set_to_none=True)
    p=infer(model,dv,pos); np.save(out/"epoch-1-probabilities.npy",p); m=report(dev,p,.35); rec.append({"epoch":1,"trainLoss":total/n,"metrics":m}); model.save_pretrained(out/"epoch-1-checkpoint"); tok.save_pretrained(out/"epoch-1-checkpoint")
    summary={"status":"COMPLETE","records":rec,"selectedEpoch":1,"finalDevelopmentCandidate":"epoch","finalMetrics":m,"baselineMacroF1":base["selected18"]["macro"]["f1"],"selectedMacroF1":m["selected18"]["macro"]["f1"],"decision":"PROMOTE" if m["selected18"]["macro"]["f1"]>base["selected18"]["macro"]["f1"] and m["selected18"]["micro"]["precision"]>=.5 else "REJECT","externalEvaluationLoaded":False,"usesOpenedGemini300":False,"elapsedSeconds":time.time()-t0}
    (out/"summary.json").write_text(json.dumps(summary,indent=2)+"\n"); print(json.dumps({k:v for k,v in summary.items() if k not in ["records","finalMetrics"]},indent=2))
if __name__=="__main__": main()

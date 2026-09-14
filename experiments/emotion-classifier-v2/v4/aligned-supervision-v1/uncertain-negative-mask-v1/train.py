#!/usr/bin/env python3
import hashlib,json,math,os,random,time,sys
from pathlib import Path
import numpy as np,torch
from torch.utils.data import DataLoader,Dataset
from transformers import AutoTokenizer,AutoModelForSequenceClassification,get_linear_schedule_with_warmup
HERE=Path(__file__).resolve().parent; PARENT=HERE.parent
sys.path.insert(0,str(PARENT.parent/"auto-v1"))
from experiment import LABELS,label_positions,collate,report
from data_safety import assert_disjoint,accumulation_weight
MAXLEN=512; BATCH=2; ACCUM=8
def rows(p): return [json.loads(x) for x in Path(p).read_text().splitlines() if x.strip()]
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
class Data(Dataset):
    def __init__(self,rs,tok,uncertain):
        self.rs=rs; self.uncertain=uncertain
        self.enc=tok([r["text"] if "text" in r else r["journal"] for r in rs],truncation=True,max_length=MAXLEN)
    def __len__(self): return len(self.rs)
    def __getitem__(self,i):
        r=self.rs[i]; positives=set(r["modelLabels"]); uncertain=self.uncertain.get(r["id"],set())
        return {k:v[i] for k,v in self.enc.items()}|{"labels":[float(l in positives) for l in LABELS],"loss_mask":[float(l in positives or l not in uncertain) for l in LABELS]}
def masked_collate(tok):
    def fn(items):
        masks=torch.tensor([x.pop("loss_mask") for x in items],dtype=torch.float32)
        return collate(tok)(items)|{"loss_mask":masks}
    return fn
@torch.inference_mode()
def infer(model,loader,pos):
    model.eval(); out=[]
    for b in loader: b.pop("labels"); b.pop("loss_mask",None); out.append(torch.sigmoid(model(**b).logits[:,pos]).cpu().numpy())
    return np.concatenate(out)
def main():
    out=HERE/"experiment"; out.mkdir(exist_ok=False)
    lock=json.loads((PARENT/"annotation-lock.json").read_text()); base=rows(PARENT/"train.jsonl"); go=rows(PARENT/"public-source-shortlist-20260910/goemotions-targeted-tranche.jsonl"); dev=rows(PARENT/"dev.jsonl"); train=base+go
    assert lock["status"]=="LOCKED" and sha(PARENT/"train.jsonl")==lock["hashes"]["train.jsonl"] and sha(PARENT/"dev.jsonl")==lock["hashes"]["dev.jsonl"] and len(base)==841 and len(go)==204
    assert_disjoint(train,dev)
    pa={r["id"]:set(r["labels"]) for r in rows(PARENT/"pass-a.jsonl")}; pb={r["id"]:set(r["labels"]) for r in rows(PARENT/"pass-b.jsonl")}
    uncertain={r["id"]:(pa[r["id"]]|pb[r["id"]])-set(r["modelLabels"]) for r in base}
    uncertain={k:v for k,v in uncertain.items() if v}
    mask_counts={l:sum(l in v for v in uncertain.values()) for l in LABELS}
    torch.set_num_threads(3); torch.manual_seed(44); random.seed(44); np.random.seed(44)
    cp=PARENT/"goemotions-targeted-v1/experiment/epoch-1-checkpoint"; tok=AutoTokenizer.from_pretrained(cp,local_files_only=True); model=AutoModelForSequenceClassification.from_pretrained(cp,local_files_only=True); pos=label_positions(model)
    tr=DataLoader(Data(train,tok,uncertain),batch_size=BATCH,shuffle=True,generator=torch.Generator().manual_seed(44),collate_fn=masked_collate(tok)); dv=DataLoader(Data(dev,tok,{}),batch_size=BATCH,collate_fn=masked_collate(tok))
    prior=json.loads((PARENT/"goemotions-targeted-v1/experiment/summary.json").read_text()); base_metrics=prior["finalMetrics"]
    opt=torch.optim.AdamW(model.parameters(),lr=2e-6,weight_decay=.01); steps=math.ceil(len(tr)/ACCUM); sched=get_linear_schedule_with_warmup(opt,math.ceil(.1*steps),steps); t0=time.time(); model.train(); opt.zero_grad(set_to_none=True); total=0.; n=0
    for i,b in enumerate(tr):
        y=b.pop("labels"); mask=b.pop("loss_mask"); logits=model(**b).logits[:,pos]; raw=torch.nn.functional.binary_cross_entropy_with_logits(logits,y,reduction="none"); loss=(raw*mask).sum()/mask.sum()
        (loss*accumulation_weight(i,len(train),BATCH,ACCUM)).backward(); total+=loss.item()*len(y); n+=len(y)
        if (i+1)%ACCUM==0 or i+1==len(tr): torch.nn.utils.clip_grad_norm_(model.parameters(),1.); opt.step(); sched.step(); opt.zero_grad(set_to_none=True)
    p=infer(model,dv,pos); np.save(out/"probabilities.npy",p); metrics=report(dev,p,.35); model.save_pretrained(out/"checkpoint"); tok.save_pretrained(out/"checkpoint")
    score=metrics["selected18"]["macro"]["f1"]; precision=metrics["selected18"]["micro"]["precision"]
    summary={"status":"COMPLETE","trainingRows":len(train),"canonicalTrainRows":len(base),"goRows":len(go),"uncertainRows":len(uncertain),"maskedNegativeTerms":sum(mask_counts.values()),"maskedByLabel":mask_counts,"trainLoss":total/n,"baselineMetrics":base_metrics,"finalMetrics":metrics,"baselineMacroF1":base_metrics["selected18"]["macro"]["f1"],"selectedMacroF1":score,"decision":"PROMOTE" if score>base_metrics["selected18"]["macro"]["f1"] and precision>=.5 else "REJECT","singleDevEvaluation":True,"externalEvaluationLoaded":False,"usesOpenedGemini300":False,"elapsedSeconds":time.time()-t0}
    (out/"summary.json").write_text(json.dumps(summary,indent=2)+"\n"); print(json.dumps({k:v for k,v in summary.items() if k not in ["baselineMetrics","finalMetrics"]},indent=2))
if __name__=="__main__": main()

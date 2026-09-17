#!/usr/bin/env python3
"""Independent single-use frozen Dev evaluator; never imports training code."""
import csv,hashlib,json
from pathlib import Path
import numpy as np,torch
from transformers import AutoConfig,AutoModelForSequenceClassification,AutoTokenizer
from evaluator import LABELS,select,metric_report
HERE=Path(__file__).resolve().parent; A=HERE.parent.parent; CP=HERE/'valid-run/checkpoint'; DEV=A/'dev.jsonl'; OUT=HERE/'valid-run/evaluation'
FULL=["admiration","amusement","anger","annoyance","approval","caring","confusion","curiosity","desire","disappointment","disapproval","disgust","embarrassment","excitement","fear","gratitude","grief","joy","love","nervousness","optimism","pride","realization","relief","remorse","sadness","surprise","neutral"]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rows(p):return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
def main():
 cfg=AutoConfig.from_pretrained(CP,local_files_only=True); assert cfg.num_labels==28
 model,info=AutoModelForSequenceClassification.from_pretrained(CP,local_files_only=True,output_loading_info=True); assert model.config.num_labels==28
 assert len(model.config.id2label)==28 and len(model.config.label2id)==28 and all(model.config.label2id[v]==int(k) for k,v in model.config.id2label.items())
 id2={int(k):v for k,v in model.config.id2label.items()}; assert [id2[i] for i in range(28)]==FULL
 head=model.classifier.out_proj if hasattr(model.classifier,'out_proj') else model.classifier; assert tuple(head.weight.shape)==(28,768) and tuple(head.bias.shape)==(28,); assert not info['missing_keys'] and not info['unexpected_keys'] and not info['mismatched_keys']; assert all(torch.isfinite(p).all() for p in model.parameters())
 idx=[FULL.index(l) for l in LABELS]; assert idx==[0,1,2,3,5,6,7,9,11,13,14,15,17,18,20,24,25,26]
 model.eval(); assert not model.training and all(not m.training for m in model.modules() if isinstance(m,(torch.nn.Dropout,torch.nn.Dropout1d,torch.nn.Dropout2d,torch.nn.Dropout3d)))
 dv=rows(DEV);assert len(dv)==149;tok=AutoTokenizer.from_pretrained(CP,local_files_only=True);enc=tok([r['journal'] for r in dv],truncation=True,max_length=512);raw=[]
 for s in range(0,149,2):
  b=tok.pad([{k:v[i] for k,v in enc.items()} for i in range(s,min(s+2,149))],padding=True,return_tensors='pt')
  with torch.inference_mode(): raw.append(model(**b).logits.cpu())
 raw=torch.cat(raw);assert tuple(raw.shape)==(149,28);probs=torch.sigmoid(raw[:,idx]).numpy();assert probs.shape==(149,18)
 OUT.mkdir(exist_ok=False);np.save(OUT/'candidate-probabilities.npy',probs);ids=[r['id'] for r in dv];(OUT/'candidate-provenance.json').write_text(json.dumps({'shape':[149,18],'dtype':str(probs.dtype),'labelOrder':LABELS,'rowIds':ids,'rowOrderSha256':hashlib.sha256('\n'.join(ids).encode()).hexdigest(),'probabilitySha256':sha(OUT/'candidate-probabilities.npy')},indent=2)+'\n')
 pred=[select(dict(zip(LABELS,p)),LABELS) for p in probs];yt=np.array([[int(l in r['modelLabels']) for l in LABELS] for r in dv]);yp=np.array([[int(l in q) for l in LABELS] for q in pred]);m=metric_report(yt,yp);tp=int(((yt==1)&(yp==1)).sum());fp=int(((yt==0)&(yp==1)).sum());fn=int(((yt==1)&(yp==0)).sum()); ex=sum(set(r['modelLabels'])==set(q) for r,q in zip(dv,pred)); matrix=[[int(((yt.sum(1)==i)&(yp.sum(1)==j)).sum()) for j in range(3)] for i in range(3)]
 per=[]
 from sklearn.metrics import precision_recall_fscore_support
 for i,l in enumerate(LABELS):
  p,r,f,_=precision_recall_fscore_support(yt[:,i],yp[:,i],average='binary',zero_division=0);per.append({'label':l,'support':int(yt[:,i].sum()),'predictedCount':int(yp[:,i].sum()),'precision':float(p),'recall':float(r),'f1':float(f),'TP':int(((yt[:,i]==1)&(yp[:,i]==1)).sum()),'FP':int(((yt[:,i]==0)&(yp[:,i]==1)).sum()),'FN':int(((yt[:,i]==1)&(yp[:,i]==0)).sum())})
 rep={'semanticCheckpointGuard':'PASS','devInferenceExecuted':True,'rawModelShape':[149,28],'productShape':[149,18],'metrics':m,'perLabel':per,'TP':tp,'FP':fp,'FN':fn,'predictedCardinality':{str(k):int((yp.sum(1)==k).sum()) for k in range(3)},'goldPredictedCardinalityMatrix':matrix,'exactSetCorrect':ex,'exactSetAccuracy':ex/149,'zeroLabelPredictions':int((yp.sum(1)==0).sum()),'averagePredictedLabels':float(yp.sum(1).mean()),'gateVerdict':'RESEARCH_SUCCESS' if m['macro']['f1']>=.3765010477 and m['micro']['precision']>=.58 and m['micro']['recall']>=.5151515152 and fp<=61 and ex>=54 else 'REJECT','checkpointSha256':sha(CP/'model.safetensors'),'devSha256':sha(DEV),'noProb21':True}
 (OUT/'evaluation-report.json').write_text(json.dumps(rep,indent=2)+'\n');(OUT/'per-label-metrics.csv').write_text('label,support,predictedCount,precision,recall,f1,TP,FP,FN\n'+'\n'.join(','.join(str(x[k]) for k in ['label','support','predictedCount','precision','recall','f1','TP','FP','FN']) for x in per)+'\n');print(json.dumps(rep,indent=2))
if __name__=='__main__':main()

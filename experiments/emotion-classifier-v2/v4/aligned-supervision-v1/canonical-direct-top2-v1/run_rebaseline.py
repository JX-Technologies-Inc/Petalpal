import csv,json,hashlib,sys
from pathlib import Path
import numpy as np
from evaluator import LABELS,THRESHOLD,select,metric_report
P=Path(__file__).resolve().parent; A=P.parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
def main():
 d=read(A/'dev.jsonl'); probs=np.load(A/'goemotions-targeted-v1/experiment/epoch-1-probabilities.npy'); assert probs.shape==(149,21)
 full=["admiration","amusement","anger","annoyance","approval","caring","confusion","curiosity","disappointment","disapproval","disgust","excitement","fear","gratitude","joy","love","neutral","optimism","remorse","sadness","surprise"]
 idx={l:full.index(l) for l in LABELS}; out=[]; rows=[]
 for r,p in zip(d,probs): out.append(select({l:p[idx[l]] for l in LABELS},LABELS)); rows.append((r['id'],r['modelLabels'],out[-1]))
 yt=np.array([[int(l in r['modelLabels']) for l in LABELS] for r in d]); yp=np.array([[int(l in o) for l in LABELS] for o in out]); m=metric_report(yt,yp)
 per=[]
 for i,l in enumerate(LABELS):
  tp=int(((yt[:,i]==1)&(yp[:,i]==1)).sum());fp=int(((yt[:,i]==0)&(yp[:,i]==1)).sum());fn=int(((yt[:,i]==1)&(yp[:,i]==0)).sum());p,r,f,_=__import__('sklearn').metrics.precision_recall_fscore_support(yt[:,i],yp[:,i],average='binary',zero_division=0);per.append({'label':l,'support':int(yt[:,i].sum()),'predictedCount':int(yp[:,i].sum()),'precision':float(p),'recall':float(r),'f1':float(f),'TP':tp,'FP':fp,'FN':fn})
 mat=[[0]*3 for _ in range(3)]
 for a,b in zip(yt.sum(1),yp.sum(1)):mat[min(2,int(a))][min(2,int(b))]+=1
 exact=float(np.mean([set(r['modelLabels'])==set(o) for r,o in zip(d,out)])); report={'evaluator':'research_direct_top2','threshold':THRESHOLD,'metrics':m,'perLabel':per,'totalTP':int(((yt==1)&(yp==1)).sum()),'totalFP':int(((yt==0)&(yp==1)).sum()),'totalFN':int(((yt==1)&(yp==0)).sum()),'goldCardinality':{str(int(k)):int(v) for k,v in zip(*np.unique(yt.sum(1),return_counts=True))},'predictedCardinality':{str(int(k)):int(v) for k,v in zip(*np.unique(yp.sum(1),return_counts=True))},'goldKPredictedK':mat,'exactSetAccuracy':exact,'zeroLabelPredictionCount':int((yp.sum(1)==0).sum()),'averagePredictedLabels':float(yp.sum(1).mean())}
 (P/'incumbent-research-direct-top2-metrics.json').write_text(json.dumps(report,indent=2)+'\n'); (P/'incumbent-per-label-metrics.csv').write_text('label,support,predictedCount,precision,recall,f1,TP,FP,FN\n'+'\n'.join(','.join(str(x[k]) for k in ['label','support','predictedCount','precision','recall','f1','TP','FP','FN']) for x in per)+'\n');
 with (P/'incumbent-predictions.csv').open('w',newline='') as f: w=csv.writer(f);w.writerow(['id','goldLabels','predictedLabels']);w.writerows((i,';'.join(g),';'.join(o)) for i,g,o in rows)
 print(json.dumps(report,indent=2))
if __name__=='__main__':main()

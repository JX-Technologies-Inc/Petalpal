"""Internal-author cross-fitted global threshold; no external Dev access."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P.parent/'auto-v1'))
from predict_ensemble import predict
from experiment import report,PRODUCT
GRID=[.15,.20,.25,.30,.35,.40,.45,.50]
def score(y,p):
 tp=(y&p).sum(0);den=y.sum(0)+p.sum(0)
 return {'macroF1':float(np.divide(2*tp,den,out=np.zeros(len(PRODUCT)),where=den>0).mean()),'microPrecision':float(tp.sum()/max(1,p.sum()))}
def choose(y,preds,ix):
 values=[score(y[ix],p[ix]) for p in preds];eligible=[i for i,m in enumerate(values) if m['microPrecision']>=.5]
 if not eligible:return .35,values
 best=max(eligible,key=lambda i:(values[i]['macroF1'],GRID[i]));return GRID[best],values

def main():
 exp=P/'pilot-experiment';assert json.loads((exp/'summary.json').read_text())['status']=='COMPLETE'
 out=exp/'calibration';out.mkdir(exist_ok=False)
 b=(P/'pilot-data/calibration.jsonl').read_bytes();manifest=json.loads((P/'pilot-data/manifest.json').read_text());assert hashlib.sha256(b).hexdigest()==manifest['hashes']['calibration']
 rows=[json.loads(l) for l in b.decode().splitlines()];spec=json.loads((exp/'ensemble.json').read_text())
 protocol={'grid':GRID,'precisionFloor':.5,'selection':'median of five thresholds, each selected on other four author folds by macro18 F1; ties higher threshold; fallback .35','foldSalt':'cosowell-calibration-threshold-v1:','checkpointSelection':'already selected by calibration BCE; cross-fitting only threshold, not unbiased full-pipeline validation','externalDevSeen':False}
 (out/'protocol.json').write_text(json.dumps(protocol,indent=2)+'\n')
 probs=predict(rows,spec);np.save(out/'probabilities.npy',probs)
 y=np.array([[l in r['modelLabels'] for l in PRODUCT] for r in rows]);preds=[];gridmetrics=[]
 for threshold in GRID:
  m=report(rows,probs,threshold);preds.append(np.array([[l in o for l in PRODUCT] for o in m['outputs']]));gridmetrics.append({'threshold':threshold,'selected18':m['selected18']})
 fold=np.array([int(hashlib.sha256((protocol['foldSalt']+r['sourceGroupId']).encode()).hexdigest(),16)%5 for r in rows]);oof=np.zeros_like(y);choices=[]
 for k in range(5):
  threshold,_=choose(y,preds,fold!=k);oof[fold==k]=preds[GRID.index(threshold)][fold==k];choices.append({'fold':k,'heldOutAuthors':int((fold==k).sum()),'threshold':threshold})
 threshold=float(np.median([c['threshold'] for c in choices]));spec['threshold']=threshold
 (out/'ensemble.json').write_text(json.dumps(spec,indent=2)+'\n')
 result={'threshold':threshold,'foldChoices':choices,'thresholdOnlyOutOfFold':score(y,oof),'fixed035':score(y,preds[GRID.index(.35)]),'gridMetrics':gridmetrics,'limitation':'64 authors, rare labels; same calibration used for checkpoint loss, OOF is not an independent pipeline estimate'}
 (out/'summary.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='gridMetrics'},indent=2),flush=True)
if __name__=='__main__':main()

#!/usr/bin/env python3
import hashlib,json,sys
from pathlib import Path
import numpy as np
from sklearn.metrics import precision_recall_fscore_support

HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE.parent/"auto-v1"))
from experiment import LABELS, PRODUCT
import evaluate_frozen_100 as engine

rows=[json.loads(x) for x in (HERE/"dev.jsonl").read_text().splitlines() if x.strip()]
p21=np.load(HERE/"experiment/epoch-0-probabilities.npy"); idx=[LABELS.index(l) for l in PRODUCT]; p=p21[:,idx]
y=np.array([[l in r["modelLabels"] for l in PRODUCT] for r in rows],dtype=np.int8)
fold=np.array([int(hashlib.sha256(r["sourceGroupId"].encode()).hexdigest(),16)%5 for r in rows])
grid=np.array([.15,.2,.25,.3,.35,.4,.45,.5,.55,.6]); chosen=[]; calibrated=np.zeros_like(p21)

def fit(yy,pp):
    if yy.sum()<4:return .35
    valid=[]
    for t in grid:
        pred=pp>=t; pr,re,f,_=precision_recall_fscore_support(yy,pred,average="binary",zero_division=0)
        if pr>=.5:valid.append((f,t))
    return float(max(valid,key=lambda z:(z[0],z[1]))[1]) if valid else .35
def transform(pp,t):
    pp=np.clip(pp,1e-6,1-1e-6); t=np.clip(t,1e-6,1-1e-6)
    z=np.log(pp/(1-pp))-np.log(t/(1-t))+np.log(.35/.65)
    return 1/(1+np.exp(-z))
def metrics(prob):
    engine.THRESHOLD=.35
    anns=[{"primaryGardenMood":None} for _ in rows]
    outputs=engine.select_variants(prob,anns,ROOT)
    pred=np.array([[l in o for l in PRODUCT] for o in outputs],dtype=np.int8)
    ma=engine.metric_report(y,pred)
    return ma,outputs

for f in range(5):
    train=fold!=f; test=fold==f; ts=[]
    calibrated[test]=p21[test]
    for j,l in enumerate(PRODUCT):
        t=fit(y[train,j],p[train,j]);ts.append(t)
        calibrated[test,LABELS.index(l)]=transform(p[test,j],t)
    chosen.append(ts)
base,_=metrics(p21); oof,outputs=metrics(calibrated)
final={l:float(np.median([chosen[f][j] for f in range(5)])) for j,l in enumerate(PRODUCT)}
success=oof["macro"]["f1"]>base["macro"]["f1"] and oof["micro"]["precision"]>=.5
result={"status":"COMPLETE","baseline":base,"oofCalibrated":oof,"foldThresholds":[dict(zip(PRODUCT,x)) for x in chosen],
        "finalMedianThresholds":final,"success":success,"decision":"PROMOTE_FOR_FURTHER_DEVELOPMENT" if success else "REJECT",
        "externalEvaluationLoaded":False,"warning":"OOF development estimate; not final evaluation and does not include annotation uncertainty"}
np.save(HERE/"oof-calibrated-probabilities.npy",calibrated)
(HERE/"calibration-result.json").write_text(json.dumps(result,indent=2)+"\n")
print(json.dumps({"baseline":base["macro"]|{"microPrecision":base["micro"]["precision"]},"calibrated":oof["macro"]|{"microPrecision":oof["micro"]["precision"]},"decision":result["decision"]},indent=2))

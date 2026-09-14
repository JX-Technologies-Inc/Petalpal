#!/usr/bin/env python3
"""Threshold-free diagnosis on the legal internal Dev only; never selects a candidate."""
import json, sys
from pathlib import Path
import numpy as np
from sklearn.metrics import average_precision_score

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE.parent/"auto-v1"))
from experiment import LABELS, PRODUCT, report

rows=[json.loads(x) for x in (HERE/"dev.jsonl").read_text().splitlines() if x.strip()]
truth=np.array([[l in r["modelLabels"] for l in PRODUCT] for r in rows],dtype=np.int8)
idx=[LABELS.index(l) for l in PRODUCT]

def oracle_f1(y,p):
    best=(0.,None)
    for t in sorted(set(float(x) for x in p),reverse=True):
        q=p>=t; tp=int((q&y.astype(bool)).sum()); fp=int((q&~y.astype(bool)).sum()); fn=int((~q&y.astype(bool)).sum())
        f=0. if 2*tp+fp+fn==0 else 2*tp/(2*tp+fp+fn)
        if f>best[0]: best=(f,t)
    return best

out={"status":"DIAGNOSTIC_ONLY_NOT_MODEL_SELECTION","devRows":len(rows),"externalEvaluationLoaded":False,"epochs":{}}
for epoch in [0,1,2]:
    probs=np.load(HERE/f"experiment/epoch-{epoch}-probabilities.npy")[:,idx]
    fixed=report(rows,np.load(HERE/f"experiment/epoch-{epoch}-probabilities.npy"),.35)
    per={}
    for j,l in enumerate(PRODUCT):
        y=truth[:,j]; p=probs[:,j]; of,ot=oracle_f1(y,p)
        per[l]={"support":int(y.sum()),"averagePrecision":float(average_precision_score(y,p)),
                "positiveMedian":float(np.median(p[y==1])),"negativeP95":float(np.quantile(p[y==0],.95)),
                "predictedPositiveAt035":int((p>=.35).sum()),"oracleF1Diagnostic":of,"oracleThresholdDiagnostic":ot}
    out["epochs"][str(epoch)]={"rawMacroF1At035":fixed["raw18"]["macro"]["f1"],
        "selectedMacroF1At035":fixed["selected18"]["macro"]["f1"],
        "microPrecisionAt035":fixed["selected18"]["micro"]["precision"],
        "macroAveragePrecision":float(np.mean([v["averagePrecision"] for v in per.values()])),
        "macroOracleF1Diagnostic":float(np.mean([v["oracleF1Diagnostic"] for v in per.values()])),"perLabel":per}
(HERE/"diagnostic.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps({e:{k:v for k,v in d.items() if k!="perLabel"} for e,d in out["epochs"].items()},indent=2))

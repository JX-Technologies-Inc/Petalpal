#!/usr/bin/env python3
import hashlib,json,sys,unicodedata
from pathlib import Path
import numpy as np
HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE.parent/"auto-v1"))
from predict_ensemble import predict
from experiment import report
def read(p):return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
def norm(x):return " ".join(unicodedata.normalize("NFKC",x).casefold().split())
def keys(rows,key):return {r.get(key) for r in rows if r.get(key) is not None}
out=HERE/"hybrid-v2-check";out.mkdir(exist_ok=False)
dev=read(HERE/"dev.jsonl"); lineage=read(ROOT/"hybrid-data-v2/train.jsonl")+read(ROOT/"hybrid-data-v2/dev.jsonl")
overlaps={"id":len(keys(dev,"id")&keys(lineage,"id")),"sourceGroupId":len(keys(dev,"sourceGroupId")&keys(lineage,"sourceGroupId")),
          "exactText":len({r["journal"] for r in dev}&{r["journal"] for r in lineage}),
          "normalizedText":len({norm(r["journal"]) for r in dev}&{norm(r["journal"]) for r in lineage})}
audit={"status":"PASS" if not any(overlaps.values()) else "FAIL","overlapCounts":overlaps}
(out/"lineage-audit.json").write_text(json.dumps(audit,indent=2)+"\n");assert audit["status"]=="PASS"
cp=ROOT/"candidate-c-lite/fine-tuned-hybrid-v2-clean/best-checkpoint";spec={"checkpoints":[str(cp)],"weights":[1.0],"maxLengths":[128],"threshold":.5}
probs=predict(dev,spec);np.save(out/"probabilities.npy",probs);metrics=report(dev,probs,.5)
baseline=json.loads((HERE/"experiment/summary.json").read_text())["baselineMacroF1"]
score=metrics["selected18"]["macro"]["f1"];mp=metrics["selected18"]["micro"]["precision"]
result={"status":"COMPLETE","lineageAudit":"PASS","metrics":metrics,"baselineMacroF1":baseline,
        "decision":"PROMOTE_FOR_FURTHER_DEVELOPMENT" if score>baseline and mp>=.5 else "REJECT","externalEvaluationLoaded":False}
(out/"result.json").write_text(json.dumps(result,indent=2)+"\n");print(json.dumps({"macroF1":score,"microPrecision":mp,"decision":result["decision"]},indent=2))

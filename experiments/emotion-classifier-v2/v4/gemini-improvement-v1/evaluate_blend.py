#!/usr/bin/env python3
import json,sys
from pathlib import Path
import numpy as np
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/"auto-v1"))
from experiment import report
rows=[json.loads(x) for x in (HERE/"dev.jsonl").read_text().splitlines() if x.strip()]
p0=np.load(HERE/"experiment/epoch-0-probabilities.npy");p2=np.load(HERE/"experiment/epoch-2-probabilities.npy");blend=.5*p0+.5*p2
metrics=report(rows,blend,.35);np.save(HERE/"fixed-blend-probabilities.npy",blend)
baseline=report(rows,p0,.35)["selected18"]; score=metrics["selected18"]
decision="PROMOTE_FOR_FURTHER_DEVELOPMENT" if score["macro"]["f1"]>baseline["macro"]["f1"] and score["micro"]["precision"]>=.5 else "REJECT"
result={"status":"COMPLETE","baseline":baseline,"fixedBlend":metrics,"decision":decision,"externalEvaluationLoaded":False}
(HERE/"blend-result.json").write_text(json.dumps(result,indent=2)+"\n")
print(json.dumps({"macroF1":score["macro"]["f1"],"microPrecision":score["micro"]["precision"],"microRecall":score["micro"]["recall"],"decision":decision},indent=2))

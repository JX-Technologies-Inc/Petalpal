#!/usr/bin/env python3
"""One-time evaluation of the previously fixed V4f candidate on the locked Gemini reference."""
import hashlib, json, sys
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
V4 = HERE.parent
ROOT = V4.parents[1]
sys.path.insert(0, str(V4 / "auto-v1"))
from predict_ensemble import predict
from experiment import report

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def rows(path): return [json.loads(x) for x in path.read_text().splitlines() if x.strip()]

lock = json.loads((HERE / "lock.json").read_text())
assert lock["status"] == "LOCKED" and lock["leakageAudit"] == "PASS"
for name, digest in lock["hashes"].items():
    assert sha(HERE / name) == digest, f"locked artifact changed: {name}"

out = HERE / "fixed-v4f-baseline"
out.mkdir(exist_ok=False)
spec_path = V4 / "auto-v3/experiments/v4f-fixed-blend/ensemble.json"
spec = json.loads(spec_path.read_text())
assert spec["weights"] == [0.5, 0.5] and spec["threshold"] == 0.35
reference = rows(HERE / "final-labels.jsonl")
assert len(reference) == lock["counts"]["finalIncluded"] == 300

protocol = {
    "status": "FIXED_CANDIDATE_ONE_TIME_EVALUATION",
    "selection": "V4f fixed before Gemini cohort inference; no score-based weight, threshold, checkpoint, or selector choice",
    "referenceLockSha256": sha(HERE / "lock.json"),
    "finalLabelsSha256": lock["hashes"]["final-labels.jsonl"],
    "candidateSpecSha256": sha(spec_path),
    "candidateSpec": spec,
    "metric": "Macro-F1 over all 18 product labels; zero_division=0",
    "referenceType": lock["referenceNameRequired"],
}
(out / "protocol.json").write_text(json.dumps(protocol, indent=2) + "\n")
probs = predict(reference, spec)
np.save(out / "probabilities.npy", probs)
metrics = report(reference, probs, spec["threshold"])
(out / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
(out / "result.json").write_text(json.dumps({
    "status": "COMPLETE", "candidate": "v4f-fixed-blend", "threshold": 0.35,
    "rows": len(reference), "selected18": metrics["selected18"],
    "raw18": metrics["raw18"], "product": metrics["product"],
    "probabilitiesSha256": sha(out / "probabilities.npy"),
    "metricsSha256": sha(out / "metrics.json"), "promoted": False
}, indent=2) + "\n")
print(json.dumps(metrics["selected18"], indent=2))

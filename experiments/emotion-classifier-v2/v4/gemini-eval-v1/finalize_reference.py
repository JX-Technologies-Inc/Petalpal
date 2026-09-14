#!/usr/bin/env python3
import hashlib, json, unicodedata
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
P = HERE.parent / "independent-human-v1"
OUTPUTS = [HERE / "final-labels.jsonl", HERE / "invalid-exclusions.jsonl",
           HERE / "leakage-audit.json", HERE / "lock.json"]

def rows(path):
    return [json.loads(x) for x in path.read_text().splitlines() if x.strip()]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def norm(text):
    return " ".join(unicodedata.normalize("NFKC", text).casefold().split())

def write_jsonl(path, items):
    path.write_text("".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) + "\n" for x in items))

if any(p.exists() for p in OUTPUTS):
    raise SystemExit("refusing to replace existing final reference artifacts")

protocol = json.loads((HERE / "protocol.json").read_text())
labels = protocol["labels"]
cohort = rows(HERE / "blind-cohort.jsonl")
pa = rows(HERE / "pass-a.jsonl")
pb = rows(HERE / "pass-b.jsonl")
adj = rows(HERE / "adjudications.jsonl")

assert len(cohort) == len(pa) == len(pb) == 300
ids = [x["id"] for x in cohort]
assert len(set(ids)) == 300
assert [x["id"] for x in pa] == ids and [x["id"] for x in pb] == ids

def valid(x):
    ls = x.get("labels")
    return (isinstance(ls, list) and len(ls) <= 2 and len(ls) == len(set(ls))
            and all(v in labels for v in ls) and isinstance(x.get("rationale"), str)
            and bool(x["rationale"].strip()))

assert all(valid(x) for x in pa) and all(valid(x) for x in pb)
a = {x["id"]: x for x in pa}; b = {x["id"]: x for x in pb}
disagreements = [i for i in ids if set(a[i]["labels"]) != set(b[i]["labels"])]
agreements = [i for i in ids if i not in set(disagreements)]
assert len(disagreements) == 81
assert len(adj) == len(disagreements) and {x["id"] for x in adj} == set(disagreements)
assert all(valid(x) for x in adj)
ad = {x["id"]: x for x in adj}

final = []
for row in cohort:
    i = row["id"]
    if i in ad:
        chosen, method = ad[i], "gemini_adjudication"
    else:
        chosen, method = a[i], "exact_pass_agreement"
    final.append({**row, "modelLabels": sorted(chosen["labels"], key=labels.index),
        "reference": {"method": method, "humanGold": False, "humanLabeled": False,
        "candidateBlind": True, "rationale": chosen["rationale"]}})

# Every API output was schema-valid, so protocol-defined invalid exclusions are empty.
exclusions = []
write_jsonl(HERE / "final-labels.jsonl", final)
write_jsonl(HERE / "invalid-exclusions.jsonl", exclusions)

comparison_paths = {
    "pilotTrain": P / "pilot-data/train.jsonl",
    "pilotCalibration": P / "pilot-data/calibration.jsonl",
    "priorExternalDev": P / "dev.jsonl",
}
comparison = {k: rows(v) for k, v in comparison_paths.items()}
eval_ids = set(ids); eval_groups = {x["sourceGroupId"] for x in cohort}
eval_exact = {x["journal"] for x in cohort}; eval_norm = {norm(x["journal"]) for x in cohort}
checks = {
    "rowCount300": len(cohort) == 300,
    "uniqueIds": len(eval_ids) == 300,
    "uniqueSourceGroups": len(eval_groups) == 300,
    "uniqueExactTexts": len(eval_exact) == 300,
    "uniqueNormalizedTexts": len(eval_norm) == 300,
    "rawTextHashesMatch": all(hashlib.sha256(x["journal"].encode()).hexdigest() == x["provenance"]["rawTextSha256"] for x in cohort),
}
overlaps = {}
for name, other in comparison.items():
    other_ids = {x["id"] for x in other}
    other_groups = {x.get("sourceGroupId") for x in other}
    other_exact = {x["journal"] for x in other}
    other_norm = {norm(x["journal"]) for x in other}
    overlaps[name] = {"id": len(eval_ids & other_ids), "sourceGroup": len(eval_groups & other_groups),
                      "exactText": len(eval_exact & other_exact), "normalizedText": len(eval_norm & other_norm)}
    checks[f"disjointFrom{name[0].upper()+name[1:]}"] = not any(overlaps[name].values())

audit = {"status": "PASS" if all(checks.values()) else "FAIL", "checks": checks,
         "overlapCounts": overlaps, "comparisonFileHashes": {k: sha(v) for k, v in comparison_paths.items()},
         "limitations": "Hash/source-group/exact/normalized isolation audit; no semantic-nearest-neighbor rerun."}
(HERE / "leakage-audit.json").write_text(json.dumps(audit, indent=2) + "\n")
assert audit["status"] == "PASS"

artifact_names = ["protocol.json", "cohort-manifest.json", "blind-cohort.jsonl", "pass-a.jsonl",
                  "pass-b.jsonl", "adjudications.jsonl", "final-labels.jsonl",
                  "invalid-exclusions.jsonl", "leakage-audit.json"]
lock = {"status": "LOCKED", "lockedAt": datetime.now(timezone.utc).isoformat(),
        "protocolId": protocol["protocolId"], "referenceNameRequired": protocol["referenceNameRequired"],
        "counts": {"cohort": 300, "agreement": len(agreements), "disagreement": len(disagreements),
                   "adjudicationSucceeded": len(adj), "adjudicationFailed": len(exclusions),
                   "finalIncluded": len(final), "excluded": len(exclusions)},
        "leakageAudit": audit["status"], "candidateInferencePerformed": False,
        "postInferenceRelabeling": "FORBIDDEN",
        "hashes": {name: sha(HERE / name) for name in artifact_names}}
(HERE / "lock.json").write_text(json.dumps(lock, indent=2) + "\n")
print(json.dumps(lock, indent=2))

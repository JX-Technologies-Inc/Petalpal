#!/usr/bin/env python3
import hashlib, json, re
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
POOL = HERE.parent / "public-domain-data-v1-20260910" / "petalpal-domain-candidate-pool.jsonl"
POOL_AUDIT = HERE.parent / "public-domain-data-v1-20260910" / "lineage-audit.json"
BASE = HERE.parent / "train.jsonl"
GO = HERE.parent / "public-source-shortlist-20260910" / "goemotions-targeted-tranche.jsonl"
OUT = HERE / "pilot-tranche.jsonl"

def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s.lower())).strip()
def h(s): return hashlib.sha256(norm(s).encode()).hexdigest()
def sid(r): return hashlib.sha256(r["originalRowId"].encode()).hexdigest()
def load(p): return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]

pool = load(POOL); base = load(BASE); go = load(GO); audit = json.loads(POOL_AUDIT.read_text())
assert audit["status"] == "PASS_WITH_RESIDUAL_RISK" and audit["normalizedTextOverlapWithHistoricalLineage"] == 0
base_hashes = {h(r["journal"]) for r in base}; go_hashes = {h(r["journal"]) for r in go}; base_ids = {r["id"] for r in base}; go_ids = {r["id"] for r in go}
lem = [r for r in pool if r["dataset"] == "Lemotif"]; en = [r for r in pool if r["dataset"] == "enISEAR"]
selected = []
weak = {"anger", "confusion", "disgust"}
for r in sorted(lem, key=lambda x: x["originalRowId"]):
    if set(r["mappedPetalPalLabels"]) & weak: selected.append(r)
assert len(selected) <= 120
selected_ids = {r["originalRowId"] for r in selected}
for r in sorted([x for x in lem if "excitement" in x["mappedPetalPalLabels"] and x["originalRowId"] not in selected_ids], key=sid):
    if len(selected) >= 120: break
    selected.append(r); selected_ids.add(r["originalRowId"])
assert len(selected) == 120
used_workers = set()
for label in ["anger", "disgust"]:
    candidates = sorted([r for r in en if label in r["mappedPetalPalLabels"]], key=lambda x: (-int(x["provenance"]["validationScore"]), sid(x)))
    got = 0
    for r in candidates:
        if r["authorId"] in used_workers: continue
        selected.append(r); selected_ids.add(r["originalRowId"]); used_workers.add(r["authorId"]); got += 1
        if got == 15: break
    assert got == 15
assert len(selected) == 150

for r in selected:
    text_hash = h(r["text"]); assert text_hash not in base_hashes and text_hash not in go_hashes
    assert r["originalRowId"] not in base_ids and r["originalRowId"] not in go_ids
    r["journal"] = r["text"]
    r["modelLabels"] = list(r["mappedPetalPalLabels"]); r["pilotRole"] = "bounded_domain_matched_train_candidate"
    r["pilotSelection"] = "Lemotif weak-label-first quota or enISEAR validation>=3 with one worker per selected row; no Dev/holdout content used"
OUT.write_text("\n".join(json.dumps(r, ensure_ascii=False, sort_keys=True) for r in selected) + "\n")
by_source = Counter(r["dataset"] for r in selected); by_label = Counter(l for r in selected for l in r["mappedPetalPalLabels"])
out_hashes = {h(r["text"]) for r in selected}
audit_out = {
    "status": "PASS_WITH_RESIDUAL_RISK", "selectionUsesDevTextOrLabels": False, "selectionUsesOpenedGemini300": False, "holdoutTextRead": False,
    "candidatePoolAuditStatus": audit["status"], "candidatePoolRows": len(pool), "baseTrainRows": len(base), "existingGoRows": len(go), "pilotRows": len(selected), "resultingTrainRows": len(base) + len(go) + len(selected),
    "pilotBySource": dict(by_source), "pilotByLabel": dict(by_label), "lemotifRows": sum(r["dataset"] == "Lemotif" for r in selected), "enISEARRows": sum(r["dataset"] == "enISEAR" for r in selected),
    "enISEARUniqueWorkers": len(used_workers), "normalizedOverlapWithCanonicalTrain": len(out_hashes & base_hashes), "normalizedOverlapWithExistingGoTranche": len(out_hashes & go_hashes), "rowIdOverlapWithCanonicalTrain": 0, "rowIdOverlapWithExistingGoTranche": 0,
    "sourceAuthorResidualRisk": {"Lemotif": "flat CSV has no respondent IDs", "enISEAR": "one selected row per source-local worker; cross-source identity cannot be proven"}, "licenseResidualRisk": {"Lemotif": "dataset-specific license not stated", "enISEAR": "ODC-By 1.0 with attribution and contents/privacy review"},
    "selectionRationale": "Use all available direct Lemotif anger/confusion/disgust rows, cap Lemotif excitement to a balanced 120-row source tranche, and add 15 validated unique-worker enISEAR anger plus 15 disgust rows."
}
(HERE / "pilot-audit.json").write_text(json.dumps(audit_out, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"pilotRows": len(selected), "bySource": dict(by_source), "byLabel": dict(by_label), "audit": str(HERE / 'pilot-audit.json')}, indent=2, ensure_ascii=False))

#!/usr/bin/env python3
import csv, hashlib, json, re
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
LINEAGE = HERE.parent / "public-source-shortlist-20260910" / "lineage-reference.jsonl"
LEMOTIF = HERE / "lemotif" / "lemotif-data-cleaned-flat.csv"
ENISEAR = HERE / "enisear" / "raw" / "deISEARenISEAR" / "enISEAR.tsv"
POOL = HERE / "petalpal-domain-candidate-pool.jsonl"

def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s.lower())).strip()

def h(s):
    return hashlib.sha256(norm(s).encode()).hexdigest()

DIRECT = {"afraid": "fear", "angry": "anger", "confused": "confusion", "disgusted": "disgust", "excited": "excitement", "happy": "joy", "sad": "sadness", "surprised": "surprise"}
PRIORITY = {"admiration", "anger", "confusion", "curiosity", "disgust", "remorse", "excitement"}
ISEAR_DIRECT = {"Anger": "anger", "Disgust": "disgust", "Fear": "fear", "Joy": "joy", "Sadness": "sadness"}

lineage = [json.loads(x) for x in LINEAGE.read_text().splitlines() if x.strip()]
lineage_hashes = {x["text_normalized_sha256"] for x in lineage}
lineage_ids = {str(x["original_row_id"]) for x in lineage if x.get("original_row_id") is not None}
rows = []
source_stats = defaultdict(Counter)

with LEMOTIF.open(encoding="utf-8", newline="") as f:
    for idx, r in enumerate(csv.DictReader(f), start=1):
        labels = [v for k, v in DIRECT.items() if r[f"Answer.f1.{k}.raw"].strip().lower() in {"true", "1", "yes"}]
        source_stats["Lemotif"]["inputRows"] += 1
        if not labels or not (set(labels) & PRIORITY):
            source_stats["Lemotif"]["excludedNoPriorityDirectLabel"] += 1
            continue
        rows.append({
            "text": r["Answer"].strip(), "originalLabels": [k for k, v in DIRECT.items() if v in labels and r[f"Answer.f1.{k}.raw"].strip().lower() in {"true", "1", "yes"}], "mappedPetalPalLabels": labels, "source": "Lemotif", "dataset": "Lemotif", "split": "official_cleaned_flat", "originalRowId": f"lemotif-row-{idx:04d}", "authorId": None, "sourceGroupId": None,
            "provenance": {"sourceUrl": "https://github.com/xaliceli/lemotif/blob/master/assets/data/lemotif-data-cleaned-flat.csv", "paper": "https://arxiv.org/abs/1903.07766", "retrievalDate": "2026-09-10", "sourceType": "Amazon Mechanical Turk journal respondents", "labelEvidence": "respondent self-selected emotion checkboxes", "licenseInfo": "Dataset rights are not separately stated; repository MIT license is code-only; research-use rights require author/product review"},
            "domainMatchFlag": "very_high", "qualityFlag": "human_written_journal_entry_direct_self_label", "mappingConfidence": "high_direct_only", "selectionReason": "PetalPal-like daily journal prompt; retained only direct taxonomy-compatible labels with at least one priority weak label; no fuzzy proud/guilt/shame mappings"
        })

with ENISEAR.open(encoding="utf-8", newline="") as f:
    for r in csv.DictReader(f, delimiter="\t"):
        source_stats["enISEAR"]["inputRows"] += 1
        prior = r["Prior_Emotion"]; mapped = ISEAR_DIRECT.get(prior)
        if not mapped or int(r[prior]) < 3:
            source_stats["enISEAR"]["excludedNonDirectOrValidationBelow3"] += 1
            continue
        rows.append({
            "text": r["Sentence"].strip(), "originalLabels": [prior], "mappedPetalPalLabels": [mapped], "source": "enISEAR", "dataset": "enISEAR", "split": "official_phase1_with_phase2_validation", "originalRowId": f"enISEAR-{r['Sentence_id']}", "authorId": f"worker:{r['Worker_id']}", "sourceGroupId": f"enISEAR-worker:{r['Worker_id']}",
            "provenance": {"sourceUrl": "https://www.ims.uni-stuttgart.de/forschung/ressourcen/korpora/deisear/", "downloadUrl": "https://www.romanklinger.de/data-sets/deISEARenISEAR.zip", "paper": "https://aclanthology.org/N19-1063/", "retrievalDate": "2026-09-10", "sourceType": "crowdsourced first-person event description", "labelEvidence": "predefined emotion prompt plus Phase-2 validation score >=3/5", "validationScore": int(r[prior]), "licenseInfo": "ODC-By 1.0; attribution required; contents/privacy rights still require review"},
            "domainMatchFlag": "high", "qualityFlag": "human_written_event_self_report_validated", "mappingConfidence": "high_direct_only", "selectionReason": "Personal event description with direct anger/disgust/fear/joy/sadness target and Phase-2 validation >=3; guilt/shame excluded rather than mapped to remorse"
        })

seen = set(); accepted = []; excluded = Counter()
for r in rows:
    nh = h(r["text"]); rid = r["originalRowId"]
    source_stats[r["dataset"]]["eligibleBeforeLineage"] += 1
    if rid in lineage_ids:
        excluded["known_original_row_id_overlap"] += 1; continue
    if nh in lineage_hashes:
        excluded["normalized_text_overlap_with_historical_lineage"] += 1; continue
    if nh in seen:
        excluded["normalized_text_duplicate_within_new_pool"] += 1; continue
    seen.add(nh); r["normalizedTextSha256"] = nh; r["candidateId"] = f"{r['dataset'].lower()}:{rid}"; accepted.append(r)

POOL.write_text("\n".join(json.dumps(x, ensure_ascii=False, sort_keys=True) for x in accepted) + "\n")
counts = Counter(l for r in accepted for l in r["mappedPetalPalLabels"])
source_summary = {"retrieved": "2026-09-10", "candidateRows": len(accepted), "sourceRows": {k: dict(v) for k, v in source_stats.items()}, "mappedLabelMembership": dict(sorted(counts.items())), "priorityCoverage": {l: counts[l] for l in sorted(PRIORITY)}, "sourceUrls": {"Lemotif": "https://github.com/xaliceli/lemotif", "enISEAR": "https://www.ims.uni-stuttgart.de/forschung/ressourcen/korpora/deisear/"}, "recommendation": "Prioritize a small Lemotif tranche first for direct journaling-domain coverage; use enISEAR as a validated event-description supplement for anger/disgust and direct neighboring labels. Do not auto-map guilt/shame to remorse."}
(HERE / "source-summary.json").write_text(json.dumps(source_summary, indent=2, ensure_ascii=False) + "\n")
audit = {"status": "PASS_WITH_RESIDUAL_RISK", "retrieved": "2026-09-10", "inputRows": {k: int(v["inputRows"]) for k, v in source_stats.items()}, "eligibleBeforeLineage": {k: int(v["eligibleBeforeLineage"]) for k, v in source_stats.items()}, "acceptedRows": len(accepted), "acceptedBySource": dict(Counter(r["dataset"] for r in accepted)), "acceptedByLabel": dict(counts), "excluded": dict(excluded), "historicalLineageRowsIndexed": len(lineage), "historicalLineageHashesCompared": len(lineage_hashes), "withinNewPoolNormalizedDuplicates": len(rows) - len({h(r["text"]) for r in rows}), "sourceAuthorAudit": {"Lemotif": {"authorMetadataAvailable": False, "residualRisk": "flat CSV has no respondent ID; 1,473 rows originate from up to 500 MTurk respondents"}, "enISEAR": {"authorMetadataAvailable": True, "uniqueWorkers": len({r["authorId"] for r in accepted if r["dataset"] == "enISEAR"}), "residualRisk": "worker IDs are source-local and historical artifacts lack cross-source author identity"}}, "selectionUsesDevTextOrLabels": False, "selectionUsesOpenedGemini300": False, "holdoutTextRead": False, "licenseResidualRisk": {"Lemotif": "dataset-specific license not stated; repository MIT is code-only; do not redistribute without review", "enISEAR": "ODC-By 1.0 with attribution; contents/privacy rights still require review"}}
audit["poolSha256"] = hashlib.sha256(POOL.read_bytes()).hexdigest()
(HERE / "lineage-audit.json").write_text(json.dumps(audit, indent=2, ensure_ascii=False) + "\n")

hist = json.loads((HERE.parent / "public-source-shortlist-20260910" / "historical-data-source-inventory.json").read_text())
hist["asOf"] = "2026-09-10"; hist["candidatePoolUpdate"] = {"directory": str(HERE.relative_to(HERE.parents[3])), "rows": len(accepted), "enteredCurrentAlignedTrain": False, "newSources": ["Lemotif", "enISEAR"], "lineageAudit": "lineage-audit.json"}
hist["sources"].extend([
    {"dataset": "Lemotif", "enteredCurrentAlignedTrain": False, "candidatePoolRows": sum(r["dataset"] == "Lemotif" for r in accepted), "artifacts": ["public-domain-data-v1-20260910/lemotif/lemotif-data-cleaned-flat.csv", "public-domain-data-v1-20260910/petalpal-domain-candidate-pool.jsonl"], "decision": "NEW; recommend small targeted candidate tranche pending rights review", "knownIssues": "Excellent journaling-domain match and direct respondent emotion labels; no respondent ID in flat CSV, and dataset-specific license is not stated."},
    {"dataset": "enISEAR", "enteredCurrentAlignedTrain": False, "candidatePoolRows": sum(r["dataset"] == "enISEAR" for r in accepted), "artifacts": ["public-domain-data-v1-20260910/enisear/deISEARenISEAR.zip", "public-domain-data-v1-20260910/petalpal-domain-candidate-pool.jsonl"], "decision": "NEW; recommend validated anger/disgust supplement only", "knownIssues": "First-person event descriptions with direct prompted emotion and Phase-2 validation; worker IDs available, but guilt/shame are excluded rather than mapped to remorse."}
])
(HERE / "historical-source-inventory-v2.json").write_text(json.dumps(hist, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"acceptedRows": len(accepted), "bySource": dict(Counter(r["dataset"] for r in accepted)), "byLabel": dict(counts), "excluded": dict(excluded), "poolSha256": audit["poolSha256"]}, indent=2, ensure_ascii=False))

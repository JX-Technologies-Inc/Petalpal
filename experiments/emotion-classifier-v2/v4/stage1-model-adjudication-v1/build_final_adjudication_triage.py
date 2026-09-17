#!/usr/bin/env python3
import argparse, csv, hashlib, json
from collections import Counter
from pathlib import Path

BASE = Path(__file__).resolve().parent
OUT = BASE.parent / "stage1-final-adjudication-plan-v1"
VALUES = {"NO", "PLAUSIBLE", "CLEAR"}
EXPECTED = {"A": 847, "B": 356, "C": 409, "D": 206}

def read_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def severe(a, b):
    return {a, b} == {"NO", "CLEAR"}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def derive():
    rows = read_csv(BASE / "model-human-comparison.csv")
    blind = {r["adjudication_id"]: r for r in read_csv(BASE / "model-judge-blind-input.csv")}
    if len(rows) != 1818 or len({r["adjudication_id"] for r in rows}) != 1818:
        raise RuntimeError("input IDs are not exactly 1818 unique rows")
    records, counts = [], Counter()
    model_severe = consensus_c = guard = 0
    for r in rows:
        a, l = r["astra_applicability"], r["luna_applicability"]
        mc, cv = a == l, a if a == l else ""
        c1 = r["core1_status"] == "VALID_HUMAN" and r["core1_applicability"] in VALUES
        c2 = r["core2_status"] == "VALID_HUMAN" and r["core2_applicability"] in VALUES
        s1, s2 = mc and c1 and r["core1_applicability"] == cv, mc and c2 and r["core2_applicability"] == cv
        no_core = mc and not s1 and not s2
        core_sev = mc and ((c1 and severe(r["core1_applicability"], cv)) or (c2 and severe(r["core2_applicability"], cv)))
        auxdef = r["aux_primary_consensus_status"] == "STRICT_MAJORITY" and r["aux_primary_consensus"] in VALUES
        auxsup = mc and auxdef and r["aux_primary_consensus"] == cv
        n = int(r["aux_primary_valid_n"])
        auxstrong = n >= 5 and max(int(r["aux_primary_NO_count"]), int(r["aux_primary_PLAUSIBLE_count"]), int(r["aux_primary_CLEAR_count"])) / n >= .8
        if auxstrong != (r["aux_primary_strong_support"] == "true"):
            raise RuntimeError("primary auxiliary strong-support mismatch: " + r["adjudication_id"])
        aux_sev = mc and auxdef and auxstrong and severe(r["aux_primary_consensus"], cv)
        msev = severe(a, l)
        cflag = msev or (mc and (core_sev or (no_core and not auxsup) or aux_sev))
        if msev: model_severe += 1
        if cflag and mc: consensus_c += 1
        guard += int(mc and no_core and auxdef and not auxsup and not core_sev and not aux_sev)
        if cflag: bucket = "C"
        elif not mc: bucket = "B"
        elif (s1 or s2) and auxsup and auxstrong and not core_sev: bucket = "A"
        else: bucket = "D"
        counts[bucket] += 1
        auxstate = "SUPPORTS_CONSENSUS" if auxsup else ("DEFINED_OPPOSING_CATEGORY" if auxdef else "UNDEFINED_OR_MIXED")
        flags = {"model_consensus": mc, "model_no_clear_severe_conflict": msev, "core1_available": c1, "core2_available": c2,
                 "core1_supports_consensus": s1, "core2_supports_consensus": s2, "no_valid_core_support": no_core,
                 "valid_core_severe_contradiction": core_sev, "primary_aux_defined": auxdef,
                 "primary_aux_supports_model_consensus": auxsup, "primary_aux_strong_support": auxstrong,
                 "primary_aux_severe_contradiction": aux_sev, "primary_aux_evidence_state": auxstate}
        records.append((r, bucket, flags))
    c1missing = sum(r["case_type"] == "CORE1_MISSING" for r in rows)
    c2unavailable = sum(r["case_type"] == "NO_VALID_CORE2" for r in rows)
    guards = {**counts, "total": len(rows), "uncertainty": counts["B"] + counts["D"], "sol_queue": counts["C"],
              "model_severe": model_severe, "model_consensus_c_union": consensus_c, "discrepancy_guard": guard,
              "CORE1_MISSING": c1missing, "CORE2_UNAVAILABLE": c2unavailable}
    required = {**EXPECTED, "total": 1818, "uncertainty": 562, "sol_queue": 409, "model_severe": 39,
                "model_consensus_c_union": 370, "discrepancy_guard": 50, "CORE1_MISSING": 4, "CORE2_UNAVAILABLE": 684}
    if any(guards.get(k) != v for k, v in required.items()):
        raise RuntimeError("authoritative guard mismatch: " + json.dumps(guards, sort_keys=True))
    return rows, blind, records, guards

def write_csv(path, fields, rows):
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--write", action="store_true"); args = ap.parse_args()
    rows, blind, records, g = derive()
    print(json.dumps(g, sort_keys=True))
    if not args.write: print("validation PASS (dry-run; no files written)"); return
    if OUT.exists(): raise RuntimeError("refusing to overwrite existing output directory")
    OUT.mkdir()
    tri, sol, side, unc = [], [], [], []
    for r, b, f in records:
        core = "CORE1_MISSING" if r["case_type"] == "CORE1_MISSING" else ("CORE2_UNAVAILABLE" if r["case_type"] == "NO_VALID_CORE2" else ("CORE_SUPPORTS" if f["core1_supports_consensus"] or f["core2_supports_consensus"] else "NO_VALID_CORE_SUPPORT"))
        coverage = ";".join(x for x, ok in [("CORE1_MISSING", r["case_type"] == "CORE1_MISSING"), ("CORE2_UNAVAILABLE", r["case_type"] == "NO_VALID_CORE2"), ("CORE1_AVAILABLE", f["core1_available"]), ("CORE2_AVAILABLE", f["core2_available"])] if ok)
        tri.append({"adjudication_id":r["adjudication_id"],"sample_id":r["sample_id"],"label":r["label"],"case_type":r["case_type"],"bucket":b,"coverage_flags":coverage,"model_relation":"AGREE" if f["model_consensus"] else "ADJACENT","core_support_state":core,"aux_primary_support_state":f["primary_aux_evidence_state"],"aux_sensitivity_flags":"R06_SENSITIVITY_ONLY;R08_SENSITIVITY_ONLY","resolution_status":{"A":"ELIGIBLE_AUTO_RESOLUTION","B":"MODEL_BOUNDARY_UNCERTAIN_ADJACENT","C":"REQUIRES_SOL_BLIND_ADJUDICATION","D":"PROVISIONAL_MODEL_CONSENSUS"}[b],"consensus_applicability_observed":r["astra_applicability"] if f["model_consensus"] else "","final_applicability":"","final_reference_set_allowed":"false"})
        if b == "C":
            sol.append({"adjudication_id":r["adjudication_id"],"sample_id":r["sample_id"],"text":blind[r["adjudication_id"]]["text"],"label":r["label"],"label_definition":r["label_definition"],"allowed_values":"NO | PLAUSIBLE | CLEAR","instruction_version":"stage1-final-sol-blind-v1"})
            side.append({"adjudication_id":r["adjudication_id"],"sample_id":r["sample_id"],"label":r["label"],"astra_applicability":r["astra_applicability"],"luna_applicability":r["luna_applicability"],"core1_applicability":r["core1_applicability"] if f["core1_available"] else "","core2_applicability":r["core2_applicability"] if f["core2_available"] else "","primary_aux_consensus":r["aux_primary_consensus"] if f["primary_aux_defined"] else "","primary_aux_evidence_state":f["primary_aux_evidence_state"],"coverage_flags":coverage})
        elif b in {"B","D"}: unc.append({"adjudication_id":r["adjudication_id"],"sample_id":r["sample_id"],"label":r["label"],"bucket":b,"uncertainty_type":"ADJACENT_MODEL_SPLIT" if b=="B" else "WEAKLY_CORROBORATED_MODEL_CONSENSUS","available_evidence":f["primary_aux_evidence_state"]+";"+core,"model_relation":"AGREE" if f["model_consensus"] else "ADJACENT","coverage_flags":coverage})
    write_csv(OUT/"triage-manifest.csv", list(tri[0]), tri); write_csv(OUT/"sol-blind-input.csv", list(sol[0]), sol); write_csv(OUT/"evidence-sidecar.csv", list(side[0]), side); write_csv(OUT/"uncertainty-manifest.csv", list(unc[0]), unc)
    (OUT/"summary.json").write_text(json.dumps({"status":"TRIAGE_PREPARED_NO_FINAL_ADJUDICATION","guards":g,"final_labels_created":False,"final_reference_set_allowed":False},indent=2)+"\n")
    (OUT/"protocol.json").write_text(json.dumps({"status":"TRIAGE_PREPARED_NO_FINAL_ADJUDICATION","rules":"sol-high-reconciled-deterministic-v1","final_reference_set_allowed":False,"final_labels_created":False},indent=2)+"\n")
    (OUT/"provenance.json").write_text(json.dumps({"source":"locked post-lock comparison artifacts only","no_judge_called":True,"judgment_mutation":False,"earlier_stop_reconciled":True},indent=2)+"\n")
    (OUT/"validation.json").write_text(json.dumps({"validation":"PASS","guards":g,"final_labels_created":False,"final_reference_set_allowed":False}, indent=2)+"\n")
    print("write PASS", OUT)

if __name__ == "__main__": main()

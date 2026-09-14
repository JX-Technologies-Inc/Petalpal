#!/usr/bin/env python3
import collections,hashlib,json,unicodedata
from pathlib import Path
HERE=Path(__file__).resolve().parent; V4=HERE.parent; P=V4/"independent-human-v1"; E=V4/"gemini-eval-v1"; ROOT=V4.parent
OUT=[HERE/"blind-train.jsonl",HERE/"blind-dev.jsonl",HERE/"lineage-audit.json",HERE/"split-lock.json"]
if any(x.exists() for x in OUT):raise SystemExit("refusing to replace locked split")
def rows(p):return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def norm(s):return " ".join(unicodedata.normalize("NFKC",s).casefold().split())
def blind(r,role):return {k:r[k] for k in ["id","journal","sourceType","sourceGroupId","provenance"]}|{"alignedRole":role}
pm=json.loads((P/"pilot-data/manifest.json").read_text())
assert sha(P/"pilot-data/train.jsonl")==pm["hashes"]["train"] and sha(P/"pilot-data/calibration.jsonl")==pm["hashes"]["calibration"]
train_source=rows(P/"pilot-data/train.jsonl")+rows(P/"pilot-data/calibration.jsonl");assert len(train_source)==841
candidates=rows(P/"candidate-train.jsonl");pilot={r["id"] for r in rows(P/"pilot-blind.jsonl")};eligible=[r for r in candidates if r["id"] not in pilot]
ranked=sorted(eligible,key=lambda r:hashlib.sha256(f'petalpal-gemini-eval-v1-20260908:{r["id"]}'.encode()).hexdigest())
opened_ids={r["id"] for r in rows(E/"blind-cohort.jsonl")};dev_source=ranked[300:]
assert len(eligible)==449 and len(dev_source)==149 and not ({r["id"] for r in dev_source}&opened_ids)
train=[blind(r,"train") for r in train_source];dev=[blind(r,"dev") for r in dev_source]
assert len({r["id"] for r in train})==841 and len({r["id"] for r in dev})==149
protected={"gemini300":E/"blind-cohort.jsonl","openedCoSoWELL367":P/"dev.jsonl","retired125":V4/"auto-v3/dev.jsonl",
           "oldHumanTest":ROOT/"hybrid-test-v2/test.jsonl","frozen2":ROOT/"frozen-2/frozen-2.jsonl"}
audit={"status":"PASS","sourceTypeCounts":{"train":dict(collections.Counter(r["sourceType"] for r in train)),"dev":dict(collections.Counter(r["sourceType"] for r in dev))},"checks":{},"protectedOverlapCounts":{}}
def sets(rr):return ({r.get("id") for r in rr},{r.get("sourceGroupId") for r in rr},{r["journal"] for r in rr},{norm(r["journal"]) for r in rr})
ts,ds=sets(train),sets(dev);names=["id","sourceGroup","exactText","normalizedText"]
audit["checks"]["trainDevDisjoint"]={n:len(a&b) for n,a,b in zip(names,ts,ds)}
audit["checks"]["trainUniqueIds"]=len(ts[0])==841;audit["checks"]["devUniqueIds"]=len(ds[0])==149;audit["checks"]["devUniqueAuthors"]=len(ds[1])==149
for name,path in protected.items():
    ps=sets(rows(path));audit["protectedOverlapCounts"][name]={n:len(ds0&ps0) for n,ds0,ps0 in zip(names,ds,ps)}
    # Neither aligned Train nor Dev may contain protected evaluation content.
    audit["protectedOverlapCounts"][name+"AgainstTrain"]={n:len(ts0&ps0) for n,ts0,ps0 in zip(names,ts,ps)}
flat=[v for group in audit["protectedOverlapCounts"].values() for v in group.values()]
if any(audit["checks"]["trainDevDisjoint"].values()) or not all([audit["checks"]["trainUniqueIds"],audit["checks"]["devUniqueIds"],audit["checks"]["devUniqueAuthors"]]) or any(flat):audit["status"]="FAIL"
for name,data in [("blind-train",train),("blind-dev",dev)]:
    (HERE/f"{name}.jsonl").write_text("".join(json.dumps(r,ensure_ascii=False,separators=(",",":"))+"\n" for r in data))
audit["inputHashes"]={"pilotTrain":pm["hashes"]["train"],"pilotCalibration":pm["hashes"]["calibration"],"candidateTrain":sha(P/"candidate-train.jsonl"),"pilotBlind":sha(P/"pilot-blind.jsonl")}
(HERE/"lineage-audit.json").write_text(json.dumps(audit,indent=2)+"\n");assert audit["status"]=="PASS"
lock={"status":"LOCKED_BEFORE_LABELS","rows":{"train":841,"dev":149},"hashes":{"protocol":sha(HERE/"protocol.json"),"blindTrain":sha(HERE/"blind-train.jsonl"),"blindDev":sha(HERE/"blind-dev.jsonl"),"lineageAudit":sha(HERE/"lineage-audit.json")},"splitUsesGeminiLabels":False,"splitUsesPredictions":False,"lineageAudit":"PASS"}
(HERE/"split-lock.json").write_text(json.dumps(lock,indent=2)+"\n");print(json.dumps({"lock":lock,"sourceTypes":audit["sourceTypeCounts"]},indent=2))

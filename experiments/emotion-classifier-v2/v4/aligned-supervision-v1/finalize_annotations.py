#!/usr/bin/env python3
import collections,hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;BASE=HERE.parent/"gemini-eval-v1";LABELS=json.loads((BASE/"protocol.json").read_text())["labels"]
OUT=[HERE/"train.jsonl",HERE/"dev.jsonl",HERE/"invalid-exclusions.jsonl",HERE/"annotation-lock.json"]
if any(x.exists() for x in OUT):raise SystemExit("refusing to replace finalized annotations")
def rows(p):return [json.loads(x) for x in p.read_text().splitlines() if x.strip()] if p.exists() else []
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,xs):p.write_text("".join(json.dumps(x,ensure_ascii=False,separators=(",",":"))+"\n" for x in xs))
blind=rows(HERE/"blind-train.jsonl")+rows(HERE/"blind-dev.jsonl");a={x["id"]:x for x in rows(HERE/"pass-a.jsonl")};b={x["id"]:x for x in rows(HERE/"pass-b.jsonl")};ad={x["id"]:x for x in rows(HERE/"adjudications.jsonl")}
ids=[x["id"] for x in blind];assert len(ids)==990 and set(a)==set(b)==set(ids)
dis=[i for i in ids if set(a[i]["labels"])!=set(b[i]["labels"])];assert set(ad)==set(dis)
def valid(x):return isinstance(x.get("labels"),list) and len(x["labels"])<=2 and len(x["labels"])==len(set(x["labels"])) and all(l in LABELS for l in x["labels"])
assert all(valid(x) for x in [*a.values(),*b.values(),*ad.values()])
final=[]
for r in blind:
 i=r["id"];chosen=ad.get(i,a[i]);final.append({**r,"modelLabels":sorted(chosen["labels"],key=LABELS.index),"annotation":{"method":"gemini_adjudication" if i in ad else "exact_gemini_pass_agreement","humanGold":False,"candidateBlind":True,"rationale":chosen["rationale"]}})
train=[x for x in final if x["alignedRole"]=="train"];dev=[x for x in final if x["alignedRole"]=="dev"];assert len(train)==841 and len(dev)==149
write(HERE/"train.jsonl",train);write(HERE/"dev.jsonl",dev);write(HERE/"invalid-exclusions.jsonl",[])
usage=rows(HERE/"usage.jsonl");cost=sum(x["estimatedCostUsd"] for x in usage);assert cost<=8
dist=lambda xs:dict(collections.Counter(l for x in xs for l in x["modelLabels"]))
lock={"status":"LOCKED","counts":{"train":841,"dev":149,"agreement":990-len(dis),"disagreement":len(dis),"adjudicated":len(ad),"invalid":0},"labelDistribution":{"train":dist(train),"dev":dist(dev)},"sourceCounts":{"train":dict(collections.Counter(x["sourceType"] for x in train)),"dev":dict(collections.Counter(x["sourceType"] for x in dev))},"usage":{"calls":len(usage),"inputTokens":sum(x["inputTokens"] for x in usage),"outputIncludingThinkingTokens":sum(x["outputIncludingThinkingTokens"] for x in usage),"estimatedActualCostUsd":cost,"budgetUsd":8},"hashes":{n:sha(HERE/n) for n in ["protocol.json","split-lock.json","lineage-audit.json","blind-train.jsonl","blind-dev.jsonl","pass-a.jsonl","pass-b.jsonl","adjudications.jsonl","train.jsonl","dev.jsonl","invalid-exclusions.jsonl","usage.jsonl"]},"openedEvaluationLoadedForLabelsOrSelection":False}
(HERE/"annotation-lock.json").write_text(json.dumps(lock,indent=2)+"\n");print(json.dumps(lock,indent=2))

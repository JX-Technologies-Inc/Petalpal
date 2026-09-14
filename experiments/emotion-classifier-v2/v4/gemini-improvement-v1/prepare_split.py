#!/usr/bin/env python3
import collections, hashlib, json, random, unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
P = HERE.parent / "independent-human-v1/pilot-data"
LABELS = ["admiration","amusement","anger","annoyance","caring","confusion","curiosity","disappointment","disgust","excitement","fear","gratitude","joy","love","optimism","remorse","sadness","surprise"]
OUT = [HERE/"train.jsonl", HERE/"dev.jsonl", HERE/"split-manifest.json"]
if any(x.exists() for x in OUT): raise SystemExit("refusing to replace split")

def read(p): return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def norm(s): return " ".join(unicodedata.normalize("NFKC",s).casefold().split())
manifest=json.loads((P/"manifest.json").read_text())
assert sha(P/"train.jsonl")==manifest["hashes"]["train"] and sha(P/"calibration.jsonl")==manifest["hashes"]["calibration"]
rows=read(P/"train.jsonl")+read(P/"calibration.jsonl")
groups=collections.defaultdict(list)
for r in rows: groups[r["sourceGroupId"]].append(r)
keys=sorted(groups); total=collections.Counter(l for r in rows for l in r["modelLabels"] if l in LABELS)

best=None
for trial in range(5000):
    rnd=random.Random(20260909+trial); order=keys[:]; rnd.shuffle(order)
    chosen=[]; n=0
    for k in order:
        if n>=180: break
        chosen.append(k); n+=len(groups[k])
    dev=[r for k in chosen for r in groups[k]]
    support=collections.Counter(l for r in dev for l in r["modelLabels"] if l in LABELS)
    missing=sum(max(0,2-support[l]) for l in LABELS if total[l])
    dist=sum(abs(support[l]/max(1,len(dev))-total[l]/len(rows)) for l in LABELS)
    score=(missing,abs(len(dev)-180),dist,trial)
    if best is None or score<best[0]: best=(score,set(chosen),support)
score,devgroups,support=best
assert score[0]==0
dev=[r for r in rows if r["sourceGroupId"] in devgroups]; train=[r for r in rows if r["sourceGroupId"] not in devgroups]
assert len(train)+len(dev)==841 and not ({r["sourceGroupId"] for r in train}&{r["sourceGroupId"] for r in dev})
assert not ({r["id"] for r in train}&{r["id"] for r in dev})
assert not ({norm(r["journal"]) for r in train}&{norm(r["journal"]) for r in dev})
for name,data in [("train",train),("dev",dev)]:
    (HERE/f"{name}.jsonl").write_text("".join(json.dumps(r,ensure_ascii=False,separators=(",",":"))+"\n" for r in data))
out={"status":"LOCKED","trial":score[3],"rows":{"train":len(train),"dev":len(dev)},
     "support":{"train":dict(collections.Counter(l for r in train for l in r["modelLabels"] if l in LABELS)),"dev":dict(support)},
     "hashes":{"protocol":sha(HERE/"protocol.json"),"sourceTrain":manifest["hashes"]["train"],"sourceCalibration":manifest["hashes"]["calibration"],"train":sha(HERE/"train.jsonl"),"dev":sha(HERE/"dev.jsonl")},
     "checks":{"sourceGroupDisjoint":True,"idDisjoint":True,"normalizedTextDisjoint":True,"allObservedLabelsDevSupportAtLeast2":True},
     "externalEvaluationLoaded":False}
(HERE/"split-manifest.json").write_text(json.dumps(out,indent=2)+"\n");print(json.dumps(out,indent=2))

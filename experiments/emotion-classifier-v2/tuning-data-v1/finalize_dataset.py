#!/usr/bin/env python3
import argparse
import difflib
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATE = ROOT / "state"
EVAL = ROOT.parent / "evaluation/petalpal-in-domain-v1.jsonl"
MODEL_LABELS = {"admiration","amusement","anger","annoyance","approval","caring","confusion","curiosity","disappointment","disapproval","disgust","excitement","fear","gratitude","joy","love","neutral","optimism","remorse","sadness","surprise"}
OUTPUT_LABELS = MODEL_LABELS - {"neutral","approval","disapproval"}
SLICES = {"SHORT":500,"NEGATION":400,"SLANG_TYPOS":300,"SUBTLE_IMPLICIT":450,"EMOJI_HEAVY":250,"STANDARD_DAILY_GROW":500}
PRIMARIES = {"SUNNY_BLOOM","GENTLE_BLOOM","QUIET_BLOOM","HEALING_BLOOM","FIRE_BLOOM","WONDER_BLOOM","DRIFTING_BLOOM","PEACEFUL_BLOOM"}
REDUNDANT = {"SUNNY_BLOOM":["joy"],"GENTLE_BLOOM":["caring"],"QUIET_BLOOM":["sadness"],"HEALING_BLOOM":[],"FIRE_BLOOM":["anger"],"WONDER_BLOOM":["curiosity"],"DRIFTING_BLOOM":["confusion"],"PEACEFUL_BLOOM":[]}
PRIMARY_MAP = {
 "HAPPY":"SUNNY_BLOOM","JOY":"SUNNY_BLOOM","SAD":"QUIET_BLOOM","SADNESS":"QUIET_BLOOM",
 "ANGRY":"FIRE_BLOOM","ANGER":"FIRE_BLOOM","ANXIOUS":"HEALING_BLOOM","FEAR":"HEALING_BLOOM",
 "EXCITED":"WONDER_BLOOM","SURPRISE":"WONDER_BLOOM","TIRED":"DRIFTING_BLOOM","DISGUST":"DRIFTING_BLOOM",
 "LOVED":"GENTLE_BLOOM","LOVE":"GENTLE_BLOOM","CALM":"PEACEFUL_BLOOM","NEUTRAL":"PEACEFUL_BLOOM",
}

def read_jsonl(path): return [json.loads(line) for line in path.open() if line.strip()]
def norm(text): return " ".join(re.findall(r"[a-z0-9]+", text.lower()))
def tokens(text): return set(norm(text).split())
def similarity(a,b):
    ta,tb=tokens(a),tokens(b); jac=len(ta&tb)/len(ta|tb) if ta|tb else 1
    seq=difflib.SequenceMatcher(None,norm(a),norm(b)).ratio()
    return jac,seq

wrapped=read_jsonl(STATE / "accepted-current.jsonl")
samples=[]; fixes=[]
for item in wrapped:
    sample=item["sample"].copy()
    old=sample["primaryGardenMood"]
    sample["primaryGardenMood"]=PRIMARY_MAP.get(old,old)
    if old != sample["primaryGardenMood"]: fixes.append({"id":sample["id"],"field":"primaryGardenMood","from":old,"to":sample["primaryGardenMood"]})
    wanted=REDUNDANT.get(sample["primaryGardenMood"])
    if wanted is not None and sample.get("primaryRedundantEmotions") != wanted:
        fixes.append({"id":sample["id"],"field":"primaryRedundantEmotions","from":sample.get("primaryRedundantEmotions"),"to":wanted})
        sample["primaryRedundantEmotions"]=wanted
    sample["review"] = item["review"]
    sample["validation"] = {"schemaValid":True,"labelsValid":True,"consistent":True,"duplicateFree":None,"frozenSetLeakageFree":None}
    sample["workflowStatus"]="validation_pending"
    samples.append(sample)

errors=[]
ids=[s["id"] for s in samples]
if len(samples)!=2400 or len(set(ids))!=2400: errors.append({"code":"SAMPLE_COUNT_OR_ID","count":len(samples),"unique":len(set(ids))})
for s in samples:
    required={"id","datasetVersion","split","primaryGardenMood","journal","sliceTags","modelLabels","expectedSecondaryEmotions","preferNoSecondaryEmotion","primaryRedundantEmotions","sourceType","provenance","review","validation","workflowStatus","sourceGroupId"}
    missing=sorted(required-set(s))
    if missing: errors.append({"id":s.get("id"),"code":"MISSING_FIELDS","fields":missing}); continue
    if s["datasetVersion"]!="petalpal-in-domain-tuning-v1" or s["split"] not in {"train","dev"} or s["primaryGardenMood"] not in PRIMARIES: errors.append({"id":s["id"],"code":"SCHEMA_ENUM"})
    if not isinstance(s["journal"],str) or not s["journal"].strip(): errors.append({"id":s["id"],"code":"EMPTY_TEXT"})
    if s["sliceTags"][0] not in SLICES: errors.append({"id":s["id"],"code":"SLICE"})
    if not set(s["modelLabels"])<=MODEL_LABELS or not set(s["expectedSecondaryEmotions"])<=OUTPUT_LABELS: errors.append({"id":s["id"],"code":"LABEL"})
    if s["preferNoSecondaryEmotion"]:
        if s["expectedSecondaryEmotions"] or not set(s["modelLabels"])<={"neutral","approval","disapproval"}: errors.append({"id":s["id"],"code":"ABSTENTION"})
    elif not 1<=len(s["expectedSecondaryEmotions"])<=2: errors.append({"id":s["id"],"code":"OUTPUT_LABEL_CONSISTENCY"})
    elif not set(s["expectedSecondaryEmotions"])<=set(s["modelLabels"]):
        before=list(s["modelLabels"]); s["modelLabels"]=list(dict.fromkeys(s["modelLabels"]+s["expectedSecondaryEmotions"]))
        fixes.append({"id":s["id"],"field":"modelLabels","from":before,"to":s["modelLabels"]})
    if s["primaryRedundantEmotions"] != REDUNDANT[s["primaryGardenMood"]]: errors.append({"id":s["id"],"code":"PRIMARY_REDUNDANCY"})
    if re.search(r"(?:^|\s)\d+$",s["journal"]): errors.append({"id":s["id"],"code":"MALFORMED_COUNTER"})

slice_counts=Counter(s["sliceTags"][0] for s in samples); split_counts=Counter(s["split"] for s in samples)
if dict(slice_counts)!=SLICES: errors.append({"code":"SLICE_COUNTS","actual":dict(slice_counts)})
if split_counts!={"train":2000,"dev":400}: errors.append({"code":"SPLIT_COUNTS","actual":dict(split_counts)})
if sum(s["preferNoSecondaryEmotion"] for s in samples)!=600: errors.append({"code":"ABSTENTION_COUNT"})

exact=defaultdict(list); normalized=defaultdict(list)
for s in samples: exact[s["journal"]].append(s["id"]); normalized[norm(s["journal"])].append(s["id"])
duplicate_groups=[{"kind":"exact","ids":v} for v in exact.values() if len(v)>1]
duplicate_groups += [{"kind":"normalized","ids":v} for k,v in normalized.items() if len(v)>1 and len(exact[next(s["journal"] for s in samples if s["id"]==v[0])])==1]

# Local lexical-semantic screen: rare-token blocking followed by token-Jaccard/sequence similarity.
df=Counter(t for s in samples for t in tokens(s["journal"]))
buckets=defaultdict(list)
for i,s in enumerate(samples):
    rare=sorted(tokens(s["journal"]),key=lambda t:(df[t],t))[:3]
    for token in rare: buckets[token].append(i)
candidates=set()
for bucket in buckets.values():
    if len(bucket) > 100: continue
    for pos,i in enumerate(bucket):
        for j in bucket[pos+1:]: candidates.add((min(i,j),max(i,j)))
near=[]
for i,j in candidates:
    if norm(samples[i]["journal"])==norm(samples[j]["journal"]): continue
    jac,seq=similarity(samples[i]["journal"],samples[j]["journal"])
    if seq>=.94 or (jac>=.90 and seq>=.75): near.append({"ids":[samples[i]["id"],samples[j]["id"]],"tokenJaccard":round(jac,4),"sequence":round(seq,4)})

frozen=read_jsonl(EVAL)
leak=[]
for s in samples:
    for f in frozen:
        if norm(s["journal"])==norm(f["journal"]): leak.append({"id":s["id"],"frozenId":f["id"],"kind":"normalized-exact"}); continue
        ts,tf=tokens(s["journal"]),tokens(f["journal"])
        jac=len(ts&tf)/len(ts|tf) if ts|tf else 1
        if jac < .5: continue
        seq=difflib.SequenceMatcher(None,norm(s["journal"]),norm(f["journal"])).ratio()
        if jac>=.72 and seq>=.82: leak.append({"id":s["id"],"frozenId":f["id"],"kind":"near","tokenJaccard":round(jac,4),"sequence":round(seq,4)})

report={"accepted":len(samples),"schemaErrors":errors,"safeFixes":len(fixes),"splitCounts":dict(split_counts),"sliceCounts":dict(slice_counts),"abstention":sum(s["preferNoSecondaryEmotion"] for s in samples),"exactOrNormalizedDuplicateGroups":duplicate_groups,"nearDuplicatePairs":near,"frozenLeakageFlags":leak}
(STATE/"final-validation-report.json").write_text(json.dumps(report,indent=2)+"\n")
(STATE/"safe-fixes.jsonl").write_text("".join(json.dumps(x)+"\n" for x in fixes))
print(json.dumps({k:(len(v) if isinstance(v,list) else v) for k,v in report.items()},indent=2))

if errors or duplicate_groups or near or leak: raise SystemExit(2)
for s in samples:
    s["validation"]["duplicateFree"]=True; s["validation"]["frozenSetLeakageFree"]=True; s["workflowStatus"]="accepted_final"
train=[s for s in samples if s["split"]=="train"]; dev=[s for s in samples if s["split"]=="dev"]
(ROOT/"train.jsonl").write_text("".join(json.dumps(s,ensure_ascii=False)+"\n" for s in train))
(ROOT/"dev.jsonl").write_text("".join(json.dumps(s,ensure_ascii=False)+"\n" for s in dev))
label_counts=Counter(label for s in samples for label in s["modelLabels"])
final={"train":len(train),"dev":len(dev),"sliceCounts":dict(slice_counts),"modelLabelCounts":dict(sorted(label_counts.items())),"abstentionCount":sum(s["preferNoSecondaryEmotion"] for s in samples),"abstentionRatio":sum(s["preferNoSecondaryEmotion"] for s in samples)/len(samples),"sha256":{"train":hashlib.sha256((ROOT/"train.jsonl").read_bytes()).hexdigest(),"dev":hashlib.sha256((ROOT/"dev.jsonl").read_bytes()).hexdigest()}}
(STATE/"final-statistics.json").write_text(json.dumps(final,indent=2)+"\n")
print(json.dumps(final,indent=2))

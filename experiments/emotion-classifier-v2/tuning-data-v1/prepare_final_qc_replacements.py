#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parent; STATE=ROOT/"state"
report=json.loads((STATE/"final-validation-report.json").read_text())
accepted={row["sample"]["id"]:row["sample"] for row in map(json.loads,(STATE/"accepted-current.jsonl").open())}
pairs=[]
for group in report["exactOrNormalizedDuplicateGroups"]:
    pairs += [(group["ids"][0],other) for other in group["ids"][1:]]
for pair in report["nearDuplicatePairs"]:
    if pair["sequence"]>=.94 or (pair["tokenJaccard"]>=.90 and pair["sequence"]>=.75): pairs.append(tuple(pair["ids"]))
parent={}
def find(x):
    parent.setdefault(x,x)
    if parent[x]!=x: parent[x]=find(parent[x])
    return parent[x]
def union(a,b):
    a,b=find(a),find(b)
    if a!=b: parent[b]=a
for a,b in pairs: union(a,b)
groups={}
for sample_id in parent: groups.setdefault(find(sample_id),[]).append(sample_id)
def quality(sample):
    words=re.findall(r"[a-z0-9]+",sample["journal"].lower())
    return (len(set(words)),len(words),len(sample["journal"]))
replace=[]
for ids in groups.values():
    keep=max(ids,key=lambda sample_id:quality(accepted[sample_id]))
    replace.extend(sample_id for sample_id in ids if sample_id!=keep)
replace=sorted(replace)
with (STATE/"final-qc-invalid-slots.jsonl").open("w") as samples, (STATE/"reviewed-final-qc-invalid-slots.jsonl").open("w") as reviews:
    for sample_id in replace:
        sample=accepted[sample_id]
        samples.write(json.dumps(sample,ensure_ascii=False)+"\n")
        reviews.write(json.dumps({"id":sample_id,"decision":"REJECT","confidence":"DETERMINISTIC","issues":["FINAL_QC_DUPLICATE_OR_NEAR_DUPLICATE"],"reviewerProvenance":{"reviewerSystem":"local-validator","reviewerRole":"FINAL_QC","reviewerPromptVersion":None},"workflowStatus":"validation_failed"})+"\n")
assert len(replace)==157
(STATE/"final-qc-replacement-checkpoint.json").write_text(json.dumps({"duplicateClusters":len(groups),"invalidatedSlots":len(replace),"status":"regeneration_required"},indent=2)+"\n")
print(json.dumps({"duplicateClusters":len(groups),"invalidatedSlots":len(replace)}))

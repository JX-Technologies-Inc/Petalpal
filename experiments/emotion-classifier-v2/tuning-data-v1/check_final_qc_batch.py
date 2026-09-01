#!/usr/bin/env python3
import difflib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(path):
    return [json.loads(line) for line in path.open() if line.strip()]


def norm(text):
    return " ".join(re.findall(r"[a-z0-9]+", text.lower()))


def score(a, b):
    ta, tb = set(norm(a).split()), set(norm(b).split())
    return len(ta & tb) / max(1, len(ta | tb)), difflib.SequenceMatcher(None, norm(a), norm(b)).ratio()


new = read(ROOT / "state" / (sys.argv[1] if len(sys.argv) > 1 else "final-qc-regenerated-1.jsonl"))
old = [row["sample"] for row in read(ROOT / "state/accepted-current.jsonl")]
frozen = read(ROOT.parent / "evaluation/petalpal-in-domain-v1.jsonl")
exact, near, leakage = [], [], []
seen = {norm(row["journal"]): row["id"] for row in old}
for i, row in enumerate(new):
    key = norm(row["journal"])
    if key in seen:
        exact.append([seen[key], row["id"]])
    seen[key] = row["id"]
    for other in old + new[:i]:
        jac, seq = score(row["journal"], other["journal"])
        if key != norm(other["journal"]) and (seq >= .94 or (jac >= .90 and seq >= .75)):
            near.append([row["id"], other["id"], round(jac, 4), round(seq, 4)])
    for other in frozen:
        jac, seq = score(row["journal"], other["journal"])
        if key == norm(other["journal"]) or (jac >= .72 and seq >= .82):
            leakage.append([row["id"], other["id"], round(jac, 4), round(seq, 4)])

result = {"count": len(new), "uniqueIds": len({row["id"] for row in new}), "exact": exact, "near": near, "frozenLeakage": leakage}
print(json.dumps(result, indent=2))
raise SystemExit(bool(exact or near or leakage or len(new) != result["uniqueIds"]))

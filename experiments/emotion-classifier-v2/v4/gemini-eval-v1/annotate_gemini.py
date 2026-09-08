#!/usr/bin/env python3
import argparse, json, os, subprocess, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROTOCOL = json.loads((HERE / "protocol.json").read_text())
LABELS = PROTOCOL["labels"]
DEFS = PROTOCOL["definitions"]
BATCH = 8

def load_jsonl(path):
    if not path.exists(): return []
    return [json.loads(x) for x in path.read_text().splitlines() if x.strip()]

def append(path, items):
    with path.open("a") as f:
        for x in items:
            f.write(json.dumps(x, ensure_ascii=False, separators=(",", ":")) + "\n")
        f.flush(); os.fsync(f.fileno())

def call(model, prompt, attempts=8):
    payload = json.dumps({
        "contents": [{"role":"user", "parts":[{"text":prompt}]}],
        "generationConfig": {"temperature":0, "responseMimeType":"application/json"}
    })
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    for attempt in range(attempts):
        p = subprocess.run(["curl","-sS","--connect-timeout","20","--max-time","180",
            "-H",f"x-goog-api-key: {os.environ['GEMINI_API_KEY']}","-H","content-type: application/json",
            "-d",payload,url], text=True, capture_output=True)
        try: data=json.loads(p.stdout)
        except Exception: data={"error":{"message":p.stderr or p.stdout}}
        if data.get("candidates"):
            text=data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text), data.get("modelVersion")
        code=data.get("error",{}).get("code")
        if code not in (429,500,502,503,504):
            raise RuntimeError(json.dumps(data.get("error",data))[:2000])
        time.sleep(min(60, 3 * (2 ** attempt)))
    raise RuntimeError(f"Gemini unavailable after {attempts} attempts: {json.dumps(data.get('error',data))[:1000]}")

def fixed_context(order):
    labels = LABELS if order == "canonical" else list(reversed(LABELS))
    defs = "\n".join(f"- {x}: {DEFS[x]}" for x in labels)
    return f"""You are an independent emotion annotator. You are not evaluating any model.
Use only the raw text and this fixed taxonomy. Never speculate about candidate predictions, scores, thresholds, metrics, training, or labels from another system.

Choose the best 0, 1, or 2 useful and distinct emotions expressed by the writer. Prefer one when sufficient. Use zero for neutral, purely factual, too ambiguous, or insufficiently evidenced text. Label the writer's emotion, not merely another person's emotion. Implicit emotion requires strong textual/event evidence. Do not output near-synonyms for the same signal.

Allowed labels and definitions:
{defs}

Return JSON only: {{"annotations":[{{"id":"exact supplied id","labels":["allowed label"],"rationale":"one concise text-grounded sentence"}}]}}.
Return exactly one annotation per supplied row, preserving row order and ids. Labels must be unique and contain at most two allowed labels."""

def validate(items, expected_ids):
    anns=items.get("annotations") if isinstance(items,dict) else None
    if not isinstance(anns,list) or [x.get("id") for x in anns] != expected_ids:
        raise ValueError("response ids/order mismatch")
    for x in anns:
        ls=x.get("labels")
        if not isinstance(ls,list) or len(ls)>2 or len(ls)!=len(set(ls)) or any(y not in LABELS for y in ls):
            raise ValueError(f"invalid labels for {x.get('id')}")
        if not isinstance(x.get("rationale"),str) or not x["rationale"].strip():
            raise ValueError(f"missing rationale for {x.get('id')}")
        x["labels"]=sorted(ls,key=LABELS.index)
    return anns

def run_pass(name):
    spec=PROTOCOL["passes"][name]
    src=load_jsonl(HERE/"blind-cohort.jsonl")
    out=HERE/f"pass-{name.lower()}.jsonl"
    done={x["id"] for x in load_jsonl(out)}
    pending=[x for x in src if x["id"] not in done]
    for pos in range(0,len(pending),BATCH):
        batch=pending[pos:pos+BATCH]
        row_text="\n\n".join(json.dumps({"id":x["id"],"rawHumanWrittenText":x["journal"]},ensure_ascii=False) for x in batch)
        prompt=fixed_context(spec["labelOrder"])+"\n\nROWS:\n"+row_text
        for format_try in range(2):
            try:
                obj,version=call(spec["model"],prompt)
                anns=validate(obj,[x["id"] for x in batch]); break
            except (ValueError,json.JSONDecodeError):
                if format_try: raise
        append(out,[{"id":x["id"],"labels":x["labels"],"rationale":x["rationale"],
                     "pass":name,"requestedModel":spec["model"],"modelVersion":version,
                     "candidateBlind":True} for x in anns])
        print(f"pass {name}: {len(done)+min(pos+BATCH,len(pending))}/{len(src)}",flush=True)

def adjudicate():
    src={x["id"]:x for x in load_jsonl(HERE/"blind-cohort.jsonl")}
    a={x["id"]:x for x in load_jsonl(HERE/"pass-a.jsonl")}
    b={x["id"]:x for x in load_jsonl(HERE/"pass-b.jsonl")}
    if set(a)!=set(src) or set(b)!=set(src): raise SystemExit("both complete passes required")
    disagreements=[i for i in src if set(a[i]["labels"]) != set(b[i]["labels"])]
    out=HERE/"adjudications.jsonl"; done={x["id"] for x in load_jsonl(out)}
    pending=[i for i in disagreements if i not in done]
    base=fixed_context("canonical")+"\n\nTwo independent Gemini annotations follow each raw text. Adjudicate from the raw text and fixed rules only. Their labels are advice, not constraints. Return the same JSON schema and exactly one final annotation per row."
    for pos in range(0,len(pending),6):
        ids=pending[pos:pos+6]
        content="\n\n".join(json.dumps({"id":i,"rawHumanWrittenText":src[i]["journal"],
            "geminiPassA":{"labels":a[i]["labels"],"rationale":a[i]["rationale"]},
            "geminiPassB":{"labels":b[i]["labels"],"rationale":b[i]["rationale"]}},ensure_ascii=False) for i in ids)
        obj,version=call(PROTOCOL["adjudication"]["model"],base+"\n\nROWS:\n"+content)
        anns=validate(obj,ids)
        append(out,[{"id":x["id"],"labels":x["labels"],"rationale":x["rationale"],
            "requestedModel":PROTOCOL["adjudication"]["model"],"modelVersion":version,
            "geminiOnly":True,"candidateBlind":True} for x in anns])
        print(f"adjudication: {len(done)+min(pos+6,len(pending))}/{len(disagreements)}",flush=True)
    print(json.dumps({"rows":len(src),"exactAgreement":len(src)-len(disagreements),"adjudicated":len(disagreements)}))

ap=argparse.ArgumentParser(); ap.add_argument("mode",choices=["A","B","adjudicate"]); args=ap.parse_args()
if args.mode in ("A","B"): run_pass(args.mode)
else: adjudicate()

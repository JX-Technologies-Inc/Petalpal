#!/usr/bin/env python3
import argparse,json,os,subprocess,time
from pathlib import Path
HERE=Path(__file__).resolve().parent; BASE=HERE.parent/"gemini-eval-v1"; PROTOCOL=json.loads((BASE/"protocol.json").read_text());LABELS=PROTOCOL["labels"];DEFS=PROTOCOL["definitions"]
PRICES={"gemini-3.6-flash":(.75,3.75),"gemini-3.5-flash":(1.5,9.0)};LIMIT=8.;BATCH=8
def load(p):return [json.loads(x) for x in p.read_text().splitlines() if x.strip()] if p.exists() else []
def append(p,items):
 with p.open("a") as f:
  for x in items:f.write(json.dumps(x,ensure_ascii=False,separators=(",",":"))+"\n")
  f.flush();os.fsync(f.fileno())
def spent():return sum(x["estimatedCostUsd"] for x in load(HERE/"usage.jsonl"))
def context(order):
 labels=LABELS if order=="canonical" else list(reversed(LABELS));defs="\n".join(f"- {x}: {DEFS[x]}" for x in labels)
 return f'''You are an independent emotion annotator. You are not evaluating any model.
Use only the raw text and this fixed taxonomy. Never speculate about candidate predictions, scores, thresholds, metrics, training, or labels from another system.

Choose the best 0, 1, or 2 useful and distinct emotions expressed by the writer. Prefer one when sufficient. Use zero for neutral, purely factual, too ambiguous, or insufficiently evidenced text. Label the writer's emotion, not merely another person's emotion. Implicit emotion requires strong textual/event evidence. Do not output near-synonyms for the same signal.

Allowed labels and definitions:
{defs}

Return JSON only: {{"annotations":[{{"id":"exact supplied id","labels":["allowed label"],"rationale":"one concise text-grounded sentence"}}]}}.
Return exactly one annotation per supplied row, preserving row order and ids. Labels must be unique and contain at most two allowed labels.'''
def record_usage(data,model,purpose):
 u=data.get("usageMetadata",{});inp=int(u.get("promptTokenCount",0));out=int(u.get("candidatesTokenCount",0))+int(u.get("thoughtsTokenCount",0))
 if out==0:out=max(0,int(u.get("totalTokenCount",0))-inp)
 pi,po=PRICES[model];cost=inp*pi/1e6+out*po/1e6
 append(HERE/"usage.jsonl",[{"model":model,"purpose":purpose,"inputTokens":inp,"outputIncludingThinkingTokens":out,"estimatedCostUsd":cost,"modelVersion":data.get("modelVersion"),"responseId":data.get("responseId")}]);return cost
def call(model,prompt,purpose,attempts=8):
 # Leave room for thinking plus the complete JSON response; the budget guard uses the same cap.
 max_output_tokens=8192
 worst=len(prompt.encode())/3*PRICES[model][0]/1e6+max_output_tokens*PRICES[model][1]/1e6
 if spent()+worst>LIMIT:raise SystemExit(f"BUDGET_STOP spent={spent():.6f} projectedWorst={spent()+worst:.6f}")
 payload=json.dumps({"contents":[{"role":"user","parts":[{"text":prompt}]}],"generationConfig":{"temperature":0,"responseMimeType":"application/json","maxOutputTokens":max_output_tokens}})
 url=f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
 for n in range(attempts):
  p=subprocess.run(["curl","-sS","--connect-timeout","20","--max-time","180","-H",f"x-goog-api-key: {os.environ['GEMINI_API_KEY']}","-H","content-type: application/json","-d",payload,url],text=True,capture_output=True)
  try:data=json.loads(p.stdout)
  except Exception:data={"error":{"message":p.stderr or p.stdout}}
  if data.get("candidates"):
   record_usage(data,model,purpose);return data
  code=data.get("error",{}).get("code")
  # curl/network failures have no HTTP code but are transient like 429/5xx.
  if code is not None and code not in (429,500,502,503,504):raise RuntimeError(json.dumps(data.get("error",data))[:2000])
  time.sleep(min(60,3*(2**n)))
 raise RuntimeError(f"Gemini unavailable: {json.dumps(data.get('error',data))[:1000]}")
def parse(data,ids):
 text=data["candidates"][0]["content"]["parts"][0]["text"];obj=json.loads(text);anns=obj.get("annotations")
 if not isinstance(anns,list) or [x.get("id") for x in anns]!=ids:raise ValueError("response ids/order mismatch")
 for x in anns:
  ls=x.get("labels");
  if not isinstance(ls,list) or len(ls)>2 or len(ls)!=len(set(ls)) or any(l not in LABELS for l in ls):raise ValueError("invalid labels")
  if not isinstance(x.get("rationale"),str) or not x["rationale"].strip():raise ValueError("missing rationale")
  x["labels"]=sorted(ls,key=LABELS.index)
 return anns
def allrows():return load(HERE/"blind-train.jsonl")+load(HERE/"blind-dev.jsonl")
def run_pass(name):
 spec=PROTOCOL["passes"][name];src=allrows();out=HERE/f"pass-{name.lower()}.jsonl";done={x["id"] for x in load(out)};pending=[x for x in src if x["id"] not in done]
 for pos in range(0,len(pending),BATCH):
  batch=pending[pos:pos+BATCH];ids=[x["id"] for x in batch];body="\n\n".join(json.dumps({"id":x["id"],"rawHumanWrittenText":x["journal"]},ensure_ascii=False) for x in batch);prompt=context(spec["labelOrder"])+"\n\nROWS:\n"+body
  for ft in range(2):
   data=call(spec["model"],prompt,f"pass{name}")
   try:anns=parse(data,ids);break
   except (ValueError,KeyError,IndexError,json.JSONDecodeError):
    if ft:raise
  append(out,[{"id":x["id"],"labels":x["labels"],"rationale":x["rationale"],"pass":name,"requestedModel":spec["model"],"modelVersion":data.get("modelVersion"),"candidateBlind":True} for x in anns])
  print(json.dumps({"pass":name,"done":len(done)+min(pos+BATCH,len(pending)),"total":len(src),"costUsd":spent()}),flush=True)
def adjudicate():
 src={x["id"]:x for x in allrows()};a={x["id"]:x for x in load(HERE/"pass-a.jsonl")};b={x["id"]:x for x in load(HERE/"pass-b.jsonl")}
 if set(a)!=set(src) or set(b)!=set(src):raise SystemExit("both passes required")
 ids=[i for i in src if set(a[i]["labels"])!=set(b[i]["labels"])];out=HERE/"adjudications.jsonl";done={x["id"] for x in load(out)};pending=[i for i in ids if i not in done]
 base=context("canonical")+"\n\nTwo independent Gemini annotations follow each raw text. Adjudicate from the raw text and fixed rules only. Their labels are advice, not constraints. Return the same JSON schema and exactly one final annotation per row."
 for pos in range(0,len(pending),6):
  ix=pending[pos:pos+6];body="\n\n".join(json.dumps({"id":i,"rawHumanWrittenText":src[i]["journal"],"geminiPassA":{"labels":a[i]["labels"],"rationale":a[i]["rationale"]},"geminiPassB":{"labels":b[i]["labels"],"rationale":b[i]["rationale"]}},ensure_ascii=False) for i in ix)
  for ft in range(2):
   data=call("gemini-3.6-flash",base+"\n\nROWS:\n"+body,"adjudication")
   try:anns=parse(data,ix);break
   except (ValueError,KeyError,IndexError,json.JSONDecodeError):
    if ft:raise
  append(out,[{"id":x["id"],"labels":x["labels"],"rationale":x["rationale"],"requestedModel":"gemini-3.6-flash","modelVersion":data.get("modelVersion"),"geminiOnly":True,"candidateBlind":True} for x in anns])
  print(json.dumps({"adjudicated":len(done)+min(pos+6,len(pending)),"total":len(ids),"costUsd":spent()}),flush=True)
 print(json.dumps({"agreement":len(src)-len(ids),"disagreement":len(ids),"costUsd":spent()}))
ap=argparse.ArgumentParser();ap.add_argument("mode",choices=["A","B","adjudicate"]);args=ap.parse_args();run_pass(args.mode) if args.mode in ("A","B") else adjudicate()

#!/usr/bin/env python3
import collections,csv,hashlib,json,re
from pathlib import Path
HERE=Path(__file__).resolve().parent;PARENT=HERE.parent
RAW=HERE/"raw/empatheticdialogues/train.csv";OUT=HERE/"augmentation.jsonl";AUDIT=HERE/"audit.json"
if OUT.exists() or AUDIT.exists():raise SystemExit("refusing to replace locked preparation outputs")
MAP={
 "impressed":"admiration","angry":"anger","furious":"anger","disgusted":"disgust",
 "excited":"excitement","guilty":"remorse","surprised":"surprise","afraid":"fear",
 "terrified":"fear","anxious":"fear","apprehensive":"fear","caring":"caring",
 "grateful":"gratitude","disappointed":"disappointment","hopeful":"optimism",
 "anticipating":"optimism","joyful":"joy","sad":"sadness","devastated":"sadness"
}
def norm(s):return re.sub(r"\s+"," ",re.sub(r"[^a-z0-9 ]"," ",s.lower().replace("_comma_",","))).strip()
def rows(p):return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
base=rows(PARENT/"train.jsonl");dev=rows(PARENT/"dev.jsonl");counts=collections.Counter(l for r in base for l in r["modelLabels"])
with RAW.open(newline="",encoding="utf8") as f:raw=list(csv.DictReader(f))
first={}
for r in raw:
 if r["conv_id"] in first:continue
 text=r["prompt"].replace("_comma_",",").strip();words=text.split();label=MAP.get(r["context"])
 if label and 5<=len(words)<=250 and re.search(r"\b(I|I'm|I’m|I've|I’ve|my|me)\b",text,re.I):first[r["conv_id"]]=(r,text,label)
candidates=sorted(first.values(),key=lambda z:hashlib.sha256((z[0]["speaker_idx"]+"|"+z[0]["conv_id"]).encode()).hexdigest())
need={l:max(0,100-counts[l]) for l in set(MAP.values())};selected=[];authors=set();texts=set()
for label in sorted(need,key=lambda l:(counts[l],l)):
 for r,text,l in candidates:
  if l!=label or need[label]<=0 or r["speaker_idx"] in authors or norm(text) in texts:continue
  authors.add(r["speaker_idx"]);texts.add(norm(text));need[label]-=1
  selected.append({"id":"ED-"+r["conv_id"].replace(":","-"),"journal":text,"modelLabels":[label],"sourceType":"PUBLIC_HUMAN","sourceGroupId":"empatheticdialogues-author-"+r["speaker_idx"],"alignedRole":"train","annotation":{"method":"publisher_human_single_emotion","humanGold":True,"candidateBlind":True,"originalLabel":r["context"],"mapping":"fixed_context_to_petalpal_taxonomy"},"provenance":{"dataset":"EmpatheticDialogues","publisher":"Facebook Research","split":"train","conversationId":r["conv_id"],"speakerId":r["speaker_idx"],"archiveSha256":"56f234d77b7dd1f005fd365bb17769cfe346c3c84295b69bc069c8ccb83be03d","acquired":"2026-09-10","license":"CC-BY-NC-4.0"}})
train_norm={norm(r["journal"]) for r in base};dev_norm={norm(r["journal"]) for r in dev};new_norm=[norm(r["journal"]) for r in selected]
assert not (set(new_norm)&train_norm) and not (set(new_norm)&dev_norm) and len(new_norm)==len(set(new_norm)) and len(authors)==len(selected)
OUT.write_text("".join(json.dumps(r,ensure_ascii=False,separators=(",",":"))+"\n" for r in selected))
audit={"status":"PASS","selectionUsesDevContentOrLabels":False,"sourceSplit":"train only","candidateConversations":len(candidates),"selectedRows":len(selected),"uniqueSourceAuthors":len(authors),"exactNormalizedOverlap":{"existingTrain":len(set(new_norm)&train_norm),"legalDev":len(set(new_norm)&dev_norm),"withinAugmentation":len(new_norm)-len(set(new_norm))},"selectedByLabel":dict(collections.Counter(r["modelLabels"][0] for r in selected)),"existingTrainCounts":dict(counts),"unfilledToTarget100":need,"mapping":MAP,"hashes":{"rawTrainCsv":hashlib.sha256(RAW.read_bytes()).hexdigest(),"augmentation":hashlib.sha256(OUT.read_bytes()).hexdigest()}}
AUDIT.write_text(json.dumps(audit,indent=2)+"\n");print(json.dumps(audit,indent=2))

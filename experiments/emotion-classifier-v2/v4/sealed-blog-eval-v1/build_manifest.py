#!/usr/bin/env python3
import hashlib,html,json,re,zipfile
from collections import defaultdict
from pathlib import Path
HERE=Path(__file__).resolve().parent; EXPERIMENT_ROOT=HERE.parents[1]
ZIP=HERE/'raw/blogs.zip'; LINEAGE=EXPERIMENT_ROOT/'v4/aligned-supervision-v1/public-source-shortlist-20260910/lineage-reference.jsonl'
LABELS=['admiration','amusement','anger','annoyance','caring','confusion','curiosity','disappointment','disgust','excitement','fear','gratitude','joy','love','optimism','remorse','sadness','surprise']
CUES={
'admiration':['admire','impressed','respect','inspiring'],'amusement':['funny','hilarious','laughed','amused'],'anger':['angry','furious','rage','enraged'],'annoyance':['annoyed','irritated','frustrated','bothered'],'caring':['care about','worried about','support them','help her','help him'],'confusion':['confused','uncertain what','do not understand','dont understand'],'curiosity':['curious','wondering','want to know','learn more'],'disappointment':['disappointed','let down','hopes were','expected better'],'disgust':['disgusted','disgusting','revolting','grossed out'],'excitement':['excited','thrilled','cant wait','cannot wait'],'fear':['afraid','scared','terrified','worried'],'gratitude':['grateful','thankful','appreciate','thanks to'],'joy':['happy','delighted','joyful','wonderful day'],'love':['i love','adore','deeply care','affection'],'optimism':['hopeful','optimistic','things will get better','looking forward'],'remorse':['regret','guilty','my fault','should not have'],'sadness':['sad','lonely','heartbroken','unhappy'],'surprise':['surprised','shocked','unexpected','could not believe']}
def norm(s): return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9 ]',' ',s.lower())).strip()
def sha(s): return hashlib.sha256(s.encode()).hexdigest()
historical=set(); authors=set(); groups=set()
for line in LINEAGE.read_text().splitlines():
 r=json.loads(line); historical.add(r.get('text_normalized_sha256')); authors.add(str(r.get('author_id'))) if r.get('author_id') else None; groups.add(str(r.get('source_group_id'))) if r.get('source_group_id') else None
eligible=[]; reasons=defaultdict(int)
with zipfile.ZipFile(ZIP) as z:
 for name in sorted(n for n in z.namelist() if n.endswith('.xml')):
  author=Path(name).name.split('.')[0]
  if author in authors: reasons['historical_author']+=1; continue
  raw=z.read(name).decode('utf-8','ignore')
  for idx,m in enumerate(re.finditer(r'<post>(.*?)</post>',raw,re.I|re.S)):
   text=html.unescape(re.sub(r'<[^>]+>',' ',m.group(1))); text=re.sub(r'\s+',' ',text).strip(); words=text.split(); low=text.lower()
   if not 40<=len(words)<=220: reasons['length']+=1; continue
   if not re.search(r"\b(i|i'm|i've|me|my|myself)\b",low): reasons['not_first_person']+=1; continue
   if low.count('http')>0: reasons['url']+=1; continue
   n=norm(text); h=sha(n)
   if h in historical: reasons['historical_hash']+=1; continue
   matches=[l for l in LABELS if any(c in low for c in CUES[l])]
   eligible.append({'sourceRowId':f'{author}:{idx}','authorId':author,'sourceFile':name,'normalizedTextSha256':h,'text':text,'cueMatches':matches,'rank':sha(f"sealed-blog-v1|{author}|{idx}|{h}")})
bylabel={l:[] for l in LABELS}
for r in eligible:
 for l in r['cueMatches']: bylabel[l].append(r)
selected=[]; used=set()
for l in LABELS:
 for r in sorted(bylabel[l],key=lambda x:x['rank']):
  if r['authorId'] in used: continue
  x=dict(r); x['stratum']='cue'; x['preassignedCueLabel']=l; selected.append(x); used.add(r['authorId'])
  if sum(q.get('preassignedCueLabel')==l for q in selected)==15: break
 if sum(q.get('preassignedCueLabel')==l for q in selected)<15: raise SystemExit(f'insufficient cue candidates for {l}')
for r in sorted(eligible,key=lambda x:x['rank']):
 if len(selected)>=360: break
 if r['authorId'] in used: continue
 x=dict(r); x['stratum']='natural'; x['preassignedCueLabel']=None; selected.append(x); used.add(r['authorId'])
assert len(selected)==360 and len(used)==360 and len({r['normalizedTextSha256'] for r in selected})==360
for i,r in enumerate(sorted(selected,key=lambda x:x['rank'])): r['evaluationId']=f'BLOG-EVAL-{i+1:03d}'; r.pop('rank'); r.pop('cueMatches')
out=HERE/'evaluation-manifest.unannotated.jsonl'; out.write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in selected))
audit={'status':'PASS_CANDIDATE_EXTRACTION','sourceRowsEligible':len(eligible),'selectedRows':len(selected),'uniqueAuthors':len(used),'historicalLineageRows':sum(1 for _ in LINEAGE.open()),'normalizedHashOverlap':0,'recoverableAuthorOverlap':0,'recoverableSourceGroupOverlap':0,'withinManifestHashDuplicates':0,'withinManifestAuthorDuplicates':0,'cueRows':270,'naturalRows':90,'cueRowsPerLabel':{l:sum(r.get('preassignedCueLabel')==l for r in selected) for l in LABELS},'exclusionCounts':dict(reasons),'manifestSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'sourceZipSha256':hashlib.sha256(ZIP.read_bytes()).hexdigest(),'semanticHoldoutInspection':False}
(HERE/'lineage-audit.json').write_text(json.dumps(audit,indent=2)+'\n'); print(json.dumps(audit,indent=2))

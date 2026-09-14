#!/usr/bin/env python3
import argparse,json,os,subprocess,time
from pathlib import Path
HERE=Path(__file__).resolve().parent
DEFS=json.loads((HERE.parent/'gemini-eval-v1/protocol.json').read_text())['definitions']; LABELS=list(DEFS)
MODELS={'A':'gemini-3.6-flash','B':'gemini-3.5-flash','J':'gemini-3.6-flash'}; PRICES={'gemini-3.6-flash':(.75,3.75),'gemini-3.5-flash':(1.5,9.)}; LIMIT=2.; BATCH=8
def load(p): return [json.loads(x) for x in p.read_text().splitlines() if x.strip()] if p.exists() else []
def append(p,xs):
 with p.open('a') as f:
  for x in xs:f.write(json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n')
  f.flush();os.fsync(f.fileno())
def spent(): return sum(x['estimatedCostUsd'] for x in load(HERE/'usage.jsonl'))
def prompt(order):
 labs=LABELS if order=='canonical' else list(reversed(LABELS)); defs='\n'.join(f'- {x}: {DEFS[x]}' for x in labs)
 return f'''You are an independent emotion annotator, not a model evaluator. Use only each raw human-written text and this fixed taxonomy. Choose the best 0, 1, or 2 useful distinct emotions expressed by the writer; prefer one. Use zero for neutral, factual, ambiguous, or insufficient evidence. Label the writer, not another person. Implicit emotion requires strong evidence. Do not output near-synonyms.\n\n{defs}\n\nReturn JSON only: {{"annotations":[{{"id":"exact supplied id","labels":["allowed label"],"rationale":"concise text-grounded sentence"}}]}}. Preserve row order and IDs.'''
def call(model,body,purpose):
 if spent()+.04>LIMIT: raise SystemExit(f'BUDGET_STOP spent={spent():.6f}')
 payload=json.dumps({'contents':[{'role':'user','parts':[{'text':body}]}],'generationConfig':{'temperature':0,'responseMimeType':'application/json','maxOutputTokens':4096}})
 url=f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
 for n in range(8):
  p=subprocess.run(['curl','-sS','--connect-timeout','20','--max-time','180','-H',f"x-goog-api-key: {os.environ['GEMINI_API_KEY']}",'-H','content-type: application/json','-d',payload,url],text=True,capture_output=True)
  try:d=json.loads(p.stdout)
  except Exception:d={}
  if d.get('candidates'):
   u=d.get('usageMetadata',{}); ni=int(u.get('promptTokenCount',0)); no=int(u.get('candidatesTokenCount',0))+int(u.get('thoughtsTokenCount',0)); no=no or max(0,int(u.get('totalTokenCount',0))-ni); pi,po=PRICES[model]; cost=ni*pi/1e6+no*po/1e6
   if spent()+cost>LIMIT: raise SystemExit(f'BUDGET_RESPONSE_WOULD_EXCEED spent={spent():.6f} response={cost:.6f}')
   append(HERE/'usage.jsonl',[{'model':model,'purpose':purpose,'inputTokens':ni,'outputIncludingThinkingTokens':no,'estimatedCostUsd':cost,'modelVersion':d.get('modelVersion'),'responseId':d.get('responseId')}]); return d
  time.sleep(min(60,3*2**n))
 raise RuntimeError('Gemini unavailable')
def parse(d,ids):
 a=json.loads(d['candidates'][0]['content']['parts'][0]['text'])['annotations']
 if [x.get('id') for x in a]!=ids: raise ValueError('id/order mismatch')
 for x in a:
  if not isinstance(x.get('labels'),list) or len(x['labels'])>2 or len(x['labels'])!=len(set(x['labels'])) or any(l not in LABELS for l in x['labels']): raise ValueError('invalid labels')
  x['labels']=sorted(x['labels'],key=LABELS.index)
 return a
def source(): return load(HERE/'evaluation-manifest.unannotated.jsonl')
def run_pass(mode):
 src=source(); out=HERE/f'pass-{mode.lower()}.jsonl'; done={x['id'] for x in load(out)} if out.exists() else set()
 # compatibility with immutable evaluation IDs
 done={x.get('id') for x in load(out)}
 pending=[r for r in src if r['evaluationId'] not in done]
 for i in range(0,len(pending),BATCH):
  b=pending[i:i+BATCH]; ids=[r['evaluationId'] for r in b]; body='\n\n'.join(json.dumps({'id':r['evaluationId'],'rawHumanWrittenText':r['text']},ensure_ascii=False) for r in b)
  for retry in range(2):
   suffix='' if retry==0 else '\n\nFORMAT RETRY: return exactly one annotation for every supplied ID, in the supplied order; do not omit, rename, or add IDs.'
   d=call(MODELS[mode],prompt('canonical' if mode=='A' else 'reverse')+'\n\nROWS:\n'+body+suffix,f'pass{mode}');
   try:a=parse(d,ids);break
   except (ValueError,KeyError,IndexError,json.JSONDecodeError):
    if retry:raise
  append(out,[{'id':x['id'],'labels':x['labels'],'rationale':x['rationale'],'pass':mode,'candidateBlind':True} for x in a]); print(json.dumps({'pass':mode,'done':len(done)+min(i+BATCH,len(pending)),'costUsd':spent()}),flush=True)
def adjudicate():
 src={r['evaluationId']:r for r in source()}; a={r['id']:r for r in load(HERE/'pass-a.jsonl')}; b={r['id']:r for r in load(HERE/'pass-b.jsonl')}; ids=[i for i in src if set(a[i]['labels'])!=set(b[i]['labels'])]; out=HERE/'adjudications.jsonl'; done={r['id'] for r in load(out)}
 pending=[i for i in ids if i not in done]
 for n in range(0,len(pending),6):
  ix=pending[n:n+6]; body='\n\n'.join(json.dumps({'id':i,'rawHumanWrittenText':src[i]['text'],'passA':{'labels':a[i]['labels'],'rationale':a[i]['rationale']},'passB':{'labels':b[i]['labels'],'rationale':b[i]['rationale']}},ensure_ascii=False) for i in ix)
  for retry in range(2):
   suffix='' if retry==0 else '\n\nFORMAT RETRY: return exactly one annotation for every supplied ID, in the supplied order; do not omit, rename, or add IDs.'
   d=call(MODELS['J'],prompt('canonical')+'\n\nAdjudicate the two independent annotations from the raw text and fixed rules. Their labels are advice, not constraints.\n\nROWS:\n'+body+suffix,'adjudication')
   try:x=parse(d,ix);break
   except (ValueError,KeyError,IndexError,json.JSONDecodeError):
    if retry:raise
  append(out,[{'id':q['id'],'labels':q['labels'],'rationale':q['rationale'],'candidateBlind':True} for q in x]); print(json.dumps({'adjudicated':len(done)+min(n+6,len(pending)),'total':len(ids),'costUsd':spent()}),flush=True)
 print(json.dumps({'agreement':len(src)-len(ids),'disagreement':len(ids),'costUsd':spent()}))
ap=argparse.ArgumentParser();ap.add_argument('mode',choices=['A','B','J']);m=ap.parse_args().mode;run_pass(m) if m in 'AB' else adjudicate()

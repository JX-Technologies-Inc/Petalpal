"""Conservative semantic exclusion; never consult model emotion scores or labels."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
import torch
from transformers import AutoTokenizer,AutoModel
P=Path(__file__).resolve().parent;R=P.parents[1]
def read(p):return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]
def main():
 if (P/'semantic-audit.json').exists():raise RuntimeError('Audit already exists')
 rows=read(P/'candidate-train.jsonl')+read(P/'candidate-dev.jsonl');refs=[]
 for f in json.loads((P/'selection.json').read_text())['historicalReferenceFiles']:
  for r in read(R/f['path']):
   if isinstance(r.get('journal'),str):refs.append(r['journal'])
 refs=list(dict.fromkeys(refs));texts=[r['journal'] for r in rows]+refs
 torch.set_num_threads(3);cp=R/'minilm/artifacts/all-MiniLM-L6-v2'
 tok=AutoTokenizer.from_pretrained(cp,local_files_only=True);model=AutoModel.from_pretrained(cp,local_files_only=True).eval();emb=[]
 with torch.inference_mode():
  for start in range(0,len(texts),16):
   b=tok(texts[start:start+16],padding=True,truncation=True,max_length=512,return_tensors='pt');h=model(**b).last_hidden_state;mask=b['attention_mask'].unsqueeze(-1);emb.append(torch.nn.functional.normalize((h*mask).sum(1)/mask.sum(1),dim=1).numpy())
   if start%512==0:print('embedded',start,'/',len(texts),flush=True)
 e=np.concatenate(emb);np.save(P/'audit-embeddings.npy',e);bad=[]
 for start in range(0,len(rows),128):
  s=e[start:min(start+128,len(rows))]@e.T
  for j,ss in enumerate(s):
   i=start+j;ss[i]=-1;k=int(ss.argmax())
   if ss[k]>=.85:bad.append({'id':rows[i]['id'],'similarity':float(ss[k]),'referenceType':'candidate' if k<len(rows) else 'historical','candidateMatch':rows[k]['id'] if k<len(rows) else None})
 ids={r['id'] for r in bad};counts={}
 for split in ['train','dev']:
  kept=[r for r in rows if r['split']==split and r['id'] not in ids];counts[split]=len(kept)
  (P/f'blind-{split}.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in kept))
 (P/'semantic-audit.json').write_text(json.dumps({'threshold':.85,'counts':counts,'excluded':bad,'model':str(cp),'maxTokens':512,'limitations':'Embedding truncation can miss late-document similarities; original full texts and lexical audit retained. Pretrained GoEmotions exact-only firewall; not proof of foundation pretraining isolation.','studentInferencePerformed':False},indent=2)+'\n');print(counts,flush=True)
if __name__=='__main__':main()

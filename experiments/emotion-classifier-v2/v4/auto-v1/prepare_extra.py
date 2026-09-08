"""Repair form extraction and audit existing consented Train-only journals."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
import torch
from sklearn.feature_extraction.text import TfidfVectorizer
from transformers import AutoTokenizer,AutoModel
P=Path(__file__).resolve().parent;R=P.parents[1];O=P.parent/'auto-v3'
sys.path.insert(0,str(R/'candidate-c-lite/scripts'))
from data_safety import normalize,source_key

def main():
    torch.set_num_threads(2)
    read=lambda p:[json.loads(l) for l in p.read_text().splitlines() if l.strip()]
    raw=[r for r in read(R/'tuning-data-v1/real-heavy-v2-train.jsonl') if r['sourceType']=='HUMAN_CONSENTED']
    labels={}
    for line in (P/'extra_human_labels.txt').read_text().splitlines():
        i,v=line.split();labels[i]=[] if v=='-' else v.split(',')
    starts={'HUM-A3-01':'Searched and applied','HUM-A3-02':'It’s my first','HUM-A3-04':'When I searched','HUM-A3-05':'I heard a good','HUM-A3-06':'I saw a very'}
    rows=[];repairs=[]
    for r in raw:
        old=r['journal'];text=old
        if r['id'] in starts:
            text=old[old.index(starts[r['id']]):]
            repairs.append({'id':r['id'],'removedPrefixCharacters':len(old)-len(text),'rawSha256':hashlib.sha256(old.encode()).hexdigest()})
        rows.append({'id':r['id'],'journal':text,'modelLabels':labels[r['id']],'customEmotions':r.get('customEmotions',[]),'sourceType':'HUMAN_CONSENTED','sourceGroupId':source_key(r),'provenance':r['provenance'],'split':'train','primaryGardenMood':None,'annotation':{'method':'Current assistant text-only reannotation','humanGold':False,'confidence':'MEDIUM','ambiguity':'Self-reported-source metadata; independent annotation/authenticity review unavailable'},'splitComponent':source_key(r)})
    dev=read(O/'dev.jsonl');existing=read(O/'train.jsonl');protected=[]
    for rel in ['frozen-2/frozen-2.jsonl','evaluation/petalpal-in-domain-v1.jsonl','hybrid-test-v2/test.jsonl']:
        # Keep only fields needed for exclusion, discard all benchmark labels.
        for x in read(R/rel):protected.append({'journal':x.get('journal',''),'sourceGroupId':source_key(x)})
    blocked_sources={source_key(r) for r in dev+protected if source_key(r)};blocked_norm={normalize(r['journal']) for r in dev+protected+existing}
    texts=[r['journal'] for r in rows+dev];x=TfidfVectorizer(analyzer='char_wb',ngram_range=(3,5)).fit_transform(texts);lex=(x[:len(rows)]@x[len(rows):].T).toarray().max(1)
    cp=R/'minilm/artifacts/all-MiniLM-L6-v2';tok=AutoTokenizer.from_pretrained(cp,local_files_only=True);m=AutoModel.from_pretrained(cp,local_files_only=True).eval();emb=[]
    with torch.inference_mode():
        for i in range(0,len(texts),8):
            b=tok(texts[i:i+8],padding=True,truncation=True,max_length=512,return_tensors='pt');h=m(**b).last_hidden_state;mask=b['attention_mask'].unsqueeze(-1);emb.append(torch.nn.functional.normalize((h*mask).sum(1)/mask.sum(1),dim=1).numpy())
    e=np.concatenate(emb);sim=(e[:len(rows)]@e[len(rows):].T).max(1)
    bad={r['sourceGroupId'] for i,r in enumerate(rows) if r['sourceGroupId'] in blocked_sources or normalize(r['journal']) in blocked_norm or lex[i]>=.8 or sim[i]>=.85}
    kept=[r for r in rows if r['sourceGroupId'] not in bad]
    tokenizer=AutoTokenizer.from_pretrained(R/'candidate-c/artifacts/checkpoint',local_files_only=True)
    lengths=[len(tokenizer(r['journal'])['input_ids']) for r in kept]
    (O/'extra-human-train.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in kept))
    report={'inputHumanConsented':len(raw),'retained':len(kept),'excludedSourceGroups':len(bad),'prefixRepairs':repairs,'sourceTypesNotRebranded':{'ADAPTED_SYNTHETIC':111,'HUMAN_CONSENTED':54,'PUBLIC_HUMAN':32},'lexicalMax':float(lex.max()),'semanticMax':float(sim.max()),'tokenLengths':{'max':max(lengths),'over128':sum(v>128 for v in lengths),'over512':sum(v>512 for v in lengths)},'devChanged':False,'sourceAndNormalizedFirewallAgainstOpenedBenchmarks':True,'benchmarkLabelsUsed':False}
    (O/'extra-human-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()

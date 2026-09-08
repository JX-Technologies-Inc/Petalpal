"""Audit optional synthetic regularization against locked Human Dev before training."""
import json,sys,hashlib
from pathlib import Path
import numpy as np
import torch
from transformers import AutoTokenizer,AutoModel
from sklearn.feature_extraction.text import TfidfVectorizer
P=Path(__file__).resolve().parent;R=P.parents[1]
sys.path.insert(0,str(R/'candidate-c-lite/scripts'))
from data_safety import normalize,assert_disjoint

def main():
    torch.set_num_threads(4)
    read=lambda p:[json.loads(l) for l in p.read_text().splitlines()]
    train=read(R/'tuning-data-v1/train.jsonl');dev=read(P/'dev.jsonl');allrows=train+dev;text=[r['journal'] for r in allrows]
    x=TfidfVectorizer(analyzer='char_wb',ngram_range=(3,5)).fit_transform(text);lex=(x[:len(train)]@x[len(train):].T).toarray().max(1)
    path=R/'minilm/artifacts/all-MiniLM-L6-v2';tok=AutoTokenizer.from_pretrained(path,local_files_only=True);model=AutoModel.from_pretrained(path,local_files_only=True).eval();emb=[]
    with torch.inference_mode():
        for i in range(0,len(text),32):
            b=tok(text[i:i+32],padding=True,truncation=True,max_length=128,return_tensors='pt');h=model(**b).last_hidden_state;m=b['attention_mask'].unsqueeze(-1)
            emb.append(torch.nn.functional.normalize((h*m).sum(1)/m.sum(1),dim=1).numpy())
    e=np.concatenate(emb);sem=(e[:len(train)]@e[len(train):].T).max(1)
    bad={r['sourceGroupId'] for i,r in enumerate(train) if lex[i]>=.8 or sem[i]>=.85}
    keep=[r for r in train if r['sourceGroupId'] not in bad];assert_disjoint(keep,dev)
    (P/'synthetic-safe.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in keep))
    (P/'synthetic-audit.json').write_text(json.dumps({'originalRows':len(train),'retainedRows':len(keep),'removedGroups':len(bad),'lexicalFlagged':int((lex>=.8).sum()),'semanticFlagged':int((sem>=.85).sum()),'policy':'Remove whole sourceGroup for lexical >=.8 or MiniLM cosine >=.85 against Human Dev, without model predictions or error analysis','sha256':hashlib.sha256((P/'synthetic-safe.jsonl').read_bytes()).hexdigest()},indent=2)+'\n')
if __name__=='__main__':main()

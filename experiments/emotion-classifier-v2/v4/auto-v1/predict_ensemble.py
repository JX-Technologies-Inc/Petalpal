"""Local experimental inference. Does not integrate with production or infer Primary."""
import argparse,gc,json,sys
from pathlib import Path
import numpy as np
import torch
from transformers import AutoTokenizer,AutoModelForSequenceClassification
P=Path(__file__).resolve().parent;ROOT=P.parents[1]
sys.path.insert(0,str(ROOT/'candidate-c-lite/scripts'))
from fine_tune import LABELS,label_positions,PRIMARY_GARDEN_MOODS
import evaluate_frozen_100 as engine

@torch.inference_mode()
def predict(rows,spec):
    torch.set_num_threads(4)
    if len(spec['checkpoints'])!=len(spec['weights']) or abs(sum(spec['weights'])-1)>1e-8:raise ValueError('Invalid blend')
    result=np.zeros((len(rows),len(LABELS)),dtype=np.float32)
    for r in rows:
        if not isinstance(r.get('journal'),str):raise ValueError('journal must be a string')
        if r.get('primaryGardenMood') is not None and r['primaryGardenMood'] not in PRIMARY_GARDEN_MOODS:raise ValueError('Invalid supplied Primary')
    active=[i for i,r in enumerate(rows) if r['journal'].strip()]
    if not active:return result
    for cp,weight,maxlen in zip(spec['checkpoints'],spec['weights'],spec['maxLengths']):
        tok=AutoTokenizer.from_pretrained(cp,local_files_only=True);model=AutoModelForSequenceClassification.from_pretrained(cp,local_files_only=True).eval();positions=label_positions(model)
        for start in range(0,len(active),8):
            ix=active[start:start+8];batch=tok([rows[i]['journal'] for i in ix],padding=True,truncation=True,max_length=maxlen,return_tensors='pt')
            result[ix]+=weight*torch.sigmoid(model(**batch).logits[:,positions]).numpy()
        del model,tok;gc.collect()
    return result

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--config',type=Path,required=True);a=ap.parse_args();spec=json.loads(a.config.read_text());rows=json.load(sys.stdin)
    probs=predict(rows,spec);engine.THRESHOLD=spec['threshold'];outputs=engine.select_variants(probs,[{'primaryGardenMood':r.get('primaryGardenMood')} for r in rows],ROOT)
    print(json.dumps([{'id':r.get('id'),'primaryGardenMood':r.get('primaryGardenMood'),'secondaryEmotions':[{'label':l,'score':float(p[LABELS.index(l)])} for l in o]} for r,p,o in zip(rows,probs,outputs)],indent=2))
if __name__=='__main__':main()

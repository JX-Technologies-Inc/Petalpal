"""Cheap no-update check: real human rows reach the classifier loss/gradients."""
import json
import sys
from pathlib import Path
import torch
from transformers import AutoModelForSequenceClassification,AutoTokenizer
P=Path(__file__).resolve().parent;sys.path.insert(0,str(P.parent/'candidate-c-lite/scripts'))
from fine_tune import PetalPalDataset,label_positions

def main():
    torch.set_num_threads(4);torch.manual_seed(42)
    cp=P.parent/'candidate-c/artifacts/checkpoint'
    tokenizer=AutoTokenizer.from_pretrained(cp,local_files_only=True)
    model=AutoModelForSequenceClassification.from_pretrained(cp,local_files_only=True).eval()
    data=PetalPalDataset(P.parent/'tuning-data-v1/train-human-augmented-v3.jsonl',tokenizer)
    pos=label_positions(model);result=[]
    for index in [0,2000,2002]:
        model.zero_grad();batch={k:v.unsqueeze(0) for k,v in data[index].items()};y=batch.pop('labels')
        logits=model(**batch).logits[:,pos];loss=torch.nn.functional.binary_cross_entropy_with_logits(logits,y);loss.backward()
        norm=model.classifier.out_proj.weight.grad[pos].norm().item()
        result.append({'rowIndex':index,'id':data.rows[index]['id'],'sourceType':data.rows[index]['sourceType'],'loss':loss.item(),'selectedHeadGradientNorm':norm})
        assert norm>0 and torch.isfinite(loss)
    (P/'gradient-diagnostic.json').write_text(json.dumps({'optimizerUpdates':0,'diagnostics':result,'interpretation':'Nonzero gradients verify inclusion only; they do not establish annotation correctness or helpful updates.'},indent=2)+'\n')
if __name__=='__main__':main()

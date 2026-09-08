"""Two-epoch pilot: select only internal calibration BCE, never read external Dev."""
import gc,hashlib,json,math,random,sys,time
from pathlib import Path
import numpy as np
import torch
from torch.utils.data import Dataset,DataLoader
from transformers import AutoTokenizer,AutoModelForSequenceClassification,get_linear_schedule_with_warmup
P=Path(__file__).resolve().parent; R=P.parents[1]
sys.path.insert(0,str(P.parent/'auto-v1'))
from experiment import LABELS,label_positions,collate,assert_disjoint,accumulation_weight
MAXLEN=512;BATCH=2;ACCUM=8
class Data(Dataset):
 def __init__(self,rows,tok):
  self.rows=rows;self.encoded=tok([r['journal'] for r in rows],truncation=True,max_length=MAXLEN)
 def __len__(self):return len(self.rows)
 def __getitem__(self,i):return {k:v[i] for k,v in self.encoded.items()}|{'labels':[float(l in self.rows[i]['modelLabels']) for l in LABELS]}
@torch.inference_mode()
def loss_on(model,loader,positions):
 model.eval();total=0;n=0
 for b in loader:
  y=b.pop('labels');loss=torch.nn.functional.binary_cross_entropy_with_logits(model(**b).logits[:,positions],y);total+=loss.item()*len(y);n+=len(y)
 return total/n

def main():
 torch.set_num_threads(3);torch.manual_seed(42);random.seed(42);np.random.seed(42)
 data=P/'pilot-data';manifest=json.loads((data/'manifest.json').read_text());protocol=json.loads((P/'pilot-protocol.json').read_text());rows={}
 for s in ['train','calibration']:
  b=(data/f'{s}.jsonl').read_bytes();assert hashlib.sha256(b).hexdigest()==manifest['hashes'][s];rows[s]=[json.loads(l) for l in b.decode().splitlines()]
 assert_disjoint(rows['train'],rows['calibration'])
 out=P/'pilot-experiment';out.mkdir(exist_ok=False)
 cp=R/'candidate-c/artifacts/checkpoint';tok=AutoTokenizer.from_pretrained(cp,local_files_only=True)
 lengths={s:[len(tok(r['journal'],truncation=False)['input_ids']) for r in rr] for s,rr in rows.items()}
 config={'epochs':protocol['epochs'],'lr':protocol['learningRate'],'maxLength':MAXLEN,'batchSize':BATCH,'accumulation':ACCUM,'seed':42,'selection':'minimum internal calibration mean BCE21, including epoch0','hashes':manifest['hashes'],'lengthAudit':{s:{'max':max(v),'over512':sum(x>512 for x in v),'over128':sum(x>128 for x in v),'count':len(v)} for s,v in lengths.items()},'lengthPolicy':'512-token model capacity to preserve new full journals; longer examples truncated; no Dev lengths inspected','device':'cpu'}
 (out/'config.json').write_text(json.dumps(config,indent=2)+'\n')
 model=AutoModelForSequenceClassification.from_pretrained(cp,local_files_only=True);positions=label_positions(model)
 train=DataLoader(Data(rows['train'],tok),batch_size=BATCH,shuffle=True,generator=torch.Generator().manual_seed(42),collate_fn=collate(tok))
 calibration=DataLoader(Data(rows['calibration'],tok),batch_size=BATCH,collate_fn=collate(tok))
 best=loss_on(model,calibration,positions);bestepoch=0;records=[{'epoch':0,'calibrationLoss':best}]
 model.save_pretrained(out/'best-checkpoint');tok.save_pretrained(out/'best-checkpoint')
 print(json.dumps(records[-1]),flush=True)
 opt=torch.optim.AdamW(model.parameters(),lr=config['lr'],weight_decay=.01)
 steps=math.ceil(len(train)/ACCUM)*config['epochs'];schedule=get_linear_schedule_with_warmup(opt,math.ceil(.1*steps),steps);t=time.time()
 for epoch in range(1,config['epochs']+1):
  model.train();opt.zero_grad(set_to_none=True);total=0;n=0
  for i,b in enumerate(train):
   y=b.pop('labels');loss=torch.nn.functional.binary_cross_entropy_with_logits(model(**b).logits[:,positions],y)
   (loss*accumulation_weight(i,len(rows['train']),BATCH,ACCUM)).backward();total+=loss.item()*len(y);n+=len(y)
   if (i+1)%ACCUM==0 or i+1==len(train):
    torch.nn.utils.clip_grad_norm_(model.parameters(),1.);opt.step();schedule.step();opt.zero_grad(set_to_none=True)
   if (i+1)%40==0:print(json.dumps({'epoch':epoch,'batch':i+1,'batches':len(train),'elapsed':time.time()-t}),flush=True)
  val=loss_on(model,calibration,positions);rec={'epoch':epoch,'trainLoss':total/n,'calibrationLoss':val,'elapsed':time.time()-t};records.append(rec)
  if val<best:best=val;bestepoch=epoch;model.save_pretrained(out/'best-checkpoint');tok.save_pretrained(out/'best-checkpoint')
  (out/f'epoch-{epoch}.json').write_text(json.dumps(rec,indent=2)+'\n');print(json.dumps(rec),flush=True)
 spec={'checkpoints':[str(cp),str(out/'best-checkpoint')],'weights':[.5,.5],'maxLengths':[128,MAXLEN],'threshold':.35}
 (out/'ensemble.json').write_text(json.dumps(spec,indent=2)+'\n')
 result={'status':'COMPLETE','bestEpoch':bestepoch,'bestCalibrationLoss':best,'epochs':records,'selection':'calibration BCE only; external Dev never loaded','elapsedSeconds':time.time()-t}
 (out/'summary.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
if __name__=='__main__':main()

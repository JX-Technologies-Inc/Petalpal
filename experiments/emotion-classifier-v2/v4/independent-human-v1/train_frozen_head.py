"""One bounded internal-only head adaptation; cached frozen encoder features."""
import hashlib,json,random,sys,time
from pathlib import Path
import numpy as np
import torch
from transformers import AutoModelForSequenceClassification,AutoTokenizer
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P.parent/'auto-v1'))
from experiment import LABELS,PRODUCT,label_positions,report

def save(path,obj):path.write_text(json.dumps(obj,indent=2)+'\n')
def main():
 torch.set_num_threads(3);torch.manual_seed(42);np.random.seed(42);random.seed(42)
 out=P/'frozen-head-v1';out.mkdir(exist_ok=False)
 manifest=json.loads((P/'pilot-data/manifest.json').read_text());rows={}
 for part in ('train','calibration'):
  b=(P/f'pilot-data/{part}.jsonl').read_bytes()
  assert hashlib.sha256(b).hexdigest()==manifest['hashes'][part]
  rows[part]=[json.loads(l) for l in b.decode().splitlines()]
 counts={s:{l:sum(l in r['modelLabels'] for r in rr) for l in LABELS} for s,rr in rows.items()}
 pilot=json.loads((P/'pilot-experiment/calibration/summary.json').read_text())
 save(out/'diagnostic.json',{'support':counts,'existingPilotGrid':[{'threshold':x['threshold'],'macroF1':x['selected18']['macro']['f1'],'micro':x['selected18']['micro']} for x in pilot['gridMetrics']],'absentCalibrationProductLabels':[l for l in PRODUCT if counts['calibration'][l]==0],'hypothesis':'Frozen representations may support better minority recall with train-derived capped positive class weights. No external errors used.'})
 config={'status':'RUNNING','baseCheckpoint':str(P/'pilot-experiment/best-checkpoint'),'maxLength':512,'seed':42,'epochs':20,'checkpoints':[0,5,10,20],'lr':1e-4,'weightDecay':.1,'batchSize':32,'loss':'BCE21; pos_weight=sqrt(negative/positive), clipped[1,4], Train only','selection':'internal macro18 at fixed .25 with microPrecision>=.5; tie lower unweighted BCE then earlier epoch; fallback epoch0','thresholdFollowup':'same prespecified global grid and author-hash cross-fitting as pilot; conditional on checkpoint selection, not independent validation','externalAccess':False,'dataHashes':manifest['hashes'],'limitations':'64 AI-labeled calibration authors; four product labels absent; selected metrics optimistic; no human-gold target claim'}
 save(out/'config.json',config)
 cp=Path(config['baseCheckpoint']);tok=AutoTokenizer.from_pretrained(cp,local_files_only=True)
 model=AutoModelForSequenceClassification.from_pretrained(cp,local_files_only=True).eval();pos=label_positions(model)
 for param in model.roberta.parameters():param.requires_grad_(False)
 features={};start=time.time()
 with torch.inference_mode():
  for part,rr in rows.items():
   buf=[]
   for i in range(0,len(rr),8):
    x=tok([r['journal'] for r in rr[i:i+8]],padding=True,truncation=True,max_length=512,return_tensors='pt')
    h=model.roberta(**x).last_hidden_state[:,:1,:]
    if i==0:
     # Actual RoBERTa classification head consumes CLS only.
     assert h.shape[1:]==(1,model.config.hidden_size)
    buf.append(h.cpu().numpy())
    if i%160==0:print(json.dumps({'event':'features','part':part,'completed':min(i+8,len(rr)),'total':len(rr)}),flush=True)
   a=np.concatenate(buf);np.save(out/f'{part}-features.npy',a);features[part]=torch.from_numpy(a.copy())
 labels={s:torch.tensor([[float(l in r['modelLabels']) for l in LABELS] for r in rr]) for s,rr in rows.items()}
 n=labels['train'].sum(0);pw=((len(rows['train'])-n)/n.clamp_min(1)).sqrt().clamp(1,4)
 save(out/'weights.json',dict(zip(LABELS,pw.tolist())))
 head=model.classifier
 save(out/'feature-manifest.json',{'baseCheckpoint':str(cp),'dataHashes':manifest['hashes'],'shapes':{s:list(x.shape) for s,x in features.items()},'encoderFrozen':all(not p.requires_grad for p in model.roberta.parameters()),'featureExtractionSeconds':time.time()-start})
 opt=torch.optim.AdamW(head.parameters(),lr=config['lr'],weight_decay=config['weightDecay']);records=[];bestkey=None;bestepoch=0
 def evaluate(epoch):
  nonlocal bestkey,bestepoch
  head.eval()
  with torch.no_grad():
   logits=head(features['calibration'])[:,pos];probs=logits.sigmoid().numpy();bce=torch.nn.functional.binary_cross_entropy_with_logits(logits,labels['calibration']).item()
  m=report(rows['calibration'],probs,.25);sel=m['selected18'];rec={'epoch':epoch,'bce':bce,'macroF1':sel['macro']['f1'],'micro':sel['micro']};records.append(rec)
  np.save(out/f'epoch-{epoch}-probabilities.npy',probs);save(out/f'epoch-{epoch}.json',m|{'bce':bce})
  key=(sel['micro']['precision']>=.5,sel['macro']['f1'] if sel['micro']['precision']>=.5 else -1,-bce,-epoch)
  if epoch==0 or (key[0] and (bestkey is None or key>bestkey)):
   bestkey=key;bestepoch=epoch;torch.save(head.state_dict(),out/'best-head.pt')
  print(json.dumps(rec),flush=True)
 evaluate(0)
 gen=torch.Generator().manual_seed(42)
 for epoch in range(1,21):
  head.train()
  for ix in torch.randperm(len(rows['train']),generator=gen).split(32):
   opt.zero_grad(set_to_none=True);loss=torch.nn.functional.binary_cross_entropy_with_logits(head(features['train'][ix])[:,pos],labels['train'][ix],pos_weight=pw);loss.backward();torch.nn.utils.clip_grad_norm_(head.parameters(),1.);opt.step()
  if epoch in config['checkpoints']:evaluate(epoch)
 # Calibrate from saved selected probabilities only; no encoder rerun.
 from calibrate_pilot import GRID,choose,score
 probs=np.load(out/f'epoch-{bestepoch}-probabilities.npy');y=labels['calibration'][:,[LABELS.index(l) for l in PRODUCT]].numpy().astype(bool)
 preds=[];grid=[]
 for threshold in GRID:
  m=report(rows['calibration'],probs,threshold);preds.append(np.array([[l in o for l in PRODUCT] for o in m['outputs']]));grid.append({'threshold':threshold,'selected18':m['selected18']})
 folds=np.array([int(hashlib.sha256(('cosowell-calibration-threshold-v1:'+r['sourceGroupId']).encode()).hexdigest(),16)%5 for r in rows['calibration']]);oof=np.zeros_like(y);choices=[]
 for k in range(5):
  t,_=choose(y,preds,folds!=k);oof[folds==k]=preds[GRID.index(t)][folds==k];choices.append(t)
 threshold=float(np.median(choices))
 save(out/'calibration.json',{'threshold':threshold,'foldChoices':choices,'thresholdOnlyOOF':score(y,oof),'grid':grid,'limitation':config['limitations']})
 result={'status':'COMPLETE','bestEpoch':bestepoch,'threshold':threshold,'records':records,'thresholdOnlyOOF':score(y,oof),'elapsedSeconds':time.time()-start,'externalEvaluated':False,'humanLabeledValidationAvailable':False,'checkpoint':{'base':str(cp),'head':str(out/'best-head.pt'),'maxLength':512,'threshold':threshold},'limitation':config['limitations']}
 save(out/'summary.json',result);print(json.dumps(result),flush=True)
if __name__=='__main__':main()

"""Bounded V4 experiments on locked AI-annotated human-written development data."""
import argparse,hashlib,json,math,random,sys,time
from pathlib import Path
import numpy as np
import torch
from torch.utils.data import DataLoader,Dataset,WeightedRandomSampler
from transformers import AutoTokenizer,AutoModelForSequenceClassification,get_linear_schedule_with_warmup
P=Path(__file__).resolve().parent;ROOT=P.parents[1]
sys.path.insert(0,str(ROOT/'candidate-c-lite/scripts'))
from fine_tune import LABELS,label_positions
from data_safety import assert_disjoint,guard_training_path,accumulation_weight
import evaluate_frozen_100 as engine
PRODUCT=engine.VARIANT_LABELS


def read(path):return [json.loads(l) for l in guard_training_path(path).read_text().splitlines() if l.strip()]

class Data(Dataset):
    def __init__(self,rows,tok):
        self.rows=rows;self.encoded=tok([r['journal'] for r in rows],truncation=True,max_length=128)
    def __len__(self):return len(self.rows)
    def __getitem__(self,i):
        return {k:v[i] for k,v in self.encoded.items()}|{'labels':[float(l in self.rows[i]['modelLabels']) for l in LABELS]}

def collate(tok):
    def fn(rows):
        y=torch.tensor([r['labels'] for r in rows]);x=tok.pad([{k:v for k,v in r.items() if k!='labels'} for r in rows],padding=True,return_tensors='pt')
        return dict(x)|{'labels':y}
    return fn

def report(rows,probs,threshold):
    annotations=[{'id':r['id'],'primaryGardenMood':None,'expected':[l for l in r['modelLabels'] if l in PRODUCT],
        'acceptable':[],'clearlyWrong':[],'preferNone':not set(r['modelLabels'])&set(PRODUCT),
        'redundant':[],'min':int(bool(set(r['modelLabels'])&set(PRODUCT))),'max':min(2,len(set(r['modelLabels'])&set(PRODUCT)))} for r in rows]
    engine.THRESHOLD=threshold;outputs=engine.select_variants(probs,annotations,ROOT)
    truth=np.array([[l in r['expected'] for l in PRODUCT] for r in annotations],dtype=np.int8)
    pred=np.array([[l in o for l in PRODUCT] for o in outputs],dtype=np.int8)
    raw=probs[:,[LABELS.index(l) for l in PRODUCT]]>=threshold
    product=engine.product_report(annotations,outputs)
    for k in ['primaryRedundancyRate','clearlyWrongEmotionRate','acceptableSecondaryPrecision','acceptableMatchRate']:product[k]=None
    # Wrong-label annotations are unavailable; unannotated predictions are not automatically "clearly wrong".
    return {'threshold':threshold,'raw18':engine.metric_report(truth,raw),'selected18':engine.metric_report(truth,pred),
            'product':product,'primaryPolicy':'unavailable, no redundancy filter applied; not a Primary-aware product validation',
            'outputs':outputs}

@torch.inference_mode()
def predict(model,loader,positions,device):
    model.eval();out=[]
    for batch in loader:
        batch.pop('labels');out.append(torch.sigmoid(model(**{k:v.to(device) for k,v in batch.items()}).logits[:,positions]).cpu().numpy())
    return np.concatenate(out)

def main():
    global P
    ap=argparse.ArgumentParser();ap.add_argument('--name',required=True);ap.add_argument('--mode',choices=['baseline','human','mixed','posweight'],required=True)
    ap.add_argument('--data-dir',type=Path,default=P);ap.add_argument('--epochs',type=int,default=3);ap.add_argument('--lr',type=float,default=1e-5);ap.add_argument('--seed',type=int,default=42)
    args=ap.parse_args();P=args.data_dir.resolve();torch.set_num_threads(4);torch.manual_seed(args.seed);random.seed(args.seed);np.random.seed(args.seed)
    manifest=json.loads((P/'manifest.json').read_text())
    if hashlib.sha256((P/'dev.jsonl').read_bytes()).hexdigest() == '0748d222ccc41e007db1f4ae221ec8e8099f49cbd5204d3778bf523145002f0b':
        raise ValueError('The 125-row Human Dev is retired from further model selection by user instruction. Preserve archived results; use a newly audited independent cohort.')
    if not manifest.get('initializationTextAuditPassed'):raise ValueError('Original checkpoint training-text audit required')
    for s in ['train','dev']:
        if hashlib.sha256((P/f'{s}.jsonl').read_bytes()).hexdigest()!=manifest['hashes'][s]:raise ValueError('Dataset changed after lock')
    train=read(P/'train.jsonl');dev=read(P/'dev.jsonl');assert_disjoint(train,dev)
    output=P/'experiments'/args.name
    output.mkdir(parents=True,exist_ok=False)
    cp=ROOT/'candidate-c/artifacts/checkpoint';tok=AutoTokenizer.from_pretrained(cp,local_files_only=True)
    model=AutoModelForSequenceClassification.from_pretrained(cp,local_files_only=True)
    positions=label_positions(model);device=torch.device('cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu');model.to(device)
    human_count=len(train)
    if args.mode=='mixed':train+=read(P/'synthetic-safe.jsonl');assert_disjoint(train,dev)
    dl=DataLoader(Data(dev,tok),batch_size=16,collate_fn=collate(tok));baseline=predict(model,dl,positions,device)
    np.save(output/'initial-probabilities.npy',baseline)
    initial=report(dev,baseline,.5);(output/'initial.json').write_text(json.dumps(initial,indent=2)+'\n')
    print(json.dumps({'event':'initial','name':args.name,'selectedMacro':initial['selected18']['macro']['f1'],'rawMacro':initial['raw18']['macro']['f1']}),flush=True)
    result={'config':{k:str(v) if isinstance(v,Path) else v for k,v in vars(args).items()},'device':str(device),'checkpointInitialization':str(cp),'trainRows':len(train),'humanTrainRows':human_count,
            'devRows':len(dev),'dataHashes':manifest['hashes'],'annotationStatus':manifest['status'],'epochs':[],'initialSelectedMacroF1':initial['selected18']['macro']['f1']}
    best=-1.;best_epoch=0;t0=time.time()
    if args.mode!='baseline':
        data=Data(train,tok);gen=torch.Generator().manual_seed(args.seed)
        if args.mode=='mixed':
            weights=[.75/human_count]*human_count+[.25/(len(train)-human_count)]*(len(train)-human_count)
            sampler=WeightedRandomSampler(weights,human_count,replacement=True,generator=gen)
            loader=DataLoader(data,batch_size=8,sampler=sampler,collate_fn=collate(tok))
        else:loader=DataLoader(data,batch_size=8,shuffle=True,generator=gen,collate_fn=collate(tok))
        optimizer=torch.optim.AdamW(model.parameters(),lr=args.lr,weight_decay=.01)
        steps=math.ceil(len(loader)/2)*args.epochs;schedule=get_linear_schedule_with_warmup(optimizer,math.ceil(.1*steps),steps)
        pw=None
        if args.mode=='posweight':
            count=torch.tensor([sum(l in r['modelLabels'] for r in train) for l in LABELS],dtype=torch.float)
            pw=torch.sqrt((len(train)-count)/count.clamp_min(1)).clamp(1,4).to(device)
            result['posWeights']=dict(zip(LABELS,pw.cpu().tolist()))
        lossfn=torch.nn.BCEWithLogitsLoss(pos_weight=pw)
        for epoch in range(1,args.epochs+1):
            model.train();optimizer.zero_grad();loss_sum=0.;n=0
            for i,batch in enumerate(loader):
                y=batch.pop('labels').to(device);logits=model(**{k:v.to(device) for k,v in batch.items()}).logits[:,positions];rawloss=lossfn(logits,y)
                sample_count=human_count if args.mode=='mixed' else len(data)
                loss=rawloss*accumulation_weight(i,sample_count,8,2);loss.backward();loss_sum+=rawloss.item()*len(y);n+=len(y)
                if (i+1)%2==0 or i+1==len(loader):
                    torch.nn.utils.clip_grad_norm_(model.parameters(),1.);optimizer.step();schedule.step();optimizer.zero_grad()
                if (i+1)%20==0:print(json.dumps({'event':'train','name':args.name,'epoch':epoch,'batch':i+1,'batches':len(loader),'elapsed':time.time()-t0}),flush=True)
            probs=predict(model,dl,positions,device);np.save(output/f'epoch-{epoch}-probabilities.npy',probs)
            metrics=report(dev,probs,.5);score=metrics['selected18']['macro']['f1']
            rec={'epoch':epoch,'loss':loss_sum/n,'elapsed':time.time()-t0,'metrics':metrics};result['epochs'].append(rec)
            (output/f'epoch-{epoch}.json').write_text(json.dumps(rec,indent=2)+'\n')
            print(json.dumps({'event':'epoch','name':args.name,'epoch':epoch,'selectedMacro':score,'rawMacro':metrics['raw18']['macro']['f1'],'elapsed':time.time()-t0}),flush=True)
            if score>best:
                best=score;best_epoch=epoch;model.save_pretrained(output/'best-checkpoint');tok.save_pretrained(output/'best-checkpoint')
    else:best=initial['selected18']['macro']['f1']
    result.update({'bestEpoch':best_epoch,'bestSelectedMacroF1':best,'elapsedSeconds':time.time()-t0,'status':'COMPLETE'})
    (output/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='epochs'}),flush=True)

if __name__=='__main__':main()

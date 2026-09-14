#!/usr/bin/env python3
import hashlib,json
from collections import Counter,defaultdict
from pathlib import Path
import numpy as np
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_recall_fscore_support
HERE=Path(__file__).resolve().parent; TRAIN=HERE.parent/'aligned-supervision-v1/train.jsonl'
LABELS=['admiration','amusement','anger','annoyance','caring','confusion','curiosity','disappointment','disgust','excitement','fear','gratitude','joy','love','optimism','remorse','sadness','surprise']
rows=[json.loads(x) for x in TRAIN.read_text().splitlines() if x.strip()]; assert len(rows)==841
groups=defaultdict(list)
for i,r in enumerate(rows): groups[r.get('sourceGroupId') or r['id']].append(i)
global_counts=np.array([sum(l in r['modelLabels'] for r in rows) for l in LABELS],float); target=global_counts/5; fold_groups=[[] for _ in range(5)]; fold_counts=np.zeros((5,18)); fold_sizes=np.zeros(5)
ordered=sorted(groups,key=lambda g:(-sum(sum(l in rows[i]['modelLabels'] for i in groups[g])/max(global_counts[k],1) for k,l in enumerate(LABELS)),hashlib.sha256(g.encode()).hexdigest()))
for g in ordered:
 idx=groups[g]; vec=np.array([sum(l in rows[i]['modelLabels'] for i in idx) for l in LABELS]); costs=[]
 for f in range(5):
  before=((fold_counts[f]/np.maximum(target,1))**2).sum()+.25*(fold_sizes[f]/(len(rows)/5))**2
  after=(((fold_counts[f]+vec)/np.maximum(target,1))**2).sum()+.25*((fold_sizes[f]+len(idx))/(len(rows)/5))**2
  costs.append(after-before)
 f=min(range(5),key=lambda x:(costs[x],fold_sizes[x],x)); fold_groups[f].append(g); fold_counts[f]+=vec; fold_sizes[f]+=len(idx)
fold_of={g:f for f,gs in enumerate(fold_groups) for g in gs}; folds=np.array([fold_of[r.get('sourceGroupId') or r['id']] for r in rows]); assert len(fold_of)==len(groups)
y=np.array([[l in r['modelLabels'] for l in LABELS] for r in rows],dtype=np.int8); probs=np.zeros_like(y,dtype=float)
for f in range(5):
 tr=np.flatnonzero(folds!=f); va=np.flatnonzero(folds==f); train_text=[rows[i]['journal'] for i in tr]; val_text=[rows[i]['journal'] for i in va]
 w=TfidfVectorizer(ngram_range=(1,2),min_df=2,max_features=60000,sublinear_tf=True,strip_accents='unicode'); c=TfidfVectorizer(analyzer='char_wb',ngram_range=(3,5),min_df=2,max_features=60000,sublinear_tf=True)
 xtr=hstack([w.fit_transform(train_text),c.fit_transform(train_text)]).tocsr(); xva=hstack([w.transform(val_text),c.transform(val_text)]).tocsr()
 for k in range(18):
  m=LogisticRegression(C=2,class_weight='balanced',max_iter=2000,solver='liblinear',random_state=42); m.fit(xtr,y[tr,k]); probs[va,k]=m.predict_proba(xva)[:,1]
 print(json.dumps({'fold':f,'train':len(tr),'validation':len(va),'groups':len(fold_groups[f])}),flush=True)
pred=(probs>=.5).astype(np.int8); selected=np.zeros_like(pred)
for i in range(len(rows)):
 ix=np.flatnonzero(pred[i]); ix=ix[np.argsort(probs[i,ix])[::-1][:2]]; selected[i,ix]=1
def report(p):
 ma=precision_recall_fscore_support(y,p,average='macro',zero_division=0); mi=precision_recall_fscore_support(y,p,average='micro',zero_division=0); per={}
 for k,l in enumerate(LABELS):
  z=precision_recall_fscore_support(y[:,k],p[:,k],average='binary',zero_division=0); per[l]={'precision':float(z[0]),'recall':float(z[1]),'f1':float(z[2]),'support':int(y[:,k].sum())}
 return {'macro':dict(zip(['precision','recall','f1'],map(float,ma[:3]))),'micro':dict(zip(['precision','recall','f1'],map(float,mi[:3]))),'perLabel':per}
r=report(selected); decision='CONTINUE_AS_ENSEMBLE_CANDIDATE' if r['macro']['f1']>=.35 and all(x['f1']>0 for x in r['perLabel'].values()) else 'REJECT'
np.save(HERE/'oof-probabilities.npy',probs); (HERE/'fold-assignment.json').write_text(json.dumps({'trainSha256':hashlib.sha256(TRAIN.read_bytes()).hexdigest(),'foldSizes':fold_sizes.astype(int).tolist(),'foldLabelSupport':fold_counts.astype(int).tolist(),'rowFold':{rows[i]['id']:int(folds[i]) for i in range(len(rows))}},indent=2)+'\n'); (HERE/'summary.json').write_text(json.dumps({'status':'COMPLETE','decision':decision,'rows':841,'groups':len(groups),'folds':5,'selected18':r,'protectedEvaluationAccess':False},indent=2)+'\n'); print(json.dumps({'decision':decision,'macro':r['macro'],'micro':r['micro'],'nonzeroLabels':sum(x['f1']>0 for x in r['perLabel'].values())},indent=2))

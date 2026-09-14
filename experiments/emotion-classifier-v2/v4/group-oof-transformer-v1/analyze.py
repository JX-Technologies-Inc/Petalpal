import json, sys
from pathlib import Path
import numpy as np
from sklearn.metrics import f1_score, precision_recall_fscore_support
sys.path.insert(0, str(Path('../auto-v1').resolve()))
from experiment import LABELS, PRODUCT

HERE=Path(__file__).resolve().parent
rows=[json.loads(x) for x in (HERE.parent/'aligned-supervision-v1/train.jsonl').read_text().splitlines() if x.strip()]
assignment=json.loads((HERE.parent/'group-oof-tfidf-v1/fold-assignment.json').read_text())
probs=np.load(HERE/'oof-probabilities.npy'); positions=[LABELS.index(l) for l in PRODUCT]
y=np.array([[l in r['modelLabels'] for l in PRODUCT] for r in rows],dtype=np.int8)
raw=(probs[:,positions]>=.35).astype(np.int8); selected=np.zeros_like(raw)
for i in range(len(rows)):
 ix=np.flatnonzero(raw[i]); ix=ix[np.argsort(probs[i,positions][ix])[::-1][:2]]; selected[i,ix]=1
pr,rc,f1,sup=precision_recall_fscore_support(y,selected,average=None,zero_division=0)
folds=np.array([assignment['rowFold'][r['id']] for r in rows]); groups={}
for r in rows: groups.setdefault(r.get('sourceGroupId') or r['id'],set()).add(assignment['rowFold'][r['id']])
out={'status':'COMPLETE','threshold':.35,'maxLabels':2,'rows':len(rows),'productLabels':PRODUCT,'foldSizes':[int((folds==f).sum()) for f in range(5)],'foldSourceGroups':[sum(1 for v in groups.values() if next(iter(v))==f) for f in range(5)],'sourceGroupCrossFoldCount':sum(len(v)>1 for v in groups.values()),'uniqueAssignedRows':len(assignment['rowFold']),'metrics':{'macroF1':float(f1_score(y,selected,average='macro',zero_division=0)),'microF1':float(f1_score(y,selected,average='micro',zero_division=0)),'perLabel':{l:{'f1':float(a),'support':int(b)} for l,a,b in zip(PRODUCT,f1,sup)},'byFold':[{'fold':f,'macroF1':float(f1_score(y[folds==f],selected[folds==f],average='macro',zero_division=0)),'microF1':float(f1_score(y[folds==f],selected[folds==f],average='micro',zero_division=0))} for f in range(5)]},'selection':'Fixed existing product rule only; no threshold, hyperparameter, or fold scan','externalEvaluationLoaded':False}
(HERE/'metrics.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))

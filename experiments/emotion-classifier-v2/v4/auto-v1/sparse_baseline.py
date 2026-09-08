"""One fixed sparse baseline justified by repeated small-data neural regressions."""
import json,sys,time,hashlib
from pathlib import Path
import joblib,numpy as np
from sklearn.pipeline import FeatureUnion
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.multiclass import OneVsRestClassifier
from sklearn.linear_model import LogisticRegression
P=Path(__file__).resolve().parent;D=P.parent/'auto-v3'
sys.path.insert(0,str(P));from experiment import LABELS,report

def main():
    out=D/'experiments/v4e-sparse';out.mkdir(exist_ok=False)
    read=lambda p:[json.loads(l) for l in p.read_text().splitlines()]
    train=read(D/'train.jsonl');dev=read(D/'dev.jsonl');m=json.loads((D/'manifest.json').read_text())
    for s in ['train','dev']:assert hashlib.sha256((D/f'{s}.jsonl').read_bytes()).hexdigest()==m['hashes'][s]
    features=FeatureUnion([('word',TfidfVectorizer(ngram_range=(1,2),min_df=2,sublinear_tf=True,dtype=np.float32)),('char',TfidfVectorizer(analyzer='char_wb',ngram_range=(3,5),min_df=2,sublinear_tf=True,dtype=np.float32))])
    t=time.perf_counter();x=features.fit_transform([r['journal'] for r in train]);xd=features.transform([r['journal'] for r in dev]);y=np.array([[l in r['modelLabels'] for l in LABELS] for r in train],dtype=int)
    model=OneVsRestClassifier(LogisticRegression(C=1.,solver='liblinear',class_weight='balanced',max_iter=1000,random_state=42),n_jobs=1);model.fit(x,y);probs=model.predict_proba(xd)
    joblib.dump({'features':features,'model':model,'labels':LABELS},out/'model.joblib');np.save(out/'probabilities.npy',probs)
    results=[report(dev,probs,t) for t in [.2,.35,.5]]
    result={'experiment':'v4e-sparse','checkpoint':str(out/'model.joblib'),'trainRows':len(train),'devRows':len(dev),'dataHashes':m['hashes'],'config':'Fixed word1-2 + char3-5 TFIDF, min_df2, balanced OVR logistic C1, seed42; no parameter sweep, vocabulary fit on Train only','elapsedSeconds':time.perf_counter()-t,'results':results}
    (out/'sparse-summary.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps([{'threshold':r['threshold'],'macroF1':r['selected18']['macro']['f1'],'microPrecision':r['selected18']['micro']['precision'],'microF1':r['selected18']['micro']['f1']} for r in results],indent=2))
if __name__=='__main__':main()

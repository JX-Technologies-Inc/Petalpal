"""Predeclared coarse global calibration; preserves per-label and product evidence."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P));from experiment import report,PRODUCT

def main():
    root=P.parent/'auto-v3';rows=[json.loads(l) for l in (root/'dev.jsonl').read_text().splitlines()]
    configs=[];base_added=False
    experiment_dirs=[]
    for version in [root,root.parent/'auto-v4']:
        if (version/'experiments').exists():experiment_dirs.extend((version/'experiments').iterdir())
    for exp in sorted(experiment_dirs):
        if not (exp/'summary.json').exists() or (exp/'invalidated.json').exists():continue
        s=json.loads((exp/'summary.json').read_text())
        if s['dataHashes']['dev']!=hashlib.sha256((root/'dev.jsonl').read_bytes()).hexdigest():raise ValueError('Cannot compare different Dev bytes')
        if not base_added:
            configs.append(('original-base',s['checkpointInitialization'],np.load(exp/'initial-probabilities.npy')));base_added=True
        if s['bestEpoch']:
            configs.append((exp.name,str(exp/'best-checkpoint'),np.load(exp/f"epoch-{s['bestEpoch']}-probabilities.npy")))
    sparse=root/'experiments/v4e-sparse'
    if (sparse/'sparse-summary.json').exists():
        ss=json.loads((sparse/'sparse-summary.json').read_text())
        if ss['dataHashes']['dev']!=hashlib.sha256((root/'dev.jsonl').read_bytes()).hexdigest():raise ValueError('Sparse Dev mismatch')
        configs.append(('v4e-sparse',str(sparse/'model.joblib'),np.load(sparse/'probabilities.npy')))
    blend=root/'experiments/v4f-fixed-blend'
    if (blend/'ensemble.json').exists():
        spec=json.loads((blend/'ensemble.json').read_text())
        if spec['devSha256']!=hashlib.sha256((root/'dev.jsonl').read_bytes()).hexdigest():raise ValueError('Ensemble Dev mismatch')
        configs.append(('v4f-fixed-blend',str(blend/'ensemble.json'),np.load(blend/'probabilities.npy')))
    results=[]
    for name,cp,probs in configs:
        for t in [.2,.35,.5]:
            m=report(rows,probs,t);results.append({'experiment':name,'checkpoint':cp,**m})
    if not results:return
    baseline=next(r for r in results if r['experiment']=='original-base' and r['threshold']==.5)
    floor=baseline['selected18']['micro']['precision']-.05
    eligible=[r for r in results if r['selected18']['micro']['precision']>=floor]
    best=max(eligible,key=lambda r:r['selected18']['macro']['f1'])
    # Paired source-component bootstrap, descriptive only (not corrected for Dev selection).
    groups=sorted(set(r['splitComponent'] for r in rows));bygroup={g:[i for i,r in enumerate(rows) if r['splitComponent']==g] for g in groups}
    truth=np.array([[l in r['modelLabels'] for l in PRODUCT] for r in rows]);pred=np.array([[l in o for l in PRODUCT] for o in best['outputs']]);basepred=np.array([[l in o for l in PRODUCT] for o in baseline['outputs']])
    def f1(y,p):
        tp=(y&p).sum(0);fp=(~y&p).sum(0);fn=(y&~p).sum(0);den=2*tp+fp+fn
        return np.divide(2*tp,den,out=np.zeros(18),where=den>0).mean()
    rng=np.random.default_rng(42);scores=[];diff=[]
    for _ in range(2000):
        ix=[i for g in rng.choice(groups,len(groups),replace=True) for i in bygroup[g]]
        value=f1(truth[ix],pred[ix]);scores.append(value);diff.append(value-f1(truth[ix],basepred[ix]))
    manifest=json.loads((root/'manifest.json').read_text())
    output={'status':'DEVELOPMENT_PROXY_ONLY','devRows':len(rows),'sourceComponents':len(groups),'annotationStatus':manifest['status'],
            'devSha256':hashlib.sha256((root/'dev.jsonl').read_bytes()).hexdigest(),
            'selectionRule':{'thresholds':[.2,.35,.5],'metric':'fixed18 macro-F1 after actual max-two selector, Primary unavailable','microPrecisionFloor':floor,'baselinePrecisionTolerance':.05},
            'best':best,'bootstrap':{'samples':2000,'unit':'sourceComponent','bestMacroF1Percentile95':np.quantile(scores,[.025,.975]).tolist(),'pairedImprovementPercentile95':np.quantile(diff,[.025,.975]).tolist(),'warning':'Descriptive resampling, not corrected for Dev model/threshold selection; low-support classes may be absent from bootstrap samples; no human annotation uncertainty modeled.'},'results':results}
    (root/'comparison.json').write_text(json.dumps(output,indent=2)+'\n')
    print(json.dumps({'best':{'experiment':best['experiment'],'threshold':best['threshold'],'macro':best['selected18']['macro'],'micro':best['selected18']['micro'],'product':best['product']},'bootstrap':output['bootstrap'],'comparison':[{'experiment':r['experiment'],'threshold':r['threshold'],'macroF1':r['selected18']['macro']['f1'],'microPrecision':r['selected18']['micro']['precision'],'microF1':r['selected18']['micro']['f1']} for r in results]},indent=2))
if __name__=='__main__':main()

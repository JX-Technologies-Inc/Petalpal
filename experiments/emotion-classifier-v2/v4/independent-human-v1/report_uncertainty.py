"""Author bootstrap of saved predictions; does not run models or choose thresholds."""
import argparse,json
from pathlib import Path
import numpy as np
P=Path(__file__).resolve().parent
LABELS='admiration amusement anger annoyance caring confusion curiosity disappointment disgust excitement fear gratitude joy love optimism remorse sadness surprise'.split()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('metrics',type=Path);args=ap.parse_args()
 rows=[json.loads(l) for l in (P/'dev.jsonl').read_text().splitlines()];m=json.loads(args.metrics.read_text())
 assert len(rows)==len({r['sourceGroupId'] for r in rows})==len(m['outputs'])
 y=np.array([[l in r['modelLabels'] for l in LABELS] for r in rows]);p=np.array([[l in o for l in LABELS] for o in m['outputs']])
 rng=np.random.default_rng(42);scores=[]
 for _ in range(2000):
  ix=rng.integers(0,len(rows),len(rows));tp=(y[ix]&p[ix]).sum(0);den=y[ix].sum(0)+p[ix].sum(0);f=np.divide(2*tp,den,out=np.zeros(len(LABELS)),where=den>0);scores.append(float(f.mean()))
 out={'macroF1':m['selected18']['macro']['f1'],'authorBootstrap95Percentile':np.quantile(scores,[.025,.975]).tolist(),'replicates':2000,'seed':42,'rows':len(rows),'labels':LABELS,'limitations':'Conditional on this source and fixed AI labels; does not quantify annotation error or transport to other populations. Zero-support labels retained with zeroDivision0. No model selection.'}
 args.metrics.with_name(args.metrics.stem+'-uncertainty.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
if __name__=='__main__':main()

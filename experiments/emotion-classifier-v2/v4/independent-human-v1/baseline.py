"""One prespecified previous-candidate evaluation; no threshold/weight search."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
P=Path(__file__).resolve().parent;R=P.parents[1]
sys.path.insert(0,str(P.parent/'auto-v1'))
from predict_ensemble import predict
from experiment import report

def main():
 out=P/'baseline-fixed-v4f'
 if out.exists():raise RuntimeError('Baseline already exists')
 lock=json.loads((P/'dev-lock.json').read_text());b=(P/'dev.jsonl').read_bytes()
 assert hashlib.sha256(b).hexdigest()==lock['sha256']
 rows=[json.loads(l) for l in b.decode().splitlines()]
 specpath=P.parent/'auto-v3/experiments/v4f-fixed-blend/ensemble.json';spec=json.loads(specpath.read_text())
 assert spec['threshold']==.35 and spec['weights']==[.5,.5]
 out.mkdir();(out/'protocol.json').write_text(json.dumps({'devSha256':lock['sha256'],'spec':spec,'selection':'prespecified previous candidate, no new tuning'},indent=2))
 probs=predict(rows,spec);np.save(out/'probabilities.npy',probs);metrics=report(rows,probs,.35)
 (out/'metrics.json').write_text(json.dumps(metrics,indent=2)+'\n');print(json.dumps(metrics['selected18'],indent=2),flush=True)
if __name__=='__main__':main()

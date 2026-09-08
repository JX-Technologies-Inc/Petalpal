"""Evaluate only after calibration-selected checkpoint is complete and sealed."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P.parent/'auto-v1'))
from predict_ensemble import predict
from experiment import report

def main():
 exp=P/'pilot-experiment';summary=json.loads((exp/'summary.json').read_text());assert summary['status']=='COMPLETE'
 lock=json.loads((P/'dev-lock.json').read_text());b=(P/'dev.jsonl').read_bytes();assert hashlib.sha256(b).hexdigest()==lock['sha256']
 spec=json.loads((exp/'ensemble.json').read_text());assert spec['weights']==[.5,.5] and spec['threshold']==.35
 calibrated=json.loads((exp/'calibration/ensemble.json').read_text());assert {k:v for k,v in spec.items() if k!='threshold'}=={k:v for k,v in calibrated.items() if k!='threshold'}
 out=exp/'external-validation';out.mkdir(exist_ok=False)
 hashes={str(f.relative_to(exp)):hashlib.sha256(f.read_bytes()).hexdigest() for f in (exp/'best-checkpoint').iterdir() if f.is_file()}
 (out/'protocol.json').write_text(json.dumps({'devSha256':lock['sha256'],'checkpointHashes':hashes,'bestEpoch':summary['bestEpoch'],'spec':spec,'calibratedSpec':calibrated,'selection':'calibration BCE, fixed weights/threshold; no external validation model selection'},indent=2)+'\n')
 rows=[json.loads(l) for l in b.decode().splitlines()];probs=predict(rows,spec);np.save(out/'probabilities.npy',probs)
 metrics=report(rows,probs,.35);(out/'metrics.json').write_text(json.dumps(metrics,indent=2)+'\n');print(json.dumps({'fixed035':metrics['selected18']},indent=2),flush=True)
 calibrated_metrics=report(rows,probs,calibrated['threshold']);(out/'calibrated-metrics.json').write_text(json.dumps(calibrated_metrics,indent=2)+'\n');print(json.dumps({'calibrated':calibrated_metrics['selected18'],'threshold':calibrated['threshold']},indent=2),flush=True)
if __name__=='__main__':main()

"""Single fixed probability blend motivated by observed precision/recall tradeoff."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
P=Path(__file__).resolve().parent;D=P.parent/'auto-v3';E=P.parent/'auto-v4/experiments/v4d-extra-human'
sys.path.insert(0,str(P));from experiment import report

def main():
    out=D/'experiments/v4f-fixed-blend';out.mkdir(exist_ok=False)
    s=json.loads((E/'summary.json').read_text());m=json.loads((D/'manifest.json').read_text());assert s['dataHashes']['dev']==m['hashes']['dev']
    original=np.load(E/'initial-probabilities.npy');adapted=np.load(E/f"epoch-{s['bestEpoch']}-probabilities.npy");probs=.5*original+.5*adapted
    rows=[json.loads(l) for l in (D/'dev.jsonl').read_text().splitlines()]
    results=[report(rows,probs,t) for t in [.2,.35,.5]];np.save(out/'probabilities.npy',probs)
    spec={'type':'equal_probability_average','weights':[.5,.5],'checkpoints':[s['checkpointInitialization'],str(E/'best-checkpoint')],'devSha256':m['hashes']['dev'],'note':'Fixed alpha, no labelwise mixing. Requires two model inferences; not deployed or latency validated.'}
    (out/'ensemble.json').write_text(json.dumps(spec,indent=2)+'\n');(out/'ensemble-results.json').write_text(json.dumps(results,indent=2)+'\n')
    print(json.dumps([{'threshold':r['threshold'],'macroF1':r['selected18']['macro']['f1'],'microPrecision':r['selected18']['micro']['precision'],'microF1':r['selected18']['micro']['f1']} for r in results],indent=2))
if __name__=='__main__':main()

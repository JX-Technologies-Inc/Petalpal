"""One predeclared policy ablation on the posweighted checkpoint, no metric change."""
import json,sys,subprocess
from pathlib import Path
import numpy as np
P=Path(__file__).resolve().parent;D=P.parent/'auto-v3'
sys.path.insert(0,str(P));from experiment import report,engine,LABELS

def experimental(probs,annotations,root):
    payload=[{'primaryGardenMood':a['primaryGardenMood'],'candidates':[{'label':l,'score':float(p[i])} for i,l in enumerate(LABELS) if p[i]>=engine.THRESHOLD]} for p,a in zip(probs,annotations)]
    uri=(P/'selector-v4.mjs').resolve().as_uri()
    js=f'import {{selectWithoutBroadClusters as select}} from {json.dumps(uri)}; const chunks=[];for await (const c of process.stdin) chunks.push(c);console.log(JSON.stringify(JSON.parse(chunks.join("")).map(r=>select(r).map(x=>x.label))));'
    out=subprocess.run(['node','--input-type=module','-e',js],input=json.dumps(payload),text=True,capture_output=True,check=True)
    return json.loads(out.stdout)

def main():
    e=D/'experiments/v4c-posweight';s=json.loads((e/'summary.json').read_text());probs=np.load(e/f"epoch-{s['bestEpoch']}-probabilities.npy");rows=[json.loads(l) for l in (D/'dev.jsonl').read_text().splitlines()]
    original=engine.select_variants;results=[]
    for name,fn in [('existing_clusters',original),('no_broad_clusters',experimental)]:
        engine.select_variants=fn
        for t in [.2,.35,.5]:results.append({'selector':name,**report(rows,probs,t)})
    engine.select_variants=original
    (D/'selector-ablation.json').write_text(json.dumps({'checkpoint':str(e/'best-checkpoint'),'bestEpoch':s['bestEpoch'],'policy':'Same checkpoint/data/metric/threshold grid; only remove broad cluster exclusion, preserve exact-label dedup, max2 and canonical Primary exclusion. No observed Primaries in Dev.','results':results},indent=2)+'\n')
    print(json.dumps([{'selector':r['selector'],'threshold':r['threshold'],'macroF1':r['selected18']['macro']['f1'],'microPrecision':r['selected18']['micro']['precision'],'microF1':r['selected18']['micro']['f1'],'outputs':r['product']['outputCountDistribution']} for r in results],indent=2))
if __name__=='__main__':main()

"""Locked Dev diagnostics only; never mutates labels or creates replacement examples."""
import json
from pathlib import Path
from collections import Counter
P=Path(__file__).resolve().parent.parent/'auto-v3'

def main():
    comparison=json.loads((P/'comparison.json').read_text());best=comparison['best'];rows=[json.loads(l) for l in (P/'dev.jsonl').read_text().splitlines()]
    product=set(best['selected18']['perLabel']);buckets={};errors=[]
    for r,out in zip(rows,best['outputs']):
        y=set(r['modelLabels'])&product;p=set(out)
        bucket='ambiguous_context' if r['annotation']['ambiguity'] else 'custom_only' if not y and r['customEmotions'] else 'explicit_or_inferred_fixed'
        d=buckets.setdefault(bucket,{'rows':0,'exact':0,'falsePositiveLabels':0,'falseNegativeLabels':0,'emptyPredictions':0})
        d['rows']+=1;d['exact']+=p==y;d['falsePositiveLabels']+=len(p-y);d['falseNegativeLabels']+=len(y-p);d['emptyPredictions']+=not p
        if p!=y:errors.append({'id':r['id'],'sourceGroupId':r['sourceGroupId'],'expected':sorted(y),'predicted':out,'annotationAmbiguity':r['annotation']['ambiguity']})
    for d in buckets.values():d['exactRate']=d['exact']/d['rows']
    manifest_root=P.parent/'auto-v4' if best['experiment'] in {'v4d-extra-human','v4f-fixed-blend'} else P
    m=json.loads((manifest_root/'manifest.json').read_text())
    result={'experiment':best['experiment'],'threshold':best['threshold'],'buckets':buckets,'perLabelWithTrainSupport':{l:{'trainSupport':m['supports']['train'][l],**v} for l,v in best['selected18']['perLabel'].items()},'errors':errors,'prohibition':'These are errors relative to locked automated annotations, not human-adjudicated product errors. Do not alter Dev labels based on them.'}
    (P/'diagnostics.json').write_text(json.dumps(result,indent=2)+'\n')
if __name__=='__main__':main()

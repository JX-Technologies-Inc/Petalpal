#!/usr/bin/env python3
"""Static preflight only: never imports a trainer and never performs inference."""
import hashlib, json, subprocess, sys
from collections import Counter
from pathlib import Path

HERE=Path(__file__).resolve().parent; P=HERE.parent
CP=P/'experiment/epoch-2-checkpoint'; TRAIN=P/'train.jsonl'; DEV=P/'dev.jsonl'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def rows(p): return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
def main():
    prot=json.loads((HERE/'protocol.json').read_text()); cfg=json.loads((CP/'config.json').read_text())
    order=[cfg['id2label'][str(i)] for i in range(len(cfg['id2label']))]
    selected18=['admiration','amusement','anger','annoyance','caring','confusion','curiosity','disappointment','disgust','excitement','fear','gratitude','joy','love','optimism','remorse','sadness','surprise']
    product=[x for x in order if x in selected18]
    assert len(order)==28 and product==selected18
    # The incumbent's exact product set is the 18-label engine set, recovered from source code, never guessed.
    src=(P.parent.parent/'candidate-c-lite/scripts/evaluate_frozen_100.py').read_text()
    assert 'metric_report' in src and 'zero_division=0' in src
    tr=rows(TRAIN)
    raw=Counter(len(r['modelLabels']) for r in tr)
    weights=prot['sourceWeights']; matrix=Counter()
    for r in tr:
        source=r['id'].split('-',1)[0]
        assert source in weights, f'Unknown locked Train provenance source: {source}'
        matrix[(source,len(r['modelLabels']))]+=1
    expected={'PHQ':{0:123,1:279,2:66},'COSO':{0:67,1:144,2:108},'HUM':{0:6,1:29,2:19}}
    source_table={s:{f'k{k}':matrix[(s,k)] for k in range(3)}|{'rows':sum(matrix[(s,k)] for k in range(3))} for s in weights}
    weighted=[sum(source_table[s][f'k{k}']*weights[s] for s in weights) for k in range(3)]
    result={'mapping28Order':order,'selected18Labels':product,'selected18LogitIndices':{l:order.index(l) for l in product},'selected18OrderSource':'existing v4/gemini-improvement-v1/prepare_split.py','sourceWeights':weights,'sourceCardinalityTable':source_table,'expectedSourceCardinalityTable':expected,'rawTrainCardinality':[raw[k] for k in range(3)],'weightedCardinality':weighted,'weightedTotal':sum(weighted),'blockers':[]}
    if source_table!= {s:{f'k{k}':expected[s][k] for k in range(3)}|{'rows':sum(expected[s].values())} for s in weights}: result['blockers'].append('Source x cardinality table mismatch.')
    if result['rawTrainCardinality'] != [196,452,193]: result['blockers'].append('Raw cardinality mismatch.')
    if weighted != [263,596,301] or sum(weighted)!=1160: result['blockers'].append('Weighted cardinality mismatch.')
    result['hashes']={str(x.relative_to(P)):sha(x) for x in [TRAIN,P/'annotation-lock.json',P/'split-lock.json'] if x.exists()}
    result['metricImplementationSha256']=sha(P.parent.parent/'candidate-c-lite/scripts/evaluate_frozen_100.py')
    (HERE/'preparation-audit.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2)); return 1 if result['blockers'] else 0
if __name__=='__main__': sys.exit(main())

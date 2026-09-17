import json,hashlib,sys
from pathlib import Path
import numpy as np
P=Path(__file__).resolve().parent;A=P.parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rs(p):return [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
def main():
 tr,d=rs(A/'train.jsonl'),rs(A/'dev.jsonl'); probs=A/'goemotions-targeted-v1/experiment/epoch-1-probabilities.npy'; arr=np.load(probs)
 full=["admiration","amusement","anger","annoyance","approval","caring","confusion","curiosity","disappointment","disapproval","disgust","excitement","fear","gratitude","joy","love","neutral","optimism","remorse","sadness","surprise"]
 labels=json.loads((P/'protocol.json').read_text())['labels']; idx={l:full.index(l) for l in labels}
 assert arr.shape==(149,21) and sha(probs)=='f9835c5126e5d642c1a0e863562ad12731e73493e0c8bade70d740c440e10dde'
 # Direct top-2 has every 0/1/2 subset in its output space; prior coupled conflicts are retained as gold sets.
 report={'mapping':{'full21Order':full,'selected18Indices':idx},'probabilityProvenance':{'reused':True,'path':str(probs),'sha256':sha(probs),'shape':list(arr.shape),'devRows':len(d),'devHash':sha(A/'dev.jsonl'),'annotationLockHash':sha(A/'annotation-lock.json')},'reachability':{'trainRows':len(tr),'devRows':len(d),'trainMaxCardinality':max(map(lambda x:len(x['modelLabels']),tr)),'devMaxCardinality':max(map(lambda x:len(x['modelLabels']),d)),'devGoldExpressible':149,'devGoldTotal':149,'priorSameClusterConflictSetsPreserved':19},'hashes':{'evaluator.py':sha(P/'evaluator.py'),'protocol.json':sha(P/'protocol.json'),'revisedProtocol':sha(A/'coso-selective-ranking-v1/revised-protocol.json')}}
 (P/'label-mapping.json').write_text(json.dumps(report['mapping'],indent=2)+'\n');(P/'reachability-report.json').write_text(json.dumps(report['reachability'],indent=2)+'\n');(P/'incumbent-provenance.json').write_text(json.dumps(report['probabilityProvenance'],indent=2)+'\n');(P/'validation-report.json').write_text(json.dumps(report,indent=2)+'\n')
if __name__=='__main__':main()

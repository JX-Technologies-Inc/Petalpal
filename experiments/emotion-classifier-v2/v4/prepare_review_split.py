"""Preassign annotation work without consulting labels or classifier predictions.
Outputs are NOT a gold Train/Dev set. Keep connected sources and similarities together.
"""
import hashlib
import json
from pathlib import Path
from collections import Counter
import sys
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P.parent/'candidate-c-lite/scripts'))
from data_safety import normalize

def main():
    rows=[json.loads(x) for x in (P/'annotation-queue.jsonl').read_text().splitlines()]
    audit=json.loads((P/'audit.json').read_text());parent=list(range(len(rows)));byid={r['id']:i for i,r in enumerate(rows)}
    def find(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]];i=parent[i]
        return i
    def union(i,j):parent[find(j)]=find(i)
    for key in [lambda r:r['canonicalSourceGroup'],lambda r:normalize(r['journal'])]:
        seen={}
        for i,r in enumerate(rows):
            k=key(r)
            if k in seen:union(i,seen[k])
            else:seen[k]=i
    for pair in audit['lexicalNearDuplicatePairsAt080']+audit['semanticCandidatesAt085']:
        union(byid[pair['a']],byid[pair['b']])
    groups={}
    for i,r in enumerate(rows):groups.setdefault(find(i),[]).append(r)
    outputs={'train':[],'dev':[]}
    for group in groups.values():
        stable='|'.join(sorted(set(r['canonicalSourceGroup'] for r in group)))
        digest=hashlib.sha256(('petalpal-v4-review-seed42:'+stable).encode()).hexdigest()
        split='dev' if int(digest[:8],16)/2**32<.2 else 'train'
        for row in group:
            # Blind annotation: hide model-proposed fixed/custom labels and old review status.
            row={k:v for k,v in row.items() if k not in {'legacyProposedLabels','legacyReviewStatus','customEmotions'}}
            row.update({'customEmotions':None,'intendedSplit':split,'splitComponent':digest,'modelLabels':None})
            outputs[split].append(row)
    for split,rr in outputs.items():
        (P/f'{split}-review.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in rr))
    report={'status':'ANNOTATION_ONLY_NOT_VALIDATED_DATASET','seed':42,'splitRule':'SHA256(source component), 20% Dev; no label-based selection',
            'components':len(groups),'rows':{k:len(v) for k,v in outputs.items()},'all625Preserved':sum(map(len,outputs.values()))==625,
            'semanticPolicy':'Conservatively union all MiniLM cosine >=.85 and lexical >=.8 candidates; semantic equivalence not certified',
            'benchmarkExclusion':'No benchmark content accessed. Independent source-only exclusion manifest still required before certification.',
            'checkpointRestriction':'V2/V3/V3-B cannot be scored as unexposed baselines on this split; restart from original checkpoint after lineage audit.'}
    (P/'split-manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()

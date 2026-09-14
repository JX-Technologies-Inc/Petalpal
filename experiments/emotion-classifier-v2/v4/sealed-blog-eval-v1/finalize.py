#!/usr/bin/env python3
import hashlib,json
from collections import Counter
from pathlib import Path
HERE=Path(__file__).resolve().parent
def load(name): return [json.loads(x) for x in (HERE/name).read_text().splitlines() if x.strip()]
def sha(name): return hashlib.sha256((HERE/name).read_bytes()).hexdigest()
protocol=json.loads((HERE/'protocol.json').read_text()); labels=protocol['taxonomy']['labels']; candidates=load('evaluation-manifest.unannotated.jsonl'); a=load('pass-a.jsonl'); b=load('pass-b.jsonl'); j=load('adjudications.jsonl'); usage=load('usage.jsonl')
ids=[r['evaluationId'] for r in candidates]; am={r['id']:r for r in a}; bm={r['id']:r for r in b}; jm={r['id']:r for r in j}; disagreements=[i for i in ids if set(am[i]['labels'])!=set(bm[i]['labels'])]
assert len(ids)==len(set(ids))==360 and set(am)==set(bm)==set(ids) and len(a)==len(b)==360
assert set(jm)==set(disagreements) and len(j)==len(disagreements)==132
final=[]
for r in candidates:
 i=r['evaluationId']; ann=jm[i] if i in jm else am[i]; ls=ann['labels']; assert len(ls)<=2 and len(ls)==len(set(ls)) and all(x in labels for x in ls)
 final.append({k:v for k,v in r.items() if k not in ('preassignedCueLabel',)}|{'labels':ls,'annotationMethod':'adjudicated' if i in jm else 'exact_pass_agreement'})
out=HERE/'final-evaluation-manifest.jsonl'; out.write_text(''.join(json.dumps(r,ensure_ascii=False,separators=(',',':'))+'\n' for r in final))
support=Counter(x for r in final for x in r['labels']); support={l:support[l] for l in labels}; cost=sum(r['estimatedCostUsd'] for r in usage)
hashes={n:sha(n) for n in ['protocol.json','evaluation-manifest.unannotated.jsonl','lineage-audit.json','pass-a.jsonl','pass-b.jsonl','adjudications.jsonl','usage.jsonl','final-evaluation-manifest.jsonl']}
checks={'candidateIdsCompleteUnique':len(ids)==len(set(ids))==360,'passACompleteExactIds':set(am)==set(ids) and len(a)==360,'passBCompleteExactIds':set(bm)==set(ids) and len(b)==360,'allDisagreementsAdjudicated':set(jm)==set(disagreements),'finalLabelsValid':all(len(r['labels'])<=2 and all(x in labels for x in r['labels']) for r in final),'candidateHashUnchanged':sha('evaluation-manifest.unannotated.jsonl')=='376d2ba645af8a90f5a8b34dd3281f59a31c1e6cb8bd8d190172704aa6c45544','lineageAuditPass':json.loads((HERE/'lineage-audit.json').read_text())['status']=='PASS_CANDIDATE_EXTRACTION','authorIsolation':len({r['authorId'] for r in final})==360,'budgetWithinCap':cost<=2.0,'supportAtLeast15AllLabels':all(v>=15 for v in support.values())}
sealed=all(checks.values())
summary={'sealStatus':'SEALED' if sealed else 'NOT_SEALED','rows':360,'passACompleted':len(a),'passBCompleted':len(b),'exactAgreement':360-len(disagreements),'disagreements':len(disagreements),'adjudicationsCompleted':len(j),'perLabelSupport':support,'actualApiCostUsd':cost,'budgetCapUsd':2.0,'checks':checks,'hashes':hashes,'modelEvaluationAllowed':sealed}
(HERE/'final-validation.json').write_text(json.dumps(summary,indent=2)+'\n'); print(json.dumps(summary,indent=2))

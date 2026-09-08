"""Finalize automated annotations and source-stratified split BEFORE predictions.
This is an AI-annotated human-text proxy, not human gold or observed-Primary evaluation.
"""
import hashlib,json,sys
from pathlib import Path
import numpy as np
from collections import Counter
P=Path(__file__).resolve().parent;R=P.parents[1]
sys.path.insert(0,str(R/'candidate-c-lite/scripts'))
from data_safety import normalize,source_key,assert_disjoint
from fine_tune import LABELS
PRODUCT=[l for l in LABELS if l not in {'approval','disapproval','neutral'}]

def main():
    if (P/"manifest.json").exists():
        raise ValueError("Dataset already locked; do not overwrite labels or split after inference")
    rows=[json.loads(l) for l in (P/'pass1.jsonl').read_text().splitlines()]
    # Second semantic review by SAME assistant. These revisions precede inference.
    revisions={
      'PHQ-071':([],['nausea'],'Physical nausea alone does not establish disgust without source context.'),
      'PHQ-540':([],['embarrassment'],'Failed performance alone does not explicitly establish disappointment; preserve uncertainty.'),
      'PHQ-547':([],[],'Admission of an error alone does not establish remorse.'),
      'PHQ-550':(['surprise'],['shame'],'Anger is content of prior entries, not necessarily current emotion.'),
    }
    for r in rows:
        if r['id'] in revisions:
            labs,custom,reason=revisions[r['id']];r['modelLabels']=labs;r['customEmotions']=custom;r['annotation']['revisionReason']=reason
        r['annotation'].update({'version':'v4-auto-v1-adjudicated','secondPass':'same-assistant semantic review plus automated consistency checks; not independent review'})
        assert set(r['modelLabels'])<=set(LABELS)
    # Source-only firewall: no labels, predictions or errors read for development.
    # Only pre-existing opened benchmark rows; never search/open Frozen-3.
    blocked_text=set();blocked_source=set();checks=[]
    for rel in ['frozen-2/frozen-2.jsonl','evaluation/petalpal-in-domain-v1.jsonl','hybrid-test-v2/test.jsonl']:
        path=R/rel;count=0
        for line in path.read_text().splitlines():
            if not line.strip():continue
            x=json.loads(line);count+=1
            if isinstance(x.get('journal'),str):blocked_text.add(hashlib.sha256(normalize(x['journal']).encode()).hexdigest())
            # Source URL can be top-level on source workbooks' JSON export.
            src=source_key(x)
            if src:blocked_source.add(src)
            url=x.get('sourceUrl')
            if url:blocked_source.add(source_key({'provenance':{'sourceUrl':url}}))
        checks.append({'path':rel,'rows':count,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    bad_components={r['splitComponent'] for r in rows if hashlib.sha256(normalize(r['journal']).encode()).hexdigest() in blocked_text or source_key(r) in blocked_source}
    quarantine=[r for r in rows if r['splitComponent'] in bad_components]
    rows=[r for r in rows if r['splitComponent'] not in bad_components]
    # Existing connected components include sources, normalized duplicates, lexical >=.80, semantic >=.85.
    groups=sorted(set(r['splitComponent'] for r in rows));indices={g:i for i,g in enumerate(groups)}
    incidence=np.zeros((len(groups),len(PRODUCT)),dtype=int);sizes=np.zeros(len(groups),dtype=int)
    for r in rows:
        i=indices[r['splitComponent']];sizes[i]+=1
        for l in set(r['modelLabels'])&set(PRODUCT):incidence[i,PRODUCT.index(l)]+=1
    total=incidence.sum(0);target=total*.2
    rng=np.random.default_rng(42);best=None
    # Fixed 5,000 candidate splits, objective exclusively coverage and proportions.
    for trial in range(5000):
        mask=rng.random(len(groups))<.2;n=sizes[mask].sum();d=incidence[mask].sum(0);t=total-d
        score=10000*((d==0).sum()+(t==0).sum())+100*((d<2).sum()+(t<2).sum())+abs(n-len(rows)*.2)+np.abs(d-target).sum()
        if best is None or score<best[0]:best=(float(score),trial,mask.copy())
    devgroups={g for g,m in zip(groups,best[2]) if m};out={'train':[],'dev':[]}
    for r in rows:
        r['split']='dev' if r['splitComponent'] in devgroups else 'train';out[r['split']].append(r)
    assert_disjoint(out['train'],out['dev'])
    for split,rr in out.items():
        (P/f'{split}.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rr))
    (P/'quarantine.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in quarantine))
    hashes={s:hashlib.sha256((P/f'{s}.jsonl').read_bytes()).hexdigest() for s in out}
    report={'status':'LOCKED_AI_ANNOTATED_HUMAN_TEXT_PROXY','humanWritten':True,'humanGold':False,'independentAnnotationReview':False,
      'primaryObserved':False,'annotationMethod':'Text-only LLM annotation, same-assistant adjudication, schema and consistency audit before student inference',
      'dataPolicy':'No journal rewritten, no difficult rows dropped; source-overlap quarantine only',
      'split':{'seed':42,'candidateCount':5000,'selectedTrial':best[1],'objective':best[0],'selectedBeforePredictions':True,'components':len(groups)},
      'counts':{s:len(rr) for s,rr in out.items()},'supports':{s:{l:sum(l in r['modelLabels'] for r in rr) for l in PRODUCT} for s,rr in out.items()},
      'emptyProductTargets':{s:sum(not set(r['modelLabels'])&set(PRODUCT) for r in rr) for s,rr in out.items()},
      'ambiguousRows':{s:sum(bool(r['annotation']['ambiguity']) for r in rr) for s,rr in out.items()},
      'hashes':hashes,'quarantinedRows':len(quarantine),'benchmarkSourceOnlyChecks':checks,
      'benchmarkSemanticExclusion':'Not recomputed on protected text; historical audit plus new source/exact firewall only',
      'nearDuplicatePolicy':'Existing source/lexical/semantic connected components preserved across split; semantic screen is not proof of equivalence',
      'scoreScope':'All 18 fixed labels, zero_division=0, including zero-support classes. Also actual max-two selector with no Primary. Primary redundancy unavailable.',
      'experimentBudget':'Base checkpoint baseline at .5; human-only adaptation 3 epochs; one mixed-data control 3 epochs; coarse thresholds .2,.35,.5 only; no per-label fitting.',
      'checkpointPolicy':'Only original candidate-c checkpoint and newly trained descendants; V2/V3/V3-B prohibited because they saw these rows.'}
    (P/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()

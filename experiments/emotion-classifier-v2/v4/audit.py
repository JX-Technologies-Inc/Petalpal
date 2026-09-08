"""Reproducible audit of development inputs only. No Frozen files are opened."""
import collections as C
import hashlib
import itertools
import json
import sys
from pathlib import Path
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'candidate-c-lite/scripts'))
from data_safety import normalize, source_key
from fine_tune import LABELS
PRODUCT = [x for x in LABELS if x not in {'neutral','approval','disapproval'}]
OUT = Path(__file__).resolve().parent

def read(name):
    return [json.loads(x) for x in (ROOT/'tuning-data-v1'/name).read_text().splitlines() if x.strip()]

def stats(rows):
    return {'rows':len(rows), 'labels':dict(C.Counter(l for r in rows for l in r['modelLabels'])),
            'labelCardinality':dict(C.Counter(len(r['modelLabels']) for r in rows)),
            'cooccurrence':dict(C.Counter('|'.join(p) for r in rows for p in itertools.combinations(sorted(set(r['modelLabels'])),2))),
            'canonicalSources':len(set(source_key(r) for r in rows)),
            'topSources':C.Counter(source_key(r) for r in rows).most_common(15),
            'exactDuplicateExcess':len(rows)-len(set(r['journal'] for r in rows)),
            'normalizedDuplicateExcess':len(rows)-len(set(normalize(r['journal']) for r in rows)),
            'customRows':sum(bool(r.get('customEmotions')) for r in rows),
            'customOnlyRows':sum(bool(r.get('customEmotions')) and not set(r['modelLabels'])&set(PRODUCT) for r in rows),
            'nullPrimary':sum(not r.get('primaryGardenMood') for r in rows)}

def main():
    original=read('train.jsonl'); combined=read('train-human-augmented-v3.jsonl')
    human=[r for r in combined if r['sourceType']=='PUBLIC_HUMAN']
    previous=read('real-heavy-v2-train.jsonl'); olddev=read('real-heavy-v2-dev.jsonl')
    marked=[r for r in human if r['adjudicationStatus']=='MANUALLY_REVIEWED_CORRECTED']
    report={'scope':'Development inputs only; no Frozen contents accessed', 'original':stats(original), 'human625':stats(human),
            'manuallyMarked20':stats(marked), 'previous197':stats(previous), 'oldHumanDev13':stats(olddev),
            'combinedRows':len(combined), 'originalPrefixIdentical':combined[:2000]==original,
            'reviewStatus':dict(C.Counter(r['adjudicationStatus'] for r in human)),
            'annotationConfidence':dict(C.Counter(r['annotationConfidence'] for r in human)),
            'pendingReviewWithUserReviewTag':sum('NEEDS_MANUAL_LABEL_REVIEW' in r['notes'] and 'USER_REVIEW' in r['annotatorIds'] for r in human),
            'explicitFinalPrimary':sum(r.get('reportedPrimaryEmotion') is not None for r in human),
            'reviewedProductCoverage':sorted(set(l for r in marked for l in r['modelLabels'])&set(PRODUCT)),
            'humanGradientRowFraction':len(human)/len(combined),
            'inputHashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'tuning-data-v1').glob('*.jsonl')}}
    for name, other in [('previous197',previous),('oldHumanDev13',olddev),('syntheticDev400',read('dev.jsonl'))]:
        report['overlap_'+name]={
            'exactRows':sum(r['journal'] in {x['journal'] for x in other} for r in human),
            'normalizedRows':sum(normalize(r['journal']) in {normalize(x['journal']) for x in other} for r in human),
            'sourceRows':sum(source_key(r) in {source_key(x) for x in other} for r in human)}
    source_to_ids=C.defaultdict(set)
    for r in human: source_to_ids[source_key(r)].add(r['sourceGroupId'])
    report['canonicalSourcesWithMultipleGroupIds']={k:sorted(v) for k,v in source_to_ids.items() if len(v)>1}
    vec=TfidfVectorizer(analyzer='char_wb',ngram_range=(3,5)); x=vec.fit_transform([r['journal'] for r in human]);sim=(x@x.T).toarray();np.fill_diagonal(sim,0)
    pairs=[{'a':human[i]['id'],'b':human[j]['id'],'similarity':float(sim[i,j])} for i,j in zip(*np.where(np.triu(sim,1)>=.8))]
    report['lexicalNearDuplicatePairsAt080']=pairs
    # Local MiniLM means a semantic retrieval diagnostic, not proof of equivalence.
    import torch
    from transformers import AutoTokenizer, AutoModel
    torch.set_num_threads(4)
    path=ROOT/'minilm/artifacts/all-MiniLM-L6-v2'
    tok=AutoTokenizer.from_pretrained(path,local_files_only=True);model=AutoModel.from_pretrained(path,local_files_only=True).eval();emb=[]
    with torch.inference_mode():
        for start in range(0,len(human),32):
            batch=tok([r['journal'] for r in human[start:start+32]],padding=True,truncation=True,max_length=256,return_tensors='pt')
            hidden=model(**batch).last_hidden_state;mask=batch['attention_mask'].unsqueeze(-1)
            e=(hidden*mask).sum(1)/mask.sum(1);emb.append(torch.nn.functional.normalize(e,dim=1).numpy())
    e=np.concatenate(emb);ss=e@e.T
    report['semanticCandidatesAt085']=[{'a':human[i]['id'],'b':human[j]['id'],'similarity':float(ss[i,j])} for i,j in zip(*np.where(np.triu(ss,1)>=.85))]
    report['semanticAuditStatus']='Retrieval complete; pairs require equivalence review before any split can be approved'
    report['validHumanDevStatus']='BLOCKED: no verified secondary-task gold; only two product labels in manually marked subset; source workbook pending'
    (OUT/'audit.json').write_text(json.dumps(report,indent=2)+'\n')
    # Preserve legacy supervision as proposals; do not silently relabel or call it gold.
    with (OUT/'annotation-queue.jsonl').open('w') as f:
        for r in human:
            f.write(json.dumps({'id':r['id'],'journal':r['journal'],'canonicalSourceGroup':source_key(r),
                 'sourceUrl':r['provenance']['sourceUrl'],'legacyProposedLabels':r['modelLabels'],
                 'legacyReviewStatus':r['adjudicationStatus'],'customEmotions':r['customEmotions'],
                 'primaryGardenMood':None,'expectedSecondaryEmotions':None,'acceptableAlternatives':None,
                 'clearlyWrongEmotions':None,'preferNoSecondaryEmotion':None,'expectedOutputMin':None,'expectedOutputMax':None,
                 'reviewerIds':[],'reviewStatus':'PENDING_VERIFIED_ANNOTATION','trainingEligible':False})+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in {'original','previous197','inputHashes','semanticCandidatesAt085','lexicalNearDuplicatePairsAt080','canonicalSourcesWithMultipleGroupIds'}},indent=2))

if __name__=='__main__': main()

"""Remove within-split normalized aliases by stable ID; preserve labels/split."""
import hashlib,json,shutil,sys
from pathlib import Path
P=Path(__file__).resolve().parent;I=P.parent/'auto-v2';O=P.parent/'auto-v3'
sys.path.insert(0,str(P.parents[1]/'candidate-c-lite/scripts'))
from data_safety import normalize

def main():
    O.mkdir(exist_ok=False);m=json.loads((I/'manifest.json').read_text());aliases=[]
    for s in ['train','dev']:
        rows=sorted([json.loads(l) for l in (I/f'{s}.jsonl').read_text().splitlines()],key=lambda r:r['id']);seen={};keep=[]
        for r in rows:
            k=normalize(r['journal'])
            if k in seen:
                assert r['modelLabels']==seen[k]['modelLabels']
                aliases.append({'id':r['id'],'canonicalId':seen[k]['id'],'split':s,'reason':'normalized duplicate'})
            else:seen[k]=r;keep.append(r)
        (O/f'{s}.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in keep));m['counts'][s]=len(keep);m['hashes'][s]=hashlib.sha256((O/f'{s}.jsonl').read_bytes()).hexdigest()
        m['supports'][s]={l:sum(l in r['modelLabels'] for r in keep) for l in m['supports'][s]};m['emptyProductTargets'][s]=sum(not set(r['modelLabels'])&set(m['supports'][s]) for r in keep);m['ambiguousRows'][s]=sum(bool(r['annotation']['ambiguity']) for r in keep)
    m.update({'version':'auto-v3','parentVersion':'auto-v2','duplicateAliases':aliases,'withinSplitNormalizedUnique':True,'dataPolicy':'625 original =593 unique retained +29 provenance quarantine +3 duplicate aliases. Stable-ID dedup only; no relabel or re-split.'})
    (O/'manifest.json').write_text(json.dumps(m,indent=2)+'\n')
    for name in ['quarantine.jsonl','synthetic-safe.jsonl','synthetic-audit.json']:shutil.copyfile(I/name,O/name)
    (I/'experiments/v4b-human-only/invalidated.json').write_text(json.dumps({'status':'INTERRUPTED_INTERNAL_DUPLICATE_AUDIT','reason':'Within-split normalized duplicates must not inflate evaluation count; preserve this exploratory run, restart unique-text protocol'},indent=2)+'\n')
    print(json.dumps({'counts':m['counts'],'aliases':aliases},indent=2))
if __name__=='__main__':main()

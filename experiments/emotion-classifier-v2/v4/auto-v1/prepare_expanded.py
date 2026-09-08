"""Versioned Train-only expansion; locked Dev bytes copied without changes."""
import hashlib,json,shutil,sys
from pathlib import Path
P=Path(__file__).resolve().parent;I=P.parent/'auto-v3';O=P.parent/'auto-v4'
sys.path.insert(0,str(P.parents[1]/'candidate-c-lite/scripts'))
from data_safety import assert_disjoint,normalize

def main():
    O.mkdir(exist_ok=False);read=lambda p:[json.loads(l) for l in p.read_text().splitlines()];m=json.loads((I/'manifest.json').read_text())
    extra=read(I/'extra-human-train.jsonl');train=read(I/'train.jsonl')+extra;dev=read(I/'dev.jsonl');assert_disjoint(train,dev)
    assert len({normalize(r['journal']) for r in train})==len(train)
    (O/'train.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in train));shutil.copyfile(I/'dev.jsonl',O/'dev.jsonl')
    m.update({'version':'auto-v4','parentVersion':'auto-v3','trainOnlyExpansion':len(extra),'devUnchanged':True,'maxTokenLength':384,'dataPolicy':'Original locked Dev unchanged;54 newly reannotated, extraction-repaired consented Train-only journals added after source/exact/semantic audit.'})
    m['counts']['train']=len(train);m['supports']['train']={l:sum(l in r['modelLabels'] for r in train) for l in m['supports']['train']};m['hashes']['train']=hashlib.sha256((O/'train.jsonl').read_bytes()).hexdigest()
    m['emptyProductTargets']['train']=sum(not set(r['modelLabels'])&set(m['supports']['train']) for r in train);m['ambiguousRows']['train']=sum(bool(r['annotation']['ambiguity']) for r in train)
    (O/'manifest.json').write_text(json.dumps(m,indent=2)+'\n');print(json.dumps(m['counts']))
if __name__=='__main__':main()

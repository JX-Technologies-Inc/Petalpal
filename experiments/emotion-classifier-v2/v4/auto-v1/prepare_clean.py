"""Create corrected immutable version by provenance-only exclusions; no re-splitting."""
import hashlib,json,shutil
from pathlib import Path
P=Path(__file__).resolve().parent;O=P.parent/'auto-v2'

def main():
    O.mkdir(exist_ok=False)
    m=json.loads((P/'manifest.json').read_text());audit=json.loads((P/'initialization-lexical-audit.json').read_text());bad=set(audit['quarantinedComponents']);excluded=[]
    for s in ['train','dev']:
        rows=[json.loads(l) for l in (P/f'{s}.jsonl').read_text().splitlines()];keep=[r for r in rows if r['splitComponent'] not in bad];excluded += [r for r in rows if r['splitComponent'] in bad]
        (O/f'{s}.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in keep));m['counts'][s]=len(keep)
        m['hashes'][s]=hashlib.sha256((O/f'{s}.jsonl').read_bytes()).hexdigest()
        m['supports'][s]={l:sum(l in r['modelLabels'] for r in keep) for l in m['supports'][s]}
        m['emptyProductTargets'][s]=sum(not set(r['modelLabels'])&set(m['supports'][s]) for r in keep)
        m['ambiguousRows'][s]=sum(bool(r['annotation']['ambiguity']) for r in keep)
    m.update({'version':'auto-v2','parentVersion':'auto-v1','correction':'29 rows quarantined via full source components for pretrained-task training-text normalized/lexical matches. Original split assignments and annotations unchanged. No post-prediction label editing.',
              'initializationTextAuditPassed':True,'initializationAudit':audit,'quarantinedRows':len(excluded)})
    m['dataPolicy']='All original625 accounted for:596 retained and29 provenance-quarantined, no difficulty-based removal.'
    (O/'manifest.json').write_text(json.dumps(m,indent=2)+'\n');(O/'quarantine.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in excluded))
    shutil.copyfile(P/'synthetic-safe.jsonl',O/'synthetic-safe.jsonl');shutil.copyfile(P/'synthetic-audit.json',O/'synthetic-audit.json')
    print(json.dumps({'counts':m['counts'],'supports':m['supports']},indent=2))
if __name__=='__main__':main()

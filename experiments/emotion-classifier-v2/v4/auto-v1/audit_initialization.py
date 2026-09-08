"""Quarantine whole source components using original training text only, no labels."""
import csv,hashlib,json,sys
from pathlib import Path
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P.parents[1]/'candidate-c-lite/scripts'))
from data_safety import normalize

def main():
    rows=[json.loads(l) for s in ['train','dev'] for l in (P/f'{s}.jsonl').read_text().splitlines()]
    path=Path('/Users/xingranma/google-research/goemotions/data/train.tsv')
    texts=[x[0] for x in csv.reader(path.open(),delimiter='\t')]
    norm={normalize(t) for t in texts}
    x=TfidfVectorizer(analyzer='char_wb',ngram_range=(3,5),min_df=1).fit_transform(texts+[r['journal'] for r in rows])
    nearest=[]
    for start in range(0,len(rows),32):
        sims=x[len(texts)+start:len(texts)+start+32]@x[:len(texts)].T
        nearest.extend(sims.max(axis=1).toarray().ravel().tolist())
    matches=[{'id':r['id'],'exactNormalized':normalize(r['journal']) in norm,'lexicalCosine':sim,'component':r['splitComponent']} for r,sim in zip(rows,nearest) if normalize(r['journal']) in norm or sim>=.8]
    bad={x['component'] for x in matches}
    report={'matches':matches,'quarantinedComponents':sorted(bad),'quarantinedRows':sum(r['splitComponent'] in bad for r in rows),'policy':'Remove whole existing components for normalized exact or char3-5 cosine>=.80 match against original GoEmotions training text; no labels/performance involved','sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'limitation':'Pretraining thread metadata and full semantic corpus audit unavailable; common short phrases can be conservatively removed.'}
    (P/'initialization-lexical-audit.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'matched':len(matches),'quarantine':report['quarantinedRows'],'trainRemaining':sum(r['split']=='train' and r['splitComponent'] not in bad for r in rows),'devRemaining':sum(r['split']=='dev' and r['splitComponent'] not in bad for r in rows)}))
if __name__=='__main__':main()

#!/usr/bin/env python3
import hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;src=HERE/'goemotions-candidate-pool.jsonl';dst=HERE/'goemotions-candidate-pool-final.jsonl'
if dst.exists():raise SystemExit('refusing to replace finalized candidate pool')
out=[]
for line in src.read_text().splitlines():
 r=json.loads(line); labels=r['modelLabels'];pr=r['provenance'];r['originalLabels']=labels;r['mappedPetalPalLabels']=labels;r['split']='train';r['authorId']=pr.get('authorId');r['provenance']['licenseInfo']='See official repository/model card; rights review required before use';out.append(r)
dst.write_text(''.join(json.dumps(r,ensure_ascii=False,separators=(',',':'))+'\n' for r in out))
print(json.dumps({'rows':len(out),'sha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'path':str(dst)}))

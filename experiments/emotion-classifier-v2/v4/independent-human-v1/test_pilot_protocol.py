"""Regression checks at the data/selector boundary for the new cohort."""
import hashlib,json,sys,unittest
from pathlib import Path
import numpy as np
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P.parent/'auto-v1'))
from experiment import report,LABELS,assert_disjoint
class PilotProtocolTest(unittest.TestCase):
 def test_locked_partitions_and_verbatim_source(self):
  manifest=json.loads((P/'pilot-data/manifest.json').read_text());parts={}
  for split in ['train','calibration']:
   b=(P/f'pilot-data/{split}.jsonl').read_bytes();self.assertEqual(hashlib.sha256(b).hexdigest(),manifest['hashes'][split]);parts[split]=[json.loads(l) for l in b.decode().splitlines()]
  b=(P/'dev.jsonl').read_bytes();self.assertEqual(hashlib.sha256(b).hexdigest(),manifest['devSha256']);parts['dev']=[json.loads(l) for l in b.decode().splitlines()]
  for a,b in [('train','calibration'),('train','dev'),('calibration','dev')]:assert_disjoint(parts[a],parts[b])
  for rr in parts.values():
   for r in rr:
    if r.get('provenance',{}).get('dataset')=='CoSoWELL-v1':self.assertEqual(hashlib.sha256(r['journal'].encode()).hexdigest(),r['provenance']['rawTextSha256'])
 def test_author_collision_rejected_even_when_text_differs(self):
  a={'journal':'One unique narrative','sourceGroupId':'cosowell-author:test','provenance':{'datasetUrl':'https://osf.io/x4s28/'}}
  with self.assertRaises(ValueError):assert_disjoint([a],[dict(a,journal='Another distinct account')])
 def test_metric_retains_absent_labels_and_selector_contract(self):
  p=np.zeros((1,len(LABELS)));p[0,LABELS.index('joy')]=.9;p[0,LABELS.index('amusement')]=.8;p[0,LABELS.index('neutral')]=1
  result=report([{'id':'fixture','modelLabels':['joy']}],p,.35)
  self.assertEqual(result['outputs'],[['joy']]);self.assertEqual(len(result['selected18']['perLabel']),18);self.assertAlmostEqual(result['selected18']['macro']['f1'],1/18)
if __name__=='__main__':unittest.main()

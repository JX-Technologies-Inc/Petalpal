import hashlib,json,sys,unittest
from pathlib import Path
import numpy as np
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P));from experiment import LABELS,PRODUCT,report
sys.path.insert(0,str(P.parents[1]/'candidate-c-lite/scripts'));from data_safety import source_key,assert_disjoint

class ProtocolTest(unittest.TestCase):
    def test_provenance_types(self):
        for p in [None,'legacy note',{}]:self.assertEqual(source_key({'provenance':p,'sourceUrl':'https://www.reddit.com/r/x/comments/abc/title'}),'reddit:abc')
    def test_locked_data_and_no_source_leakage(self):
        root=P.parent/'auto-v3';manifest=json.loads((root/'manifest.json').read_text());rows={}
        for s in ['train','dev']:
            path=root/f'{s}.jsonl';self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),manifest['hashes'][s]);rows[s]=[json.loads(l) for l in path.read_text().splitlines()]
        assert_disjoint(rows['train'],rows['dev']);
        from data_safety import normalize
        for rr in rows.values():self.assertEqual(len(rr),len({normalize(r['journal']) for r in rr}))
        self.assertFalse({r['splitComponent'] for r in rows['train']}&{r['splitComponent'] for r in rows['dev']})
        self.assertEqual(sum(len(v) for v in rows.values())+manifest['quarantinedRows']+len(manifest['duplicateAliases']),625)
        old={r['id']:r for s in ['train','dev'] for r in map(json.loads,(P/f'{s}.jsonl').read_text().splitlines())}
        for rr in rows.values():
            for r in rr:self.assertEqual(r,old[r['id']])
    def test_extra_human_extraction_and_dev_immutability(self):
        root=P.parent/'auto-v3';expanded=P.parent/'auto-v4'
        self.assertEqual((root/'dev.jsonl').read_bytes(),(expanded/'dev.jsonl').read_bytes())
        raw={r['id']:r for r in map(json.loads,(P.parents[1]/'tuning-data-v1/real-heavy-v2-train.jsonl').read_text().splitlines())}
        extra=[json.loads(l) for l in (root/'extra-human-train.jsonl').read_text().splitlines()]
        self.assertEqual(len(extra),54)
        for r in extra:
            self.assertIn(r['journal'],raw[r['id']]['journal'])
            self.assertEqual(r['sourceType'],'HUMAN_CONSENTED')
            self.assertNotIn('如果上面的 Emotion',r['journal'])
            self.assertNotIn('□ Excitement',r['journal'])
        train=[json.loads(l) for l in (expanded/'train.jsonl').read_text().splitlines()]
        dev=[json.loads(l) for l in (expanded/'dev.jsonl').read_text().splitlines()]
        assert_disjoint(train,dev)

    def test_actual_selector_and_fixed_macro_scope(self):
        rows=[{'id':'unit','modelLabels':['joy']}];p=np.zeros((1,len(LABELS)))
        for label,value in [('neutral',1),('approval',.99),('joy',.9),('love',.8),('surprise',.7)]:p[0,LABELS.index(label)]=value
        m=report(rows,p,.5);self.assertLessEqual(len(m['outputs'][0]),2);self.assertNotIn('neutral',m['outputs'][0]);self.assertEqual(len(m['selected18']['perLabel']),18)
        self.assertIsNone(m['product']['clearlyWrongEmotionRate']);self.assertIsNone(m['product']['primaryRedundancyRate'])
        self.assertAlmostEqual(m['selected18']['macro']['f1'],1/18)

if __name__=='__main__':unittest.main()

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
import torch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'candidate-c-lite/scripts'))
from data_safety import guard_training_path, assert_disjoint, accumulation_weight, source_key
from fine_tune import LABELS, label_positions, metrics, PRIMARY_GARDEN_MOODS

class RegressionTests(unittest.TestCase):
    def test_benchmarks_rejected(self):
        for p in ['frozen-2/data.jsonl','frozen-3/data.jsonl','hybrid-test-v2/test.jsonl','evaluation/data.jsonl','x/petalpal-in-domain-v1.jsonl']:
            with self.assertRaises(ValueError): guard_training_path(Path(p))
        guard_training_path(Path('v4/dev.jsonl'))
    def test_source_aliases(self):
        a={'journal':'different','sourceGroupId':'a','provenance':{'sourceUrl':'https://beta.reddit.com/r/test/comments/abc/title/comment'}}
        b={'journal':'other','sourceGroupId':'b','provenance':{'sourceUrl':'https://www.reddit.com/r/test/comments/abc/'}}
        self.assertEqual(source_key(a),source_key(b))
        with self.assertRaises(ValueError):assert_disjoint([a],[b])
    def test_normalized_leakage(self):
        with self.assertRaises(ValueError):assert_disjoint([{'journal':'Hello, WORLD!'}],[{'journal':'hello world'}])
    def test_accumulation_matches_combined_mean_gradient(self):
        for n in [1,8,9,16,17,23]:
            x=torch.arange(1,n+1).float()
            for start in range(0,n,16):
                p=torch.tensor(2.,requires_grad=True)
                for offset in range(start,min(start+16,n),8):
                    loss=(p*x[offset:offset+8]).square().mean()*accumulation_weight(offset//8,n,8,2)
                    loss.backward()
                q=torch.tensor(2.,requires_grad=True);(q*x[start:start+16]).square().mean().backward()
                self.assertTrue(torch.allclose(p.grad,q.grad))
    def test_mapping_and_metrics(self):
        model=SimpleNamespace(config=SimpleNamespace(id2label=dict(enumerate(reversed(LABELS)))))
        self.assertEqual(label_positions(model),list(reversed(range(21))))
        y=torch.eye(21);m=metrics(y,y)
        self.assertEqual(m['macro_f1'],1)
        self.assertEqual(len(PRIMARY_GARDEN_MOODS),8)

if __name__=='__main__': unittest.main()

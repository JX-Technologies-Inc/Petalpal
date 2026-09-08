"""Evaluate explicitly reviewed Human Dev with the actual product selector.
Does not tune thresholds. Missing product annotations fail instead of becoming zero.
"""
import argparse
import json
import sys
from pathlib import Path
import numpy as np
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P.parent/'candidate-c-lite/scripts'))
from data_safety import guard_training_path
from fine_tune import PRIMARY_GARDEN_MOODS, LABELS
# This module defines inference/selector/metrics; importing does not open Frozen.
import evaluate_frozen_100 as engine


def validate(row):
    if row.get('reviewStatus')!='VERIFIED' or not row.get('reviewerIds'):
        raise ValueError(f"Unverified annotation: {row.get('id')}")
    if row.get('primaryGardenMood') not in PRIMARY_GARDEN_MOODS:
        raise ValueError('Observed/user-selected Primary is required; do not infer it from target labels')
    if row.get('intendedSplit')!='dev':raise ValueError('Expected Human Dev only')
    for field in ['expectedSecondaryEmotions','acceptableAlternatives','clearlyWrongEmotions']:
        if not isinstance(row.get(field),list) or not set(row[field])<=set(engine.VARIANT_LABELS):
            raise ValueError(f'Missing or invalid {field}')
    if not isinstance(row.get('preferNoSecondaryEmotion'),bool):raise ValueError('Missing abstention annotation')
    lo,hi=row.get('expectedOutputMin'),row.get('expectedOutputMax')
    if type(lo)!=int or type(hi)!=int or not 0<=lo<=hi<=2:raise ValueError('Invalid output bounds')
    if not isinstance(row.get('primaryRedundantEmotions'),list):raise ValueError('Missing canonical redundant labels')
    return {'id':row['id'],'primaryGardenMood':row['primaryGardenMood'],'expected':row['expectedSecondaryEmotions'],
            'acceptable':row['acceptableAlternatives'],'clearlyWrong':row['clearlyWrongEmotions'],
            'preferNone':row['preferNoSecondaryEmotion'],'redundant':row['primaryRedundantEmotions'],'min':lo,'max':hi}


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--dev',type=Path,required=True);ap.add_argument('--checkpoint',type=Path,required=True)
    ap.add_argument('--threshold',type=float,default=.5);ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
    if not 0<=args.threshold<=1:raise ValueError('Invalid threshold')
    if args.output.exists():raise ValueError('Refusing to overwrite an experiment result')
    rows=[json.loads(l) for l in guard_training_path(args.dev).read_text().splitlines() if l.strip()]
    if not rows:raise ValueError('Empty Dev')
    annotations=[validate(r) for r in rows]
    # Certification must come from audited split preparation, not inferred from a filename.
    manifest=json.loads(args.dev.with_suffix('.manifest.json').read_text())
    import hashlib
    if manifest.get('sha256')!=hashlib.sha256(args.dev.read_bytes()).hexdigest():raise ValueError('Stale Dev manifest')
    if manifest.get('status')!='CERTIFIED_HUMAN_DEV' or not manifest.get('sourceDisjoint') or not manifest.get('benchmarkExcluded'):
        raise ValueError('Human Dev certification missing')
    checkpoint=str(args.checkpoint.resolve())
    if checkpoint not in manifest.get('allowedCheckpoints',[]):raise ValueError('Checkpoint training-lineage audit missing')
    engine.THRESHOLD=args.threshold
    probs=engine.predict([r['journal'] for r in rows],args.checkpoint,8)
    outputs=engine.select_variants(probs,annotations,P.parent)
    truth=np.asarray([[l in r['expected'] for l in engine.VARIANT_LABELS] for r in annotations],dtype=np.int8)
    pred=np.asarray([[l in rr for l in engine.VARIANT_LABELS] for rr in outputs],dtype=np.int8)
    metrics=engine.metric_report(truth,pred);product=engine.product_report(annotations,outputs)
    # Undefined denominators are unavailable, not a reassuring measured zero.
    if not sum(len(x) for x in outputs):
        for k in ['strictSecondaryPrecision','acceptableSecondaryPrecision','clearlyWrongEmotionRate','primaryRedundancyRate']:product[k]=None
    if not any(a['preferNone'] for a in annotations):product['correctAbstentionRate']=None
    if not any(a['min']>0 for a in annotations):
        product['usefulCoverage']=None;product['unwantedAbstentionRate']=None
    result={'checkpoint':checkpoint,'threshold':args.threshold,'examples':len(rows),'labelScope':engine.VARIANT_LABELS,
            'classificationMetrics':metrics,'productMetrics':product,'zeroSupportLabels':[l for l,m in metrics['perLabel'].items() if m['support']==0],
            'predictions':[{'id':r['id'],'selected':o,'probabilities':dict(zip(LABELS,map(float,p)))} for r,o,p in zip(rows,outputs,probs)]}
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='predictions'},indent=2))
if __name__=='__main__':main()

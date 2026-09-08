"""Write final experiment report directly from persisted measured results."""
import json
from pathlib import Path
P=Path(__file__).resolve().parent.parent/'auto-v3'

def main():
    c=json.loads((P/'comparison.json').read_text());b=c['best'];baseline=next(r for r in c['results'] if r['experiment']=='original-base' and r['threshold']==.5)
    fmt=lambda x:f'{x:.4f}'
    lines=['# V4 automated human-text development report — 2026-09-07','',
      f"Best eligible Dev Macro-F1: **{fmt(b['selected18']['macro']['f1'])}**, experiment `{b['experiment']}`, threshold `{b['threshold']}`. **The Macro-F1 >=0.60 target was not reached.**",'',
      'This is authentic-source-tagged human-written text with **AI annotations**, not independent human gold. There are no observed user Primaries. The score measures fixed18 emotion prediction through the existing max-two selector with Primary unset. It is not a validated Primary-aware PetalPal production result.','',
      '## Measured improvement','',
      '| Metric | Original @0.5 | Best fixed blend @0.35 |','|---|---:|---:|']
    for avg in ['macro','micro']:
        for metric in ['precision','recall','f1']:
            lines.append(f"| {avg} {metric} | {fmt(baseline['selected18'][avg][metric])} | {fmt(b['selected18'][avg][metric])} |")
    for key in ['exactExpectedMatchRate','usefulCoverage','correctAbstentionRate','unwantedAbstentionRate']:
        lines.append(f"| {key} | {fmt(baseline['product'][key])} | {fmt(b['product'][key])} |")
    lines += ['',f"Outputs0/1/2: baseline `{baseline['product']['outputCountDistribution']}`, best `{b['product']['outputCountDistribution']}`.",
      'Acceptable-match/clearly-wrong annotation and observed Primary redundancy are unavailable, reported as null. They were not inferred as zero. The ensemble improves useful coverage but correct abstention is lower than baseline; this tradeoff remains material.',
      '', '## Experiments retained','', '| Experiment | Highest macro across fixed grid | Threshold | Micro precision there | Selection outcome |','|---|---:|---:|---:|---|']
    for name in dict.fromkeys(r['experiment'] for r in c['results']):
        rows=[r for r in c['results'] if r['experiment']==name];top=max(rows,key=lambda r:r['selected18']['macro']['f1'])
        eligible=[r for r in rows if r['selected18']['micro']['precision']>=c['selectionRule']['microPrecisionFloor']]
        decision='fails precision guard at all tested thresholds' if not eligible else 'eligible; did not win' if name!=b['experiment'] else 'best eligible point estimate'
        if top not in eligible and eligible:decision+='; highest-macro setting rejected'
        lines.append(f"| {name} | {fmt(top['selected18']['macro']['f1'])} | {top['threshold']} | {fmt(top['selected18']['micro']['precision'])} | {decision} |")
    lines += ['', 'Four neural fine-tunes completed (human-only, mixed, positive weighting, extra54 human), plus one fixed sparse baseline and one fixed50/50 blend. Epoch selection used the actual selected18 macro @.5, then only thresholds .2/.35/.5 were evaluated. No per-label threshold fitting. Micro precision floor was original @.5 precision minus .05.',
      'The separate no-broad-clusters ablation reached macro .5406 but precision .4590 and was rejected. Production selector was not edited.',
      'Earlier auto-v1 and auto-v2 runs were interrupted/invalidated for initialization overlap or internal duplicates; their files remain in their experiment folders. They are not included as valid comparisons.',
      '', '## Data, supervision and isolation','',
      '-625 original PUBLIC_HUMAN records were individually reannotated before predictions. A second pass by the same assistant plus consistency checks is not independent adjudication. Customs and ambiguity were retained. No Dev labels changed after prediction inspection.'.replace('-625','- 625'),
      '- Initial source-component split was chosen before inference to cover all18 labels. Later deterministic exclusions removed29 rows by pretrained-task overlap components and3 normalized aliases, without re-splitting or changing labels.',
      '- Final core data:468 Train /125 Dev across35 Dev source components. All18 classes are counted. Curiosity and surprise have1 Dev positive each; many others have2.',
      '- Later Train-only expansion added54 records tagged HUMAN_CONSENTED, giving522 Train with identical125 Dev bytes. Five form-header extraction defects were repaired; no journal prose was rewritten. Longest352 tokens, max384 used to avoid truncating labels away from their evidence.',
      '- The historical197 augmentation was111 adapted synthetic +54 consented human +32 public human. It was not197 authentic-human rows.',
      '- Source, normalized, lexical and MiniLM connected-component checks separate Human Train/Dev. Benchmark source/hash-only exclusion did not use benchmark labels, predictions or errors. No Frozen-3 creation/evaluation.',
      '- Original GoEmotions train exact/lexical matches were quarantined. Full foundation/pretrained-corpus provenance is not available, so complete pretraining-source isolation is not claimed.',
      '- Synthetic auxiliary data was checked against Human Dev and used only in the mixed Train condition. Original synthetic Dev never selected a V4 checkpoint.',
      '', '## Why 0.60 is not a reliable claim yet','',
      'The rare-label bottleneck is visible in the support table below. The four neural runs do not show a sustained macro gain over the original encoder individually; class weighting improves recall but increases false positives, and broad-cluster removal worsens precision. The fixed blend recovers some complementary behavior without reaching .60.',
      'Only35 independent Dev components and1–2 positives for many classes make repeated hyperparameter search risky. AI-label errors and missing conversational context are not quantified by human agreement; real user Primary and acceptable/wrong-emotion judgments cannot be reconstructed from these inputs.',
      f"Descriptive source bootstrap: macro percentile range `{c['bootstrap']['bestMacroF1Percentile95']}`, paired improvement over original @.5 `{c['bootstrap']['pairedImprovementPercentile95']}`. This is not a corrected confidence interval for the selected model: missing rare classes distort bootstrap samples, selection optimism and annotation uncertainty are not modeled.",
      'Further tuning on this small Dev is paused after these documented hypotheses. This is not a mathematical proof that .60 is impossible. The next useful data milestone is a separate source-disjoint development validation cohort with independent automated adjudication, preserved journal context, broader rare-label support, and observed Primary metadata where available. No manual annotation or file-moving is requested from the user, and no new Frozen final evaluation is authorized by this result.',
      '', '## Best per-label metrics','', '| Label | Precision | Recall | F1 | Dev support |','|---|---:|---:|---:|---:|']
    for label,v in b['selected18']['perLabel'].items():lines.append(f"| {label} | {fmt(v['precision'])} | {fmt(v['recall'])} | {fmt(v['f1'])} | {v['support']} |")
    lines += ['', '## Artifacts and reproducibility','',
      '- `comparison.json`: every threshold report, full per-label/product metrics, selected outputs and descriptive bootstrap.',
      '- `diagnostics.json`: locked-label error buckets and adaptation Train support.',
      '- `manifest.json`, `../auto-v4/manifest.json`: dataset hashes, supervision status and provenance accounting.',
      '- `experiments/v4f-fixed-blend/ensemble.json`: fixed50/50 original + extra-human epoch2 checkpoints, lengths128/384, threshold.35. Requires two inferences; no production latency or memory certification.',
      '- `../auto-v1/predict_ensemble.py`: runnable local JSON-in/JSON-out inference preserving supplied Primary. `runtime-verification.json` records saved-checkpoint reproduction and boundary checks.',
      '- `../auto-v1/test_protocol.py`, `../test_regressions.py`: data/selector/gradient regression tests. Production modules were not connected to this model.','']
    (P/'REPORT.md').write_text('\n'.join(lines))
if __name__=='__main__':main()

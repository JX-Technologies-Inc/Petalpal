# V4 automated human-text development report — 2026-09-07

Best eligible Dev Macro-F1: **0.5606**, experiment `v4f-fixed-blend`, threshold `0.35`. **The Macro-F1 >=0.60 target was not reached.**

This is authentic-source-tagged human-written text with **AI annotations**, not independent human gold. There are no observed user Primaries. The score measures fixed18 emotion prediction through the existing max-two selector with Primary unset. It is not a validated Primary-aware PetalPal production result.

## Measured improvement

| Metric | Original @0.5 | Best fixed blend @0.35 |
|---|---:|---:|
| macro precision | 0.5885 | 0.6544 |
| macro recall | 0.4666 | 0.5910 |
| macro f1 | 0.4747 | 0.5606 |
| micro precision | 0.5571 | 0.5904 |
| micro recall | 0.5000 | 0.6282 |
| micro f1 | 0.5270 | 0.6087 |
| exactExpectedMatchRate | 0.5840 | 0.6000 |
| usefulCoverage | 0.5672 | 0.7164 |
| correctAbstentionRate | 0.7586 | 0.7069 |
| unwantedAbstentionRate | 0.2090 | 0.1343 |

Outputs0/1/2: baseline `{'0': 58, '1': 64, '2': 3}`, best `{'0': 50, '1': 67, '2': 8}`.
Acceptable-match/clearly-wrong annotation and observed Primary redundancy are unavailable, reported as null. They were not inferred as zero. The ensemble improves useful coverage but correct abstention is lower than baseline; this tradeoff remains material.

## Experiments retained

| Experiment | Highest macro across fixed grid | Threshold | Micro precision there | Selection outcome |
|---|---:|---:|---:|---|
| original-base | 0.5262 | 0.35 | 0.5244 | eligible; did not win |
| v4c-human-only | 0.4878 | 0.2 | 0.4530 | eligible; did not win; highest-macro setting rejected |
| v4c-mixed | 0.5190 | 0.35 | 0.5875 | eligible; did not win |
| v4c-posweight | 0.5001 | 0.5 | 0.4775 | fails precision guard at all tested thresholds |
| v4d-extra-human | 0.5687 | 0.2 | 0.4872 | eligible; did not win; highest-macro setting rejected |
| v4e-sparse | 0.2209 | 0.5 | 0.6744 | eligible; did not win |
| v4f-fixed-blend | 0.5606 | 0.35 | 0.5904 | best eligible point estimate |

Four neural fine-tunes completed (human-only, mixed, positive weighting, extra54 human), plus one fixed sparse baseline and one fixed50/50 blend. Epoch selection used the actual selected18 macro @.5, then only thresholds .2/.35/.5 were evaluated. No per-label threshold fitting. Micro precision floor was original @.5 precision minus .05.
The separate no-broad-clusters ablation reached macro .5406 but precision .4590 and was rejected. Production selector was not edited.
Earlier auto-v1 and auto-v2 runs were interrupted/invalidated for initialization overlap or internal duplicates; their files remain in their experiment folders. They are not included as valid comparisons.

## Data, supervision and isolation

- 625 original PUBLIC_HUMAN records were individually reannotated before predictions. A second pass by the same assistant plus consistency checks is not independent adjudication. Customs and ambiguity were retained. No Dev labels changed after prediction inspection.
- Initial source-component split was chosen before inference to cover all18 labels. Later deterministic exclusions removed29 rows by pretrained-task overlap components and3 normalized aliases, without re-splitting or changing labels.
- Final core data:468 Train /125 Dev across35 Dev source components. All18 classes are counted. Curiosity and surprise have1 Dev positive each; many others have2.
- Later Train-only expansion added54 records tagged HUMAN_CONSENTED, giving522 Train with identical125 Dev bytes. Five form-header extraction defects were repaired; no journal prose was rewritten. Longest352 tokens, max384 used to avoid truncating labels away from their evidence.
- The historical197 augmentation was111 adapted synthetic +54 consented human +32 public human. It was not197 authentic-human rows.
- Source, normalized, lexical and MiniLM connected-component checks separate Human Train/Dev. Benchmark source/hash-only exclusion did not use benchmark labels, predictions or errors. No Frozen-3 creation/evaluation.
- Original GoEmotions train exact/lexical matches were quarantined. Full foundation/pretrained-corpus provenance is not available, so complete pretraining-source isolation is not claimed.
- Synthetic auxiliary data was checked against Human Dev and used only in the mixed Train condition. Original synthetic Dev never selected a V4 checkpoint.

## Why 0.60 is not a reliable claim yet

The rare-label bottleneck is visible in the support table below. The four neural runs do not show a sustained macro gain over the original encoder individually; class weighting improves recall but increases false positives, and broad-cluster removal worsens precision. The fixed blend recovers some complementary behavior without reaching .60.
Only35 independent Dev components and1–2 positives for many classes make repeated hyperparameter search risky. AI-label errors and missing conversational context are not quantified by human agreement; real user Primary and acceptable/wrong-emotion judgments cannot be reconstructed from these inputs.
Descriptive source bootstrap: macro percentile range `[0.3439883793991299, 0.5913607514155759]`, paired improvement over original @.5 `[0.014768933856104935, 0.1807012114610154]`. This is not a corrected confidence interval for the selected model: missing rare classes distort bootstrap samples, selection optimism and annotation uncertainty are not modeled.
Further tuning on this small Dev is paused after these documented hypotheses. This is not a mathematical proof that .60 is impossible. The next useful data milestone is a separate source-disjoint development validation cohort with independent automated adjudication, preserved journal context, broader rare-label support, and observed Primary metadata where available. No manual annotation or file-moving is requested from the user, and no new Frozen final evaluation is authorized by this result.

## Best per-label metrics

| Label | Precision | Recall | F1 | Dev support |
|---|---:|---:|---:|---:|
| admiration | 0.1429 | 1.0000 | 0.2500 | 2 |
| amusement | 0.3333 | 1.0000 | 0.5000 | 2 |
| anger | 1.0000 | 0.2500 | 0.4000 | 4 |
| annoyance | 1.0000 | 1.0000 | 1.0000 | 3 |
| caring | 0.0000 | 0.0000 | 0.0000 | 2 |
| confusion | 1.0000 | 0.5000 | 0.6667 | 2 |
| curiosity | 1.0000 | 1.0000 | 1.0000 | 1 |
| disappointment | 0.5000 | 0.6000 | 0.5455 | 5 |
| disgust | 0.5000 | 0.3333 | 0.4000 | 3 |
| excitement | 1.0000 | 0.5000 | 0.6667 | 2 |
| fear | 0.6667 | 1.0000 | 0.8000 | 2 |
| gratitude | 1.0000 | 0.6471 | 0.7857 | 17 |
| joy | 0.6364 | 0.7368 | 0.6829 | 19 |
| love | 1.0000 | 0.5714 | 0.7273 | 7 |
| optimism | 1.0000 | 0.5000 | 0.6667 | 2 |
| remorse | 1.0000 | 1.0000 | 1.0000 | 2 |
| sadness | 0.0000 | 0.0000 | 0.0000 | 2 |
| surprise | 0.0000 | 0.0000 | 0.0000 | 1 |

## Artifacts and reproducibility

- `comparison.json`: every threshold report, full per-label/product metrics, selected outputs and descriptive bootstrap.
- `diagnostics.json`: locked-label error buckets and adaptation Train support.
- `manifest.json`, `../auto-v4/manifest.json`: dataset hashes, supervision status and provenance accounting.
- `experiments/v4f-fixed-blend/ensemble.json`: fixed50/50 original + extra-human epoch2 checkpoints, lengths128/384, threshold.35. Requires two inferences; no production latency or memory certification.
- `../auto-v1/predict_ensemble.py`: runnable local JSON-in/JSON-out inference preserving supplied Primary. `runtime-verification.json` records saved-checkpoint reproduction and boundary checks.
- `../auto-v1/test_protocol.py`, `../test_regressions.py`: data/selector/gradient regression tests. Production modules were not connected to this model.

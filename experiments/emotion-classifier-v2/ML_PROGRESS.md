# ML Progress

## Current Direction

- Preferred candidate: Candidate C-Lite (`SamLowe/roberta-base-go_emotions`, ONNX Runtime CPU INT8).
- Deployment direction: Render Free is acceptable for low-traffic functional validation and Daily Grow UX at low concurrency, but its `0.1 CPU` is not a production capacity target.
- The experimental 21-label model analyzes secondary emotions only; the user-selected Primary Garden Mood remains authoritative. Candidate C-Lite is not connected to production.

## Completed

- Candidate A (TF-IDF + OVR Logistic Regression): Macro-F1 `0.506177`, Micro-F1 `0.549516`, median CPU `1.07 ms`, `9.25 MiB`.
- Candidate B (frozen MiniLM + OVR): Macro-F1 `0.413176`; worse and slower than Candidate A.
- Candidate C (PyTorch RoBERTa): Macro-F1 `0.573226`, Micro-F1 `0.619073`, Garden Micro-F1 `0.757580`; median CPU `54.59 ms`, model `480.19 MiB`.
- Candidate C-Lite ONNX FP32 export and dynamic INT8 quantization succeeded; predictions and full 5,228-sample test evaluation were validated.
- C-Lite INT8: Macro-F1 `0.573398`, Micro-F1 `0.618650`, Garden Micro-F1 `0.756672`; model `120.06 MiB` (about 75% smaller than ONNX FP32).
- Per-label dev thresholds, 21-label projection, Garden Mood mapping, runtime comparison, and local `/health`, `/results`, `/benchmark` service checks are complete.
- Render Free 512 MiB feasibility benchmark completed: max RSS `299.89 MiB` (`58.57%`), zero OOMs/errors; concurrency-1 median `198.17 ms`, P95 `400.74 ms`, and throughput about `4.3–4.8 req/s`. Memory is sufficient; the `0.1 CPU` tier is CPU-bound.
- Render decision: current latency is acceptable for low-concurrency Daily Grow validation; throughput scaling is CPU-bound, so Free-tier results must not be used as production capacity estimates.
- PetalPal in-domain v1 final evaluation completed on 100 manually annotated Daily Grow examples using frozen C-Lite INT8, existing per-label thresholds, and the backend selector: strict precision `31.82%`, acceptable precision `36.36%`, useful coverage `22.58%`, correct abstention `77.42%`, unwanted abstention `50.00%`, clearly-wrong rate `4.55%`, Primary redundancy `0.00%`, exact match `34.00%`, acceptable match `42.00%`. Current quality is not ready for unguarded production use. Details: `evaluation/petalpal-in-domain-v1-c-lite-int8-results.json`.
- Failure analysis completed for all 58 unacceptable-match cases: 51 (`87.93%`) are model-probability/false-positive failures, 4 (`6.90%`) are diagnostic threshold near-misses, and 3 (`5.17%`) involve selector/output policy. Short, negation, slang, and subtle Daily Grow language show the largest gaps; threshold tuning alone is unlikely to solve them.
- Failure details: `evaluation/petalpal-in-domain-v1-c-lite-int8-failure-analysis.md` and `.json`.
- In-domain tuning/dev v1 generation and independent review completed: exactly `2,400` accepted (`2,000` Train / `400` Dev), `25%` abstention. Final schema, label, slice, split, exact/normalized duplicate, deterministic near-duplicate, and frozen-100 leakage checks all pass. Files: `tuning-data-v1/train.jsonl`, `tuning-data-v1/dev.jsonl`; QC: `tuning-data-v1/state/final-validation-report.json` and `final-statistics.json`.
- Candidate C-Lite in-domain fine-tuning completed for 5 epochs. Epoch 4 is the locked best checkpoint with Dev 21-label macro-F1 `0.9304`.
- Frozen 100 final product evaluation completed: strict 18-label macro-F1 `0.2908`, micro-F1 `0.2880`, acceptable match `0.48`, exact expected match `0.38`, useful coverage `0.2903`, clearly-wrong emotion rate `0.0233`, and unwanted abstention rate `0.4677`. The main failure mode is over-abstention / low recall.
- Frozen over-abstention analysis: 59/100 returned no variant. The locked final report did not persist per-example probabilities or pre/post-selector candidates, so the 59 cannot be exactly apportioned without rerunning the opened set. Existing pre-fine-tune Frozen diagnostics attribute failures mainly to weak/incorrect model probabilities plus in-domain mismatch (`51/58`), with threshold near-misses (`4/58`) and selector policy (`3/58`) secondary. The fixed `0.5` cutoff amplifies low recall when in-domain scores fall below Dev levels; the selector then intentionally removes excluded, Primary-redundant, and semantic-duplicate labels. The large synthetic Dev (`0.9304`) versus human Frozen (`0.2908`) gap is strongest evidence of Train/Dev-to-product distribution mismatch, not a selector defect.
- Opened Frozen positive-score diagnostic at fixed `0.5` (distribution is min/median/max; FN is positives below threshold):

| Product label | Positive score distribution | FN | Diagnostic |
|---|---:|---:|---|
| admiration | `.015/.128/.840` | 2/3 | representation/distribution |
| amusement | `.002/.004/.014` | 9/9 | representation/distribution |
| anger | no positives | 0 | insufficient Frozen coverage |
| annoyance | `.008/.186/.670` | 2/3 | representation/distribution |
| caring | `.009/.009/.009` | 1/1 | representation/distribution |
| confusion | `.151/.466/.814` | 2/4 | mixed calibration/representation |
| curiosity | no positives | 0 | insufficient Frozen coverage |
| disappointment | `.004/.217/.645` | 8/9 | mainly representation/distribution |
| disgust | `.003/.011/.033` | 6/6 | representation/distribution |
| excitement | `.016/.263/.794` | 5/6 | mainly representation/distribution |
| fear | `.746/.780/.814` | 0/2 | no observed FN |
| gratitude | `.023/.095/.767` | 6/8 | representation/distribution |
| joy | `.001/.026/.867` | 8/9 | representation/distribution |
| love | `.006/.694/.719` | 1/3 | isolated representation miss |
| optimism | `.006/.336/.937` | 3/6 | bimodal distribution mismatch |
| remorse | `.012/.408/.940` | 2/3 | mixed calibration/representation |
| sadness | `.003/.099/.773` | 3/4 | representation/distribution |
| surprise | `.001/.017/.422` | 6/6 | mainly representation/distribution |

- Conclusion: most missed positives are far below `0.5`, so threshold calibration alone cannot explain or repair the recall gap. The dominant evidence remains representation/product-distribution mismatch; confusion and remorse contain limited near-threshold calibration cases. Anger and curiosity cannot be assessed from this Frozen set because they have no strict-positive examples.
- Train/Dev data audit: exact/normalized overlap is zero and `sourceGroupId` is split-disjoint, but lexical/template separation is weak. Dev-to-Train nearest char-ngram similarity has median `0.822`; `235/400` Dev rows are ≥`0.80`, `39/400` are ≥`0.90`, and several pairs differ only by a person/location substitution or an appended stock sentence. Repeated frames include “I really admire how…”, “I was disappointed that…”, and “The moment stayed with me…”.
- Only about `2.1–2.3%` of positive labels appear literally in the journal, so direct label-word leakage is not the main issue. However, examples are generally short (median `12` words), clean, canonical, and emotionally unambiguous compared with real Daily Grow input. Shared generation templates and near-paraphrases make Dev unusually easy and likely inflate its `0.9304` macro-F1; the large human-product gap supports this conclusion. Treat current Dev as pipeline validation, not a reliable estimate of product generalization.
- Hybrid human-majority dataset v2 completed separately at `hybrid-data-v2/`: `2,000` Train / `400` Dev, all 18 Flower Variant labels balanced at `111–112` Train and `22–23` Dev examples. Train sources: EmpatheticDialogues `1,379`, GoEmotions `531`, retained PetalPal synthetic `90`; Dev: `276`, `106`, `18`. Journals are `1–57` words in Train and `1–54` in Dev (median `15` each).
- Hybrid v2 audit: normalized duplicate overlap `0`, source-group overlap `0`; 14 Dev candidates at char-ngram similarity ≥`0.80` were rejected. Final Dev→Train nearest similarity is median `0.335`, P95 `0.563`, max `0.798`. Files: `hybrid-data-v2/train.jsonl`, `dev.jsonl`, and `audit.json`. Existing datasets and Frozen sets remain unchanged.
- Hybrid v2 ED label cleanup completed for the approved noisy examples: 4 remapped, 5 dropped, 5 clean ED-valid replacements added, and 1 retained unchanged. Dev remains `400`; label counts remain tightly balanced at `21–23`. Normalized/source-group overlap remains `0`; Dev→Train similarity remains median `0.335`, P95 `0.563`, max `0.798`. Exact changes are recorded in `hybrid-data-v2/audit.json`.
- Hybrid-data-v2 best-checkpoint Dev evaluation at threshold `0.5`: 18-label Macro P/R/F1 `0.7945 / 0.6805 / 0.7289`; Micro P/R/F1 `0.8000 / 0.6800 / 0.7351`. Per-label F1: admiration `0.7619`, amusement `0.9130`, anger `0.4865`, annoyance `0.5854`, caring `0.7805`, confusion `0.6512`, curiosity `0.7179`, disappointment `0.5143`, disgust `0.7692`, excitement `0.6842`, fear `0.8372`, gratitude `0.7805`, joy `0.7111`, love `0.8837`, optimism `0.7442`, remorse `0.9333`, sadness `0.6667`, surprise `0.7000`.
- Metric scope note: the previous training Macro-F1 `0.6248` included all 21 classifier labels; the product-relevant 18-label Macro-F1 is `0.7289` and is the appropriate Flower Variant metric.
- Hybrid V2 Clean final 18-label Dev: Macro P/R/F1 `0.8079 / 0.6942 / 0.7438`; Micro P/R/F1 `0.8105 / 0.6950 / 0.7483`. Improvement over V2: Macro-F1 `0.7289 → 0.7438`; Micro-F1 `0.7351 → 0.7483`. Best current checkpoint: `candidate-c-lite/fine-tuned-hybrid-v2-clean/best-checkpoint`.
- Hybrid-v3 human-written Train/Dev created at `hybrid-v3/`: `2,000 / 400`, using only unused EmpatheticDialogues and GoEmotions sources. Both splits are exactly `65%` single-label, `30%` two-label, and `5%` 3+-label; original qualifying Flower labels are preserved and all 18 labels are balanced (`156` each in Train, `31–32` in Dev). Source-group isolation, exact/normalized duplicate, and `<0.80` near-duplicate checks against existing Train/Dev/Test all pass; Frozen 100 was not accessed. See `hybrid-v3/audit.json`.
- Hybrid-test-v2 final evaluation completed on 360 previously untouched human-written examples, exactly 20 per Flower Variant label. Macro P/R/F1 `0.8024 / 0.6861 / 0.7319`; Micro P/R/F1 `0.7994 / 0.6861 / 0.7384`. Per-label F1: admiration `0.8649`, amusement `0.9756`, anger `0.7222`, annoyance `0.5714`, caring `0.7895`, confusion `0.7429`, curiosity `0.7692`, disappointment `0.6500`, disgust `0.7027`, excitement `0.5882`, fear `0.8718`, gratitude `0.7027`, joy `0.4737`, love `0.8780`, optimism `0.7179`, remorse `0.9189`, sadness `0.7500`, surprise `0.4848`. The set is now opened/final and prohibited from all future tuning or model selection.
- PetalPal-domain-v1 human-only Train/Dev created separately: `2,000 / 400`, using unused EmpatheticDialogues and GoEmotions groups only. Each split is exactly `62%` emotion-required, `31%` NONE-preferred, and `7%` optional; all 18 Flower labels are balanced across required cases, with single- and multi-label examples. Word counts are 4–18 with median `10`; normalized/source-group overlap with existing hybrid Train/Dev/Test and between the new splits is `0`; maximum near-duplicate similarity is `0.798` at the `0.80` rejection boundary. Files: `petalpal-domain-v1/train.jsonl`, `dev.jsonl`, and `audit.json`. Dev remains held out from Train.
- PetalPal-domain-v1 training completed with best Dev Macro-F1 `0.6097`. Hybrid Test 18-label Macro P/R/F1: `0.7826 / 0.6333 / 0.6892`; Micro P/R/F1: `0.7808 / 0.6333 / 0.6994`. Versus Hybrid V2 Clean, Macro-F1 regressed `4.27pp` and Micro-F1 regressed `3.90pp`. Short-text proxy-domain resampling does not solve the PetalPal domain gap; do not promote this checkpoint. Hybrid V2 Clean remains the current best.
- Conditional-v1 human-written Train/Dev created at `conditional-v1/`: `2,000 / 400`, balanced across the six defensibly assignable Primary Moods. It contains `1,298 / 262` Primary-only examples and `702 / 138` multi-emotion examples; Primary labels are deterministically derived from ED/GoEmotions source labels and removed from `modelLabels`. Schema, source-group isolation, exact/normalized duplicates, and `<0.80` near-duplicate checks against existing Train/Dev/Test all pass; Frozen 100 was not accessed. See `conditional-v1/audit.json`.
- Conditional V1 A/B completed on identical human-written `conditional-v1` data. Conditioned (`Primary Mood + Journal`) ran 5 epochs; best epoch `4`, Dev Macro-F1 `0.2904`, Micro-F1 `0.5704`. Journal-only control was manually stopped after epoch 3; best observed epoch `2`, Dev Macro-F1 `0.2875`, Micro-F1 `0.5703`. Primary Mood conditioning showed no meaningful improvement over the matched control; do not pursue Conditional V2/V3 using this approach. Hybrid V2 Clean remains the current best general classifier (held-out Human Test Macro-F1 `0.7319`).
- Hybrid V3 used `65%` single-label / `30%` two-label / `5%` three-or-more-label data. Best Dev Macro-F1: `0.6197`. Human Test Macro P/R/F1: `0.6517 / 0.6361 / 0.6263`; Micro P/R/F1: `0.6326 / 0.6361 / 0.6343`. Versus Hybrid V2 Clean, Macro-F1 regressed `10.56pp` and Micro-F1 regressed `10.41pp`. The current multi-label mixture degrades held-out generalization; do not promote V3. Hybrid V2 Clean remains the current best.
- V2 Clean Frozen 100 product evaluation: Macro-F1 `0.2102`, Micro-F1 `0.2720`, acceptable precision `0.5116`, useful coverage `0.3226`, correct abstention `0.7742`, unwanted abstention `0.4516`, clearly-wrong emotion rate `0.0465`, exact match `0.37`, and acceptable match `0.51`. Frozen 100 is opened diagnostic data and must not be used for further tuning or model selection.

## Current Work

- Candidate C-Lite fine-tuning and Frozen 100 final evaluation are complete; no further model-selection work is active.

## Next Steps

- V2 direction: create a new held-out final evaluation set first; use only separate Train/Dev data to improve realistic Daily Grow coverage and calibrate per-label thresholds/abstention, then verify selector behavior and perform one final evaluation on the new untouched set.
- **P1:** Build in-domain PetalPal Train/Dev data matching real product journals; preserve a new untouched Frozen-2 final set; retrain from the locked C-Lite checkpoint or base model with the same 21-label classifier → 18-label product mapping; evaluate representation shift before any threshold tuning.
- **P2:** Only after V2 training, calibrate a global or per-label threshold on Dev, then evaluate exactly once on Frozen-2.

## Do Not Redo

- Do not optimize/retrain Candidate A or MiniLM without new evidence.
- Do not repeat Candidate C export, INT8 quantization, or accuracy evaluation unless artifacts or dependencies change.
- Do not rerun the Render Free 512 MiB memory feasibility benchmark unless the model or runtime changes.
- Do not tune thresholds or selector behavior against the 100-example in-domain gold evaluation set.
- Do not train on, fine-tune on, modify, imitate, or use the frozen 100-example final evaluation set for data-generation prompts or preprocessing-rule optimization; it is final evaluation/failure-analysis only.
- Frozen 100 has now been opened and must not be used for tuning, model selection, or another future final-quality claim.
- `hybrid-test-v2/test.jsonl` is opened/final: never use it for future tuning, training, threshold calibration, preprocessing decisions, or model selection.
- Do not benchmark a higher Render tier until production traffic assumptions or latency SLOs are defined.
- Do not train BERT/DistilBERT or add legacy `moodTrainingData.json` to V2.
- Do not connect TF-IDF, MiniLM, Candidate C, or C-Lite to production yet.

## Important Constraints

- Fair comparisons use the same official GoEmotions splits, 21 labels, 5,228 test samples, thresholds, and Garden mapping.
- No Journal means no secondary ML; ML never overrides Primary Mood; output is at most two secondary emotions.
- Filter `neutral`, `approval`, and `disapproval` from flower variants.
- Tuning data must use AI-assisted synthetic generation plus independent AI review and automated validation/rejection/regeneration; provenance must identify generator/reviewer versions and the data must never be presented as human gold.
- Higher-tier CPU benchmarking remains deferred until production traffic assumptions or latency SLOs are defined.
- Use `graphify-out/graph.json` in this directory for ML navigation; keep it separate from the Product Graph.
- Model binaries, datasets, caches, generated artifacts, and Dockerfiles are intentionally outside the ML Graph's AST scope.

# ML Progress

## Current Direction

- 2026-09-07 follow-up: **old 125 Human Dev retired from further model selection** by user instruction; retain 56.06% unchanged. Active work is public authentic narrative acquisition in `v4/independent-human-v1/`. No Frozen-3; no new score yet.

- Active V4 status (2026-09-07): best **AI-annotated, source-disjoint human-text Dev Macro-F1 0.560632**, fixed original/extra-human 50:50 probability blend @0.35. Macro target0.60 not reached; no human-gold/observed-Primary production claim. See `v4/auto-v3/REPORT.md`.
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
- Phase 1 conclusion: Hybrid V2 Clean Train/Dev is `100%` single-label and remains the strongest general-emotion baseline/backbone (held-out Human Test Macro-F1 `0.7319`), but its Frozen 100 Macro-F1 `0.2102` does not validate it for PetalPal-specific secondary-emotion production. Hybrid V3 added real multi-label supervision (`65% / 30% / 5%` for one/two/three-or-more labels), scoring Human Test Macro-F1 `0.6263` and Frozen Macro-F1 `0.2379`; its slight Frozen classification gain came with substantial generalization and product-metric regressions, so V3 is archived. Public ED/GoEmotions data is sufficient for a general baseline but not the PetalPal-specific task; do not continue V4/V5 on these public datasets. The next ML phase must wait for real or deliberately human-annotated PetalPal-style journals, then create new Train/Dev/untouched Test data for domain adaptation. Frozen 100 remains opened diagnostic data only and is prohibited from further tuning or model selection.
- V2 Clean Frozen 100 product evaluation: Macro-F1 `0.2102`, Micro-F1 `0.2720`, acceptable precision `0.5116`, useful coverage `0.3226`, correct abstention `0.7742`, unwanted abstention `0.4516`, clearly-wrong emotion rate `0.0465`, exact match `0.37`, and acceptable match `0.51`. Frozen 100 is opened diagnostic data and must not be used for further tuning or model selection.
- Human-Augmented V2 training completed for 5 epochs from `candidate-c/artifacts/checkpoint` using `train-human-augmented-v2.jsonl`: original Train `2,000` + `197` eligible real-heavy augmentations = `2,197`. Best Dev Macro-F1: `0.931123`; best checkpoint: `candidate-c-lite/fine-tuned-human-augmented-v2/best-checkpoint`.
- Real-Heavy Dev 13 evaluation: old Candidate C-Lite Macro/Micro-F1 `0.1296 / 0.4444`; Human-Augmented V2 Macro/Micro-F1 `0.2085 / 0.5854`. Human-style generalization improved materially over the old Candidate C-Lite.
- Human-Augmented V2 Frozen 100 final evaluation: Macro-F1 `0.2902`, Micro-F1 `0.3101`, exact expected match `0.37`, acceptable match `0.49`, clearly-wrong emotion rate `0.0213`, unwanted abstention rate `0.4677`; output distribution: `0` emotions = `58`, `1` = `37`, `2` = `5`. The main remaining problem is recall / excessive abstention. Human-Augmented V2 is the current final candidate.
- Human-Augmented V3 training completed for 5 epochs from `candidate-c/artifacts/checkpoint` using original Train `2,000` + public-human `625` = `2,625`; original Dev `400` remained unchanged. Output: `candidate-c-lite/fine-tuned-human-augmented-v3`; best checkpoint: `candidate-c-lite/fine-tuned-human-augmented-v3/best-checkpoint`; best Dev Macro-F1: `0.9213933349`. `frozenEvaluationUsed=false`; `frozenGuardPassed=true`.
- Human-Augmented V3 old Frozen 100 diagnostic at threshold `0.5`: Macro-F1 `0.2610722611`, Micro-F1 `0.3076923077`, exact match `0.37`, acceptable match `0.48`, useful coverage `0.3387096774`, unwanted abstention `0.4193548387`, clearly-wrong emotion rate `0.0416666667`; output counts: `0=56`, `1=40`, `2=4`.
- V2/V3 experimental comparison: V2 best Dev Macro-F1 `0.9311233759`, Frozen Macro/Micro-F1 `0.2901607652 / 0.3100775194`, exact/acceptable match `0.37 / 0.49`, unwanted abstention `0.4677419`, clearly-wrong rate `0.0212766`, outputs `0=58 / 1=37 / 2=5`. V3 Dev Macro-F1 was lower; Frozen Micro-F1 was essentially flat while Macro-F1 declined. V3 reduced unwanted abstention from about `46.8%` to `41.9%`, but increased clearly-wrong rate from about `2.1%` to `4.2%`. Adding public-human data did not improve overall Frozen performance. This is an experimental observation only.
- Frozen-2 created and locked at `frozen-2/` with `100` public-human examples. Final leakage audit: PASS; exact overlap `0`, normalized overlap `0`, source-group/thread overlap `0`, Train/Dev near-duplicates at char-ngram similarity `>=0.80` `0`, internal duplicates `0`, and internal near-duplicates `0`. Status: `FROZEN_2_LOCKED`; it may be used only once for final evaluation.
- Human-Augmented V3-B trained for 5 epochs on Human-Augmented V3 Train `2,625` with learning rate `1.5e-5`. Best checkpoint: `candidate-c-lite/fine-tuned-human-augmented-v3-lr15e-6/best-checkpoint`; best Dev Macro-F1 at `0.5`: `0.915108`. Its best Dev threshold was `0.45`, with Macro-F1 `0.923793` and Micro-F1 `0.916959`. V3-B did not outperform original V3.
- Final selection was completed on Dev before Frozen-2: `candidate-c-lite/fine-tuned-human-augmented-v3/best-checkpoint` with global threshold `0.45`. Original V3 Dev at `0.45`: Macro-F1 `0.925195`, Micro-F1 `0.920561`.
- ONE-TIME FINAL Frozen-2 evaluation completed on `100` examples using original Human-Augmented V3 at threshold `0.45`. Macro P/R/F1: `0.266975 / 0.193107 / 0.196718`; Micro P/R/F1: `0.348485 / 0.252747 / 0.292994`; exact match `0.23`, acceptable match `0.23`, useful coverage `0.252747`, correct abstention `0.333333`, unwanted abstention `0.384615`, clearly-wrong emotion rate `0.0`, primary redundancy rate `0.257576`; output distribution: `0=38`, `1=58`, `2=4`.
- Frozen-2 conclusion: a large synthetic-Dev to real-human generalization gap remains. The V3 Frozen-2 result is fixed historical evidence. Frozen-2 has been opened/evaluated and cannot be reused for further selection or development.
- Frozen-2 100 human benchmark comparison used only Dev-selected thresholds chosen before any Frozen-2 results: V2 `candidate-c-lite/fine-tuned-human-augmented-v2/best-checkpoint` at `0.35`; V3 `candidate-c-lite/fine-tuned-human-augmented-v3/best-checkpoint` at `0.45`; V3-B `candidate-c-lite/fine-tuned-human-augmented-v3-lr15e-6/best-checkpoint` at `0.45`.
- V2 Frozen-2 benchmark: Macro-F1 `0.233439`, Micro-F1 `0.285714`, Micro P/R `0.311688 / 0.263736`, exact/acceptable match `0.26 / 0.26`, useful coverage `0.263736`, unwanted abstention `0.263736`, clearly-wrong rate `0.0`, primary redundancy `0.272727`; outputs `0=28 / 1=67 / 2=5`.
- V3 Frozen-2 benchmark: Macro-F1 `0.196718`, Micro-F1 `0.292994`, Micro P/R `0.348485 / 0.252747`, exact/acceptable match `0.23 / 0.23`, useful coverage `0.252747`, unwanted abstention `0.384615`, clearly-wrong rate `0.0`, primary redundancy `0.257576`; outputs `0=38 / 1=58 / 2=4`.
- V3-B Frozen-2 benchmark: Macro-F1 `0.186371`, Micro-F1 `0.269231`, Micro P/R `0.323077 / 0.230769`, exact/acceptable match `0.21 / 0.21`, useful coverage `0.230769`, unwanted abstention `0.395604`, clearly-wrong rate `0.0`, primary redundancy `0.261538`; outputs `0=39 / 1=57 / 2=4`.
- Benchmark interpretation: V2 led Macro-F1, exact/acceptable match, useful coverage, and abstention performance. V3 had slightly higher Micro-F1 and Micro Precision but abstained more. V3-B beat neither V3 nor V2, so lowering LR to `1.5e-5` did not help. Expanding V3 to `625` public-human rows did not produce the expected overall human-benchmark improvement, and the synthetic-Dev to human-benchmark generalization gap remains. Frozen-2 is no longer an untouched final holdout and is now human benchmark / diagnostic data only.

## Current Work

- Synthetic V1 is an archived biased baseline; do not use it for further tuning or model selection.
- PetalPal-domain V1 is an archived failed experiment; do not promote it.
- Conditional V1 and its matched control are archived; Primary Mood conditioning showed no meaningful gain.
- Hybrid V2 Clean is the current best general baseline/candidate backbone, not a production-validated PetalPal secondary-emotion model.
- Hybrid V3 is archived.
- Human-Augmented V3 at global threshold `0.45` was the historical selected candidate; its Frozen-2 result remains fixed historical evidence. Current V4 proxy-development results are below.
- Preserve both Human-Augmented V2 and V3 checkpoints; do not delete either.

## Next Steps

- Current: complete source-diverse development validation with independent automated adjudication before further small-Dev searching or any Frozen-3 lock. The historical pre-V4 audit prerequisite below has been completed; no user annotation/file-moving is requested.
- Any future V4 development must use Train/Dev only and requires a new untouched final holdout, such as Frozen-3, for its one final evaluation.
- Before any V4 training, audit the `625` public-human augmentation for label quality, label distribution, fixed-label mapping, and domain/task fit; do not immediately continue LR tuning or V4 training.

## Do Not Redo

- Do not optimize/retrain Candidate A or MiniLM without new evidence.
- Do not repeat Candidate C export, INT8 quantization, or accuracy evaluation unless artifacts or dependencies change.
- Do not rerun the Render Free 512 MiB memory feasibility benchmark unless the model or runtime changes.
- Do not tune thresholds or selector behavior against the 100-example in-domain gold evaluation set.
- Do not train on, fine-tune on, modify, imitate, or use the frozen 100-example final evaluation set for data-generation prompts or preprocessing-rule optimization; it is final evaluation/failure-analysis only.
- Frozen 100 has been viewed multiple times and is now diagnostic benchmark data only; it must not be used for threshold tuning, model selection, data generation, or another future final-quality claim.
- Frozen-2 has been opened/evaluated multiple times and is human benchmark / diagnostic data only. Its thresholds were selected on Dev before inspection; never use Frozen-2 for model selection, threshold tuning, training-data design, V4 tuning, training, data generation, or Train/Dev changes. A truly untouched future final evaluation requires a new Frozen-3.
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

## V4 takeover — 2026-09-07: supervision audit and development gate

This section supersedes the historical “final selected candidate” as the active development status. No new model is promoted. REAL-HUMAN source-disjoint Dev Macro-F1 >=0.60 is **not achieved or measurable with the currently verified annotations**. This is not evidence that 0.60 is impossible.

### Completed audit

- Reproducible evidence: `v4/audit.py`, `v4/audit.json`; detailed 25-item pipeline review and next-input requirements: `v4/README.md`.
- Disk V3 Train has 2,625 records and an identical original-2,000 prefix. Historical training summary contains neither input hashes nor counts, so exact historical bytes are not independently proven. New runs log both.
- 605/625 human rows retain `NEEDS_MANUAL_LABEL_REVIEW` notes despite `USER_REVIEW`/`trainingEligible=true`. Those metadata do not establish gold labels. 20 are marked manually corrected, covering only fear (4), joy (1), neutral (2), and 13 empty fixed-label sets. Source workbook is required to verify actual manual final fields. All 625 have null Primary.
- 78 rows contain customs; 21 have customs but no product label. Customs are preserved; no automatic remapping or fabricated labels introduced.
- 179 canonical Reddit threads; 18 have multiple legacy sourceGroupIds. Exact duplicates 0, normalized duplicate excess 4, lexical cosine >=.80 pairs 6, local MiniLM semantic cosine >=.85 candidates 9. Semantic candidates are conservatively grouped; equivalence review is still required before certification.
- 37 human rows share source threads with previous 197; exact/normalized overlap 0. Old Human Dev13 has only 6 canonical threads and covers 10 product labels; it is not a sufficient 18-label development benchmark. No new quality score was calculated on it.
- Strong skew: joy 206 / gratitude 119 versus curiosity 4 / admiration 6. Uniform V3 sampling gives human rows 23.81% of examples; reweighting proposed labels before verifying them is unjustified.
- `v4/gradient-diagnostic.json`: original checkpoint, zero optimizer updates, nonzero selected-head gradient norms for two sampled human rows (0.10385 and 0.83071). Human rows reach the objective; this does not prove historical gradient history or beneficial supervision.
- Historical evaluator code review only: Frozen-2 `clearlyWrong=[]` makes wrong rate zero uninformative; its redundancy denominator uses proposed primary-emotion labels rather than canonical Bloom redundancy; `or` fallback loses explicitly empty final annotations. Historical results were not changed or re-evaluated.

### Confirmed repairs and verification

- `candidate-c-lite/scripts/data_safety.py`: benchmark path guard including Frozen-2/3 and hybrid-test-v2, normalized-text and canonical-thread split checks. Filename protection is not exhaustive content provenance protection.
- `fine_tune.py`: correct sample weighting for partial gradient-accumulation groups and short final batches; sample-weighted Dev loss; all eight Primaries accepted; reject empty datasets/held-out row markers/invalid arguments; prevent experiment overwrites; log dataset sizes, SHA256s and hyperparameters.
- 28→21 named projection, float multi-hot BCE targets, tokenizer/masks, linear warmup and 21→18 product selector inspected; no confirmed mapping/selector implementation bug. Synthetic Dev checkpoint selection remains inappropriate for V4. The legacy training defaults are not a V4 release protocol.
- `v4/test_regressions.py`: 5 tests passed, including actual gradient equivalence to a combined batch, thread aliases, normalized leakage, all benchmark path guards, label mapping/metric sanity and eight Primaries.
- `v4/smoke-pipeline/smoke-result.json`: original checkpoint, one synthetic Train / one synthetic Dev example, one update; forward/backward/evaluation passed on CPU. Macro-F1 0.0 is a smoke artifact, **not Human Dev performance**. No checkpoint was saved/promoted. Hyperparameters are in the result; this did not use Human/Frozen data for selection.

### Prepared Human development work

- `v4/annotation-queue.jsonl` preserves all 625 legacy proposals/provenance separately with training eligibility false.
- `v4/prepare_review_split.py` preassigns 525 Train / 100 Dev over 174 connected source/duplicate components by SHA256 seed 42, without labels or model predictions. All hard/custom examples remain. `train-review.jsonl` / `dev-review.jsonl` are blind annotation queues, **not certified gold datasets**. `split-manifest.json` records limits and pending benchmark source-only exclusion.
- `v4/evaluate_dev.py` uses actual product selection, fixed 18-label P/R/F1/support and all requested product metrics; persists probabilities, distinguishes undefined rates from zero, and fails on missing review/product fields, certification or training-lineage approval. V2/V3/V3-B cannot be treated as unseen baselines on rows they trained on.
- Experiment `v4-baseline`: **DATA_BLOCKED, not trained, no Human metrics/threshold/checkpoint selected**. Original-checkpoint lineage audit, verified annotations, benchmark exclusion and coverage must pass first. Then select epochs on Human Dev, compare reduced synthetic influence/reliable-human weighting, and only then coarse global calibration. No repeated speculative runs on unverified gold.

### Current blocker and next action

- Original `/Users/xingranma/Desktop/ml` directory access was rejected by macOS. User supplied `experiments/emotion-classifier-v2/v4-input/`; it did not exist and was created. At latest inspection it contains no workbook. Need the source 625 workbook there to reconcile final/proposed annotations; raw workbook may reveal additional review but JSONL does not establish it.
- Even trusting 20 corrected rows, coverage is only 2/18 product labels and no observed Primaries. Need independently reviewed real journals with observed/user-selected Primary, explicit secondary/custom/abstention annotations and enough independent sources covering all 18 labels. Suggested initial Dev support is >=20 positives per label, with uncertainty reported; do not drop hard labels or infer missing labels to achieve coverage.
- No Frozen-100, Frozen-2 or Hybrid Test content was loaded. No Frozen-3 creation/evaluation. Historical checkpoints and failed experiments preserved; no production changes made.

## V4 autonomous continuation — 2026-09-07 (AI annotation authorized)

The user explicitly authorized automated labeling/adjudication and requested no manual file-moving or annotation. The prior human-review-only data gate is superseded for **AI-annotated human-text proxy development**, not for claims of human-gold or observed-Primary product validation.

- Reused all 625 source-linked PUBLIC_HUMAN excerpts already in the repo. No original journals rewritten. Original workbook still not available, but it is no longer a prerequisite to relabel raw text. No request for user data work.
- `v4/auto-v1/pass1.jsonl`: individual text-only annotation of all 625 by the current assistant, before candidate predictions; custom-only/context-missing cases preserved. `annotations.txt` is its compact reproducible record. Second pass by the same assistant (not independent review) revised four uncertain interpretations, with reasons in finalized rows. No human-gold claim.
- Repeated source-only firewall against existing opened benchmark text hashes/canonical sources. Benchmark labels/predictions/errors were not used; no Frozen-3 access. Zero overlap/quarantine. This is provenance exclusion only, not benchmark evaluation. Semantic checks against protected texts were not recomputed.
- Replaced pre-annotation 525/100 assignment once, before model inference, because its Dev omitted 4 labels. Fixed 5,000 source-component split candidates (seed42), objective only Train/Dev label coverage and proportions, selected trial4718. New locked split: **489 Train / 136 Dev**, all18 labels have >=2 positives in both splits. No hard rows dropped; all625 retained. Full support/hash/provenance details: `v4/auto-v1/manifest.json`.
- Human Dev contains 60 no-fixed-product-label cases and 49 explicitly ambiguous/context-poor cases; they remain in evaluation. Rare labels have only2 positives, so macro estimates will be noisy. This is source-linked human-written text with automated labels, not independently validated journal gold.
- Primaries are unavailable. Report both raw18 and actual JS max-two/cluster-filtered18, with Primary unset. Primary redundancy, acceptable alternatives and explicitly clearly-wrong rates are unavailable (null), not fabricated zeros. The evaluation is not directly comparable to Primary-aware Frozen results.
- `v4/auto-v1/experiment.py`: fresh original checkpoint initialization, dynamic padding/max128, named21 projection, BCE, AdamW lr1e-5/weight_decay.01, warmup10%, batch8/accum2, clip1.0, seed42, maximum3epochs; checkpoint selection by max-two selected18 Dev Macro-F1 @.5. Every epoch's probabilities/results retained. Planned comparisons: human-only, then 75%human/25%synthetic sampling with equal optimizer-step budget; only global .2/.35/.5 calibration afterward. No per-label fitting.
- `v4-baseline` COMPLETE, original candidate-c checkpoint, threshold .5: Macro P/R/F1 **.586610/.459486/.484817**, Micro P/R/F1 **.584416/.511364/.545455**; exact .595588, useful coverage .578947, correct abstention .766667, unwanted abstention .210526; outputs0/1/2=62/71/3. Raw and selected F1 equal at this threshold. This is the new **AI-annotated human Dev proxy** baseline, not Frozen.
- `v4-human-only` running locally on CPU. Human rows are489; no historical V2/V3/V3-B initialization.
- Optional original synthetic Train2000 checked against locked Human Dev using char3–5 >=.8 and MiniLM >=.85; no flagged pairs, all2000 retained for the control. `synthetic-audit.json` records exact input hash. Old synthetic Dev is never used for selection.
- Fixed an additional metadata parsing bug in `data_safety.source_key`: provenance may be a string/null; now handles dict metadata and top-level sourceUrl explicitly.

### Initialization leakage correction (before completing first adaptation)

- Located original GoEmotions training data at `/Users/xingranma/google-research/goemotions/data/train.tsv` via Candidate C README; audited text only. Normalized overlaps:3 in new Train,1 in new Dev. Even though some are generic short phrases, the strict no-duplicate policy requires exclusion.
- **Invalidated v4-baseline .484817** as not fully leakage-clean. `v4-human-only` interrupted after epoch1 (.432397); its artifacts remain, both experiments have `invalidated.json`. Neither is eligible for model selection or a success claim.
- Applying fixed whole-component exclusions for normalized exact and char3–5 cosine>=.80 matches to original pretrained-task Train, without inspecting that source's labels. Original annotation labels/splits remain frozen; corrected dataset will be a subset, not a new performance-optimized split. This late audit is recorded transparently, not hidden.

### Final data cleaning before eligible experiments: auto-v3

- Pretrained-task text audit found9 exact/lexical matches. Their complete existing source components contain29 rows; all29 are quarantined. No annotation changes or re-splitting. `initialization-lexical-audit.json` records the rule and source hash. Some matches are generic phrases, so exclusion is deliberately conservative. Full pretrained-corpus thread/semantic isolation remains unproven; only fine-tuning Train/Dev source isolation is established.
- Internal normalized audit then found3 remaining aliases: Train539→298, Dev096→084 and110→086. Merged by lowest stable ID with matching labels. No hard examples removed. The auto-v2 trial was stopped and archived with its invalidation reason; its metrics are ineligible.
- **Final auto-v3:468 Train /125 Dev**, all18 labels still have positive support. All625 originals accounted for:593 unique retained +29 provenance quarantine +3 aliases. Labels and source split assignments are unchanged from pre-inference annotation; only deterministic leakage/duplicate exclusions occurred afterward. Rare Dev support is1 for curiosity/surprise,2 for many other labels.
- `v4c-human-only` is running on this fixed version. Run data hashes and code are recorded in its experiment directory. This is the first eligible adaptation under the completed exact/lexical/within-split audit, and results will be labeled as automatically annotated human-text proxy results.

### Eligible auto-v3 baseline and early observations

- Original checkpoint @.5 on125 unique Human Dev proxy texts: Macro P/R/F1=.588462/.466629/**.474703**; Micro P/R/F1=.557143/.500000/.527027. Exact=.584, useful coverage=.567164, correct abstention=.758621, unwanted abstention=.208955, outputs0/1/2=58/64/3. All18 classes included.
- `v4c-human-only` epoch1 @.5: Macro-F1=.386833, Micro P/R/F1=.625000/.512821/.563380. Precision improved but rare-label macro recall declined; this is not a successful model. Continue the predeclared3epochs and compare mixed regularization, not relabel Dev.
- `v4c-mixed` started: same original initialization, seed, LR,3epochs and468 sampled examples per epoch; sampling mass75%human/25%synthetic. Synthetic pool2000 passed the earlier audit against the larger pre-exclusion Dev, so it also passes this subset. No old synthetic Dev selection.
- Calibration selection rule recorded in `summarize.py`: .2/.35/.5 only, maximize selected18 macro-F1 subject to micro precision no more than .05 below the original @.5 baseline. This tolerance is an engineering guard, not validated product acceptance. Source-component paired bootstrap reports uncertainty, with explicit warning that it does not correct for model selection or annotation uncertainty.
- Additional3 protocol tests passed (plus5 legacy regression tests): metadata type handling, immutable labels/splits with complete625-row accounting, source and normalized uniqueness, actual max-two selector/excluded labels, fixed18 metric scope, unavailable metrics remain null.

- Original-base coarse calibration on the same auto-v3 Dev: @.20 Macro-F1=.499426, Micro precision=.494949 (fails the predefined precision floor .507143); @.35 Macro-F1=**.526206**, Micro precision=.524390, Micro-F1=.537500; @.50 Macro-F1=.474703. Lowering threshold alone is insufficient for .60. `baseline-calibration.json` preserves full reports, no Frozen sweep.
- Host has8GB RAM and CPU-only torch. Concurrent runs slowed substantially; mixed training was paused via process suspension while human-only completes, then will resume unchanged. No paid external training or user command required.

### Human-only outcome and coarse calibration

- `v4c-human-only` completed3epochs. @.5 selected18 Macro-F1 by epoch: **.386833, .382618, .381497**. Best checkpoint epoch1; no promotion. Best epoch1 @.35=.407282; @.20=.487790 with Micro precision=.452991 (fails floor). Human-only adaptation did not beat the original pretrained checkpoint.
- Current provisional best remains original-base @.35: Macro-F1=.526206, Micro-F1=.537500. Source-component resampling is unstable due to1–2 positive examples for many labels; reported descriptive intervals are not independent final validation and omit annotation uncertainty.
- `diagnose.py` produces per-label Train/Dev support and ambiguous/custom-only error buckets without modifying labels. If mixed regularization also fails, next justified hypothesis is bounded positive-class weighting, addressing rare positives being overwhelmed by negative BCE terms; no per-label threshold search.

### Additional existing-data findings during training

- The previous “197 human augmentation” is actually111 `ADAPTED_SYNTHETIC`,54 `HUMAN_CONSENTED`,32 `PUBLIC_HUMAN` according to its own provenance. Do not report all197 as authentic human journals.
- Several HUMAN_CONSENTED A3 rows contain pasted annotation-form instructions and a list of emotion names in the journal input. This is a confirmed extraction defect; future use must extract the actual journal substring and retain the raw-text hash/removal record. Historical V2 data/checkpoints remain untouched.
- Prepared independent-of-Dev-text Train annotations for the54 consented rows in `extra_human_labels.txt`, preserving out-of-taxonomy/unspecified feelings rather than inventing fixed labels. They are not added to any current run or Dev. This potential next training-data experiment requires a separate provenance/duplicate audit first.

- Mixed best epoch3: @.35 Macro-F1=0.518964, Micro precision=.587500; @.5=.441154; @.2=.4817 with precision=.4622 (reject). It improves precision relative to original @.35 but does not reach .60 or win Macro-F1. Full exact values retained in `comparison.json`.
- `v4c-posweight` running: all else held fixed against human-only, BCE pos_weight=sqrt((N-positive)/positive), clipped[1,4], derived exclusively from Train counts. This is a new hypothesis after the two adaptation failures.
- Cleaned all54 consented existing journals; removed only known annotation-form prefixes from5 A3 records, preserving raw hashes. No exclusion required by canonical source/normalized/lexical/semantic checks against Dev and source/hash firewall against opened benchmarks. Max Dev similarity: lexical .324708, MiniLM .636690. Longest journal352 tokens;2 exceed128. `extra-human-audit.json` records everything.
- Prepared optional **auto-v4** Train-only expansion522 rows, exact same125 Dev bytes/labels/split. `experiment_expanded.py` allows max384 to retain the two long journals fully (no journal rewriting or target truncation). This is not yet an executed experiment; if positive weighting still fails, test additional authentic consented Train supervision rather than repeated threshold sweeps.

- Posweight epoch1 @.5: selected18 Macro-F1=.500097 versus raw18=.536232; epoch2 selected=.474299/raw=.496698. Class weighting helps relative to unweighted adaptation, but not yet .60.
- New bounded selector hypothesis: current broad clusters forbid distinct simultaneous emotions (e.g. gratitude/love, fear/anger), not merely duplicates. `selector-v4.mjs` is an isolated ablation preserving max2, supported/excluded labels, exact-label dedup and canonical Primary redundancy, removing only broad cluster blocking. Production selector unchanged. Native Node invariant tests passed. Compare only the posweighted best @.5 checkpoint at the same .2/.35/.5 grid, with identical labels/metrics; no per-label rules or Frozen-based changes.

### Positive weighting / selector outcomes; real Train expansion

- `v4c-posweight` completed3epochs: @.5 selected Macro-F1 .500097/.474299/.485353; epoch1 retained. Its selected Micro precision=.477477, below the predefined .507143 floor, so reject promotion despite higher macro than unweighted adaptation. Coarse lower thresholds worsen precision further.
- Selector ablation on that exact epoch1 checkpoint: removing broad clusters @.5 raises Macro-F1 to **.540577**, but Micro precision falls to **.459016**; outputs0/1/2=31/66/28. @.35/.2 also fail precision. **Rejected**. No production selector changes. This is not a .60 success and not a justification to emit more emotions indiscriminately.
- `v4d-extra-human` started on auto-v4:522 Train (468 existing +54 consented, reannotated and extraction-repaired), same125 Dev byte-for-byte. Unweighted BCE, original checkpoint, lr1e-5, seed42,3epochs, batch8/accum2; max384 only to preserve all long journals (longest352 tokens). Compared with human-only, this tests additional genuine-source Train supervision rather than changing Dev labels. Step count increases with dataset size; not a strict equal-compute ablation.
- Current accepted proxy best remains original checkpoint @.35, selected18 Macro-F1 .526206. All four training hypotheses and selector/calibration failures remain recorded. No Frozen quality evaluation or model selection.

- Added one fixed sparse baseline because four neural adaptation objectives/data settings regressed on the new small dataset: `v4e-sparse`, Train468, word1–2 + char3–5 TF-IDF, min_df2, balanced OVR logistic C1/seed42, vocabulary fit on Train only. This new supervision/task and repeated neural regression are the new evidence justifying the otherwise archived Candidate-A family check. No parameter grid, no old Test access.
- Sparse results @.2/.35/.5 Macro-F1=.156334/.182155/**.220914**; @.5 Micro precision=.674419 and Micro-F1=.479339. Reject: high precision but severe under-recall. A lexical classifier does not solve this source-disjoint Dev.

### Final result of this autonomous iteration

- `v4d-extra-human` completed3epochs; @.5 Macro-F1: 0.388662, 0.405688, 0.400397. Best epoch2. Its @.2 Macro-F1=.568711 but Micro precision=.487179 failed the preset precision floor, so that high-macro setting was rejected.
- One fixed50/50 probability blend was tested after the precision/recall tradeoff appeared: original checkpoint + extra-human best epoch2, no mixing-weight sweep. Same .2/.35/.5 grid and unchanged existing selector.
- **Best eligible: `v4f-fixed-blend` @`0.35`, Macro P/R/F1 **0.654401/0.591037/0.560632**; Micro P/R/F1 **0.590361/0.628205/0.608696**.
- On identical125 Dev texts, Macro-F1 changed from original @.5 0.474703 to 0.560632 (+8.59 percentage points). **Macro target0.60 remains unmet. Micro-F1>0.60 and exact match0.60 do not satisfy that target.**
- Best product-proxy metrics: exact=0.600000, useful coverage=0.716418, correct abstention=0.706897, unwanted abstention=0.134328; outputs={'0': 50, '1': 67, '2': 8}. Acceptable/wrong-emotion annotations and real Primary redundancy remain unavailable/null.
- `predict_ensemble.py` implemented local inference from saved checkpoints, lengths128/384, threshold.35, existing selector. Recomputed all125 Dev probabilities: max difference=4.17232513e-07, selected outputs identical. Empty-journal abstention, supplied Primary preservation/redundancy and max2 outputs passed. Two model inferences are required; no deployment/resource certification or production integration.
- Final complete evidence: `v4/auto-v3/REPORT.md`, `comparison.json`, `diagnostics.json`, `runtime-verification.json`, all per-epoch metrics/probabilities/checkpoints. Nine Python regression/protocol tests and native selector invariant assertions passed. Earlier interrupted/invalidated experiments remain archived.
- Main limits: only35 Dev source components; curiosity/surprise each1 positive and many labels2; AI annotation has no independent human agreement measurement; excerpts often lack context; no observed user Primary. Four neural adaptation runs, one fixed sparse baseline, one selector ablation and one fixed blend do not establish reliable .60. This is not proof that .60 is impossible.
- Stop expanding the current small-Dev search after these bounded hypotheses. Next useful development prerequisite is a separate source-disjoint validation cohort with independent automated adjudication, broader rare-label support and preserved context/Primary metadata where available. Do not fabricate these missing observations or relabel Dev to improve scores. No user data work or long-training command is required for the runs completed here.
- Frozen-2 was used only by a source/hash exclusion firewall, never for labels, errors, threshold tuning, metrics or model selection. Frozen-3 remains untouched and V4 is not locked for final evaluation.


### Independent human-written cohort acquisition (2026-09-07, ongoing)

- Preserved `v4f-fixed-blend` and old Dev bytes/results. Added a hash-based refusal in the V4 trainer to prevent new selection on the retired125 Dev.
- Verified original publisher sources and downloaded HappyDB raw101,094 records, Dreaddit3,553 segments, and CoSoWELL v1 token-level archive. Raw files have SHA-256 acquisition records; initial Python TLS failures were resolved using certificate-verifying system curl, not disabling HTTPS verification.
- Preferred CoSoWELL `yesterday`:1,994 original narratives /1,178 authors. Its prompt asks about yesterday's personal event without prescribing emotion. Excluded future imagination and picture descriptions. Original full narrative field preserved byte-for-byte as text.
- Label-blind selection:20–400 words, first-person reference, one narrative per author by deterministic ID hash, author-hash70/30 split. Historical/init normalized firewall and lexical>=.8 exclusion produce candidate769 Train /370 Dev. Semantic audit running; counts may decrease only for predeclared duplicate/quality rules. No labels or student predictions used for selection.
- HappyDB happy-only prompt, Dreaddit stress selection/fragmentation/missing author IDs, Korean ToM restricted full data, and historical ED/GoEmotions are not promoted as new reliable Dev. Source decisions and limitations in `v4/independent-human-v1/SOURCES.md`.
- CoSoWELL is older North-American adults, mostly pandemic-era, not representative of all PetalPal users. Dataset commercial terms unconfirmed: v1 OSF points to a missing license.txt; article license is not treated as dataset permission. No deployment/distribution.
- Remaining: finish semantic exclusion, automatic text-only annotation/adjudication and quality audit, report actual18-label support without emotion quota sampling, then establish fixed56.06%-candidate baseline on new cohort before new training. No new F1 claimed.

### CoSoWELL interruption recovery checkpoint

- Completed semantic audit:769 candidate Train /368 candidate Dev; excluded2 Dev semantic near-duplicates. Do not rerun acquisition or audits.
- Completed all370 candidate-Dev text-only annotations and same-assistant adjudication, excluding1 copied grammar-instruction record. Locked367 Dev /367 authors, SHA256 `952394ce159c40c585ac70c65a2cff8374ddb4b6abd3a7eaa0158584c80a8f8b`;108 empty-label rows. No independent annotator agreement or human-gold claim. Disgust support0; confusion3, curiosity2, remorse3. Keep all18 metric labels.
- Fixed archived V4f baseline completed on new367: Macro P/R/F1=.420834/.225408/.253547; Micro P/R/F1=.597222/.353425/.444062. No new threshold sweep. Old125 score56.06% unchanged. Evidence `independent-human-v1/baseline-fixed-v4f/metrics.json`. Do not rerun.
- Before seeing baseline, selected320 candidate Train authors by deterministic hash:64 internal calibration /256 Train,2epochs lr5e-6 from original checkpoint, initial fixed50/50 blend and .35; checkpoint selected by internal calibration loss, not367 Dev. Pilot annotations now240/320. One copied Beatles article at pilot index182 excluded; full raw preserved. Next: annotate pilot indices240–319, finalize data, run prespecified adaptation.

### CoSoWELL pilot data locked and training started (2026-09-07)

- Finished320/320 pilot text-only AI annotations; no independent annotator/gold claim. One copied article excluded. Final777 Train (522 existing +255 new) /64 internal calibration. Author, canonical-source and normalized-text disjointness passed against367 Dev and between Train/calibration. Raw text retained. Manifest `independent-human-v1/pilot-data/manifest.json`.
- Prespecified2epochs lr5e-6 from original Candidate C, seed42, effective batch16; select minimum calibration BCE21 including epoch0. Fixed50/50 original/adapted blend, .35 threshold. New branch maxLength512 (model capacity), batch2 for CPU memory; original blend branch remains128. Training script does not load external Dev. All longer-text truncation counts will be recorded from Train/calibration only.
- Running `independent-human-v1/train_pilot.py`; log `pilot-training.log`; output `pilot-experiment/`. Resume by inspecting log and summary; do not launch a duplicate or rerun completed data work. Next: finish training, lock checkpoint, evaluate fixed blend once on locked367 Dev. Old125 remains retired; no Frozen tuning or Frozen-3 creation.
- Pilot Train/calibration tokenizer audit complete: maximum447/496 tokens; zero rows truncated at512. At128,155/777 Train and38/64 calibration rows would truncate. Three new regression checks passed: sealed hashes/verbatim source text, source-collision rejection, and actual selector/all18-label metric contract. Scoped graph update completed; no model deployment.
- Fixed-baseline author-bootstrap95% interval [0.203830,0.290191],2000 draws seed42, saved from existing predictions (no inference rerun). Conditional on source/fixed AI labels; does not include annotation error or population shift.
- Before pilot external-validation inference, added a bounded internal-only calibration follow-up: fixed ensemble weights; global threshold grid [.15,.20,.25,.30,.35,.40,.45,.50];5 author-hash folds, select macro18 F1 with Micro-P>=.5 on other4 folds, tie higher threshold, fallback.35; final threshold median of5 choices. Report fixed.35 and internally selected threshold together using one saved external probability matrix. No external score participates. Threshold OOF is not independent full-pipeline validation because checkpoint loss uses the same64. Script `calibrate_pilot.py`.

### CoSoWELL pilot calibration and external validation COMPLETE (2026-09-07)

- Supersedes previous training-running status: training COMPLETE, epoch2 selected by internal BCE 0.10238249530084431; no training restarted.
- Internal calibration executed once: fold thresholds [.25,.25,.25,.30,.25], median 0.25. Threshold-only OOF Macro-F1=0.3490840949, Micro-P=0.6785714286; not an independent pipeline estimate because checkpoint selection used these64 authors.
- External367 validation executed once with sealed checkpoint hashes and one shared saved probability matrix. Fixed .35: Macro-F1=0.2553028551; Micro-P/R/F1=0.6094420601/0.3890410959/0.4749163880. Internal-selected .25: Macro-F1=0.2771175962; Micro-P/R/F1=0.5493421053/0.4575342466/0.4992526158.
- Compared with saved same-cohort baseline Macro-F1 .2535470549, descriptive changes are +.0017558002 (fixed) and +.0235705413 (calibrated); no statistical improvement claim. Macro-F1 .60 remains unmet. All18 labels retained, including absent disgust. References remain same-assistant AI labels, not independent human gold; same-source author holdout, not new-domain validation.
- Evidence: `v4/independent-human-v1/pilot-experiment/calibration/summary.json`, `external-validation/protocol.json`, `metrics.json`, `calibrated-metrics.json`, `probabilities.npy`. Do not rerun calibration/evaluation. Old125, Frozen sets and production unchanged.
- Next single step: use saved internal calibration grid metrics/probabilities and locked Train/calibration label support to write one bounded optimization hypothesis/protocol. No external-Dev error mining or threshold/checkpoint selection; no new source search, annotations, training, or evaluation needed for that diagnostic step.

### Frozen-head-v1 internal optimization COMPLETE (2026-09-07)

- New user acceptance criterion explicitly requires independent **human-labeled** external validation Macro-F1>=.60. CoSoWELL367 is AI-labeled and does not qualify; its .2771175962 is not human-gold performance.
- Internal-only diagnosis: calibration lacks curiosity/disgust/excitement/remorse; anger/confusion/disappointment/surprise each have one positive. Train minority support is small (curiosity6, remorse9, admiration12). No external errors/labels loaded in this round.
- One new bounded round `independent-human-v1/frozen-head-v1`: reused epoch2 pilot encoder, cached777 Train/64 calibration CLS features at512; trained only existing RoBERTa head20epochs, AdamW lr1e-4 weightDecay.1, Train-derived sqrt negative/positive weights clipped[1,4]. Four prespecified checkpoint comparisons (0/5/10/20), fixed.25 macro18 with Micro-P>=.5, selected epoch20. No baseline, existing annotation, prior inference or full-model training repeated.
- Internal fixed.25 Macro-F1 epoch0=.3639206938, epoch20=.3786503620; Micro-P/R=.5212765957/.7000000000. Epoch5/10 failed precision floor. Global author-fold calibration selected.30; threshold-only OOF Macro-F1=.3433336453, Micro-P=.5555555556, below pilot .3490840949/.6785714286. **Not promoted; no external evaluation.** These are selection-biased internal diagnostics, not independent evidence of improvement.
- Runtime71.16 seconds, process exited0. Head serialization/full-model compatibility verified on one internal row: maximum probability difference1.1920929e-7 (<1e-5). Saved config, weights, diagnostics, features, per-epoch probabilities/metrics, selected head, calibration, summary, verification and decision. No production changes; no Graphify needed.
- New source research (not repetition): acquired EduAffect version2 once. Human single-dominant labels, not exhaustive multilabel; no author fields, English/Twi preprocessing. Actual CSV2422 rows; paper2423. Release license differs from paper. Quarantined ZIP and source/acceptance decision saved in `human-validation-research/DECISION.md`; no admission, relabeling, inference or score-based filtering.
- Next priority is the missing independent human multilabel reference under existing18-product-label/0–2-output semantics and author/source isolation. Do not silently replace it with AI annotations, single-label evaluation or fewer labels. Further threshold searching on64 labels is not a substitute. No annotation job purchased or messages sent.

> Historical first-audit snapshot. The user subsequently authorized automated annotation. Current executed experiments and measured results are in `auto-v3/REPORT.md`; the workbook/manual-review prerequisite below no longer blocks automated proxy development.

# V4 development status — 2026-09-07

**No valid V4 Human Dev score exists yet. The 0.60 target is not achieved.**
This audit does not establish that 0.60 is impossible. It establishes that the available converted annotations cannot currently measure it credibly.

## Evidence

`audit.json` is reproducible from development JSONL only with `../../..` repository `.venv/bin/python` running `v4/audit.py`. It includes input SHA256s, label frequencies, cardinality, co-occurrence, canonical source concentration, lexical duplicates, semantic candidates and overlap with the prior 197 and 13 examples.

- V3 input really contains 2,625 rows: the first 2,000 are identical to original Train, followed by 625 PUBLIC_HUMAN records. The historical summary does not save the input hash or row count, so the exact historical file bytes cannot be independently reconstructed from that summary.
- 605/625 have `NEEDS_MANUAL_LABEL_REVIEW` in their original-status notes while conversion assigns `USER_REVIEW` and `trainingEligible=true`. These are unverified proposals, not proven human gold. Model-generated origin is not individually recoverable without the source workbook/converter.
- Only 20 are marked manually corrected. They cover fear (4), joy (1), neutral (2), and 13 empty fixed-label sets. They have no observed Primary. Even if the status is trusted, these cannot validate the 18-label secondary task. Raw source verification remains pending.
- 78 custom-emotion rows, including 21 with no product fixed label. Preserve customs. Do not turn unknown/missing labels into all-negative supervision. Explicitly reviewed custom-only abstention can be a valid negative later.
- 179 canonical Reddit threads, 18 threads with inconsistent legacy group IDs, 4 normalized duplicate excess rows, 6 lexical pairs at cosine >=0.80, and 9 MiniLM semantic candidates >=0.85. Semantic similarity is a retrieval screen, not a guarantee of meaning equivalence.
- 37 rows share threads with previous 197. No exact/normalized journal overlap with those 197; no canonical-source overlap with the old 13 Dev in this comparison.
- Labels are imbalanced: joy 206, gratitude 119, curiosity 4, admiration 6. Balancing these unverified labels would amplify uncertain supervision.
- Only 23.81% of uniformly shuffled V3 rows are human. `gradient-diagnostic.json` checks nonzero human loss/head gradients without updating weights. Nonzero gradients do not mean beneficial supervision.

## Confirmed code repairs

Shared `data_safety.py` rejects Frozen paths (including Frozen-2/3), evaluation folders and hybrid-test-v2; resolves symlinks; normalizes NFKC/case/punctuation; canonicalizes Reddit thread URLs; rejects cross-split normalized text, sourceGroupId and canonical-source collisions. Renamed/copied benchmark files are not fully preventable without provenance manifests; do not interpret filename guards as exhaustive leakage certification.

`fine_tune.py` now rejects held-out row markers, empty datasets and nonpositive run arguments; accepts all eight canonical Primaries; checks Train/Dev overlap; refuses overwriting nonempty experiment directories; logs input hashes, sizes and hyperparameters. Gradient accumulation weights a partial update by actual example count, including a short last batch. Dev loss is also example-weighted. All historical outputs are preserved. These repairs are not claimed to explain the domain gap.

## Pipeline audit

| Item | Finding |
|---|---|
| 28→21 / label order | Resolved by checkpoint id2label names. Historical positions match selected canonical labels; no positional-offset bug found. |
| BCE / targets | Float multi-hot, sigmoid inference, BCEWithLogitsLoss on selected logits: consistent. Unreviewed negatives/custom-only labels remain a supervision concern. |
| Tokenizer / padding / truncation | Local checkpoint tokenizer; Train max padding 128, eval dynamic padding with same 128 cap. Padding has attention masks. Long texts may truncate; dataset suitability must be reassessed after gold conversion. |
| Loader / gradients | Shuffled full dataset, no human-specific exclusion. Human gradients checked separately; historical gradients were not saved. |
| Optimizer / warmup | AdamW; linear schedule, ceil update count. Partial accumulation scaling fixed; no clipping in legacy trainer. |
| Selection / stopping | Legacy 21-label F1 at .5; patience 2, up to 5 epochs. Synthetic Dev is unsuitable for V4 model selection. Do not use the legacy default as V4 training policy. |
| Threshold | Sigmoid >= threshold; old sweeper reports all 21 labels, not product-selected 18. No Frozen sweep performed. |
| 21→18 / selector | Actual JS selector filters excluded labels, canonical Primary redundancy, duplicate semantic clusters, and caps output at two. No confirmed selector code bug. |
| Primary / objective | All 625 Primaries null, so general-emotion proposed labels cannot establish Primary-aware secondary targets. Prior conditioning experiment already failed; no new conditioning run justified. |
| Abstention | Zero retained candidates means abstention. Unknown annotations must not be inferred as preference for no output. |
| Metrics | Historical Frozen-2 reader supplies empty clearlyWrong/acceptable lists: reported wrong rate 0 is structurally uninformative. It also defines redundancy using proposed primary emotion rather than canonical Bloom redundancy and uses `or` fallback that loses an explicitly empty final list. Historical results remain unchanged; do not optimize against them. |
| Conversion / gold | USER_MARKED_ELIGIBLE is not gold review. Source workbook required to verify final-vs-proposed field handling; original converter not found in inspected paths. |
| Leakage / source split | Canonical thread identity is necessary; legacy sourceGroupId alone misses aliases. New component assignment also unions near-duplicate candidates. Benchmark source-only exclusion certification remains pending. |
| Imbalance / weighting | Human 23.81% uniformly sampled, no class/sample weights. Label reliability must precede reweighting. |
| Initialization / V3 lineage | Summary says original candidate-c checkpoint. Input on disk is 2,625; historical summary lacks hashes/counts. V3 has already trained on all 625, so it cannot be evaluated on their new split as an unseen baseline. |

## Prepared artifacts and baseline gate

`prepare_review_split.py` creates **annotation assignments**, not training-ready gold: 525 Train / 100 Dev across 174 connected source/duplicate components. SHA256 seed 42 assigns 20% of components to Dev without label or prediction inspection. All 625 records remain present, including difficult and custom-only examples. This is an annotation starting point, not a guaranteed representative/covered benchmark. Review coverage may require additional independently sourced journals rather than dropping hard/rare cases.

`train-review.jsonl` and `dev-review.jsonl` hide legacy fixed/custom predictions to support blind review. `annotation-queue.jsonl` preserves old proposals and provenance separately. No rows are certified training-eligible. Dev annotations must be independent of model predictions, include observed/user-selected Primary, strict secondary labels, acceptable alternatives, explicit wrong-label judgment, abstention preference, output bounds, custom emotions and reviewer identity. Public text with a reviewer-supplied hypothetical Primary must be marked as a proxy and cannot silently become real user Primary gold.

`evaluate_dev.py` is prepared for certified Human Dev only. It refuses pending review, missing product fields, stale/missing certification, and checkpoints without approved training lineage. It measures fixed 18-label P/R/F1/support, exact/acceptable match, coverage, abstention, wrong-emotion rate, redundancy and output counts through the actual selector. Undefined denominators return null. Per-example probabilities are retained for permitted Dev diagnostics. Importing the legacy inference helpers opens no Frozen files.

Baseline **v4-baseline** is data-blocked, not run: after verified annotations and source-only benchmark exclusion, audit original checkpoint lineage, train anew with Human Dev selection. Do not initialize from V2/V3/V3-B or claim unexposed evaluation on rows they saw. Subsequent hypotheses, only after a trustworthy baseline: lower synthetic influence / reliable-human oversampling, then coarse global threshold calibration, with a fixed trial budget and all results retained. Per-label thresholds are unjustified at current support.

## Required next input

The user supplied `experiments/emotion-classifier-v2/v4-input/`; it did not exist initially and was created. It remains empty at the latest check. Original `/Users/xingranma/Desktop/ml` listing was denied by macOS. Put the original 625 workbook in `v4-input/` to reconcile actual final labels against converted proposals. This may recover annotations, but does not guarantee enough gold: converted evidence currently supports only 20 status-marked reviews and two positive product labels. Need independently reviewed source-disjoint journals spanning all 18 labels plus no-secondary cases; aim for at least 20 positive Dev examples per label as a practical initial precision target, report uncertainty, and expand rare classes through new sources rather than relabeling the benchmark. No evidence yet establishes a reliable numerical performance ceiling.

Frozen-100, Frozen-2 and Hybrid Test were not loaded. Frozen-3 was neither created nor evaluated. Do not run an expensive V4 training until the data gate passes.

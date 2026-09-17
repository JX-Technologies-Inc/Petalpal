# Stage 1 model adjudication v1 — first phase

Human Stage 1 judgments are FROZEN HUMAN OBSERVATIONAL EVIDENCE. No further human
annotation, calibration, re-review, or manual adjudication is planned. The previous
targeted human re-review plan is superseded by the 2026-09-14 user instruction.
Stage 2/3 are deprecated; evidence, rank_order, tie_group are legacy unused fields.

## Completed scope

The queue was constructed from existing validated Astra audit artifacts and exact-hash
repository snapshots: 1,130 Core disagreements, four Core1 missing cells and 684
no-valid-Core2 cells, totaling 1,818 cells over 220 samples. The other 2,160 cells
are registered as CORE_HUMAN_AGREEMENT and are outside the primary model queue.
These counts validate queue construction; the old human agreement audit was not rerun.

Astra is one model-judge run (gpt-6-astra), continued across execution contexts and
checkpoints. The original 186 judgments were preserved. Recovery found 585 valid rows;
82 further rows reached disk before the explicit configuration correction, leaving
667 preserved rows at the transition. The remaining 1,151 cells were judged with
Extremely High (xhigh), yielding 1,818 complete rows. Prior reasoning levels are not
independently instrumented and are not retroactively called xhigh. This recovery
added 1,233 judgments in total. The latest cross-account continuation recovered 918
valid rows and added only its 900 missing IDs; the account change was operational,
with the same Astra judge and xhigh configuration. There is no extra model panelist.
The exact identifier gpt-6-astra is supported by the recorded runtime agent dispatch,
not inferred from a display name or account. See account-continuation-checkpoint.json.

The execution contexts used only blind semantic input/guidance and existing Astra
checkpoints. Inputs, original/checkpoint prefixes and final judgments are hash-locked.
Human/Luna comparison began after Astra completion and sealing; no judgment was
revised after that join. This is workflow isolation with execution attestations, not
an OS access-control sandbox or an independence claim about model pretraining.
Confidence is subjective certainty, not a calibrated probability.

model-judge-blind-input.csv and luna-judge-input.csv are byte-identical. Both judges
use model-stage1-guidance-v1.md, the original unchanged definition strings, and the
same per-label semantic guidance. Model guidance is user-authorized model workflow
guidance derived from Sol's diagnosis; it is not a human-approved definition revision.
The existing Luna artifact was already complete (1,818/1,818), was not regenerated,
and is byte-preserved. Exact Luna identity/configuration are recorded only when
supported by its existing completion metadata; otherwise they remain unverified.
Queue membership itself is selected; no case_type, human
answer/count, priority, Astra answer, or final category appears in Luna's input.

## Frozen human evidence and comparison

Core1's four blanks remain CORE1_HUMAN_MISSING. Core2's R3-184..R3-221 remains
CORE2_INVALID_PLACEHOLDER; values are masked before use, never treated as NO,
human missing, or judgments. Comparison match fields are blank when unavailable.

Core reviewers remain anchors and Auxiliary reviewers remain supporting evidence.
auxiliary-frozen-evidence.csv preserves each queued cell's individual Auxiliary
values. Current primary supporting summaries use AUX-R01..R05 and AUX-R07.
The latest user instruction designates both R06 and R08 as separate sensitivity
evidence. R06's earlier audit flag was INCOMPLETE_COVERAGE; no new distribution or
reviewer-quality audit is claimed. Missing values remain missing. The pre-existing
master's normal-count columns include R06; those unchanged columns and their legacy
comparison are explicitly marked sensitivity-only. Primary summary columns exclude
both R06 and R08. Individual pairwise reports identify every Auxiliary reviewer.

A primary Auxiliary consensus in model-human-comparison.csv denotes only a unique
strict majority (>50%) of valid primary supporting reviewers; no strict majority is MIXED.
Strong support retains Sol's at-least-80%-of-at-least-five rule. Neither summary
creates a final label, equal-status Core vote, or automatic override.

## Provenance and boundaries

Current model outputs use ASTRA_INDEPENDENT_BLIND_MODEL_JUDGMENT. The reserved
MODEL_ADJUDICATED_CORE_DISAGREEMENT, MODEL_ADJUDICATED_CORE1_MISSING, and
MODEL_ADJUDICATED_NO_VALID_CORE2 categories are defined only for later final
adjudication; no such final assignment is made now. These outputs are not human
gold, human-adjudicated labels, or human consensus. Final reference set is NOT
ALLOWED: Sol final adjudication and the final provenance freeze remain outstanding.
Both model judgments and their descriptive panel/human comparisons are complete.
This diagnostic is not product evaluation.

Texts are unchanged from the previously audited repository snapshots. This task
does not independently resolve the historical UI quote-rendering concern. No desktop
raw CSVs or protected row-level holdouts were reread. No training, external paid API,
dataset/label rewrite, old artifact modification, commit, or push was performed.

## Files and reproducibility

- protocol.json and queue-summary.json: policy, execution state and derived queue counts.
- model-adjudication-input.csv: non-blind master; never feed to either blind judge.
- model-judge-blind-input.csv / luna-judge-input.csv: identical semantic inputs.
- model-stage1-guidance-v1.md: shared applicability anchors and finite reason codes.
- astra-judgments.csv and astra-judgments-lock.json: completed, sealed independent vote.
- model-human-comparison.csv / comparison-summary.json: post-blind descriptive join.
- auxiliary-frozen-evidence.csv: individual supporting/sensitivity judgments.
- core-human-agreement-registry.csv: preserved nonqueued Core agreements.
- source-manifest.json / blind-input-lock.json: source and semantic input hashes.
- validation.json / progress-append-audit.json: final checks and append-only verification.
- build_queue.py: deterministic queue preparation, refusing an already-built queue.
- finish_comparison.py: existing seal/join extended for the completed Luna artifact;
  refuses an existing seal/comparison and appends progress only after validation.
- panel_comparison.py: post-lock pairwise/model-panel and R06/R08 sensitivity outputs.
- astra-configuration-transition.json / astra-judgment-provenance.csv: actual configuration segments.
- model-panel-provenance.json: model identity evidence and its limits.
- model-model-*.csv: panel pairs, disagreement rows, matrix, transitions and per-label counts.
- model-human-pairwise-summary.csv / auxiliary-sensitivity-summary.csv: separate comparators.
- verify.py: verification of this workflow's outputs; no old human audit rerun.

Next step: Sol reviews the completed panel and frozen human evidence for separately
authorized final adjudication/provenance freeze. No final resolution or automatic
follow-up was started here.

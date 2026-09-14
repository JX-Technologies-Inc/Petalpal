# Human Review 221 — Stage 1 Core/Auxiliary Audit

Stage 1 applicability only. Categories: NO, PLAUSIBLE, CLEAR. Stage 2 and Stage 3 are DEPRECATED; evidence, rank_order and tie_group are legacy unused fields. The current user protocol supersedes the old bundle instructions about future stages and AUX-R08 exclusion.

## Inputs and validity

Only the two explicitly supplied desktop clean Core CSVs and eight independent Auxiliary CSVs were read as ratings. The user supplied an unpacked directory instead of the initially named ZIP. Exact byte snapshots and SHA-256 hashes are in `input/` and `input-audit.json`. The redundant combined long CSV was not used. The initial operating-system access failure is preserved in `access-history/`; access is now resolved.

Both Core files contain 221 samples, 18 labels/sample, 3,978 rows, no duplicate keys or illegal valid-range applicability values. All ten files have matching sample texts and label definitions on shared keys. This checks the supplied clean exports, not historical UI rendering or canonical raw-text provenance; the earlier quote-rendering issue is not declared resolved by this check.

Reviewer 1 has four unchanged missing judgments: R3-087/fear; R3-163/surprise; R3-168/admiration; R3-168/amusement. Reviewer 2 is valid ONLY for R3-001..R3-183. All 684 positions in R3-184..R3-221 are permanently INVALID/EXCLUDED export placeholders, regardless of whether their CSV value is blank. Their applicability values never enter judgment QA, marginals, comparisons, support counts, or conclusions. Structural sample/text checks do not treat these positions as ratings.

## Core descriptive results

Effective overlap: **3290** judgments from 183 samples. Exact agreement: **2160/3290 (65.653495%)**. Unweighted three-category Cohen's kappa: **0.233754933**. Total disagreements: **1130**, comprising **337 severe** NO/CLEAR and **793 adjacent** disagreements. PLAUSIBLE remains a separate category.

Highest disagreement rates: optimism 113/183 (61.75%), excitement 112/183 (61.20%), surprise 94/182 (51.65%), joy 91/183 (49.73%), gratitude 79/183 (43.17%).

Highest-disagreement samples, ordered by rate then count: R3-022 12/18, R3-093 12/18, R3-127 12/18, R3-016 11/18, R3-100 11/18, R3-124 11/18, R3-063 10/18, R3-076 10/18, R3-081 10/18, R3-085 10/18. These are diagnostic cases, not deletion or adjudication targets.

## Auxiliary QC

| Reviewer | Valid coverage | Missing | NO | PLAUSIBLE | CLEAR | QC flag |
|---|---:|---:|---:|---:|---:|---|
| AUX-R01 | 3978/3978 | 0 | 3726 | 69 | 183 | NONE |
| AUX-R02 | 3978/3978 | 0 | 3474 | 154 | 350 | NONE |
| AUX-R03 | 3978/3978 | 0 | 3731 | 44 | 203 | NONE |
| AUX-R04 | 3978/3978 | 0 | 3383 | 207 | 388 | NONE |
| AUX-R05 | 3978/3978 | 0 | 3345 | 379 | 254 | NONE |
| AUX-R06 | 3942/3978 | 36 | 2946 | 521 | 475 | INCOMPLETE_COVERAGE |
| AUX-R07 | 3978/3978 | 0 | 3477 | 257 | 244 | NONE |
| AUX-R08 | 3978/3978 | 0 | 1 | 1719 | 2258 | EXTREME_DISTRIBUTION |

Coverage uses 3,978 expected keys; category rates use each reviewer's valid nonblank judgments. INCOMPLETE_COVERAGE means any missing judgment. EXTREME_DISTRIBUTION is a descriptive screen (NO rate below 1% or one category at least 99%), not proof of reviewer invalidity. No Auxiliary reviewer was removed or weighted. All eight receive separate Core comparisons. Per-opportunity support counts include all available valid Auxiliary ratings and identify flagged contributions separately without choosing a winning category.

Auxiliary vs Reviewer 1 uses its actual nonblank overlap across all 221 samples; vs Reviewer 2 always uses only R3-001..183. Different populations and class prevalence prevent direct ranking of reviewers from these raw agreement/kappa values. Cohen's kappa is sensitive to class marginals; high raw agreement is not evidence of gold accuracy. Uncertainty intervals and inferential group comparisons were not requested or computed.

## Boundaries and artifacts

NO GOLD LABELS CREATED. NO MAJORITY-VOTE ADJUDICATION. NO AUTOMATIC CORE OVERRIDE. STAGE 2 / STAGE 3 DEPRECATED. ADJUDICATION NOT PERFORMED IN THIS TASK.

The sample is disagreement-enriched and Reviewer 2 coverage is partial, so these descriptive statistics are not an unbiased estimate for the full 841-row Train, a population reliability claim, or model evaluation. Reviewer QC flags neither authorize exclusion/downweighting nor identify correctness. Missing values remain missing. No protected cohort, model predictions, training, taxonomy edit, commit, or push was used.

`core-confusion-matrix.csv` has Reviewer 1 rows and Reviewer 2 columns. `core-label-agreement.csv`, `core-sample-agreement.csv`, and `core-disagreements.csv` expose exact denominators and cases. `auxiliary-reviewer-qc.csv`, `auxiliary-core-agreement.csv`, and `core-disagreement-aux-support.csv` preserve reviewer hierarchy. The latter includes individual Auxiliary values to make counts auditable; no consensus field is created. JSON null / blank metric means undefined, never zero imputation.

Reproduction: run `analyze.py` with the bundled Python runtime on these exact input snapshots/originals; it refuses to overwrite a completed artifact. `verify.py` independently verifies source masks, metrics and saved outputs before completion. No original rating file is modified. ML Lead / Sol decides Stage 1 adjudication methodology next; this task does not start it.

Completion: independent artifact verification PASS. Canonical ML_PROGRESS.md was appended; its previous bytes were preserved exactly. See `validation.json` and `progress-append-audit.json`.

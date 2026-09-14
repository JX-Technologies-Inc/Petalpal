

## Human Review 221 — Stage 1 Core/Auxiliary Audit

Date: 2026-09-14. Artifact: `v4/stage1-human-review-core-v1/`.

### Protocol

- Human Review is now formally **Stage 1 only**, using applicability NO / PLAUSIBLE / CLEAR. Stage 2 deprecated. Stage 3 deprecated. `evidence / rank_order / tie_group` are legacy unused fields and are not missing work. This current protocol supersedes earlier log entries and bundle metadata describing later stages.

### Reviewer hierarchy

- Core anchor reviewers: Reviewer 1 and Reviewer 2 only. Auxiliary: AUX-R01 through AUX-R08, each a distinct human reviewer. No equal-status ten-reviewer pool or reviewer weighting.

### Core validity

- Reviewer 1: 221 samples, 3,978 potential judgments, four missing: R3-087/fear; R3-163/surprise; R3-168/admiration; R3-168/amusement. All four remain missing.
- Reviewer 2: valid only R3-001..R3-183, 3,294 valid judgments. R3-184..R3-221 permanently excluded: all 684 invalid export-placeholder judgments are barred from every judgment statistic, QC distribution, comparison and downstream reference construction regardless of blankness.
- Both supplied desktop clean Core CSVs passed schema, keys, label-set, legal-value and cross-Core exact-text/definition checks. Actual nonblank Core overlap = 3290; derived from the files, not an assumed denominator. No raw exports or historical reviewer files were substituted.

### Core agreement

- Exact/raw agreement: 2160/3290 = 0.656534954 (65.6535%). Unweighted three-class Cohen's kappa = 0.233754933. Total disagreement 1130; severe NO/CLEAR 337; adjacent 793. PLAUSIBLE remains a third category.
- Highest label disagreement rates: optimism 113/183 (61.75%), excitement 112/183 (61.20%), surprise 94/182 (51.65%), joy 91/183 (49.73%), gratitude 79/183 (43.17%).
- Highest-disagreement samples (rate then count): R3-022 12/18, R3-093 12/18, R3-127 12/18, R3-016 11/18, R3-100 11/18, R3-124 11/18, R3-063 10/18, R3-076 10/18, R3-081 10/18, R3-085 10/18. Diagnostic only; no examples removed or adjudicated.

### Auxiliary QC

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

- Table order: reviewer | valid/3978 | missing | NO | PLAUSIBLE | CLEAR | flag. These counts were recomputed from the eight individual CSVs. All eight are retained for descriptive comparisons and support counts. Missing ratings stay missing. Flags are not exclusion/downweighting decisions.
- AUX-R06: INCOMPLETE_COVERAGE; 36 missing. AUX-R08: EXTREME_DISTRIBUTION; distribution reported explicitly above, including its separately computed Core comparisons in the artifact.
- All Auxiliary comparisons with Reviewer 2 apply the same permanent 183-sample boundary. Per-Core-disagreement Auxiliary counts do not select a final category. Bundle suggestions to exclude AUX-R08 by default or later complete deprecated stages were not followed because the latest user protocol overrides them.

### Methodology boundary

- **NO GOLD LABELS CREATED**
- **NO MAJORITY-VOTE ADJUDICATION**
- **NO AUTOMATIC CORE OVERRIDE**
- **STAGE 2 / STAGE 3 DEPRECATED**
- **ADJUDICATION NOT PERFORMED IN THIS TASK**
- Point estimates describe the observed valid overlap; kappa depends on class prevalence. Partial Core coverage and the enriched sample preclude full-Train population reliability or model-quality claims. Clean-export text consistency does not independently resolve the historical UI quote-rendering concern. No legal149, Blog360, protected holdout, training, model inference, taxonomy modification, commit or push.
- Next: ML Lead / Sol decides Stage 1 adjudication methodology from these artifacts. No follow-up experiment or adjudication is automatically started.

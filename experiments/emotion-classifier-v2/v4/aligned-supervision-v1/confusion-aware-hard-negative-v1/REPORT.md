# Confusion-aware hard-negative v1

Status: **DATA NOT READY — NO TRAINING**.

No new human review or manual adjudication occurred. RTN and COSO labels, predictions, probabilities, and row-level errors were not used to construct or judge candidates. Existing aggregate COSO development evidence alone froze the target confusion pairs.

## Frozen confusion priorities

The seven pair families are sadness/caring, caring/love, joy/optimism, joy/excitement, caring/gratitude, joy/love, and fear/annoyance. They are the substitution-style pairs observed in `balanced-head-error-analysis-v1`; sadness/disappointment and anger/annoyance were not promoted because the legal development artifact did not show them among the leading substitution pairs.

## Existing-data audit

The audit produced 1,152 directional candidate records:

- 1,097 have unresolved negative status. Canonical Train has model-agreement/adjudication labels with `humanGold=false`; omission is not an explicit negative.
- 55 GoEmotions records have a human positive label and an explicit paired zero supported by all available non-unclear per-rater binary columns. They span 10/14 target directions, but their underlying Reddit rights remain `REVIEW_REQUIRED`, so none are eligible.
- Existing rows satisfying rights PASS + reliable positive + explicit paired negative: **0**.

CoSoWELL Train and consented canonical text pass their existing rights/provenance gates but lack explicit negative supervision. Hippocorpus passes O-UDA-1.0 and source-grouping gates but is unlabeled. It was therefore admitted only as a blind model-panel candidate source, never as human gold. Unexpected-Events was not used because it is third-person/hypothetical and Hippocorpus supplies the preferred first-person domain.

## Leakage audit

The blind selection contains 314 unique train-only samples. Exact normalized overlap, lexical near-duplicate overlap at Jaccard 0.80, and source-group overlap against legal Dev, Gemini opened evaluation, and RTN were all zero. The maximum observed protected lexical similarity was 0.069. Protected labels and errors were not read; RTN was not used for selection or design.

## Blind model panel

Because direct existing supervision was insufficient, a fresh-context Astra/Luna/Sol panel judged a sealed 1,005-cell blind input. Each judge saw only adjudication ID, sample ID, text, target label, definition, and allowed values. Source, prior labels, model outputs, probabilities, pair identity, expected answer, other votes, and evaluation evidence were hidden. All outputs passed exact coverage, schema, vocabulary, identity/configuration, rationale-length, and per-row input-hash validation before comparison.

| Judge | NO | PLAUSIBLE | CLEAR |
|---|---:|---:|---:|
| Astra | 423 | 299 | 283 |
| Luna | 763 | 93 | 149 |
| Sol | 765 | 145 | 95 |

Three-way exact agreement was `463/1005 = 46.07%`. Pairwise exact agreement was Astra/Luna `54.43%`, Astra/Sol `53.33%`, and Luna/Sol `79.30%`. Panel statuses were 392 unanimous NO, 58 unanimous CLEAR, 223 strong NO, 52 strong CLEAR, 181 direct CLEAR/NO conflicts, and 99 ambiguous. Astra was materially more permissive than Luna/Sol; no vote was recalibrated or manually overridden.

## Deterministic admission

The main hard-negative rule was applied exactly: positive label `3/3 CLEAR` and paired negative label `3/3 NO`. It admitted only **9** pair-direction examples:

- annoyance > fear: 4
- caring > gratitude: 1
- fear > annoyance: 1
- gratitude > caring: 2
- love > joy: 1

Another 40 examples met only the strong 2/3-style secondary rule and remain separate. They are not mixed into the main pool. Strict controls admitted 5 no-clear rows and 0 genuine two-label rows.

All panel-derived rows are labeled `MODEL_PANEL_WEAK_PSEUDO_NOT_HUMAN_GOLD`.

## Decision

The acceptance gate fails: 9/280 high-confidence hard negatives, 5/40 no-clear controls, 0/40 two-label controls, only 5/14 directions represented, and minimum represented-direction support 1 rather than 15. Rights/provenance and leakage gates pass for the panel input, but supervision quantity, direction coverage, and controls do not.

Therefore status is **DATA NOT READY**. No classifier was trained, no threshold/sampler/replay/class-weight/calibration experiment was run, and the incumbent remains frozen. Scaling the same model-only panel is not justified by the low unanimous yield and judge-distribution mismatch. The next exact action is an external evidence change: admit an existing rights-cleared corpus with exhaustive human multi-label annotation, or obtain authoritative underlying-content/commercial-training clearance for an already exhaustively annotated source; then rerun the deterministic source and quota audit without new human review.

# Counterfactual Pairwise Ranking Supervision V1

Date: 2026-09-18

Decision: **INCONCLUSIVE — DO_NOT_TRAIN**

The pair-quality gate failed before training. No classifier candidate was trained, no checkpoint was created, and neither RTN nor COSO was opened for this experiment.

## Frozen design

- Fully original synthetic short personal-life Events only; supervision status is `MODEL_GENERATED / WEAK_PSEUDO`.
- 18 Product labels × 8 pairs = 144 intended pairs and 288 unique Events.
- Intended order was randomized once with seed 53 and frozen before validation.
- Intended direction was exactly balanced: 72 `A_STRONGER`, 72 `B_STRONGER`; each label had 4/4.
- Event length was at most 112 characters. Exact Event duplicates, exact pair duplicates, cross-pair token-Jaccard near duplicates at 0.78, and mechanical product-fit failures were all zero.
- Predeclared usable tiers were `HIGH_PAIR` and `MEDIUM_PAIR`, equally included. `CONFLICT` and `UNRESOLVED` were excluded.
- Had the data gate passed, the single frozen experiment would have used ranking-only logistic loss `mean(softplus(-(z_strong_target - z_weak_target)))`, affecting only the target label logit. No weaker Event would have become a zero target and no full 18-label target would have been created.
- The unrun protocol fixed the incumbent initialization, classifier plus encoder layers 10–11, LR `1e-6`, weight decay `0.01`, one epoch, batch size 8 pairs, seed 53, max length 512, threshold 0.35, max-2, and one run with no sweep.

## Blind validation and independence

Exactly three isolated validators judged all 144 pairs:

- Astra: `gpt-6-astra / medium`
- Sol: `gpt-5.6-sol / medium`
- Luna: `gpt-5.6-luna / medium`

Each received only pair ID, target label and definition, Event A, Event B, the three decision options, and output schema. All three complete outputs passed schema checks and were semantically frozen before consensus.

| Audit item | Result |
|---|---:|
| Astra isolated | YES |
| Sol isolated | YES |
| Luna isolated | YES |
| Agents saw intended direction | NO |
| Agents saw other outputs | NO |
| Outputs frozen before consensus | YES |
| Fourth adjudicator used | NO |
| Repeated-model votes used | NO |

## Consensus result

| Outcome | Count |
|---|---:|
| Intended pairs | 144 |
| HIGH_PAIR | 100 |
| MEDIUM_PAIR | 0 |
| CONFLICT | 44 |
| UNRESOLVED | 0 |
| Usable HIGH+MEDIUM | 100 |

Usable consensus direction was 48 `A_STRONGER` and 52 `B_STRONGER`. All 100 usable pairs matched the generator's intended direction, for 100.00% intended-direction fidelity among usable pairs. Counting excluded conflict pairs against the full intended cohort, the usable-and-correct yield was 100/144 = 69.44%. Generator intent is a specification, not gold.

### Per-label coverage and fidelity

`Fidelity` is agreement with generator intent among usable pairs. `All-pair yield` is usable-and-correct divided by the eight intended pairs.

| Label | Intended | High | Medium | Conflict | Unresolved | Usable | Usable A/B | Fidelity | All-pair yield |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| admiration | 8 | 6 | 0 | 2 | 0 | 6 | 3/3 | 100% | 75.0% |
| amusement | 8 | 7 | 0 | 1 | 0 | 7 | 4/3 | 100% | 87.5% |
| anger | 8 | 4 | 0 | 4 | 0 | 4 | 2/2 | 100% | 50.0% |
| annoyance | 8 | 4 | 0 | 4 | 0 | 4 | 2/2 | 100% | 50.0% |
| caring | 8 | 6 | 0 | 2 | 0 | 6 | 2/4 | 100% | 75.0% |
| confusion | 8 | 6 | 0 | 2 | 0 | 6 | 3/3 | 100% | 75.0% |
| curiosity | 8 | 6 | 0 | 2 | 0 | 6 | 3/3 | 100% | 75.0% |
| disappointment | 8 | 6 | 0 | 2 | 0 | 6 | 3/3 | 100% | 75.0% |
| disgust | 8 | 7 | 0 | 1 | 0 | 7 | 3/4 | 100% | 87.5% |
| excitement | 8 | 5 | 0 | 3 | 0 | 5 | 1/4 | 100% | 62.5% |
| fear | 8 | 6 | 0 | 2 | 0 | 6 | 2/4 | 100% | 75.0% |
| gratitude | 8 | 7 | 0 | 1 | 0 | 7 | 3/4 | 100% | 87.5% |
| joy | 8 | 6 | 0 | 2 | 0 | 6 | 4/2 | 100% | 75.0% |
| love | 8 | 4 | 0 | 4 | 0 | 4 | 2/2 | 100% | 50.0% |
| optimism | 8 | 4 | 0 | 4 | 0 | 4 | 3/1 | 100% | 50.0% |
| remorse | 8 | 5 | 0 | 3 | 0 | 5 | 3/2 | 100% | 62.5% |
| sadness | 8 | 6 | 0 | 2 | 0 | 6 | 2/4 | 100% | 75.0% |
| surprise | 8 | 5 | 0 | 3 | 0 | 5 | 3/2 | 100% | 62.5% |

## Frozen gate decision

Passing checks included exact cohort size, equal label counts, exact intended direction balance, uniqueness, product fit, `HIGH_PAIR >= 90`, `HIGH_PAIR >= 4` per label, unresolved maximum, and global usable A/B balance.

The following predeclared checks failed:

- usable pairs: 100 < 108;
- usable pairs per label: anger, annoyance, excitement, love, optimism, remorse, and surprise were below 6;
- usable-and-intended-correct pairs: 100 < 108, with the same seven per-label failures below 6;
- direct conflicts: 44 > 14;
- usable direction coverage per label: excitement had only one usable A direction and optimism only one usable B direction, below two each.

Therefore: **pair-quality gate FAIL — DO_NOT_TRAIN**. No gate was relaxed, no pair was rewritten or added, no validator was recalled, and no extra vote or adjudicator was used.

## Post-freeze diagnostic

This diagnostic was computed only after all three semantic outputs were frozen and was not used for rescue:

- Astra and Sol agreed on 144/144 pairs. Each matched the intended generation direction on 144/144.
- Luna agreed with each of them on 100/144 and selected the opposite non-tie direction on the remaining 44. Luna matched generator intent on 100/144.
- No validator used `TIE_UNCLEAR`, explaining why all non-HIGH pairs became direct conflicts rather than MEDIUM or UNRESOLVED.

This does not establish that any validator was correct. It shows that the proposed relative relation was highly stable for 100 pairs but materially validator-dependent for 44, too much to support the predeclared broad-training claim.

## Outcome

- Ranking objective: frozen but not run.
- Usable training pair count: 0 admitted because the dataset-level gate failed.
- Candidate checkpoint: none.
- COSO/RTN evaluation: not performed.
- Final research decision: **INCONCLUSIVE**.
- Classifier actually improved: **NO**.
- Current incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`.

Pairwise V1 taught us that relative counterfactual supervision can produce a clean, perfectly intended-aligned 100-pair core, but the relation was not robust enough across the required validator set to provide balanced coverage over all 18 labels. The failure is a supervision-consensus failure, not evidence that ranking training itself succeeds or fails.

The next materially different quality task should change the evidence source rather than rescue this synthetic/model-validated pool: use independently human-labeled, rights-cleared short-Event evidence with explicit per-label judgments. The already documented conditional `rw3d-explicit-extremes-v1` is suitable only after written product-use clearance; until then this is an external-evidence blocker, not authorization to search or request permission in this task.

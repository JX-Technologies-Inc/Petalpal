# Three-State Partial Supervision v3 — Milestone Report

Date: 2026-09-18

Status: **INCONCLUSIVE — SUPERVISION GATE FAILED — DO_NOT_TRAIN — INCUMBENT UNCHANGED**

V3 created a new independent balanced per-label negative cohort. It did not reuse V1/V2 rows or add emergency rows for prior failures. Every design count, integer gate, inclusion policy, and candidate protocol was frozen before validation. Aggregate quality was strong, but two label-level robustness gates failed; therefore the first masked three-state BCE candidate was not trained and RTN/COSO remained unopened.

## 1. Frozen V3 design

- Event count: **108**
- Total Event × Product-18 cells: **1,944**
- Structure: **72 single-positive / 18 two-positive / 18 zero-positive**
- Intended positive opportunities per label: **6**
- Intended negative opportunities per label: **18**
- Total intended positive/negative cells: **108 / 324**
- Frozen inclusion policy: **HIGH + MEDIUM, equal binary weight**
- Character min/max/mean: **160 / 238 / 196.09**
- Exact/normalized/token-Jaccard near duplicates: **0 / 0 / 0**
- Maximum repeated opening-four-word type: **1**
- Product-fit failures: **0**

All Events were newly generated original synthetic PetalPal-style entries. No RTN, COSO, external, restricted, V1, or V2 row was used or paraphrased. All labels remain `MODEL_GENERATED_SYNTHETIC_WEAK_PSEUDO_NOT_HUMAN_GOLD`.

## 2. Strict validator independence

The validators were three distinct model validators under a blind independent protocol, not independent human ground-truth annotators.

| Audit item | Result |
|---|---|
| Astra isolated | **YES** |
| Sol isolated | **YES** |
| Luna isolated | **YES** |
| Agents saw targets | **NO** |
| Agents saw other outputs | **NO** |
| Agents saw incumbent predictions | **NO** |
| Agents saw RTN/COSO | **NO** |
| Outputs frozen before consensus | **YES** |
| Cross-agent review occurred | **NO** |
| Fourth adjudicator used | **NO** |
| Repeated-model votes used | **NO** |

Each validator received a separate `fork_turns="none"` task containing access only to the frozen Event text, common Product-18 definitions, common three-state rules, and output schema. All 108 × 18 judgments were saved before aggregation. No semantic correction or validator recall occurred.

File-derived agent rates:

| Validator | POSITIVE | NEGATIVE | UNCLEAR |
|---|---:|---:|---:|
| Astra medium | 99 (5.09%) | 306 (15.74%) | 1,539 (79.17%) |
| Sol medium | 108 (5.56%) | 354 (18.21%) | 1,482 (76.23%) |
| Luna medium | 109 (5.61%) | 307 (15.79%) | 1,528 (78.60%) |

Independence gate: **PASS**.

## 3. Consensus and final supervision

| Tier | Cells |
|---|---:|
| HIGH_POSITIVE | **95** |
| MEDIUM_POSITIVE | **12** |
| HIGH_NEGATIVE | **209** |
| MEDIUM_NEGATIVE | **113** |
| UNCERTAIN | **1,515** |

Final HIGH+MEDIUM supervision:

- Positive: **107 (5.50%)**
- Negative: **322 (16.56%)**
- Masked: **1,515 (77.93%)**
- Positive Event cardinality 0/1/2/>2: **18 / 73 / 17 / 0**

Direct POSITIVE-versus-NEGATIVE conflicts: **3 / 1,944 = 0.154%**. Every conflict was masked.

## 4. Per-label supervision audit

| Label | Positive support | Combined negative support | Intended HIGH-negative / 18 | Positive fidelity / 6 | Combined negative fidelity / 18 |
|---|---:|---:|---:|---:|---:|
| admiration | 6 | 18 | 16 | 6 | 18 |
| amusement | 6 | 18 | 16 | 6 | 18 |
| anger | 6 | 16 | 5 | 6 | 15 |
| annoyance | 6 | 17 | 17 | 6 | 17 |
| caring | 6 | 18 | 16 | 6 | 18 |
| confusion | 6 | 27 | 7 | 6 | 17 |
| curiosity | 6 | **10** | 9 | 6 | **10** |
| disappointment | 6 | 18 | 9 | 6 | 18 |
| disgust | 6 | 18 | 16 | 6 | 18 |
| excitement | 6 | 18 | 16 | 6 | 18 |
| fear | 5 | 19 | **0** | 5 | 15 |
| gratitude | 6 | 17 | 13 | 6 | 17 |
| joy | 6 | 15 | 10 | 6 | 15 |
| love | 6 | 18 | 15 | 6 | 17 |
| optimism | 6 | 18 | 14 | 6 | 18 |
| remorse | 6 | 18 | 9 | 6 | 18 |
| sadness | 6 | 18 | 11 | 6 | 18 |
| surprise | 6 | 21 | 7 | 6 | 18 |

Global fidelity:

- Positive combined fidelity: **107/108 = 99.07%**
- Combined negative fidelity: **303/324 = 93.52%**
- Intended HIGH-negative fidelity: **206/324 = 63.58%**

All thresholds used exact integer-count comparisons; no rounded rational comparisons were used.

## 5. Multi-label and zero-positive behavior

- Intended two-positive Events retaining both positives: **17/18**
- Frozen minimum: **16/18** — PASS
- Intended zero-positive Events with any positive: **0/18**
- Zero-positive safety: **18/18** — PASS

## 6. Frozen gate result

Passed gates included:

- HIGH_POSITIVE: `95 >= 90`
- HIGH_NEGATIVE: `209 >= 130`
- global positive fidelity: `107 >= 100`
- global combined negative fidelity: `303 >= 270`
- global intended HIGH-negative support: `206 >= 140`
- per-label positive support and fidelity
- polarity-conflict limit
- two-positive retention and zero-positive safety
- independence, product-fit, uniqueness, and template gates

Failed gates:

1. **Per-label combined negative support:** curiosity had `10`, below the frozen minimum `12`.
2. **Per-label intended combined negative fidelity:** curiosity recovered `10/18`, below the frozen minimum count `12/18`.
3. **Per-label intended HIGH-negative support:** fear had `0/18`, below the frozen minimum count `5/18`.

Supervision gate: **FAIL**.
Training decision: **DO_NOT_TRAIN**.

No row was added or regenerated, no threshold changed, no consensus rule changed, no validator was recalled, and no fourth vote or human adjudication was used.

## 7. Training and evaluation

- Frozen weak-training file created: **no**
- Training protocol instantiated: **no**
- Masked partial-BCE candidate trained: **no**
- Candidate checkpoint created: **no**
- RTN opened: **no**
- COSO per-row evidence opened: **no**
- Rescue or sweep: **no**

The candidate wrapper reuses the existing V1 masked-loss implementation, which boolean-selects supervised logits and targets before BCE. It was not executed because the data gate failed.

## 8. Decision

Final decision: **INCONCLUSIVE**.

Classifier actually improved: **NO candidate was trained, so classifier improvement was not tested**.

The three-state partial-supervision hypothesis remains untested rather than rejected. V3 is a failed supervision gate, not a failed model candidate.

## 9. Current incumbent

Unchanged: `goemotions-targeted-v1/experiment/epoch-1-checkpoint`.

- COSO micro/macro-F1: approximately `0.5281 / 0.3452`
- RTN RESOLVED micro/macro-F1: `0.3163 / 0.3184`
- RTN RESOLVED exact-set: `50.41%`
- RTN RESOLVED FP/FN: `62 / 85`
- RTN RESOLVED predicted 0/1/2: `153 / 86 / 5`

These are carried-forward frozen references, not newly opened evaluation results.

## 10. What V3 taught us

Balanced scale and semantic diversity produced strong aggregate evidence: 322 supervised negatives, 209 HIGH_NEGATIVE cells, and 63.58% intended unanimous-negative fidelity. Disappointment, the V2 unanimous-negative weakness, improved from `2/10` to `9/18` intended HIGH hits.

The remaining failures expose taxonomy-specific limitations rather than insufficient aggregate scale:

- `curiosity NEGATIVE` still frequently becomes UNCLEAR even when the writer knows the explanation or declines follow-up. Increasing opportunities from 10 to 18 raised HIGH hits to 9 but combined hits only to 10.
- `fear NEGATIVE` produced broad combined support but zero 3/3 intended HIGH hits. Validators agreed in pairs but did not unanimously treat safety-resolved cues as evidence that fear does not apply.

More rows or sharper denials would now be another synthetic rescue and risk teaching label-negation prose rather than natural Event semantics.

## 11. Next materially different quality task

Do not create V3.1, append curiosity/fear rows, or rerun validators. The next materially different evidence change is a rights-cleared, exhaustively judged source with explicit per-label negatives, or a genuinely different learning objective that can use partial pairwise boundary evidence without requiring every absent emotion to become a binary negative. No external search or permission request was performed in this task.

## Artifact map

- `protocol.json`: frozen balanced design, integer gates, and candidate settings
- `generate.py`, `generator-output.jsonl`, `generation-audit.json`: hidden specifications and frozen original Events
- `validator-instructions.md`, `blind-input.jsonl`: isolated validator payload
- `agent-a-labels.jsonl`, `agent-b-labels.jsonl`, `agent-c-labels.jsonl`: frozen peer-validator outputs
- `compute_consensus.py`, `consensus.jsonl`, `supervision-audit.json`: deterministic consensus, fidelity, independence, and gates
- `freeze_training.py`, `run_candidate.py`: unexecuted gated masked-loss reuse

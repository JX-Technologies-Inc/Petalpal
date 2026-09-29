# Independent consensus weak supervision v1

Decision: **REJECT**. The candidate is research-only and does not replace the frozen incumbent.

## Bottleneck and hypothesis

The short-Event diagnostic suggested broad under-production and extra abstention alongside label-specific over-production. Prior positive weighting, asymmetric loss, uncertain-negative masking, correlated-teacher distillation, DAPT, valence adaptation, selector intersection, and dropout consistency did not provide a defensible correction. This experiment tested whether blind Product-18 labels from three distinct models on rights-admitted short Event text could supply missing semantic supervision without inheriting incumbent predictions.

The hypothesis should have generalized beyond RTN because source selection used only 900 previously admitted training rows from Hippocorpus and Unexpected Events, with 450 independent source groups per source. RTN-300, COSO predictions, incumbent predictions, desired label counts, and native labels did not participate in pool selection, labeling, consensus, training, or checkpoint selection.

## Data, rights, and independence

- Text: Hippocorpus and Unexpected Events, both `ADMIT_UNLABELED`; 900 rows, 900 source groups, no prepared-validation group overlap, no normalized exact overlap with RTN-300.
- Agents: Agent A `gpt-6-astra / medium`, Agent B `gpt-5.6-sol / medium`, Agent C `gpt-5.6-luna / medium`.
- Each agent independently received only `rowId`, Event text, Product-18 definitions, and the 0-2 output rule. Other agents, incumbent output, source metadata, COSO, RTN, consensus, and desired counts were hidden.
- Labels are `MODEL_GENERATED_WEAK_PSEUDO_NOT_HUMAN_GOLD`. No human or fourth-model adjudication was used.
- Frozen exact-set consensus: 60 high, 577 medium, 263 unresolved. Feasibility passed with 637 resolved rows, including 240 non-empty rows, 17 represented labels, and 10 labels with at least 10 positives.

The natural weak-label pool remained strongly imbalanced: joy 105 positives, disappointment 41, sadness 27, surprise 25, fear 21, but curiosity 1, annoyance 2, remorse 2, anger 3, and disgust 0. Under the frozen non-empty/empty sampling rule, the one training set contained 372 rows: 240 non-empty and 132 empty.

## Experiment

The single candidate initialized from `goemotions-targeted-v1/experiment/epoch-1-checkpoint`, updated only the classifier and top two encoder layers for one epoch at LR `1e-6`, batch 16, seed 46, with standard unweighted Product-18 BCE. No checkpoint, loss, threshold, selector, sample, or rescue sweep was run.

## Candidate versus incumbent

COSO-149 historical human-labeled diagnostic:

- Micro precision/recall/F1: `0.5797/0.4848/0.5281 -> 0.5735/0.4727/0.5183`
- Macro-F1: `0.3452 -> 0.3381`
- Exact-set: `34.90% -> 33.56%`
- FP/FN: `58/85 -> 58/87`
- 0/1/2 outputs: `35/90/24 -> 35/92/22`
- Largest supported-label F1 changes: caring `-0.0751`, sadness `-0.0523`; all other support>=5 changes were zero.

RTN-300 resolved model-consensus diagnostic:

- Micro precision/recall/F1: `0.3542/0.2857/0.3163 -> 0.3656/0.2857/0.3208`
- Macro-F1: `0.3184 -> 0.3223`
- Exact-set: `50.41% -> 50.82%`
- FP/FN: `62/85 -> 59/85`
- 0/1/2 outputs: `153/86/5 -> 156/83/5`, versus consensus `128/113/3`
- Summed absolute 0/1/2 distribution error worsened from `54` to `60`.

RTN-300 high-consensus diagnostic:

- Micro-F1: `0.3678 -> 0.3765`
- Macro-F1: `0.3360 -> 0.3431`
- Exact-set: `55.66% -> 56.60%`
- FP/FN: `31/24 -> 29/24`

Previously untouched unlabeled validation behavior remained stable but is not correctness evidence: candidate/incumbent exact outputs agreed on `100%` of Hippocorpus validation and `99.26%` of Unexpected Events validation.

## Gate and conclusion

The candidate passed the frozen RTN precision/recall/FP/FN/high-consensus gates and all COSO tolerance gates. It failed two required RTN-resolved gates: the predeclared micro-F1 gain of at least `+0.015` (observed `+0.0045`) and 0/1/2 distribution error no worse than 54 (observed 60). Therefore the exact decision is **REJECT**.

Research evidence improved: **NO** under the complete frozen gate. Credible product-quality promotion proven: **NO**. Current incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint` and remains research-only with unresolved historical rights lineage.

Next selected task: test a materially different, taxonomy-balanced synthetic-semantic supervision route. Generate balanced, original short Event exemplars from the fixed Product-18 definitions, blind-validate them with separate models, freeze one accepted set, and run one bounded candidate. This selection is motivated by the training-pool coverage failure above, not by fitting RTN rows or thresholds.

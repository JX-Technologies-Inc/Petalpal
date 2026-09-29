# Taxonomy-balanced synthetic supervision v1

Decision: **REJECT**. The candidate does not replace the frozen research incumbent.

## Bottleneck and hypothesis

The preceding independent-consensus experiment showed that natural short-Event weak supervision remained severely imbalanced: joy had 105 consensus positives, while curiosity had 1, annoyance/remorse 2, anger 3, and disgust 0. This experiment tested a materially different route: equal generation budget for every Product-18 label, followed by two-model blind exact-target validation.

The route was designed to generalize beyond RTN because all 18 fixed taxonomy labels received the same budget. No RTN text, prediction, mismatch, desired RTN count, COSO error, incumbent output, or external source text was used in generation, validation, acceptance, training, or checkpoint selection.

## Data and multi-model protocol

- Generator: `gpt-6-astra / medium`; 24 original single-label Events per label plus 100 target-empty Events, 532 total.
- Blind validators: `gpt-5.6-sol / medium` and `gpt-5.6-luna / medium`.
- Validators saw only `rowId`, text, the fixed definitions, and the 0-2 rule. Targets, generator identity, other validator output, desired counts, incumbent, COSO, and RTN were hidden.
- Acceptance required both validators to independently return the exact hidden target. No uncertainty override, human review, fourth model, or adjudication occurred.
- Label status is `MODEL_GENERATED_SYNTHETIC_WEAK_PSEUDO_NOT_HUMAN_GOLD`.

Mechanical generation checks passed: 532 unique Events, 48-130 characters, exactly 24 generated targets per label and 100 empty targets. Validators exactly agreed with each other on 406 rows. Exact-target accepted support was 12-22 per label and 96 empty rows, passing the locked gate. The training set was fixed at exactly 12 accepted rows per label plus 72 accepted empty rows: 288 rows total.

The generator and validators share model families with the RTN panel. RTN results are therefore correlated research evidence, not independent validation or promotion evidence.

## Experiment

The single candidate initialized from `goemotions-targeted-v1/experiment/epoch-1-checkpoint`, updated only the classifier and top two encoder layers for one epoch at LR `1e-6`, batch 16, seed 47, with standard unweighted Product-18 BCE. No regeneration, checkpoint selection, loss/threshold/selector change, sweep, or rescue variant occurred.

## Candidate versus incumbent

COSO-149 historical human-labeled diagnostic:

- Micro precision/recall/F1: `0.5797/0.4848/0.5281 -> 0.5755/0.4848/0.5263`
- Macro-F1: `0.3452 -> 0.3479`
- Exact-set: `34.90% -> 34.23%`
- FP/FN: `58/85 -> 59/85`
- 0/1/2 outputs: `35/90/24 -> 35/89/25`
- Supported-label F1: love `+0.1410`, fear `-0.0234`, gratitude `-0.0684`; other support>=5 labels unchanged.

RTN-300 resolved model-consensus diagnostic:

- Micro precision/recall/F1: `0.3542/0.2857/0.3163 -> 0.3646/0.2941/0.3256`
- Macro-F1: `0.3184 -> 0.3252`
- Exact-set: `50.41% -> 50.82%`
- FP/FN: `62/85 -> 61/84`
- 0/1/2 outputs: `153/86/5 -> 154/84/6`, versus consensus `128/113/3`
- Per-label changes were narrow: love F1 `+0.1212`, sadness `+0.0294`, joy `+0.0071`, surprise `-0.0357`.
- Summed absolute 0/1/2 distribution error was `58`, above the frozen maximum 54.

RTN-300 high-consensus diagnostic:

- Micro-F1: `0.3678 -> 0.3765`
- Macro-F1: `0.3360 -> 0.3399`
- Exact-set: `55.66% -> 56.60%`
- FP/FN: `31/24 -> 29/24`

## Gate and conclusion

The candidate passed all COSO tolerance, RTN precision/recall/FP/FN/high-consensus, and output-integrity gates. It failed the two mandatory RTN-resolved gates: micro-F1 needed `>=0.3313` but reached `0.3256`, and distribution error needed `<=54` but was `58`. The exact decision is therefore **REJECT**.

Research evidence improved under the complete frozen gate: **NO**. Credible product-quality promotion proven: **NO**. The current incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`, research-only and not production-cleared.

No post-hoc rescue is authorized. Natural independent weak supervision and taxonomy-balanced synthetic weak supervision both produced small, directionally mixed changes without clearing the same broad behavior gate.

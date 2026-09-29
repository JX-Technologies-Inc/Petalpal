# Selective Supervision V1 training hypothesis

Status: `FROZEN_DESIGN / DO_NOT_TRAIN_YET`

## Sole hypothesis

On an Event with several reasonable emotions, explicitly masking plausible-but-not-selected labels from BCE while ranking selected labels above them is hypothesized to improve final Product-18 max-two selection relative to the unchanged incumbent.

There is exactly one candidate and one objective. This tests a joint selective-supervision intervention on the new admitted pool. Unlike ordinary omitted-label BCE, a supported but lower-priority emotion gets no absolute negative BCE target; unlike uncertainty-only masking, it receives an explicit within-Event preference gradient. The general ranking loss is not new; the distinction is the supported-but-nonselected state and which pairs are ranked, rather than positive-versus-all-omitted or cross-Event counterfactual pairs.

The incumbent comparison does not isolate masking from ranking, or the objective from new data and one epoch of adaptation. It cannot establish superiority over an equally trained ordinary-BCE model on the same rows. No ablation, extra candidate, or weight sweep is authorized; conclusions must remain about this joint intervention and its predeclared raw-ranking/output metrics.

## Objective

For Event `i` and Product-18 label `l`, let logit `z[i,l]` have one frozen state:

- `SELECTED`: BCE target `1`;
- `NOT_APPLICABLE`: BCE target `0`;
- `PLAUSIBLE_NOT_SELECTED`: excluded from BCE.

For each row, compute ordinary unweighted BCE over only `SELECTED ∪ NOT_APPLICABLE`, averaged over the included cells:

`L_bce(i) = mean(BCEWithLogits(z[i,l], y[i,l]))`.

For every within-Event pair `s ∈ SELECTED`, `p ∈ PLAUSIBLE_NOT_SELECTED`, compute a zero-margin logistic ranking loss:

`L_rank(i) = mean(softplus(z[i,p] - z[i,s]))`.

The row loss is:

`L(i) = L_bce(i) + (1/18) * L_rank(i)` when ranking pairs exist, otherwise `L(i) = L_bce(i)` with `L_rank(i) = 0` (no empty mean).

The batch loss is the unweighted mean of row losses, including rows without ranking pairs. Do not average ranking only over pair-bearing rows in a batch; that would silently increase its weight when such rows are sparse. Use raw Product-18 logits and numerically stable BCEWithLogits/softplus, not sigmoid probabilities inside softplus. All pairs have equal weight within a row; only the mean, never the pair sum, enters the objective.

### One-time ranking-weight decision

Replace unsupported weight `1.0` with the predeclared constant **`lambda_rank = 1/18`** (approximately `0.055556`), determined only by the frozen label count. No loss probing, gradient fitting, Dev/Final result, historical candidate performance, adaptive balancing, or sweep is used to choose or revise it.

Let `a = |SELECTED|`, `b = |PLAUSIBLE_NOT_SELECTED|`, and `m = 18 - b` for a row with pairs. At zero logits, mean BCE has selected-logit gradient magnitude `1/(2m)`; mean ranking has magnitude `1/(2a)` per selected logit and `1/(2b)` per plausible logit. Weight `1.0` therefore makes the selected ranking gradient `m/a` times the BCE gradient (up to 17), even though both scalar losses equal `log(2)` at zero logits. Equality of scalar loss values does not justify unit weight.

With `1/18`, that neutral-point selected-gradient ratio is `m/(18a) <= 1`. More generally each weighted ranking-logit gradient is bounded by `1/(18a)` or `1/(18b)`, no greater than `1/m`, the per-logit maximum magnitude of the row's masked BCE gradient. This is a conservative scale convention, not an optimum or a guarantee that ranking is always smaller than BCE at actual logits. Saturated BCE gradients may be near zero. A failed run ends V1; it cannot motivate increasing lambda.

`softplus(z_p - z_s)` has the correct direction: minimization raises selected scores and lowers plausible scores relatively. It is shift-invariant and supplies no absolute cutoff. In particular a lower-ranked cross-cluster plausible label may still exceed `0.35` and occupy a spare output slot. Rank correctness alone is therefore insufficient; Dev must also pass actual selection, FP, abstention, and cardinality guards. Plausible labels are BCE-masked, not gradient-free. A clearly supported ordering for every Cartesian-product pair is an admission requirement, not something training may invent.

There is no class weight, positive weight, focal/ASL term, margin sweep, confidence weight, source weight, distillation term, consistency term, auxiliary task, or alternative candidate.

## Single run contract

- Initialize from the unchanged research incumbent `goemotions-targeted-v1/experiment/epoch-1-checkpoint` to hold starting weights fixed. This does not isolate a causal loss effect. Record and retain its rights-pending Reddit/GoEmotions and CoSoWELL lineage in any descendant; admitted new data cannot make that checkpoint production-cleared. This is a research-only run design, not authorization for production-targeted training.
- Use only admitted Selective Supervision V1 Train rows. Do not replay rights-pending historical text.
- Update the Product-18 classifier and encoder layers 10–11; freeze all other parameters.
- One epoch, AdamW, learning rate `1e-6`, weight decay `0.01`, batch size `16`, seed `56`, maximum tokenizer length `512`.
- Save and evaluate the final checkpoint only. No early stopping, intermediate checkpoint selection, restart, continuation, extra epoch, seed/LR/threshold sweep, or rescue.
- Keep Product-18 label mapping, tokenizer, threshold `0.35`, emotion clusters, and maximum-two selector unchanged. V1 rows have no Primary; always pass `primaryGardenMood = null`, without inferring one.

Selective Dev is evaluated once after the final checkpoint freezes and is the sole candidate PASS/REJECT decision. If its complete gate fails, V1 stops with Final Test sealed. Only recorded `PASS_DEV` permits a separate evaluator to run Final Test once with frozen checkpoint/configuration/evaluation code; Final predictions freeze before references or scores are revealed. Final scores are a terminal report, never a promotion gate or a candidate/training decision. Favorable or unfavorable Final results cannot cause rescue, tuning, continuation, another candidate, or data/annotation/inference changes.

## Explicit non-hypotheses

This run does not test Balanced Head/Mean Anchor, ASL, class balancing, positive weighting, standard continuation, missing-positive repair, Stage-1 patching, DAPT, distillation, dropout consistency, a different backbone, model-vote hard negatives, external data, or threshold/seed/LR search.

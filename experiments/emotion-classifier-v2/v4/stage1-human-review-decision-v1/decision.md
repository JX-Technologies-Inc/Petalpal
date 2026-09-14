# Human Review 221 — Stage 1 Methodology Decision

Date: 2026-09-14
Status: METHODOLOGY DECISION COMPLETE; ADJUDICATION NOT STARTED

## Decision

The Astra Stage 1 Core/Auxiliary audit is methodologically **PASS** for its stated descriptive purpose. The current ratings are **not ready for direct adjudication** and **cannot yet form a final Stage 1 reference set**. Revise and human-freeze the Stage 1 applicability guide first, then conduct a targeted, blinded re-review by both Core reviewers, remeasure agreement, freeze the adjudication policy, and only then adjudicate remaining disagreements.

No gold, final, or adjudicated labels are created here.

## Astra audit

All required validity boundaries were implemented correctly:

- Effective Core overlap is 3,290: Reviewer 2 has 183 valid samples × 18 labels = 3,294 positions, minus Reviewer 1's four genuine blanks within that range.
- Reviewer 2 rows R3-184..R3-221 are masked before applicability validation or QC. All 684 placeholder positions are excluded from agreement, marginals, kappa, confusion matrices, Auxiliary comparisons, and downstream conclusions.
- Reviewer 1's four missing judgments remain blank and were not imputed: R3-087/fear, R3-163/surprise, R3-168/admiration, and R3-168/amusement.
- NO, PLAUSIBLE, and CLEAR remain three distinct categories. No binarization was used.
- The reported unweighted Cohen's kappa uses the standard observed-versus-marginal-expected agreement formula on the identical 3,290-position overlap. Recalculation from the saved confusion matrix gives expected agreement 0.551755619 and kappa 0.233754933.
- Severe disagreement is exactly NO↔CLEAR: 324 Reviewer-1-NO/Reviewer-2-CLEAR plus 13 in the reverse direction = 337.
- Auxiliary reviewers were reported separately as supporting evidence. No equal-status pooling, weighting, majority-vote finalization, Core override, gold creation, or adjudication occurred.
- Stage 2/3 fields were not read as judgments. `evidence`, `rank_order`, and `tie_group` remain legacy unused fields.

Unweighted kappa is appropriate as the primary exact-category chance-corrected statistic under the locked three-category audit. Because the scale is ordered, future post-re-review reporting should add linear-weighted kappa as a secondary calibration statistic, without replacing exact agreement, the confusion matrix, or severe-disagreement counts.

## What 65.65% raw agreement and kappa 0.234 mean here

Raw agreement is strongly inflated by shared negative decisions. Of 2,160 exact agreements, 1,945 (90.05%) are NO↔NO; those cells alone are 59.12% of all 3,290 comparisons. The reviewers also use the scale very differently:

- Reviewer 1: NO 2,842 (86.38%), PLAUSIBLE 300 (9.12%), CLEAR 148 (4.50%).
- Reviewer 2: NO 1,995 (60.64%), PLAUSIBLE 729 (22.16%), CLEAR 566 (17.20%).

The chance agreement implied by those marginals is already 55.18%, so 65.65% observed agreement represents only about 10.48 percentage points beyond that baseline. Kappa therefore falls to 0.234. This is not a generic verdict that the reviewers are "bad"; it is evidence that, in this disagreement-enriched 18-label applicability task, their thresholds are not calibrated to the same semantics.

The direction is systematic rather than symmetric:

- NO↔PLAUSIBLE: 610 total, including 573 Reviewer-1-NO/Reviewer-2-PLAUSIBLE and only 37 in reverse.
- PLAUSIBLE↔CLEAR: 183 total, including 145 Reviewer-1-PLAUSIBLE/Reviewer-2-CLEAR and 38 in reverse.
- NO↔CLEAR: 337 total, including 324 Reviewer-1-NO/Reviewer-2-CLEAR and 13 in reverse.

Reviewer 2 is therefore substantially more inclusive and more willing to use CLEAR. The disagreement reflects a mixture of general applicability-threshold mismatch, PLAUSIBLE/CLEAR calibration mismatch, and label-specific semantic overreach. It is not safe to send all 1,130 cells directly to an adjudicator under the unchanged guide: that would ask the adjudicator to impose another private threshold instead of resolving a stable shared rule.

## Five highest-disagreement labels

### Optimism

Disagreement is dominated by NO↔CLEAR (64) and NO↔PLAUSIBLE (37). Actual examples show CLEAR applied to present gratitude, a smile, a compliment, current physical improvement, routine activity, and generic positive outcomes without a stated favorable future expectation. AUX-R01..R07 match Reviewer 1 on 74.1% of their valid ratings across optimism Core-disagreement cells; AUX-R08 matches Reviewer 2 on 75/113. Revision is needed to require an explicit or strongly entailed future-directed expectation and to exclude current pleasant state, completed improvement, gratitude, luck, and generic positivity by themselves.

### Excitement

Disagreement contains 52 NO↔CLEAR, 39 NO↔PLAUSIBLE, and 21 PLAUSIBLE↔CLEAR. CLEAR was sometimes assigned to feeling seen, gratitude, ordinary improvement, family good news, routine work progress, or general positive mood without strong arousal/eagerness. AUX-R01..R07 match Reviewer 1 on 72.3% of valid ratings; AUX-R08 matches Reviewer 2 on 73/112. The guide must distinguish high-arousal enthusiasm/eagerness from joy, relief, gratitude, interest, and merely favorable events.

### Surprise

Disagreement contains 40 severe and 54 adjacent cases, led by NO↔PLAUSIBLE (49). Examples include smiles, compliments, talkative pets, positive reactions, and notable events without clear unexpectedness; genuine unexpected compliments illustrate the intended boundary. AUX-R01..R07 match Reviewer 1 on 74.6% of valid ratings. The guide must require an unexpected event or violated expectation plus a writer reaction, rather than novelty, intensity, or an interesting outcome alone.

### Joy

The main disagreement is PLAUSIBLE↔CLEAR (48), followed by NO↔CLEAR (22) and NO↔PLAUSIBLE (21). Unlike the other top labels, AUX-R01..R07 are mixed: 40.1% of their valid ratings match Reviewer 1, 31.3% match Reviewer 2, and 28.6% match neither. Examples range from explicit wonderful/delighted states to mild relief, pleasant weather, ordinary improvements, and neutral routines. This is a genuine calibration problem around the current word "Strong" and joy's use as a generic positive umbrella. The guide needs positive-intensity anchors and explicit exclusions for optimism, excitement, gratitude, amusement, love, relief, and mere favorable facts.

### Gratitude

Disagreement is overwhelmingly NO↔PLAUSIBLE (63); only 9 cases are severe. CLEAR/PLAUSIBLE was sometimes inferred from pet recovery, family/friend mentions, praise, fortunate outcomes, or generic happiness without a clear received benefit or kindness. Direct statements such as "I'm grateful" provide a contrasting positive anchor, while conversational "Thanks" requires contextual judgment. AUX-R01..R07 match Reviewer 1 on 76.1% of valid ratings; AUX-R08 matches Reviewer 2 on 57/79. The guide must specify the required benefit/kindness/source relation and distinguish gratitude from relief, joy, appreciation of circumstances, and being pleased with praise.

## Eighteen-label revision verdict

Detailed priorities are in `label-review-priorities.csv`.

- HIGH: optimism, excitement, surprise, joy, gratitude, amusement, disappointment, love.
- MEDIUM: admiration, anger, annoyance, caring, confusion, curiosity, disgust, fear, sadness.
- LOW: remorse.

The three non-top-five HIGH labels are not optional: love has 20 severe disagreements, disappointment 18, and amusement 17. Caring and curiosity remain MEDIUM despite high total disagreement because their disagreements are mostly adjacent and AUX-R01..R07 strongly favor the conservative interpretation; they need boundary examples and threshold anchors, but the evidence for a fundamentally defective definition is weaker than for the HIGH group.

## Options considered

### A. Directly adjudicate all 1,130 disagreements — REJECT

Definitions and Core thresholds are not yet stable. Direct adjudication would collapse disagreement into labels without establishing a shared decision rule and would overstate the result as gold-like certainty.

### B. Revise definitions, then re-review every affected row — PARTLY ACCEPT

The ordering is correct, but re-reviewing every cell touched by any clarification is broader than necessary and could approach a full redo.

### C. Redo all 3,290 overlapping judgments — REJECT

This has the highest human cost and discards useful stable NO↔NO agreement. The evidence identifies specific labels and severe cells, so a full redo is not yet justified.

### D. Human-freeze a revised guide, then targeted dual-Core re-review with masked controls — RECOMMENDED

Revise global NO/PLAUSIBLE/CLEAR anchors and the HIGH/MEDIUM label boundary notes using actual disagreement examples. After human confirmation, both Core reviewers independently re-review all HIGH-label disagreement cells, all MEDIUM-label severe cells, and fixed agreement controls, blind to prior judgments and Auxiliary values. Complete the invalid/missing coverage under the same frozen guide, remeasure agreement, then freeze and execute adjudication only for remaining unresolved cells.

## Reviewer completion decisions

- Reviewer 2 R3-184..R3-221: **supplement after the revised Stage 1 guide is human-frozen**. The 684 placeholders remain permanently invalid and are never restored. Reviewer 2 supplies 684 new judgments. Because the guide will change, Reviewer 1 should independently refresh the same 38×18 cells so both anchors are comparable under one version.
- Reviewer 1 four missing: **complete after guide freeze**, never impute. Because fear, surprise, admiration, and amusement are HIGH/MEDIUM revision labels, Reviewer 2 should also blindly refresh those four paired cells under the same guide.

## Auxiliary decision

- AUX-R01..R05 and AUX-R07: retain as supporting evidence; never form an automatic final label.
- AUX-R06: retain normally on every valid cell using pairwise-complete analysis. Its 36 blanks remain missing; no global downweight is justified by 99.095% coverage.
- AUX-R08: retain raw judgments and report separately, but exclude from consensus/strong-support counts and adjudication vote-like summaries. Its NO count is 1/3,978, agreement/kappa with Reviewer 1 are 5.66%/−0.005, and with Reviewer 2 are 22.53%/0.040. This scale-use pattern is non-comparable with both Core anchors and all other Auxiliary reviewers. It may not be deleted or rewritten and may be inspected only as a separate sensitivity perspective.

## Final reference and ML implication

Final Stage 1 reference set allowed now: **NO**. Stable definitions, calibrated Core semantics, a frozen adjudication policy, and resolved missing/invalid Core coverage are all still absent.

The Human Review results **partially support, and materially strengthen**, the conclusion that supervision semantics and label-boundary consistency are a principal current bottleneck rather than model architecture alone. The systematic threshold split, 337 severe disagreements, and label-specific failures align with the strict sourceGroup Transformer OOF result showing learnable signal within current supervision. They do not prove architecture is irrelevant, because the 221-sample package is disagreement-enriched, partial, and not an independent model evaluation.

## One required sequence

1. Build a blinded boundary-calibration packet from HIGH labels and representative MEDIUM severe cases; do not change ratings.
2. Core reviewers plus the ML Lead revise the general applicability anchors and label boundary notes; human-confirm and version-freeze the guide.
3. Run a masked calibration check on fixed disagreement and agreement-control cells.
4. Both Core reviewers perform the targeted re-review specified in `targeted-rereview-plan.json`.
5. Under the same guide, both Core reviewers cover R3-184..R3-221; Reviewer 1 completes its four missing cells and Reviewer 2 refreshes their paired judgments.
6. Recompute Core agreement, directional confusion, severe disagreement, per-label agreement, and control drift.
7. If calibration gates pass, freeze the adjudication protocol; otherwise stop for methodology revision rather than widening re-review automatically.
8. An independent human adjudicator resolves only the remaining queued cases under the frozen protocol.
9. Freeze the Stage 1 reference set only after all validity and coverage gates pass.
10. Create a versioned supervision-delta and rare-label support/diversity audit; do not overwrite historical labels.
11. Only then design one future ML experiment against a new eligible evaluation protocol—not legal149, Blog360, or protected holdouts.

NO FINAL GOLD LABELS CREATED IN THIS TASK.

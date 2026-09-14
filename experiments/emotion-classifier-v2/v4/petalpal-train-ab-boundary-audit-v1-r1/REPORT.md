DIAGNOSTIC ONLY

# PetalPal train A/B boundary audit

This audit follows `petalpal-train-ab-boundary-audit-v1-r1` and uses only the 841 Train IDs after lock validation. Cells with n < 5 are suppressed. No adjudications, rationales, row-level text, legal149, Blog360, Frozen/protected holdouts, training, inference, or checkpoint evaluation were used.

- legal149 remains retired from further model selection.
- Transformer OOF Macro-F1 0.492306 is not a promoted or final score.
- Blog360 remains NOT_SEALED.
- Pass A used Gemini 3.6 Flash with canonical label order.
- Pass B used Gemini 3.5 Flash with reversed label order.
- Model version and label order are therefore completely confounded.
- This analysis cannot establish human annotation unreliability.
- This analysis cannot establish slot-policy causality.
- This analysis cannot establish source-semantic causality.
- This analysis cannot distinguish rare-label quantity from linguistic/contextual diversity.

See `summary.json` for all counts and permutation results. The permutation is descriptive only: an opportunity baseline, not a causal null, valid cluster-level p-value, or semantic causal test. Source composition-controlled analyses and interval conclusions are marked INCONCLUSIVE where required support was not available.

## Implementation consistency validation

- agreement + strict subset + replacement = 662 + 137 + 42 = 841: PASS.
- disagreement = strict subset + replacement = 137 + 42 = 179: PASS.
- G1′ denominator is disagreement rows: 137 / 179 = 76.5363%; G1′ = `inclusion-form dominant`.
- Each replacement row contributes one total unit, evenly distributed over its A-only × B-only pair set; total replacement contribution = 42.0: PASS.
- Family weighted contributions plus `CROSS_FAMILY_OTHER` = 42.0: PASS.
- `family_row_count` is row involvement, so it may exceed 42 when a row has multiple qualifying pairs.
- The prior 23.5 value was a faulty partial aggregate and has been corrected.

Protocol execution gap remains: A-reference/B-reference composition controls and the required sourceGroup cluster bootstrap were not executed; G2′ and G3′ remain `INCONCLUSIVE`.

## Completed protocol steps

Permutation: 10,000 replicates, seed 44, strata source × (|A|, |B|), complete B-set shuffle. Observed top-three concentration = 0.928571; permutation 95th percentile = 0.928571. G2′ = FAIL.

Raw and composition-controlled source estimates, percentile CIs, common-support coverage, and sourceGroup bootstrap support are in `summary.json`. Bootstrap requested 10,000; valid percentage = 100.00%. The permutation is an opportunity baseline only, not a causal null or formal p-value.

## Final decision-gate closure

Decision gates:

- G1′: `PASS — inclusion-form dominant` (137 / 179 = 76.5363%).
- G2′: `FAIL`. Observed top-three concentration = 0.928571 and permutation 95th percentile = 0.928571; the protocol requires a strictly greater observed value.
- G3′: `FAIL — raw source-association gate not supported`. Raw Reddit–CoSoWELL difference = -0.062192 and corrected sourceGroup-bootstrap 95% CI = [-0.126877, 0.004347], which includes zero. Therefore the necessary raw G3′ condition is not satisfied.

The earlier CI `[-0.049518, -0.049518]` is deprecated and removed from use as an implementation/reporting error. It must not be cited.

Composition-control sensitivity evidence is retained only as incomplete, non-gate evidence: A-reference point estimate = -0.011876 with invalid/untrustworthy CI and reported coverage 0.907125; its existing strata artifact incorrectly includes `Other`. B-reference point estimate = 0.004877, CI [-0.054180, 0.030200], reported coverage 0.902036. These gaps do not affect the conclusion that G3′ cannot PASS under the fixed protocol. G3′ FAIL does not prove that Reddit and CoSoWELL have no difference; it means the current data do not provide evidence satisfying the prespecified robust source-association gate.

DIAGNOSTIC COMPLETE FOR DECISION GATES

Implementation note: `Composition-controlled sensitivity analysis remains partially unverifiable, but cannot change the failed raw prerequisite for G3′.`

Decision-gate execution gaps: NONE.

Non-decision sensitivity-analysis gaps: A-reference CI and strata artifact remain unverifiable/invalid as noted above; composition-controlled bootstrap diagnostics were not fully independently verified.

## Completed protocol steps

Permutation: 10,000 replicates, seed 44, strata source × (|A|, |B|), complete B-set shuffle. Observed top-three concentration = 0.928571; permutation 95th percentile = 0.928571. G2′ = FAIL.

Raw and composition-controlled source estimates, percentile CIs, common-support coverage, and sourceGroup bootstrap support are in `summary.json`. Bootstrap requested 10,000; valid percentage = 100.00%. The permutation is an opportunity baseline only, not a causal null or formal p-value.

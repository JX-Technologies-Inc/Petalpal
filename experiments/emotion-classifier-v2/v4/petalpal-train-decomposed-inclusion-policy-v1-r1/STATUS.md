# Human Review Status — 2026-09-13

## Canonical protocol change

The original Stage 1 / Stage 2 / Stage 3 review plan is stopped. The current round is **Stage 1 semantic applicability review only**.

Active Stage 1 ratings are exactly:

- `NO`
- `PLAUSIBLE`
- `CLEAR`

Stage 2 and Stage 3 are retired. They must not be collected or used for analysis, gold generation, or training targets. The deprecated rule `CLEAR + SUFFICIENT → eligible` must not be used. `PLAUSIBLE` must not be automatically mapped to positive or negative; target policy is a separate ML Lead decision.

Reviewer 1 status is `reviewer_1_only / interim`, not multi-reviewer consensus gold: 221 samples, 3,978 possible Stage 1 ratings, 3,974 observed, and 4 missing. Missing ratings must remain masked, must not be auto-filled, and must not be treated as negative.

Reviewer 2 Stage 1 completion is required before agreement, disagreement, or target-policy analysis. Do not train models and do not modify LOCKED/frozen evaluation.

## Artifact rule

Future model agents must follow this status and the updated `protocol.json`; they must not resume the retired Stage 1/2/3 workflow or consume Stage 2/3 fields.

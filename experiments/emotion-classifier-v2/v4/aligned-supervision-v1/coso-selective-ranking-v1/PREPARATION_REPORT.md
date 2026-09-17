# coso-selective-ranking-v1 — PREPARATION REPORT

**PREPARATION ONLY — TRAINING NOT STARTED**

- Protocol: `protocol.json`
- Mapping guard: **PASS**. Frozen incumbent 28-output order was read from `../experiment/epoch-2-checkpoint/config.json`; exact selected18 indices are recorded in `preparation-audit.json`. No hand-guessed index was used.
- Metric lock guard: **PASS (implementation lock)**. Existing implementation is `candidate-c-lite/scripts/evaluate_frozen_100.py`; its SHA-256 is recorded in `preparation-audit.json`. The incumbent `.34517862965139323` remains a frozen artifact; no Dev baseline was rerun.
- Selector reachability: **FAIL / STOP**. Existing selector audit found **43** conflicting Train 2-label rows and **19** conflicting Dev 2-label rows. Dev affected pairs: `excitement|joy` (3), `annoyance|fear` (3), `admiration|gratitude` (2), `gratitude|love` (1), `joy|optimism` (3), `amusement|excitement` (2), `excitement|optimism` (3), `amusement|joy` (2), `caring|love` (1). The 19 Dev rows are not expressible under the frozen cluster rule; no selector change was made.
- Weighted cardinality guard: **FAIL / STOP**. Mechanical raw locked-841 Train counts are `k=0:196, k=1:452, k=2:193`; frozen source weights are not present as a recoverable artifact, so `[263,596,301]`, sum `1160`, cannot be established. Protocol was not corrected.
- Leakage/hash guards: **RECORDED**. Locked Train/Dev and lock-file SHA-256 values are recorded in `preparation-audit.json`; no inference or evaluation was run.
- Script validation: **PASS**. `prepare.py` passed `py_compile`; `selector_audit.mjs` passed `node --check` and executed only selector audit logic.

## Blockers

1. Frozen source-weight artifact unavailable; weighted cardinality target cannot be verified.
2. Raw locked Train cardinalities do not equal the mandatory weighted target.
3. 19 canonical Dev 2-label gold sets are unexpressible under the frozen selector.

## Boundary

No optimizer step occurred. No training, Dev inference/evaluation, threshold testing, protected evaluation, or second configuration was started. Overall result: **PREPARATION STOPPED**.

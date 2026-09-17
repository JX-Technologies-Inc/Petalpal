# PetalPal ML Data Rights Status

Status-only governance record. This file does not alter dataset contents, checkpoints, metrics, labels, or historical experiment results.

## Current source status

| Source | Current status | Evidence / provenance | Exact source URLs |
|---|---|---|---|
| Reddit-derived / PHQ public-human | **PENDING RIGHTS CLEARANCE** | Recovered workbook documents direct Reddit-linked public-human collection; row-level `Source URL` and `sourceGroupId` provenance preserved. `PHQ` is an internal PetalPal row prefix. | Preserved in row provenance; no new URL introduced here. |
| CoSoWELL | **PENDING RIGHTS CLEARANCE** | Existing source snapshot and provenance records; dataset-specific usage and commercial rights await written confirmation. | Existing URLs remain in source metadata; no new URL introduced here. |
| HUMAN_CONSENTED 54 | **CLEARED on existing documentary-consent evidence** | Collector-confirmed original consent covers ML research, training/fine-tuning, evaluation, product development, deployment, and commercial use. | No additional URL required. |

## Policy for pending-rights data

Data marked **PENDING RIGHTS CLEARANCE** may remain in historical research artifacts and evaluation results. Existing experiments are not deleted. However:

- it must not be newly used for production-targeted model training;
- checkpoints trained on it must not be labeled production-cleared;
- historical metrics and experiment conclusions must not be rewritten;
- status may change to `CLEARED` only after explicit written permission or rights clarification is documented.

Pending status is a governance guard, not a deletion instruction. Historical research/evaluation artifacts remain preserved with their provenance.

## Current production-use rule

Reddit-derived and CoSoWELL sources are not production-cleared. Any future training or deployment decision using them requires documented written rights clearance first. Cleared-data fallback work may proceed independently.

## Evidence limitations

No source URL or permission statement is newly inferred in this document. Where exact permission evidence is absent from the repository, status remains `NOT FOUND — USER INPUT REQUIRED`.


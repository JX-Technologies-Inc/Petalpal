# Preparation QA

Train rows: 841; disagreement rows: 179; controls: 0=14, 1=14, 2=14; review rows: 221; label opportunities per reviewer: 3978.

Both reviewer files are long-format, have no original labels, source, sourceGroup, strata, model/version, final/gold labels, or historical status. Applicability/evidence/ranking/tie fields are blank. No ratings or adjudications were generated. IDs are unique and sample selection uses SHA-256 of `44|stableID`.

Expected workload: 7,956 label opportunities; 15,912 semantic/evidence judgments; 442 row-level workflows; planning estimate 24–40 reviewer-hours.

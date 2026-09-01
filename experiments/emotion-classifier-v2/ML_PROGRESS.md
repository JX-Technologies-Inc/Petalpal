# ML Progress

## Current Direction

- Preferred candidate: Candidate C-Lite (`SamLowe/roberta-base-go_emotions`, ONNX Runtime CPU INT8).
- Deployment direction: Render Free is acceptable for low-traffic functional validation and Daily Grow UX at low concurrency, but its `0.1 CPU` is not a production capacity target.
- The experimental 21-label model analyzes secondary emotions only; the user-selected Primary Garden Mood remains authoritative. Candidate C-Lite is not connected to production.

## Completed

- Candidate A (TF-IDF + OVR Logistic Regression): Macro-F1 `0.506177`, Micro-F1 `0.549516`, median CPU `1.07 ms`, `9.25 MiB`.
- Candidate B (frozen MiniLM + OVR): Macro-F1 `0.413176`; worse and slower than Candidate A.
- Candidate C (PyTorch RoBERTa): Macro-F1 `0.573226`, Micro-F1 `0.619073`, Garden Micro-F1 `0.757580`; median CPU `54.59 ms`, model `480.19 MiB`.
- Candidate C-Lite ONNX FP32 export and dynamic INT8 quantization succeeded; predictions and full 5,228-sample test evaluation were validated.
- C-Lite INT8: Macro-F1 `0.573398`, Micro-F1 `0.618650`, Garden Micro-F1 `0.756672`; model `120.06 MiB` (about 75% smaller than ONNX FP32).
- Per-label dev thresholds, 21-label projection, Garden Mood mapping, runtime comparison, and local `/health`, `/results`, `/benchmark` service checks are complete.
- Render Free 512 MiB feasibility benchmark completed: max RSS `299.89 MiB` (`58.57%`), zero OOMs/errors; concurrency-1 median `198.17 ms`, P95 `400.74 ms`, and throughput about `4.3–4.8 req/s`. Memory is sufficient; the `0.1 CPU` tier is CPU-bound.
- Render decision: current latency is acceptable for low-concurrency Daily Grow validation; throughput scaling is CPU-bound, so Free-tier results must not be used as production capacity estimates.
- PetalPal in-domain v1 final evaluation completed on 100 manually annotated Daily Grow examples using frozen C-Lite INT8, existing per-label thresholds, and the backend selector: strict precision `31.82%`, acceptable precision `36.36%`, useful coverage `22.58%`, correct abstention `77.42%`, unwanted abstention `50.00%`, clearly-wrong rate `4.55%`, Primary redundancy `0.00%`, exact match `34.00%`, acceptable match `42.00%`. Current quality is not ready for unguarded production use. Details: `evaluation/petalpal-in-domain-v1-c-lite-int8-results.json`.
- Failure analysis completed for all 58 unacceptable-match cases: 51 (`87.93%`) are model-probability/false-positive failures, 4 (`6.90%`) are diagnostic threshold near-misses, and 3 (`5.17%`) involve selector/output policy. Short, negation, slang, and subtle Daily Grow language show the largest gaps; threshold tuning alone is unlikely to solve them.
- Failure details: `evaluation/petalpal-in-domain-v1-c-lite-int8-failure-analysis.md` and `.json`.
- In-domain tuning/dev v1 generation and independent review completed: exactly `2,400` accepted (`2,000` Train / `400` Dev), `25%` abstention. Final schema, label, slice, split, exact/normalized duplicate, deterministic near-duplicate, and frozen-100 leakage checks all pass. Files: `tuning-data-v1/train.jsonl`, `tuning-data-v1/dev.jsonl`; QC: `tuning-data-v1/state/final-validation-report.json` and `final-statistics.json`.

## Current Work

- The 2,400-example in-domain tuning/dev dataset is complete and frozen for the next experiment stage; no fine-tuning has started.

## Next Steps

- Design and run the first Candidate C-Lite in-domain fine-tuning experiment only after explicit instruction.

## Do Not Redo

- Do not optimize/retrain Candidate A or MiniLM without new evidence.
- Do not repeat Candidate C export, INT8 quantization, or accuracy evaluation unless artifacts or dependencies change.
- Do not rerun the Render Free 512 MiB memory feasibility benchmark unless the model or runtime changes.
- Do not tune thresholds or selector behavior against the 100-example in-domain gold evaluation set.
- Do not train on, fine-tune on, modify, imitate, or use the frozen 100-example final evaluation set for data-generation prompts or preprocessing-rule optimization; it is final evaluation/failure-analysis only.
- Do not benchmark a higher Render tier until production traffic assumptions or latency SLOs are defined.
- Do not train BERT/DistilBERT or add legacy `moodTrainingData.json` to V2.
- Do not connect TF-IDF, MiniLM, Candidate C, or C-Lite to production yet.

## Important Constraints

- Fair comparisons use the same official GoEmotions splits, 21 labels, 5,228 test samples, thresholds, and Garden mapping.
- No Journal means no secondary ML; ML never overrides Primary Mood; output is at most two secondary emotions.
- Filter `neutral`, `approval`, and `disapproval` from flower variants.
- Tuning data must use AI-assisted synthetic generation plus independent AI review and automated validation/rejection/regeneration; provenance must identify generator/reviewer versions and the data must never be presented as human gold.
- Higher-tier CPU benchmarking remains deferred until production traffic assumptions or latency SLOs are defined.
- Use `graphify-out/graph.json` in this directory for ML navigation; keep it separate from the Product Graph.
- Model binaries, datasets, caches, generated artifacts, and Dockerfiles are intentionally outside the ML Graph's AST scope.

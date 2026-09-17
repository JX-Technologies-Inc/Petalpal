# Semantic Retrieval Benchmark Protocol v1

Status: English-only dev benchmark and gold audit pass; no production model
has been selected. Multilingual retrieval is deferred.

## 2026-09-17 dev gold audit

The original audit found 77 inconsistent positive edges. Root cause was five
systematic generation/mapping defects rather than 77 independent judgments:
stale exact-query ordinals (36), fixed first-Event mapping for topic and
cross-language queries (18), incorrect multi-plausible mapping (12),
paraphrase drift (6), and proper-noun drift (5). A further 24 broad or
hard-negative queries were under-specified even when their existing positive
edge passed the earlier surface-cue check.

Phase 1 is now English-only. The four multilingual slices (`zh-zh`, `en-zh`,
`zh-en`, and `code-switch`) remain in the fixture but are excluded from audit,
benchmark metrics, and model selection. Their data is not repaired in this
phase. The deterministic English source-of-truth derives relevance from owner,
scenario family, English Event metadata, and per-query objective criteria.

The English-only dev audit now passes for 84 queries and 78 positive edges,
with zero unresolved cases, mapping issues, family leakage, or cross-owner
leakage. Held-out families remain closed. Run
`npm run benchmark:semantic:audit` to reproduce the current audit.

## Data and splits

The gold fixture is synthetic and non-sensitive only. It contains no Reddit,
CoSoWELL, user Event, Journal, or unknown-rights material. Future permitted
data is explicitly consented Event data only. The fixture uses 300 synthetic
Events and 180 queries. Queries are split by scenario family, not rows:
`family-02`, `family-05`, `family-08`, and `family-10` are held out. This
prevents near-duplicate Event/query patterns crossing the split.

## Compared strategies

The comparison uses the existing owner-scoped keyword baseline and three fixed
local English candidates using exact cosine retrieval with `summary-v1` and
`structured-v1`: `all-MiniLM-L6-v2`, `bge-small-en-v1.5`, and `e5-small-v2`.
All use quantized ONNX inference through the existing server-side provider
contract. Held-out and multilingual queries are excluded.

Keyword limitations: lexical overlap only, no synonym/paraphrase or
cross-lingual understanding, and no production SQL candidate-pool claim; the
benchmark wrapper ranks the complete in-memory owner-scoped synthetic set.

## Metrics and quality gates

Phase 1 reports Recall@1, Recall@3, Recall@5, Recall@10, MRR, English per-slice
metrics, and separate no-answer counts. No-answer queries are excluded from
ordinary recall denominators.

The following are **PLANNED THRESHOLDS — NOT MEASURED RESULTS**:

- safety tests: zero isolation/deletion/consent/invalid-vector failures;
- held-out Recall@5 >= 0.85;
- held-out MRR >= 0.70;
- semantic candidate Recall@5 no worse than keyword;
- paraphrase Recall@5 improvement >= 0.10 over keyword;
- future ANN Recall@10 relative to exact >= 0.98.

Language-direction and cross-lingual gates are deferred with the multilingual
phase and do not participate in the English candidate decision.

The English dev benchmark selected `bge-small-en-v1.5` with `summary-v1` as the
production candidate. Selection considered aggregate metrics, slice balance,
latency, cost, dimensions, and deployment practicality. No production DB,
pgvector, ANN, reranker, fusion, backfill, multilingual data, or held-out data
was used.

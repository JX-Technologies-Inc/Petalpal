# ML Progress

> **Authoritative current status (2026-09-24):** `FINAL_FORMULATION_REJECT_AND_STOP`; ML experimentation is frozen. The one authorized transport-only rerun of the frozen Jev two-stage formulation completed all 167/167 eligible Dev resolutions and failed semantic gates A, B, and C. No semantic logic changed, and Final was **not accessed during the rerun**. The original transport-incomplete run and its earlier Final checksum access remain disclosed below. The Target-First v1 checkpoint immediately below supersedes all older “current”, “active”, “next”, and continuation statements elsewhere in this historical progress log, including the 2026-09-17 ML V1 freeze. No Target-First candidate was promoted; the incumbent remains unchanged.

## CURRENT CHECKPOINT — Target-First v1 (2026-09-24)

**Transport-only rerun — `FINAL_FORMULATION_REJECT_AND_STOP`.** The original frozen Jev model, prompt, Product-18 definitions, seven pairs, trigger, integration, incumbent, selector, metrics, and gates were unchanged. Transport was frozen at concurrency 1, minimum 2 seconds between requests, and up to three identical-payload retries for HTTP 429/503 using `Retry-After` or 5/10/20 seconds. The single locked Dev 315 rerun had **167 eligible rows, 167 real Jev resolutions, 0 fallbacks, 0 HTTP 429, and 11 HTTP 503** (all recovered): transport success **100%**, completeness gate **PASS**. It changed **86** outputs. Incumbent vs rerun Dev Macro-F1 **.575687→.608468**, Micro-F1 **.607509→.638298**, FP **75→115**, P0 directional Macro **.470238→.150794**; bad→good **3**, good→bad **42**; BOTH control correctness **2/8→4/8**, NEITHER **21/21→21/21**, non-P0 output changes **0**. Gates **A FAIL, B FAIL, C FAIL, D PASS, E PASS, F PASS**. Accepted Train/Dev and incumbent remained unchanged, max-2/Product-18 held, and **Final accessed during rerun: NO**. Artifacts: `v4/selective-supervision-v1/target-first-v1/jev-p0-resolver-transport-rerun-v1/`. No further rerun or semantic modification is authorized; no Final evaluation.

**Current ML decision and handoff.** Retain `v4/aligned-supervision-v1/goemotions-targeted-v1/experiment/epoch-1-checkpoint` as the incumbent; its locked-Dev baseline is Macro-F1 **0.575687**, Micro-F1 **0.607509**, FP **75**, and P0 directional Macro **0.470238**. The transport-complete Jev result rejects the final formulation despite higher overall F1 because P0 directional Macro fell to **0.150794**, good→bad directions reached **42**, and FP rose to **115**. No Jev V2, Candidate V9, further synthetic Train expansion, prompt/trigger/confidence rescue, local pairwise-head rescue, reopening of old formulation experiments, or further formulation redesign is authorized. The next phase is **backend/product integration only**: Event → emotion inference → Flower Engine → memory/report. Start no new ML experiment without genuinely new external evidence. Final must not be accessed again; no Final row was parsed or evaluated in either Jev run, although the original run's post-Dev checksum command read the Final file.

**Original one-shot formulation pilot (historical; transport-incomplete) — `FINAL_FORMULATION_REJECT_AND_STOP`.** The frozen formulation was incumbent max-2 Product-18 output → deterministic P0 trigger → one real `typesafe-ai/jev` four-choice resolution → max-2 integration. The trigger considered exactly the seven fixed P0 pairs when at least one member appeared in incumbent output, chose the pair with the smallest absolute raw incumbent probability difference (fixed pair order on ties), and allowed at most one resolution per Event. Integration applied `A_ONLY`/`B_ONLY` to select that pair member, `BOTH` only within capacity (otherwise original output), and `NEITHER` to remove both without backfill; unrelated incumbent labels were preserved. Train 306 implementation preflight **PASS** with a successful real Jev call. One frozen Dev 315 run made **167** eligible resolution calls, changed **16** outputs, and recorded **120/167** transport fallbacks (107 HTTP 429, 13 HTTP 503) after the single identical-payload retry. Incumbent vs Jev-system Dev Macro-F1 **.575687→.582654**, Micro-F1 **.607509→.613333**, FP **75→83**, P0 directional Macro **.470238→.404762**; bad→good **0**, good→bad **8**; BOTH and NEITHER control correctness deltas **0/8** and **0/21**. Gates **A FAIL, B FAIL, C FAIL, D PASS, E PASS, F FAIL**. Train and Dev accepted files and the incumbent were unchanged; max-2/Product-18 and non-P0 output invariants held. A post-Dev checksum command read the locked Final file, so **Final accessed YES**, despite no Final row parsing, inference, or evaluation. The Final lock content was unchanged. Artifacts: `v4/selective-supervision-v1/target-first-v1/jev-p0-resolver-v1/`. **Stop:** no Jev V2, prompt or threshold rescue, trigger or pair-specific change, local head rescue, Candidate V9, synthetic Train expansion, reopening the old fine-tuning route, or Final evaluation.

**Prior decision and guard (before the final formulation pilot).** The accepted selective-supervision dataset is Train **306**, Dev **315 LOCKED**, Final Test **300 LOCKED and unopened for row-level model selection/training diagnostics**. Candidate V1–V8 and the one controlled V2/Train306 experiment all failed the unchanged locked-Dev gates; none was promoted. The controlled Train 270→306 causal-diversity expansion was rejected and yielded **`STOP_DATA_EXPANSION`** and `REJECT_DEV_STOP_DATA_EXPANSION`. The incumbent remains `v4/aligned-supervision-v1/goemotions-targeted-v1/experiment/epoch-1-checkpoint`. The branch options recorded here were historical possibilities before the final Jev pilot; the final decision above supersedes them.

**Source of truth.** In this section paths are relative to `experiments/emotion-classifier-v2/v4/selective-supervision-v1/target-first-v1/` unless otherwise stated. Current accepted files and their lock audits outrank historical `work/checkpoint.json`, `work/validation-report.json`, and `work/stats.json`: those snapshots still report Train 270 because they preceded the 36-row expansion, and must not be used as the current Train count. Final accepted rows were not parsed or evaluated; the post-pilot checksum read is disclosed above. Dev was the sole model-selection split for the now-closed experiments.

### Supervision decision, taxonomy, and protocol

The old keyword/post-hoc-label route is closed: its keyword pass underselected, and the semantic pilot/repeated relabel route promoted secondary emotions to selected without yielding a stable, predefined target standard. Old annotation and human/model-review artifacts remain provenance/observational evidence, **not human gold** and not valid current training supervision or gap analysis. Stage 2 evidence and Stage 3 `rank_order`/`tie_group` are deprecated and unused; the former `CLEAR + SUFFICIENT` rule is invalid. Do not continue human re-review or manual adjudication under that route. Target-First v1 is **synthetic weak supervision, not human gold**. Sources: `PROTOCOL.md`, `generation-spec.md`, the historical protocol-change records below, and the Target-First accepted artifacts.

The ordered Product-18 taxonomy is `admiration, amusement, anger, annoyance, caring, confusion, curiosity, disappointment, disgust, excitement, fear, gratitude, joy, love, optimism, remorse, sadness, surprise`. Every TARGET assigns one of three states per label: `SELECTED` (primary, BCE positive), `PLAUSIBLE_NOT_SELECTED` (genuinely plausible secondary, masked from BCE), or `NOT_APPLICABLE` (unsupported, BCE negative). The training objective is row-mean BCE over unmasked Product-18 cells plus a within-row selected-over-plausible pairwise ranking term; this is a selective label policy, not a claim of human-ground-truth emotions.

The authoritative Target-First construction workflow was **plan TARGET → freeze its semantic states, role, boundary/P0 coverage, scenario family and hash → write Event afterward → mechanical/schema/linkage/isolation checks → independent semantic QA → append-only Event retry if needed → admit only a passing current attempt**. A TARGET must never be changed to rationalize generated prose. Attempts and failed QA remain immutable history; the `attemptBudget` is enforced, attempt IDs must be globally unique, and at most one attempt per active TARGET may be accepted. Protocol extensions supported same-frozen-TARGET append-only retries, bounded exhausted-attempt recovery with validator-integrity safeguards, and an evidence-gated `POST_GENERATION_TERMINAL` invalidation only for proven `TARGET_CONSTRAINT_CONFLICT`: preserve the invalid TARGET and attempts, exclude them from admission, and permit exactly one new active replacement TARGET with preserved split/coverage/state roles. Event failure alone did not justify invalidation. Split families were atomic; exact, normalized, character-ngram near-template, and delexicalized isolation checks applied. Dev was the locked model-selection split; Final was reserved for a one-time terminal estimate only after a Dev-passing choice. The final formulation was rejected, so no Final evaluation or further Final access is authorized. Sources: `PROTOCOL.md`, `generation-spec.md`, `schema.json`, Dev/Final lock audits.

The historical 1,000-Event pool is `OWNED_SYNTHETIC_UNLABELED_DOMAIN_POOL`: provenance/rights permit only aggregate style constraints (short natural personal Events, ≤300 characters). Its row-level content is not available to TARGET authors, writers, or QA; it is excluded from current supervised Train/Dev/Final, receives no selective labels, and is not current gap-analysis evidence. Do not copy, retrieve, quote, transform, or paraphrase its Events into Target-First Events. Source: `PROTOCOL.md` §1.

### Accepted sets, construction closure, and split integrity

| Split | Accepted artifact | Rows / selected cardinality 0,1,2 | SHA-256 / authority |
|---|---|---|---|
| Train | `accepted/train.jsonl` | **306 / 36,192,78** | `da57b4ab7a6b8a7b672ee301d9b0d884e69e5512325a6d797623592ecd202b14` (current file and Train306 frozen plan) |
| Dev | `accepted/dev.jsonl` | **315 / 48,201,66**, LOCKED | `beef087a052bbebbd089561a2194fc7bc7ffc84b675a7a159a0c3abc818b2bbb`; `work/dev-accepted-final-audit.json`: `DEV_ACCEPTED_315_LOCK_PASS` |
| Final Test | `accepted/final-test.locked.jsonl` | **300 / 45,189,66**, LOCKED; rows not parsed/evaluated | `bf1172c7c5eda0c7f17474f8e07e13b31dd28201c8825bbbbbf54ce16696c049`; `work/final-accepted-final-audit.json`: `FINAL_ACCEPTED_300_LOCK_PASS` |

Selected-label support in Product-18 order: Train `16,17,9,19,33,17,18,18,14,16,17,30,32,24,18,17,17,16`; Dev `17,16,15,16,33,16,15,15,16,16,17,21,33,24,16,15,16,16`; Final `16,15,15,15,32,15,15,15,15,15,16,20,32,23,15,15,16,16`. All 18 labels have selected support. Train's 14 P0 direction counts are listed in the expansion table below. Dev's 14 directions each have 8–9 rows; Final's each have 8–9. Dev both-selected and neither-selected controls pass at **8** and **21** targets; Final controls pass at **8** (4 caring|sadness, 4 joy|love) and **21** (3 per pair). These are coverage counts, not independent claims of model quality.

Dev construction closed at **315 active/accepted** of 317 historical TARGETs. The two proven constraint conflicts `TFV1-DEV-00284` and `TFV1-DEV-00285` were terminally invalidated, retaining their history, and replaced one-for-one by `TFV1-DEV-00316` and `TFV1-DEV-00317` with roles/coverage preserved (`work/final-2-dev-replacement-target-freeze.json`). Mechanical and semantic QA, one-accepted-per-active-TARGET linkage, target/hash provenance, P0/control coverage, validator integrity, and exact/normalized/near-template and family isolation passed; terminally invalidated history is excluded. `work/dev-accepted-final-audit.json` is the lock authority.

Final Plan v1 failed its freeze audit (`work/full-final-target-freeze-audit.json`: `BLOCKED_FINAL_PLAN_TEMPLATE_AND_INDEPENDENCE_FAILURE`) because slot-filled causal templates lacked independent concrete scenarios. Plan v2 rebuilt from the coverage blueprint with new concrete causal mechanisms and passed `work/full-final-v2-target-freeze-audit.json`. The first Event generator then produced widespread malformed/template-like prose: deterministic slot assembly, raw scenario-plan interpolation, explicit emotional-hierarchy wording, and truncation were diagnosed in the semantic QA artifacts. Direct-authored natural prose replaced that generation mechanism for the eventual passing Events. Final closed at **300 active/accepted, LOCKED** with passing linkage/QA/validator/target integrity and zero exact, normalized, or ≥0.80 near-duplicate isolation failures. `work/final-accepted-final-audit.json` records Train↔Final, Dev↔Final, and Final↔Final isolation **PASS**, superseded attempts excluded. Its Train=270 field describes its pre-expansion audit time, not today's Train count. The accepted Final rows have not been parsed or evaluated; the original Jev pilot's checksum read is disclosed above.

### Train P0 expansion and namespace repair

The pre-expansion Train set had **270** accepted rows, only **92** selected→plausible pair-bearing rows in the V2 training control, and narrow causal structure in several P0 directions. The Train→Dev relational audit judged a bounded causal-diversity expansion **`TRAIN_DATA_EXPANSION_JUSTIFIED`** as a falsifiable hypothesis, not a conclusion that more synthetic data would work. V2 margin evidence (`candidate-v5/objective-conflict-audit.json`) shows Train P0 macro positive ordering **0.685629→0.714966** and mean selected-minus-plausible margin **1.176235→1.211708** from base to V2, while locked Dev P0 raw macro moved **0.552579→0.535714** and mean margin **0.175718→0.172683**. The asymmetry and directions below motivated, but did not validate, the single expansion test.

The first provisional 36-row plan was preserved as `work/plans/train-p0-expansion-36-provisional.INVALID_FOR_FREEZE.json` after its planning turn read a mixed target registry containing Dev/Final target-plan metadata. It was never a freeze source. Clean `work/plans/train-p0-expansion-36-clean-provisional-v2.json` was rebuilt from Train-only evidence and a predeclared aggregate allocation without Dev or Final access. One provisional blueprint (`CLEAN-P0-005`) was replaced after its disappointment-state conflict; the full freeze-prep audit then passed **36/36**, zero blockers. `work/plans/train-p0-expansion-36-freeze-receipt.json` froze IDs **`TFV1-TRAIN-00381`–`TFV1-TRAIN-00416`**; the mixed `work/targets.jsonl` registry was a **write-only append destination** (`registryContentRead=false`) in this clean freeze. All 36 Events passed mechanical and semantic QA. Exactly one current passing attempt per new TARGET was accepted, with superseded attempts excluded; the original 270 accepted Train rows remained byte-for-byte unchanged. Accepted Train became **306** with Train-only exact/normalized/near-template isolation and duplicate/linkage/schema checks passing.

| P0 direction | New Train rows | Current Train total |
|---|---:|---:|
| sadness>caring | 3 | 8 |
| caring>sadness | 2 | 8 |
| caring>love | 2 | 9 |
| love>caring | 2 | 9 |
| joy>optimism | 3 | 8 |
| optimism>joy | 3 | 8 |
| joy>excitement | 6 | 8 |
| excitement>joy | 2 | 10 |
| caring>gratitude | 2 | 10 |
| gratitude>caring | 2 | 10 |
| joy>love | 3 | 8 |
| love>joy | 2 | 9 |
| fear>annoyance | 2 | 9 |
| annoyance>fear | 2 | 8 |

Train306 readiness initially stopped on **five** Train↔Dev attempt-ID collisions. All were `IDENTIFIER_NAMESPACE_COLLISION`, **zero** `TRUE_CROSS_SPLIT_ATTEMPT_LEAKAGE`: each colliding Train/Dev record had different Event text, TARGET hash, and scenario family. Only affected Train IDs/provenance were renamed: `TFV1-TRAIN-00381` `TFV1-ATT-0000381→TFV1-ATT-9000001`; `00387` `0000387→9000002`; `00399` `0000399→9000003`; `00405` `0000405→9000004`; `00414` `0000429→9000005` (abbreviated new/old IDs in latter four mappings retain prefix `TFV1-ATT-`). Dev, Event text, TARGET semantics, labels, and V2 configuration were unchanged; Final was not accessed. Train↔Dev global attempt uniqueness and exact/normalized/near-template/family isolation revalidated **PASS**; `candidate-v2-train306/run/readiness-audit.json` subsequently passed at Train 306 / Dev 315.

### Locked-Dev experimental record: incumbent and V1–V8

All metrics below are from the corresponding `official-training-v1/run/summary.json` or `candidate-v{2..8}/run/summary.json` on the same **315 LOCKED Dev**, threshold **0.35**, canonical clustered Product-18 **max-2** selector. Columns are Dev Macro-F1 / Micro-F1 / false positives / P0 directional selection Macro / P0 raw-ranking Macro / all-selected-above-all-plausible rate. All candidate runs used the final checkpoint and **did not access Final**. The nine frozen gates required all to pass; none did. The base is the unchanged `goemotions-targeted-v1/experiment/epoch-1-checkpoint`.

| Model | Exact hypothesis / material change from control | Macro / Micro / FP | P0 directional / raw / above | Gates; decision and inference |
|---|---|---|---|---|
| Incumbent | Frozen base; no Target-First update | `.575687 / .607509 / 75` | `.470238 / .552579 / .569231` | Current incumbent; no Final row evaluation |
| V1 | Test Target-First selective BCE + zero-margin ranking, Train 270; classifier + encoder 10–11, seed 56, 1 epoch | `.581699 / .604730 / 80` | `.445437 / .535714 / .553846` | **3/9 REJECT**; small Macro gain, worse Micro/FP/P0 |
| V2 | V1 with **only** `lambda_rank: 1/18→15/92`, compensating 92/270 pair-bearing dilution | `.582030 / .605753 / 79` | `.453373 / .535714 / .553846` | **4/9 REJECT**; directional/FP slightly better than V1, raw P0 ordering unchanged |
| V3 | V2 with **only** epochs `1→2`, fresh run from same base | `.581224 / .602694 / 82` | `.429563 / .535714 / .553846` | **2/9 REJECT**; lower Train loss, worse Dev, no raw relational gain |
| V4 | V2 with **only** encoder trainable scope `10–11→8–11` | `.582118 / .604730 / 80` | `.437500 / .535714 / .553846` | **2/9 REJECT**; broader score movement without P0 improvement |
| V5 | V2 with **only** rank softplus margin `0→1.0` logit | `.582030 / .605753 / 79` | `.453373 / .535714 / .553846` | **4/9 REJECT**; greater Train margin pressure, same Dev outputs/order; BCE/rank gradients were not destructively conflicting |
| V6 | V2 with **only** trainable scope `classifier + encoder 10–11→classifier only` | `.573420 / .604096 / 76` | `.461310 / .543651 / .561538` | **3/9 REJECT**; more incumbent relational geometry preserved, but overall under-adaptation |
| V7 | V2 with **only** trainable scope `classifier + encoder 10–11→classifier + layer 11` | `.582030 / .605753 / 79` | `.453373 / .535714 / .553846` | **4/9 REJECT**; V2-like behavior; no layer-count sweet spot |
| V8 | V2 with **only** encoder LR `1e-6→1e-7`; classifier LR stayed `1e-6` | `.573420 / .604096 / 76` | `.461310 / .543651 / .561538` | **3/9 REJECT**; classifier-only/V6-like behavior, no useful interpolation |

The V1 control used Train 270, seed 56, one epoch, batch 16, AdamW LR `1e-6`, weight decay `.01`, max length 512, classifier + encoder layers 10–11, row-mean masked BCE plus zero-margin ranking at `lambda_rank=1/18`, no scheduler/early stopping, and final checkpoint only. V2 preserved that recipe except `lambda_rank=15/92`; V3–V8 each changed only the stated factor from V2. The V5 diagnostic (`candidate-v5/objective-conflict-audit.json`) measured base BCE/ranking gradient cosine **+0.349663**, with **0** negative batch cosines; destructive gradient conflict was not supported. No V1–V8 checkpoint was promoted; **Final accessed: NO** for every run.

The locked-Dev relational failure is direction-specific and stable across architectures: at incumbent/V2, raw correct counts were `caring>sadness 0/9`, `caring>gratitude 0/8`, `excitement>joy 2/8`, and `love>joy 1/9` (selector hits `0/9`, `0/8`, `2/8`, `0/9`). The reverse directions were much stronger (`sadness>caring 8/9`, `gratitude>caring 7/8`, `joy>excitement 7/8 incumbent or 6/8 V2`, `joy>love 9/9`). V2's stronger rank objective improved Train ordering/margins but Dev raw ranking stayed below incumbent; V3–V5/V7 repeated the same poor raw boundaries and V6/V8 only moved modestly toward incumbent. This supports a Train→Dev relational generalization/causal-diversity concern, not a threshold-only failure; `TRAIN_DATA_EXPANSION_JUSTIFIED` was the bounded test rationale rather than proof that expansion would help.

### Controlled Train306 falsification and historical route decision

`candidate-v2-train306/frozen-plan.json` froze the V2 control and **only material change** `accepted Train 270→306` (V2 recipe, same base checkpoint, seed 56, one epoch, batch 16, AdamW `1e-6`/`.01`, max length 512, classifier + layers 10–11, selected-positive/NA-negative/plausible-masked row-mean BCE, zero-margin pairwise loss `lambda_rank=15/92`, threshold `.35`, canonical max-2, nine gates, final checkpoint only, no scheduler/early stop/sweep). The attempt-ID repair changed identifiers/provenance only; Event text, TARGETs, semantics, label states and Dev data were invariant. Readiness `PASS`; Train **306**, Dev **315 LOCKED**, Final **unopened**. This one run was the explicit stop/go falsification of further synthetic Train expansion, not the start of a 306→342→378 sequence.

`candidate-v2-train306/run/summary.json`: 1 epoch / 306 rows; mean training loss **.232182397**, masked BCE **.173314453**, unweighted ranking loss **.361056691**. Locked Dev Macro-F1 **.581699245**, Micro-F1 **.604729730**, FP **80**, P0 directional **.445436508**, P0 raw ranking **.535714286**, selected-above-plausible **.553846154**; **3/9** gates passed, `REJECT_DEV`. Versus V2 (`.582029932/.605752961/79`, P0 `.453373016/.535714286/.553846154`), the expanded run had **zero bad→good and zero good→bad raw P0 flips**. Versus incumbent (`.575686656/.607508532/75`, P0 `.470238095/.552579365/.569230769`), it had **zero bad→good and two good→bad** raw flips (`joy>optimism`, `joy>excitement`). The four low-diversity directions remained `caring>sadness 0/9`, `caring>gratitude 0/8`, `excitement>joy 2/8`, `love>joy 1/9`; no meaningful locked-Dev relational gain appeared. Final accessed **NO**. The frozen stop/go rule required raw and selected-above-plausible gains ≥.030 over V2, positive net flips, and FP rise ≤4; its substantive relational requirements failed. **Recommendation: `STOP_DATA_EXPANSION`; final status: `REJECT_DEV_STOP_DATA_EXPANSION`.**

**Closed under the earlier Target-First fine-tuning formulation:** more synthetic Target-First Train expansion (including 306→342→378), more epochs, broader encoder-depth or layer-count sweet-spot search, simple ranking-weight or positive-margin increases, differential encoder-LR micro-search, threshold sweeps in response to threshold-independent raw-order failure, and Candidate V9-style small hyperparameter variations. V1–V8 plus Train306 did not produce meaningful locked-Dev P0 generalization. The evidence does **not** say data can never help or the task is impossible; it says the present bottleneck is not simply optimization time, ranking coefficient, destructive BCE/ranking conflict, encoder capacity/depth, or this one bounded causal-diversity expansion. Train relational behavior and some per-label Dev metrics can improve without reliable transfer of target P0 boundaries. The incumbent was retained; Dev remained LOCKED and Final 300 remained locked without row-level evaluation. **Historical route status: `CURRENT_TARGET_FIRST_FINE_TUNING_ROUTE_CLOSED_AFTER_V1_V8_AND_TRAIN306`; superseded by the final formulation decision above.**

## Historical chronology below (superseded where it says “current”)

## Canonical Human Review Protocol Change — 2026-09-13

- The original Stage 1 / Stage 2 / Stage 3 human-review plan is stopped. This round formally retains **Stage 1 semantic applicability review only**, with ratings `NO`, `PLAUSIBLE`, and `CLEAR`.
- Stage 2 and Stage 3 are retired: do not collect them and do not use them for analysis, gold generation, or training targets. The old rule `CLEAR + SUFFICIENT → eligible` is deprecated and must not be used.
- Stage 1 `PLAUSIBLE` must not be automatically treated as positive or negative; target policy requires a separate ML Lead decision.
- Reviewer 1 is `reviewer_1_only / interim`, not multi-reviewer consensus gold: 221 samples, 3,978 possible ratings, 3,974 observed, 4 missing. Missing values remain masked and must not be auto-filled or treated as negative.
- Wait for Reviewer 2 Stage 1 completion before agreement, disagreement, or target-policy analysis. Do not train models or modify LOCKED/frozen evaluation.
- Canonical artifact: `experiments/emotion-classifier-v2/v4/petalpal-train-decomposed-inclusion-policy-v1-r1/STATUS.md`.

## Current Direction

- 2026-09-07 follow-up: **old 125 Human Dev retired from further model selection** by user instruction; retain 56.06% unchanged. Active work is public authentic narrative acquisition in `v4/independent-human-v1/`. No Frozen-3; no new score yet.

- Active V4 status (2026-09-07): best **AI-annotated, source-disjoint human-text Dev Macro-F1 0.560632**, fixed original/extra-human 50:50 probability blend @0.35. Macro target0.60 not reached; no human-gold/observed-Primary production claim. See `v4/auto-v3/REPORT.md`.
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
- Candidate C-Lite in-domain fine-tuning completed for 5 epochs. Epoch 4 is the locked best checkpoint with Dev 21-label macro-F1 `0.9304`.
- Frozen 100 final product evaluation completed: strict 18-label macro-F1 `0.2908`, micro-F1 `0.2880`, acceptable match `0.48`, exact expected match `0.38`, useful coverage `0.2903`, clearly-wrong emotion rate `0.0233`, and unwanted abstention rate `0.4677`. The main failure mode is over-abstention / low recall.
- Frozen over-abstention analysis: 59/100 returned no variant. The locked final report did not persist per-example probabilities or pre/post-selector candidates, so the 59 cannot be exactly apportioned without rerunning the opened set. Existing pre-fine-tune Frozen diagnostics attribute failures mainly to weak/incorrect model probabilities plus in-domain mismatch (`51/58`), with threshold near-misses (`4/58`) and selector policy (`3/58`) secondary. The fixed `0.5` cutoff amplifies low recall when in-domain scores fall below Dev levels; the selector then intentionally removes excluded, Primary-redundant, and semantic-duplicate labels. The large synthetic Dev (`0.9304`) versus human Frozen (`0.2908`) gap is strongest evidence of Train/Dev-to-product distribution mismatch, not a selector defect.
- Opened Frozen positive-score diagnostic at fixed `0.5` (distribution is min/median/max; FN is positives below threshold):

| Product label | Positive score distribution | FN | Diagnostic |
|---|---:|---:|---|
| admiration | `.015/.128/.840` | 2/3 | representation/distribution |
| amusement | `.002/.004/.014` | 9/9 | representation/distribution |
| anger | no positives | 0 | insufficient Frozen coverage |
| annoyance | `.008/.186/.670` | 2/3 | representation/distribution |
| caring | `.009/.009/.009` | 1/1 | representation/distribution |
| confusion | `.151/.466/.814` | 2/4 | mixed calibration/representation |
| curiosity | no positives | 0 | insufficient Frozen coverage |
| disappointment | `.004/.217/.645` | 8/9 | mainly representation/distribution |
| disgust | `.003/.011/.033` | 6/6 | representation/distribution |
| excitement | `.016/.263/.794` | 5/6 | mainly representation/distribution |
| fear | `.746/.780/.814` | 0/2 | no observed FN |
| gratitude | `.023/.095/.767` | 6/8 | representation/distribution |
| joy | `.001/.026/.867` | 8/9 | representation/distribution |
| love | `.006/.694/.719` | 1/3 | isolated representation miss |
| optimism | `.006/.336/.937` | 3/6 | bimodal distribution mismatch |
| remorse | `.012/.408/.940` | 2/3 | mixed calibration/representation |
| sadness | `.003/.099/.773` | 3/4 | representation/distribution |
| surprise | `.001/.017/.422` | 6/6 | mainly representation/distribution |

- Conclusion: most missed positives are far below `0.5`, so threshold calibration alone cannot explain or repair the recall gap. The dominant evidence remains representation/product-distribution mismatch; confusion and remorse contain limited near-threshold calibration cases. Anger and curiosity cannot be assessed from this Frozen set because they have no strict-positive examples.
- Train/Dev data audit: exact/normalized overlap is zero and `sourceGroupId` is split-disjoint, but lexical/template separation is weak. Dev-to-Train nearest char-ngram similarity has median `0.822`; `235/400` Dev rows are ≥`0.80`, `39/400` are ≥`0.90`, and several pairs differ only by a person/location substitution or an appended stock sentence. Repeated frames include “I really admire how…”, “I was disappointed that…”, and “The moment stayed with me…”.
- Only about `2.1–2.3%` of positive labels appear literally in the journal, so direct label-word leakage is not the main issue. However, examples are generally short (median `12` words), clean, canonical, and emotionally unambiguous compared with real Daily Grow input. Shared generation templates and near-paraphrases make Dev unusually easy and likely inflate its `0.9304` macro-F1; the large human-product gap supports this conclusion. Treat current Dev as pipeline validation, not a reliable estimate of product generalization.
- Hybrid human-majority dataset v2 completed separately at `hybrid-data-v2/`: `2,000` Train / `400` Dev, all 18 Flower Variant labels balanced at `111–112` Train and `22–23` Dev examples. Train sources: EmpatheticDialogues `1,379`, GoEmotions `531`, retained PetalPal synthetic `90`; Dev: `276`, `106`, `18`. Journals are `1–57` words in Train and `1–54` in Dev (median `15` each).
- Hybrid v2 audit: normalized duplicate overlap `0`, source-group overlap `0`; 14 Dev candidates at char-ngram similarity ≥`0.80` were rejected. Final Dev→Train nearest similarity is median `0.335`, P95 `0.563`, max `0.798`. Files: `hybrid-data-v2/train.jsonl`, `dev.jsonl`, and `audit.json`. Existing datasets and Frozen sets remain unchanged.
- Hybrid v2 ED label cleanup completed for the approved noisy examples: 4 remapped, 5 dropped, 5 clean ED-valid replacements added, and 1 retained unchanged. Dev remains `400`; label counts remain tightly balanced at `21–23`. Normalized/source-group overlap remains `0`; Dev→Train similarity remains median `0.335`, P95 `0.563`, max `0.798`. Exact changes are recorded in `hybrid-data-v2/audit.json`.
- Hybrid-data-v2 best-checkpoint Dev evaluation at threshold `0.5`: 18-label Macro P/R/F1 `0.7945 / 0.6805 / 0.7289`; Micro P/R/F1 `0.8000 / 0.6800 / 0.7351`. Per-label F1: admiration `0.7619`, amusement `0.9130`, anger `0.4865`, annoyance `0.5854`, caring `0.7805`, confusion `0.6512`, curiosity `0.7179`, disappointment `0.5143`, disgust `0.7692`, excitement `0.6842`, fear `0.8372`, gratitude `0.7805`, joy `0.7111`, love `0.8837`, optimism `0.7442`, remorse `0.9333`, sadness `0.6667`, surprise `0.7000`.
- Metric scope note: the previous training Macro-F1 `0.6248` included all 21 classifier labels; the product-relevant 18-label Macro-F1 is `0.7289` and is the appropriate Flower Variant metric.
- Hybrid V2 Clean final 18-label Dev: Macro P/R/F1 `0.8079 / 0.6942 / 0.7438`; Micro P/R/F1 `0.8105 / 0.6950 / 0.7483`. Improvement over V2: Macro-F1 `0.7289 → 0.7438`; Micro-F1 `0.7351 → 0.7483`. Best current checkpoint: `candidate-c-lite/fine-tuned-hybrid-v2-clean/best-checkpoint`.
- Hybrid-v3 human-written Train/Dev created at `hybrid-v3/`: `2,000 / 400`, using only unused EmpatheticDialogues and GoEmotions sources. Both splits are exactly `65%` single-label, `30%` two-label, and `5%` 3+-label; original qualifying Flower labels are preserved and all 18 labels are balanced (`156` each in Train, `31–32` in Dev). Source-group isolation, exact/normalized duplicate, and `<0.80` near-duplicate checks against existing Train/Dev/Test all pass; Frozen 100 was not accessed. See `hybrid-v3/audit.json`.
- Hybrid-test-v2 final evaluation completed on 360 previously untouched human-written examples, exactly 20 per Flower Variant label. Macro P/R/F1 `0.8024 / 0.6861 / 0.7319`; Micro P/R/F1 `0.7994 / 0.6861 / 0.7384`. Per-label F1: admiration `0.8649`, amusement `0.9756`, anger `0.7222`, annoyance `0.5714`, caring `0.7895`, confusion `0.7429`, curiosity `0.7692`, disappointment `0.6500`, disgust `0.7027`, excitement `0.5882`, fear `0.8718`, gratitude `0.7027`, joy `0.4737`, love `0.8780`, optimism `0.7179`, remorse `0.9189`, sadness `0.7500`, surprise `0.4848`. The set is now opened/final and prohibited from all future tuning or model selection.
- PetalPal-domain-v1 human-only Train/Dev created separately: `2,000 / 400`, using unused EmpatheticDialogues and GoEmotions groups only. Each split is exactly `62%` emotion-required, `31%` NONE-preferred, and `7%` optional; all 18 Flower labels are balanced across required cases, with single- and multi-label examples. Word counts are 4–18 with median `10`; normalized/source-group overlap with existing hybrid Train/Dev/Test and between the new splits is `0`; maximum near-duplicate similarity is `0.798` at the `0.80` rejection boundary. Files: `petalpal-domain-v1/train.jsonl`, `dev.jsonl`, and `audit.json`. Dev remains held out from Train.
- PetalPal-domain-v1 training completed with best Dev Macro-F1 `0.6097`. Hybrid Test 18-label Macro P/R/F1: `0.7826 / 0.6333 / 0.6892`; Micro P/R/F1: `0.7808 / 0.6333 / 0.6994`. Versus Hybrid V2 Clean, Macro-F1 regressed `4.27pp` and Micro-F1 regressed `3.90pp`. Short-text proxy-domain resampling does not solve the PetalPal domain gap; do not promote this checkpoint. Hybrid V2 Clean remains the current best.
- Conditional-v1 human-written Train/Dev created at `conditional-v1/`: `2,000 / 400`, balanced across the six defensibly assignable Primary Moods. It contains `1,298 / 262` Primary-only examples and `702 / 138` multi-emotion examples; Primary labels are deterministically derived from ED/GoEmotions source labels and removed from `modelLabels`. Schema, source-group isolation, exact/normalized duplicates, and `<0.80` near-duplicate checks against existing Train/Dev/Test all pass; Frozen 100 was not accessed. See `conditional-v1/audit.json`.
- Conditional V1 A/B completed on identical human-written `conditional-v1` data. Conditioned (`Primary Mood + Journal`) ran 5 epochs; best epoch `4`, Dev Macro-F1 `0.2904`, Micro-F1 `0.5704`. Journal-only control was manually stopped after epoch 3; best observed epoch `2`, Dev Macro-F1 `0.2875`, Micro-F1 `0.5703`. Primary Mood conditioning showed no meaningful improvement over the matched control; do not pursue Conditional V2/V3 using this approach. Hybrid V2 Clean remains the current best general classifier (held-out Human Test Macro-F1 `0.7319`).
- Hybrid V3 used `65%` single-label / `30%` two-label / `5%` three-or-more-label data. Best Dev Macro-F1: `0.6197`. Human Test Macro P/R/F1: `0.6517 / 0.6361 / 0.6263`; Micro P/R/F1: `0.6326 / 0.6361 / 0.6343`. Versus Hybrid V2 Clean, Macro-F1 regressed `10.56pp` and Micro-F1 regressed `10.41pp`. The current multi-label mixture degrades held-out generalization; do not promote V3. Hybrid V2 Clean remains the current best.
- Phase 1 conclusion: Hybrid V2 Clean Train/Dev is `100%` single-label and remains the strongest general-emotion baseline/backbone (held-out Human Test Macro-F1 `0.7319`), but its Frozen 100 Macro-F1 `0.2102` does not validate it for PetalPal-specific secondary-emotion production. Hybrid V3 added real multi-label supervision (`65% / 30% / 5%` for one/two/three-or-more labels), scoring Human Test Macro-F1 `0.6263` and Frozen Macro-F1 `0.2379`; its slight Frozen classification gain came with substantial generalization and product-metric regressions, so V3 is archived. Public ED/GoEmotions data is sufficient for a general baseline but not the PetalPal-specific task; do not continue V4/V5 on these public datasets. The next ML phase must wait for real or deliberately human-annotated PetalPal-style journals, then create new Train/Dev/untouched Test data for domain adaptation. Frozen 100 remains opened diagnostic data only and is prohibited from further tuning or model selection.
- V2 Clean Frozen 100 product evaluation: Macro-F1 `0.2102`, Micro-F1 `0.2720`, acceptable precision `0.5116`, useful coverage `0.3226`, correct abstention `0.7742`, unwanted abstention `0.4516`, clearly-wrong emotion rate `0.0465`, exact match `0.37`, and acceptable match `0.51`. Frozen 100 is opened diagnostic data and must not be used for further tuning or model selection.
- Human-Augmented V2 training completed for 5 epochs from `candidate-c/artifacts/checkpoint` using `train-human-augmented-v2.jsonl`: original Train `2,000` + `197` eligible real-heavy augmentations = `2,197`. Best Dev Macro-F1: `0.931123`; best checkpoint: `candidate-c-lite/fine-tuned-human-augmented-v2/best-checkpoint`.
- Real-Heavy Dev 13 evaluation: old Candidate C-Lite Macro/Micro-F1 `0.1296 / 0.4444`; Human-Augmented V2 Macro/Micro-F1 `0.2085 / 0.5854`. Human-style generalization improved materially over the old Candidate C-Lite.
- Human-Augmented V2 Frozen 100 final evaluation: Macro-F1 `0.2902`, Micro-F1 `0.3101`, exact expected match `0.37`, acceptable match `0.49`, clearly-wrong emotion rate `0.0213`, unwanted abstention rate `0.4677`; output distribution: `0` emotions = `58`, `1` = `37`, `2` = `5`. The main remaining problem is recall / excessive abstention. Human-Augmented V2 is the current final candidate.
- Human-Augmented V3 training completed for 5 epochs from `candidate-c/artifacts/checkpoint` using original Train `2,000` + public-human `625` = `2,625`; original Dev `400` remained unchanged. Output: `candidate-c-lite/fine-tuned-human-augmented-v3`; best checkpoint: `candidate-c-lite/fine-tuned-human-augmented-v3/best-checkpoint`; best Dev Macro-F1: `0.9213933349`. `frozenEvaluationUsed=false`; `frozenGuardPassed=true`.
- Human-Augmented V3 old Frozen 100 diagnostic at threshold `0.5`: Macro-F1 `0.2610722611`, Micro-F1 `0.3076923077`, exact match `0.37`, acceptable match `0.48`, useful coverage `0.3387096774`, unwanted abstention `0.4193548387`, clearly-wrong emotion rate `0.0416666667`; output counts: `0=56`, `1=40`, `2=4`.
- V2/V3 experimental comparison: V2 best Dev Macro-F1 `0.9311233759`, Frozen Macro/Micro-F1 `0.2901607652 / 0.3100775194`, exact/acceptable match `0.37 / 0.49`, unwanted abstention `0.4677419`, clearly-wrong rate `0.0212766`, outputs `0=58 / 1=37 / 2=5`. V3 Dev Macro-F1 was lower; Frozen Micro-F1 was essentially flat while Macro-F1 declined. V3 reduced unwanted abstention from about `46.8%` to `41.9%`, but increased clearly-wrong rate from about `2.1%` to `4.2%`. Adding public-human data did not improve overall Frozen performance. This is an experimental observation only.
- Frozen-2 created and locked at `frozen-2/` with `100` public-human examples. Final leakage audit: PASS; exact overlap `0`, normalized overlap `0`, source-group/thread overlap `0`, Train/Dev near-duplicates at char-ngram similarity `>=0.80` `0`, internal duplicates `0`, and internal near-duplicates `0`. Status: `FROZEN_2_LOCKED`; it may be used only once for final evaluation.
- Human-Augmented V3-B trained for 5 epochs on Human-Augmented V3 Train `2,625` with learning rate `1.5e-5`. Best checkpoint: `candidate-c-lite/fine-tuned-human-augmented-v3-lr15e-6/best-checkpoint`; best Dev Macro-F1 at `0.5`: `0.915108`. Its best Dev threshold was `0.45`, with Macro-F1 `0.923793` and Micro-F1 `0.916959`. V3-B did not outperform original V3.
- Final selection was completed on Dev before Frozen-2: `candidate-c-lite/fine-tuned-human-augmented-v3/best-checkpoint` with global threshold `0.45`. Original V3 Dev at `0.45`: Macro-F1 `0.925195`, Micro-F1 `0.920561`.
- ONE-TIME FINAL Frozen-2 evaluation completed on `100` examples using original Human-Augmented V3 at threshold `0.45`. Macro P/R/F1: `0.266975 / 0.193107 / 0.196718`; Micro P/R/F1: `0.348485 / 0.252747 / 0.292994`; exact match `0.23`, acceptable match `0.23`, useful coverage `0.252747`, correct abstention `0.333333`, unwanted abstention `0.384615`, clearly-wrong emotion rate `0.0`, primary redundancy rate `0.257576`; output distribution: `0=38`, `1=58`, `2=4`.
- Frozen-2 conclusion: a large synthetic-Dev to real-human generalization gap remains. The V3 Frozen-2 result is fixed historical evidence. Frozen-2 has been opened/evaluated and cannot be reused for further selection or development.
- Frozen-2 100 human benchmark comparison used only Dev-selected thresholds chosen before any Frozen-2 results: V2 `candidate-c-lite/fine-tuned-human-augmented-v2/best-checkpoint` at `0.35`; V3 `candidate-c-lite/fine-tuned-human-augmented-v3/best-checkpoint` at `0.45`; V3-B `candidate-c-lite/fine-tuned-human-augmented-v3-lr15e-6/best-checkpoint` at `0.45`.
- V2 Frozen-2 benchmark: Macro-F1 `0.233439`, Micro-F1 `0.285714`, Micro P/R `0.311688 / 0.263736`, exact/acceptable match `0.26 / 0.26`, useful coverage `0.263736`, unwanted abstention `0.263736`, clearly-wrong rate `0.0`, primary redundancy `0.272727`; outputs `0=28 / 1=67 / 2=5`.
- V3 Frozen-2 benchmark: Macro-F1 `0.196718`, Micro-F1 `0.292994`, Micro P/R `0.348485 / 0.252747`, exact/acceptable match `0.23 / 0.23`, useful coverage `0.252747`, unwanted abstention `0.384615`, clearly-wrong rate `0.0`, primary redundancy `0.257576`; outputs `0=38 / 1=58 / 2=4`.
- V3-B Frozen-2 benchmark: Macro-F1 `0.186371`, Micro-F1 `0.269231`, Micro P/R `0.323077 / 0.230769`, exact/acceptable match `0.21 / 0.21`, useful coverage `0.230769`, unwanted abstention `0.395604`, clearly-wrong rate `0.0`, primary redundancy `0.261538`; outputs `0=39 / 1=57 / 2=4`.
- Benchmark interpretation: V2 led Macro-F1, exact/acceptable match, useful coverage, and abstention performance. V3 had slightly higher Micro-F1 and Micro Precision but abstained more. V3-B beat neither V3 nor V2, so lowering LR to `1.5e-5` did not help. Expanding V3 to `625` public-human rows did not produce the expected overall human-benchmark improvement, and the synthetic-Dev to human-benchmark generalization gap remains. Frozen-2 is no longer an untouched final holdout and is now human benchmark / diagnostic data only.

## Current Work

- Synthetic V1 is an archived biased baseline; do not use it for further tuning or model selection.
- PetalPal-domain V1 is an archived failed experiment; do not promote it.
- Conditional V1 and its matched control are archived; Primary Mood conditioning showed no meaningful gain.
- Hybrid V2 Clean is the current best general baseline/candidate backbone, not a production-validated PetalPal secondary-emotion model.
- Hybrid V3 is archived.
- Human-Augmented V3 at global threshold `0.45` was the historical selected candidate; its Frozen-2 result remains fixed historical evidence. Current V4 proxy-development results are below.
- Preserve both Human-Augmented V2 and V3 checkpoints; do not delete either.

## Next Steps

- Current: complete source-diverse development validation with independent automated adjudication before further small-Dev searching or any Frozen-3 lock. The historical pre-V4 audit prerequisite below has been completed; no user annotation/file-moving is requested.
- Any future V4 development must use Train/Dev only and requires a new untouched final holdout, such as Frozen-3, for its one final evaluation.
- Before any V4 training, audit the `625` public-human augmentation for label quality, label distribution, fixed-label mapping, and domain/task fit; do not immediately continue LR tuning or V4 training.

## Do Not Redo

- Do not optimize/retrain Candidate A or MiniLM without new evidence.
- Do not repeat Candidate C export, INT8 quantization, or accuracy evaluation unless artifacts or dependencies change.
- Do not rerun the Render Free 512 MiB memory feasibility benchmark unless the model or runtime changes.
- Do not tune thresholds or selector behavior against the 100-example in-domain gold evaluation set.
- Do not train on, fine-tune on, modify, imitate, or use the frozen 100-example final evaluation set for data-generation prompts or preprocessing-rule optimization; it is final evaluation/failure-analysis only.
- Frozen 100 has been viewed multiple times and is now diagnostic benchmark data only; it must not be used for threshold tuning, model selection, data generation, or another future final-quality claim.
- Frozen-2 has been opened/evaluated multiple times and is human benchmark / diagnostic data only. Its thresholds were selected on Dev before inspection; never use Frozen-2 for model selection, threshold tuning, training-data design, V4 tuning, training, data generation, or Train/Dev changes. A truly untouched future final evaluation requires a new Frozen-3.
- `hybrid-test-v2/test.jsonl` is opened/final: never use it for future tuning, training, threshold calibration, preprocessing decisions, or model selection.
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

## V4 takeover — 2026-09-07: supervision audit and development gate

This section supersedes the historical “final selected candidate” as the active development status. No new model is promoted. REAL-HUMAN source-disjoint Dev Macro-F1 >=0.60 is **not achieved or measurable with the currently verified annotations**. This is not evidence that 0.60 is impossible.

### Completed audit

- Reproducible evidence: `v4/audit.py`, `v4/audit.json`; detailed 25-item pipeline review and next-input requirements: `v4/README.md`.
- Disk V3 Train has 2,625 records and an identical original-2,000 prefix. Historical training summary contains neither input hashes nor counts, so exact historical bytes are not independently proven. New runs log both.
- 605/625 human rows retain `NEEDS_MANUAL_LABEL_REVIEW` notes despite `USER_REVIEW`/`trainingEligible=true`. Those metadata do not establish gold labels. 20 are marked manually corrected, covering only fear (4), joy (1), neutral (2), and 13 empty fixed-label sets. Source workbook is required to verify actual manual final fields. All 625 have null Primary.
- 78 rows contain customs; 21 have customs but no product label. Customs are preserved; no automatic remapping or fabricated labels introduced.
- 179 canonical Reddit threads; 18 have multiple legacy sourceGroupIds. Exact duplicates 0, normalized duplicate excess 4, lexical cosine >=.80 pairs 6, local MiniLM semantic cosine >=.85 candidates 9. Semantic candidates are conservatively grouped; equivalence review is still required before certification.
- 37 human rows share source threads with previous 197; exact/normalized overlap 0. Old Human Dev13 has only 6 canonical threads and covers 10 product labels; it is not a sufficient 18-label development benchmark. No new quality score was calculated on it.
- Strong skew: joy 206 / gratitude 119 versus curiosity 4 / admiration 6. Uniform V3 sampling gives human rows 23.81% of examples; reweighting proposed labels before verifying them is unjustified.
- `v4/gradient-diagnostic.json`: original checkpoint, zero optimizer updates, nonzero selected-head gradient norms for two sampled human rows (0.10385 and 0.83071). Human rows reach the objective; this does not prove historical gradient history or beneficial supervision.
- Historical evaluator code review only: Frozen-2 `clearlyWrong=[]` makes wrong rate zero uninformative; its redundancy denominator uses proposed primary-emotion labels rather than canonical Bloom redundancy; `or` fallback loses explicitly empty final annotations. Historical results were not changed or re-evaluated.

### Confirmed repairs and verification

- `candidate-c-lite/scripts/data_safety.py`: benchmark path guard including Frozen-2/3 and hybrid-test-v2, normalized-text and canonical-thread split checks. Filename protection is not exhaustive content provenance protection.
- `fine_tune.py`: correct sample weighting for partial gradient-accumulation groups and short final batches; sample-weighted Dev loss; all eight Primaries accepted; reject empty datasets/held-out row markers/invalid arguments; prevent experiment overwrites; log dataset sizes, SHA256s and hyperparameters.
- 28→21 named projection, float multi-hot BCE targets, tokenizer/masks, linear warmup and 21→18 product selector inspected; no confirmed mapping/selector implementation bug. Synthetic Dev checkpoint selection remains inappropriate for V4. The legacy training defaults are not a V4 release protocol.
- `v4/test_regressions.py`: 5 tests passed, including actual gradient equivalence to a combined batch, thread aliases, normalized leakage, all benchmark path guards, label mapping/metric sanity and eight Primaries.
- `v4/smoke-pipeline/smoke-result.json`: original checkpoint, one synthetic Train / one synthetic Dev example, one update; forward/backward/evaluation passed on CPU. Macro-F1 0.0 is a smoke artifact, **not Human Dev performance**. No checkpoint was saved/promoted. Hyperparameters are in the result; this did not use Human/Frozen data for selection.

### Prepared Human development work

- `v4/annotation-queue.jsonl` preserves all 625 legacy proposals/provenance separately with training eligibility false.
- `v4/prepare_review_split.py` preassigns 525 Train / 100 Dev over 174 connected source/duplicate components by SHA256 seed 42, without labels or model predictions. All hard/custom examples remain. `train-review.jsonl` / `dev-review.jsonl` are blind annotation queues, **not certified gold datasets**. `split-manifest.json` records limits and pending benchmark source-only exclusion.
- `v4/evaluate_dev.py` uses actual product selection, fixed 18-label P/R/F1/support and all requested product metrics; persists probabilities, distinguishes undefined rates from zero, and fails on missing review/product fields, certification or training-lineage approval. V2/V3/V3-B cannot be treated as unseen baselines on rows they trained on.
- Experiment `v4-baseline`: **DATA_BLOCKED, not trained, no Human metrics/threshold/checkpoint selected**. Original-checkpoint lineage audit, verified annotations, benchmark exclusion and coverage must pass first. Then select epochs on Human Dev, compare reduced synthetic influence/reliable-human weighting, and only then coarse global calibration. No repeated speculative runs on unverified gold.

### Current blocker and next action

- Original `/Users/xingranma/Desktop/ml` directory access was rejected by macOS. User supplied `experiments/emotion-classifier-v2/v4-input/`; it did not exist and was created. At latest inspection it contains no workbook. Need the source 625 workbook there to reconcile final/proposed annotations; raw workbook may reveal additional review but JSONL does not establish it.
- Even trusting 20 corrected rows, coverage is only 2/18 product labels and no observed Primaries. Need independently reviewed real journals with observed/user-selected Primary, explicit secondary/custom/abstention annotations and enough independent sources covering all 18 labels. Suggested initial Dev support is >=20 positives per label, with uncertainty reported; do not drop hard labels or infer missing labels to achieve coverage.
- No Frozen-100, Frozen-2 or Hybrid Test content was loaded. No Frozen-3 creation/evaluation. Historical checkpoints and failed experiments preserved; no production changes made.

## V4 autonomous continuation — 2026-09-07 (AI annotation authorized)

The user explicitly authorized automated labeling/adjudication and requested no manual file-moving or annotation. The prior human-review-only data gate is superseded for **AI-annotated human-text proxy development**, not for claims of human-gold or observed-Primary product validation.

- Reused all 625 source-linked PUBLIC_HUMAN excerpts already in the repo. No original journals rewritten. Original workbook still not available, but it is no longer a prerequisite to relabel raw text. No request for user data work.
- `v4/auto-v1/pass1.jsonl`: individual text-only annotation of all 625 by the current assistant, before candidate predictions; custom-only/context-missing cases preserved. `annotations.txt` is its compact reproducible record. Second pass by the same assistant (not independent review) revised four uncertain interpretations, with reasons in finalized rows. No human-gold claim.
- Repeated source-only firewall against existing opened benchmark text hashes/canonical sources. Benchmark labels/predictions/errors were not used; no Frozen-3 access. Zero overlap/quarantine. This is provenance exclusion only, not benchmark evaluation. Semantic checks against protected texts were not recomputed.
- Replaced pre-annotation 525/100 assignment once, before model inference, because its Dev omitted 4 labels. Fixed 5,000 source-component split candidates (seed42), objective only Train/Dev label coverage and proportions, selected trial4718. New locked split: **489 Train / 136 Dev**, all18 labels have >=2 positives in both splits. No hard rows dropped; all625 retained. Full support/hash/provenance details: `v4/auto-v1/manifest.json`.
- Human Dev contains 60 no-fixed-product-label cases and 49 explicitly ambiguous/context-poor cases; they remain in evaluation. Rare labels have only2 positives, so macro estimates will be noisy. This is source-linked human-written text with automated labels, not independently validated journal gold.
- Primaries are unavailable. Report both raw18 and actual JS max-two/cluster-filtered18, with Primary unset. Primary redundancy, acceptable alternatives and explicitly clearly-wrong rates are unavailable (null), not fabricated zeros. The evaluation is not directly comparable to Primary-aware Frozen results.
- `v4/auto-v1/experiment.py`: fresh original checkpoint initialization, dynamic padding/max128, named21 projection, BCE, AdamW lr1e-5/weight_decay.01, warmup10%, batch8/accum2, clip1.0, seed42, maximum3epochs; checkpoint selection by max-two selected18 Dev Macro-F1 @.5. Every epoch's probabilities/results retained. Planned comparisons: human-only, then 75%human/25%synthetic sampling with equal optimizer-step budget; only global .2/.35/.5 calibration afterward. No per-label fitting.
- `v4-baseline` COMPLETE, original candidate-c checkpoint, threshold .5: Macro P/R/F1 **.586610/.459486/.484817**, Micro P/R/F1 **.584416/.511364/.545455**; exact .595588, useful coverage .578947, correct abstention .766667, unwanted abstention .210526; outputs0/1/2=62/71/3. Raw and selected F1 equal at this threshold. This is the new **AI-annotated human Dev proxy** baseline, not Frozen.
- `v4-human-only` running locally on CPU. Human rows are489; no historical V2/V3/V3-B initialization.
- Optional original synthetic Train2000 checked against locked Human Dev using char3–5 >=.8 and MiniLM >=.85; no flagged pairs, all2000 retained for the control. `synthetic-audit.json` records exact input hash. Old synthetic Dev is never used for selection.
- Fixed an additional metadata parsing bug in `data_safety.source_key`: provenance may be a string/null; now handles dict metadata and top-level sourceUrl explicitly.

### Initialization leakage correction (before completing first adaptation)

- Located original GoEmotions training data at `/Users/xingranma/google-research/goemotions/data/train.tsv` via Candidate C README; audited text only. Normalized overlaps:3 in new Train,1 in new Dev. Even though some are generic short phrases, the strict no-duplicate policy requires exclusion.
- **Invalidated v4-baseline .484817** as not fully leakage-clean. `v4-human-only` interrupted after epoch1 (.432397); its artifacts remain, both experiments have `invalidated.json`. Neither is eligible for model selection or a success claim.
- Applying fixed whole-component exclusions for normalized exact and char3–5 cosine>=.80 matches to original pretrained-task Train, without inspecting that source's labels. Original annotation labels/splits remain frozen; corrected dataset will be a subset, not a new performance-optimized split. This late audit is recorded transparently, not hidden.

### Final data cleaning before eligible experiments: auto-v3

- Pretrained-task text audit found9 exact/lexical matches. Their complete existing source components contain29 rows; all29 are quarantined. No annotation changes or re-splitting. `initialization-lexical-audit.json` records the rule and source hash. Some matches are generic phrases, so exclusion is deliberately conservative. Full pretrained-corpus thread/semantic isolation remains unproven; only fine-tuning Train/Dev source isolation is established.
- Internal normalized audit then found3 remaining aliases: Train539→298, Dev096→084 and110→086. Merged by lowest stable ID with matching labels. No hard examples removed. The auto-v2 trial was stopped and archived with its invalidation reason; its metrics are ineligible.
- **Final auto-v3:468 Train /125 Dev**, all18 labels still have positive support. All625 originals accounted for:593 unique retained +29 provenance quarantine +3 aliases. Labels and source split assignments are unchanged from pre-inference annotation; only deterministic leakage/duplicate exclusions occurred afterward. Rare Dev support is1 for curiosity/surprise,2 for many other labels.
- `v4c-human-only` is running on this fixed version. Run data hashes and code are recorded in its experiment directory. This is the first eligible adaptation under the completed exact/lexical/within-split audit, and results will be labeled as automatically annotated human-text proxy results.

### Eligible auto-v3 baseline and early observations

- Original checkpoint @.5 on125 unique Human Dev proxy texts: Macro P/R/F1=.588462/.466629/**.474703**; Micro P/R/F1=.557143/.500000/.527027. Exact=.584, useful coverage=.567164, correct abstention=.758621, unwanted abstention=.208955, outputs0/1/2=58/64/3. All18 classes included.
- `v4c-human-only` epoch1 @.5: Macro-F1=.386833, Micro P/R/F1=.625000/.512821/.563380. Precision improved but rare-label macro recall declined; this is not a successful model. Continue the predeclared3epochs and compare mixed regularization, not relabel Dev.
- `v4c-mixed` started: same original initialization, seed, LR,3epochs and468 sampled examples per epoch; sampling mass75%human/25%synthetic. Synthetic pool2000 passed the earlier audit against the larger pre-exclusion Dev, so it also passes this subset. No old synthetic Dev selection.
- Calibration selection rule recorded in `summarize.py`: .2/.35/.5 only, maximize selected18 macro-F1 subject to micro precision no more than .05 below the original @.5 baseline. This tolerance is an engineering guard, not validated product acceptance. Source-component paired bootstrap reports uncertainty, with explicit warning that it does not correct for model selection or annotation uncertainty.
- Additional3 protocol tests passed (plus5 legacy regression tests): metadata type handling, immutable labels/splits with complete625-row accounting, source and normalized uniqueness, actual max-two selector/excluded labels, fixed18 metric scope, unavailable metrics remain null.

- Original-base coarse calibration on the same auto-v3 Dev: @.20 Macro-F1=.499426, Micro precision=.494949 (fails the predefined precision floor .507143); @.35 Macro-F1=**.526206**, Micro precision=.524390, Micro-F1=.537500; @.50 Macro-F1=.474703. Lowering threshold alone is insufficient for .60. `baseline-calibration.json` preserves full reports, no Frozen sweep.
- Host has8GB RAM and CPU-only torch. Concurrent runs slowed substantially; mixed training was paused via process suspension while human-only completes, then will resume unchanged. No paid external training or user command required.

### Human-only outcome and coarse calibration

- `v4c-human-only` completed3epochs. @.5 selected18 Macro-F1 by epoch: **.386833, .382618, .381497**. Best checkpoint epoch1; no promotion. Best epoch1 @.35=.407282; @.20=.487790 with Micro precision=.452991 (fails floor). Human-only adaptation did not beat the original pretrained checkpoint.
- Current provisional best remains original-base @.35: Macro-F1=.526206, Micro-F1=.537500. Source-component resampling is unstable due to1–2 positive examples for many labels; reported descriptive intervals are not independent final validation and omit annotation uncertainty.
- `diagnose.py` produces per-label Train/Dev support and ambiguous/custom-only error buckets without modifying labels. If mixed regularization also fails, next justified hypothesis is bounded positive-class weighting, addressing rare positives being overwhelmed by negative BCE terms; no per-label threshold search.

### Additional existing-data findings during training

- The previous “197 human augmentation” is actually111 `ADAPTED_SYNTHETIC`,54 `HUMAN_CONSENTED`,32 `PUBLIC_HUMAN` according to its own provenance. Do not report all197 as authentic human journals.
- Several HUMAN_CONSENTED A3 rows contain pasted annotation-form instructions and a list of emotion names in the journal input. This is a confirmed extraction defect; future use must extract the actual journal substring and retain the raw-text hash/removal record. Historical V2 data/checkpoints remain untouched.
- Prepared independent-of-Dev-text Train annotations for the54 consented rows in `extra_human_labels.txt`, preserving out-of-taxonomy/unspecified feelings rather than inventing fixed labels. They are not added to any current run or Dev. This potential next training-data experiment requires a separate provenance/duplicate audit first.

- Mixed best epoch3: @.35 Macro-F1=0.518964, Micro precision=.587500; @.5=.441154; @.2=.4817 with precision=.4622 (reject). It improves precision relative to original @.35 but does not reach .60 or win Macro-F1. Full exact values retained in `comparison.json`.
- `v4c-posweight` running: all else held fixed against human-only, BCE pos_weight=sqrt((N-positive)/positive), clipped[1,4], derived exclusively from Train counts. This is a new hypothesis after the two adaptation failures.
- Cleaned all54 consented existing journals; removed only known annotation-form prefixes from5 A3 records, preserving raw hashes. No exclusion required by canonical source/normalized/lexical/semantic checks against Dev and source/hash firewall against opened benchmarks. Max Dev similarity: lexical .324708, MiniLM .636690. Longest journal352 tokens;2 exceed128. `extra-human-audit.json` records everything.
- Prepared optional **auto-v4** Train-only expansion522 rows, exact same125 Dev bytes/labels/split. `experiment_expanded.py` allows max384 to retain the two long journals fully (no journal rewriting or target truncation). This is not yet an executed experiment; if positive weighting still fails, test additional authentic consented Train supervision rather than repeated threshold sweeps.

- Posweight epoch1 @.5: selected18 Macro-F1=.500097 versus raw18=.536232; epoch2 selected=.474299/raw=.496698. Class weighting helps relative to unweighted adaptation, but not yet .60.
- New bounded selector hypothesis: current broad clusters forbid distinct simultaneous emotions (e.g. gratitude/love, fear/anger), not merely duplicates. `selector-v4.mjs` is an isolated ablation preserving max2, supported/excluded labels, exact-label dedup and canonical Primary redundancy, removing only broad cluster blocking. Production selector unchanged. Native Node invariant tests passed. Compare only the posweighted best @.5 checkpoint at the same .2/.35/.5 grid, with identical labels/metrics; no per-label rules or Frozen-based changes.

### Positive weighting / selector outcomes; real Train expansion

- `v4c-posweight` completed3epochs: @.5 selected Macro-F1 .500097/.474299/.485353; epoch1 retained. Its selected Micro precision=.477477, below the predefined .507143 floor, so reject promotion despite higher macro than unweighted adaptation. Coarse lower thresholds worsen precision further.
- Selector ablation on that exact epoch1 checkpoint: removing broad clusters @.5 raises Macro-F1 to **.540577**, but Micro precision falls to **.459016**; outputs0/1/2=31/66/28. @.35/.2 also fail precision. **Rejected**. No production selector changes. This is not a .60 success and not a justification to emit more emotions indiscriminately.
- `v4d-extra-human` started on auto-v4:522 Train (468 existing +54 consented, reannotated and extraction-repaired), same125 Dev byte-for-byte. Unweighted BCE, original checkpoint, lr1e-5, seed42,3epochs, batch8/accum2; max384 only to preserve all long journals (longest352 tokens). Compared with human-only, this tests additional genuine-source Train supervision rather than changing Dev labels. Step count increases with dataset size; not a strict equal-compute ablation.
- Current accepted proxy best remains original checkpoint @.35, selected18 Macro-F1 .526206. All four training hypotheses and selector/calibration failures remain recorded. No Frozen quality evaluation or model selection.

- Added one fixed sparse baseline because four neural adaptation objectives/data settings regressed on the new small dataset: `v4e-sparse`, Train468, word1–2 + char3–5 TF-IDF, min_df2, balanced OVR logistic C1/seed42, vocabulary fit on Train only. This new supervision/task and repeated neural regression are the new evidence justifying the otherwise archived Candidate-A family check. No parameter grid, no old Test access.
- Sparse results @.2/.35/.5 Macro-F1=.156334/.182155/**.220914**; @.5 Micro precision=.674419 and Micro-F1=.479339. Reject: high precision but severe under-recall. A lexical classifier does not solve this source-disjoint Dev.

### Final result of this autonomous iteration

- `v4d-extra-human` completed3epochs; @.5 Macro-F1: 0.388662, 0.405688, 0.400397. Best epoch2. Its @.2 Macro-F1=.568711 but Micro precision=.487179 failed the preset precision floor, so that high-macro setting was rejected.
- One fixed50/50 probability blend was tested after the precision/recall tradeoff appeared: original checkpoint + extra-human best epoch2, no mixing-weight sweep. Same .2/.35/.5 grid and unchanged existing selector.
- **Best eligible: `v4f-fixed-blend` @`0.35`, Macro P/R/F1 **0.654401/0.591037/0.560632**; Micro P/R/F1 **0.590361/0.628205/0.608696**.
- On identical125 Dev texts, Macro-F1 changed from original @.5 0.474703 to 0.560632 (+8.59 percentage points). **Macro target0.60 remains unmet. Micro-F1>0.60 and exact match0.60 do not satisfy that target.**
- Best product-proxy metrics: exact=0.600000, useful coverage=0.716418, correct abstention=0.706897, unwanted abstention=0.134328; outputs={'0': 50, '1': 67, '2': 8}. Acceptable/wrong-emotion annotations and real Primary redundancy remain unavailable/null.
- `predict_ensemble.py` implemented local inference from saved checkpoints, lengths128/384, threshold.35, existing selector. Recomputed all125 Dev probabilities: max difference=4.17232513e-07, selected outputs identical. Empty-journal abstention, supplied Primary preservation/redundancy and max2 outputs passed. Two model inferences are required; no deployment/resource certification or production integration.
- Final complete evidence: `v4/auto-v3/REPORT.md`, `comparison.json`, `diagnostics.json`, `runtime-verification.json`, all per-epoch metrics/probabilities/checkpoints. Nine Python regression/protocol tests and native selector invariant assertions passed. Earlier interrupted/invalidated experiments remain archived.
- Main limits: only35 Dev source components; curiosity/surprise each1 positive and many labels2; AI annotation has no independent human agreement measurement; excerpts often lack context; no observed user Primary. Four neural adaptation runs, one fixed sparse baseline, one selector ablation and one fixed blend do not establish reliable .60. This is not proof that .60 is impossible.
- Stop expanding the current small-Dev search after these bounded hypotheses. Next useful development prerequisite is a separate source-disjoint validation cohort with independent automated adjudication, broader rare-label support and preserved context/Primary metadata where available. Do not fabricate these missing observations or relabel Dev to improve scores. No user data work or long-training command is required for the runs completed here.
- Frozen-2 was used only by a source/hash exclusion firewall, never for labels, errors, threshold tuning, metrics or model selection. Frozen-3 remains untouched and V4 is not locked for final evaluation.


### Independent human-written cohort acquisition (2026-09-07, ongoing)

- Preserved `v4f-fixed-blend` and old Dev bytes/results. Added a hash-based refusal in the V4 trainer to prevent new selection on the retired125 Dev.
- Verified original publisher sources and downloaded HappyDB raw101,094 records, Dreaddit3,553 segments, and CoSoWELL v1 token-level archive. Raw files have SHA-256 acquisition records; initial Python TLS failures were resolved using certificate-verifying system curl, not disabling HTTPS verification.
- Preferred CoSoWELL `yesterday`:1,994 original narratives /1,178 authors. Its prompt asks about yesterday's personal event without prescribing emotion. Excluded future imagination and picture descriptions. Original full narrative field preserved byte-for-byte as text.
- Label-blind selection:20–400 words, first-person reference, one narrative per author by deterministic ID hash, author-hash70/30 split. Historical/init normalized firewall and lexical>=.8 exclusion produce candidate769 Train /370 Dev. Semantic audit running; counts may decrease only for predeclared duplicate/quality rules. No labels or student predictions used for selection.
- HappyDB happy-only prompt, Dreaddit stress selection/fragmentation/missing author IDs, Korean ToM restricted full data, and historical ED/GoEmotions are not promoted as new reliable Dev. Source decisions and limitations in `v4/independent-human-v1/SOURCES.md`.
- CoSoWELL is older North-American adults, mostly pandemic-era, not representative of all PetalPal users. Dataset commercial terms unconfirmed: v1 OSF points to a missing license.txt; article license is not treated as dataset permission. No deployment/distribution.
- Remaining: finish semantic exclusion, automatic text-only annotation/adjudication and quality audit, report actual18-label support without emotion quota sampling, then establish fixed56.06%-candidate baseline on new cohort before new training. No new F1 claimed.

### CoSoWELL interruption recovery checkpoint

- Completed semantic audit:769 candidate Train /368 candidate Dev; excluded2 Dev semantic near-duplicates. Do not rerun acquisition or audits.
- Completed all370 candidate-Dev text-only annotations and same-assistant adjudication, excluding1 copied grammar-instruction record. Locked367 Dev /367 authors, SHA256 `952394ce159c40c585ac70c65a2cff8374ddb4b6abd3a7eaa0158584c80a8f8b`;108 empty-label rows. No independent annotator agreement or human-gold claim. Disgust support0; confusion3, curiosity2, remorse3. Keep all18 metric labels.
- Fixed archived V4f baseline completed on new367: Macro P/R/F1=.420834/.225408/.253547; Micro P/R/F1=.597222/.353425/.444062. No new threshold sweep. Old125 score56.06% unchanged. Evidence `independent-human-v1/baseline-fixed-v4f/metrics.json`. Do not rerun.
- Before seeing baseline, selected320 candidate Train authors by deterministic hash:64 internal calibration /256 Train,2epochs lr5e-6 from original checkpoint, initial fixed50/50 blend and .35; checkpoint selected by internal calibration loss, not367 Dev. Pilot annotations now240/320. One copied Beatles article at pilot index182 excluded; full raw preserved. Next: annotate pilot indices240–319, finalize data, run prespecified adaptation.

### CoSoWELL pilot data locked and training started (2026-09-07)

- Finished320/320 pilot text-only AI annotations; no independent annotator/gold claim. One copied article excluded. Final777 Train (522 existing +255 new) /64 internal calibration. Author, canonical-source and normalized-text disjointness passed against367 Dev and between Train/calibration. Raw text retained. Manifest `independent-human-v1/pilot-data/manifest.json`.
- Prespecified2epochs lr5e-6 from original Candidate C, seed42, effective batch16; select minimum calibration BCE21 including epoch0. Fixed50/50 original/adapted blend, .35 threshold. New branch maxLength512 (model capacity), batch2 for CPU memory; original blend branch remains128. Training script does not load external Dev. All longer-text truncation counts will be recorded from Train/calibration only.
- Running `independent-human-v1/train_pilot.py`; log `pilot-training.log`; output `pilot-experiment/`. Resume by inspecting log and summary; do not launch a duplicate or rerun completed data work. Next: finish training, lock checkpoint, evaluate fixed blend once on locked367 Dev. Old125 remains retired; no Frozen tuning or Frozen-3 creation.
- Pilot Train/calibration tokenizer audit complete: maximum447/496 tokens; zero rows truncated at512. At128,155/777 Train and38/64 calibration rows would truncate. Three new regression checks passed: sealed hashes/verbatim source text, source-collision rejection, and actual selector/all18-label metric contract. Scoped graph update completed; no model deployment.
- Fixed-baseline author-bootstrap95% interval [0.203830,0.290191],2000 draws seed42, saved from existing predictions (no inference rerun). Conditional on source/fixed AI labels; does not include annotation error or population shift.
- Before pilot external-validation inference, added a bounded internal-only calibration follow-up: fixed ensemble weights; global threshold grid [.15,.20,.25,.30,.35,.40,.45,.50];5 author-hash folds, select macro18 F1 with Micro-P>=.5 on other4 folds, tie higher threshold, fallback.35; final threshold median of5 choices. Report fixed.35 and internally selected threshold together using one saved external probability matrix. No external score participates. Threshold OOF is not independent full-pipeline validation because checkpoint loss uses the same64. Script `calibrate_pilot.py`.

### CoSoWELL pilot calibration and external validation COMPLETE (2026-09-07)

- Supersedes previous training-running status: training COMPLETE, epoch2 selected by internal BCE 0.10238249530084431; no training restarted.
- Internal calibration executed once: fold thresholds [.25,.25,.25,.30,.25], median 0.25. Threshold-only OOF Macro-F1=0.3490840949, Micro-P=0.6785714286; not an independent pipeline estimate because checkpoint selection used these64 authors.
- External367 validation executed once with sealed checkpoint hashes and one shared saved probability matrix. Fixed .35: Macro-F1=0.2553028551; Micro-P/R/F1=0.6094420601/0.3890410959/0.4749163880. Internal-selected .25: Macro-F1=0.2771175962; Micro-P/R/F1=0.5493421053/0.4575342466/0.4992526158.
- Compared with saved same-cohort baseline Macro-F1 .2535470549, descriptive changes are +.0017558002 (fixed) and +.0235705413 (calibrated); no statistical improvement claim. Macro-F1 .60 remains unmet. All18 labels retained, including absent disgust. References remain same-assistant AI labels, not independent human gold; same-source author holdout, not new-domain validation.
- Evidence: `v4/independent-human-v1/pilot-experiment/calibration/summary.json`, `external-validation/protocol.json`, `metrics.json`, `calibrated-metrics.json`, `probabilities.npy`. Do not rerun calibration/evaluation. Old125, Frozen sets and production unchanged.
- Next single step: use saved internal calibration grid metrics/probabilities and locked Train/calibration label support to write one bounded optimization hypothesis/protocol. No external-Dev error mining or threshold/checkpoint selection; no new source search, annotations, training, or evaluation needed for that diagnostic step.

### Frozen-head-v1 internal optimization COMPLETE (2026-09-07)

- New user acceptance criterion explicitly requires independent **human-labeled** external validation Macro-F1>=.60. CoSoWELL367 is AI-labeled and does not qualify; its .2771175962 is not human-gold performance.
- Internal-only diagnosis: calibration lacks curiosity/disgust/excitement/remorse; anger/confusion/disappointment/surprise each have one positive. Train minority support is small (curiosity6, remorse9, admiration12). No external errors/labels loaded in this round.
- One new bounded round `independent-human-v1/frozen-head-v1`: reused epoch2 pilot encoder, cached777 Train/64 calibration CLS features at512; trained only existing RoBERTa head20epochs, AdamW lr1e-4 weightDecay.1, Train-derived sqrt negative/positive weights clipped[1,4]. Four prespecified checkpoint comparisons (0/5/10/20), fixed.25 macro18 with Micro-P>=.5, selected epoch20. No baseline, existing annotation, prior inference or full-model training repeated.
- Internal fixed.25 Macro-F1 epoch0=.3639206938, epoch20=.3786503620; Micro-P/R=.5212765957/.7000000000. Epoch5/10 failed precision floor. Global author-fold calibration selected.30; threshold-only OOF Macro-F1=.3433336453, Micro-P=.5555555556, below pilot .3490840949/.6785714286. **Not promoted; no external evaluation.** These are selection-biased internal diagnostics, not independent evidence of improvement.
- Runtime71.16 seconds, process exited0. Head serialization/full-model compatibility verified on one internal row: maximum probability difference1.1920929e-7 (<1e-5). Saved config, weights, diagnostics, features, per-epoch probabilities/metrics, selected head, calibration, summary, verification and decision. No production changes; no Graphify needed.
- New source research (not repetition): acquired EduAffect version2 once. Human single-dominant labels, not exhaustive multilabel; no author fields, English/Twi preprocessing. Actual CSV2422 rows; paper2423. Release license differs from paper. Quarantined ZIP and source/acceptance decision saved in `human-validation-research/DECISION.md`; no admission, relabeling, inference or score-based filtering.
- Next priority is the missing independent human multilabel reference under existing18-product-label/0–2-output semantics and author/source isolation. Do not silently replace it with AI annotations, single-label evaluation or fewer labels. Further threshold searching on64 labels is not a substitute. No annotation job purchased or messages sent.

### Gemini evaluation lock, fixed baseline, and bounded ASL round (2026-09-09)

- Locked a new 300-author CoSoWELL cohort before candidate inference. Gemini A/B each completed 300 schema-valid annotations; exact label-set agreement was 219/300 and 81 disagreements were independently adjudicated with `gemini-3.6-flash`. All 81 adjudications succeeded; 300 rows included, 0 excluded. Hash/source-group/exact/normalized leakage audit passed and `v4/gemini-eval-v1/lock.json` is `LOCKED`. This is human-written, Gemini-annotated/adjudicated evaluation, not human-gold.
- One-time fixed `v4f-fixed-blend` inference used the pre-existing 50/50 ensemble, threshold .35, and unchanged product selector. Selected18 Macro P/R/F1=.560326/.311135/**.341139**; Micro P/R/F1=.698225/.348083/.464567. The dominant failure is low recall, with zero F1 for anger/remorse. No weight, threshold, checkpoint, selector, or label choice used this opened evaluation.
- Bounded internal round `v4/gemini-improvement-v1` tested one prespecified asymmetric-loss hypothesis without loading the Gemini evaluation. Existing locked pilot Train777+calibration64 were repartitioned by source group into661 Train/180 Dev using label coverage only; all18 Dev labels have >=2 positives and normalized/source-group isolation passed.
- Fixed ASL configuration: original checkpoint, max512, lr5e-6,2epochs, gammaPositive0/gammaNegative2, probability clip.05, threshold.35, unchanged max-two selector, Micro precision>=.50 selection guard. Epoch0 Dev Macro-F1=.459329. Epoch1=.491064 with Micro-P=.449495; epoch2=.508348 with Micro-P=.454106. Both trained epochs failed the guard; epoch0 retained and ASL **REJECTED**. No external/retired/Frozen holdout was loaded.
- Evidence now repeats the same pattern across pos-weighting, selector relaxation, low-threshold settings, and ASL: recall can be raised, but precision falls below the fixed guard. Further loss/threshold searching on the current same-assistant labels has low information value.
- Next hypothesis: supervision/reference alignment and rare-label coverage, rather than another loss variant, is the main bottleneck. The clean next development input is independently Gemini-annotated/adjudicated human-written Train/Dev data that remains separate from the opened300 evaluation and from any future untouched final holdout. Creating it requires additional paid Gemini API usage, so work pauses for explicit budget authorization. Do not train on or tune against the opened300 reference.

### Zero-cost post-ASL diagnosis and bounded checks (2026-09-09)

- Threshold-free diagnosis on the new legal180-row internal Dev: original epoch0 macro average precision `.621371` and per-label oracle-threshold Macro-F1 diagnostic `.663175`, versus actual selected Macro-F1 `.459329`. ASL epoch1/2 reduced macro AP to `.603287/.605210` and oracle diagnostics to `.640968/.646691`; it did not improve ranking. This diagnostic is not a candidate score or permission to use oracle thresholds.
- One prespecified5-fold OOF label-wise calibration used only the180-row Dev, fixed threshold grid and per-label precision>=.50 rule. It reduced Macro-F1 `.459329 -> .440367`, while Micro-P remained `.642105`; **REJECTED**. Rare-label support is too small for stable per-label calibration.
- Saved Hybrid V2 Clean checkpoint lineage audit against the new Dev passed for IDs, source groups, exact and normalized text. Its historical fixed threshold `.50` produced Macro-F1 `.409435`, Micro-P `.495575`; **REJECTED**. A general-human backbone does not solve this domain/task gap.
- One fixed50/50 original+ASL-epoch2 probability blend at unchanged threshold `.35` produced Macro-F1 `.477911`, Micro-P/R `.540000/.522581`, versus original `.459329`; it passes the internal guard and is retained only as a **further-development candidate**. No external evaluation was run, and no blend-weight/threshold sweep occurred.
- Combined evidence: original ranking contains signal, but small-support label-wise calibration does not generalize OOF; objectives that raise recall degrade precision; the alternate backbone is worse. A fixed blend recovers only +1.86pp internally, far short of a credible path to `.60`. More local loss/threshold/selector searching now has low expected value.
- Proposed paid next stage (not started): independently Gemini A/B annotate and adjudicate all841 existing human-written development rows plus149 reserved, author-disjoint CoSoWELL rows. Keep the existing841 as Train after a fresh lineage audit; use the149 pre-reserved authors as a fixed Dev, selected before labels and never part of the opened Gemini300. Expected standard-API volume:248 A/B batch requests plus about45 adjudication requests if disagreement remains near27%, roughly293 calls. Conservative estimated cost `$2–$8 USD`, depending mainly on thinking/output tokens; official 2026-09 pricing is $0.75/M input + $3.75/M output for Gemini3.6 Flash and $1.50/M input + $9/M output for Gemini3.5 Flash. Await explicit authorization before any call.
- Success would show that supervision/reference semantic alignment plus broader independent annotation materially improves a candidate on the untouched149-row Dev while retaining precision. Failure would strongly indicate that architecture/domain coverage—not merely annotation mismatch—is limiting performance, justifying a different encoder or genuinely new human-written training source rather than more relabeling.

### Aligned-supervision-v1 COMPLETE (2026-09-10)

- Resumed strictly from persisted outputs: Pass A 672/990 and Pass B 192/990. Completed IDs were not reprocessed. Transient DNS/timeout handling was fixed; the output cap was raised after repeated truncated JSON, without changing labels, split, selection, or evaluation rules.
- Pass A/B completed 990/990 each. Exact agreement 773; all 217 disagreements received independent Gemini3.6 adjudication; invalid exclusions 0. Final labels are locked at 841 Train / 149 author-disjoint Dev. Gemini usage: 291 recorded calls, estimated actual cost `$4.47387525`, below the `$8` hard stop.
- Prespecified aligned-supervision full fine-tune completed from Candidate C (2 epochs, standard BCE, threshold .35, unchanged max-two selector). On the legal149-row Dev, selected18 Macro-F1: epoch0 `.232600`, epoch1 `.286660`, epoch2 `.308555`; epoch2 Micro P/R/F1 `.553957/.466667/.506579`, satisfying the precision>=.50 guard.
- The one allowed fixed50/50 baseline+selected-epoch blend scored Macro-F1 `.265443`, so it was not selected. Final development candidate is epoch2; decision `PROMOTE` relative to the epoch0 baseline. This is development evidence on human-written, Gemini-labeled data, not human-gold or final external evidence.
- Opened Gemini300, CoSoWELL367, retired125, Frozen sets, old Human Test, and production were not loaded or modified. Evidence: `v4/aligned-supervision-v1/annotation-lock.json` and `experiment/summary.json`. No commit/push.

### Aligned-supervision bounded follow-ups (2026-09-10)

- Diagnosis on the saved legal149 Dev: aligned epoch2 still had zero F1 on admiration, anger, confusion, curiosity, disgust and remorse; common-label performance and Micro precision were materially stronger. The primary issue is rare-label coverage/ranking, not a globally permissive selector.
- `class-balanced-v1` tested exactly one Train-derived sqrt positive-weight configuration, clipped `[1,4]`, for2 continuation epochs from aligned epoch2. Macro-F1 `.312237/.303352`, but Micro precision `.461538/.435407` failed the existing `.50` guard. **REJECTED**; weighting repeated the known recall-for-precision failure.
- `standard-continuation-v1` tested exactly2 lower-LR standard-BCE continuation epochs from aligned epoch2. Macro-F1 improved `.308555 -> .323107 -> .331812`; selected epoch2 Micro P/R/F1 `.577778/.472727/.520000`. The one fixed50/50 blend scored `.312216`. **PROMOTED** development candidate: unblended continuation epoch2.
- One final preregistered `standard-continuation-v2` checked whether the monotonic trajectory persisted. It reversed to Macro-F1 `.316664/.314602`; prior `.331812` retained and the continuation **REJECTED**. Stop further epoch continuation and local loss/weight searching: the peak has passed and repeated selection on149 Dev would add selection bias.
- Current best legal-Dev selected18 Macro-F1 is **`.3318122835`**, still far below `.60`. The next defensible hypothesis requires a materially different pretrained backbone or genuinely new leakage-safe aligned Train signal, with a fresh bounded protocol; it should not be another threshold/selector/loss/epoch sweep. No forbidden evaluation, production change, commit, or push occurred.

### Materially different backbone round (2026-09-10)

- `deberta-v3-small-v1` was locked before download/training: generic `microsoft/deberta-v3-small`, new21-label head, aligned Train only, standard BCE,3epochs, fixed `.35`/max-two evaluation and unchanged legal149 Dev selection. All three epochs produced all-negative outputs at the fixed threshold: selected18 Macro-F1 and Micro P/R/F1 all `0`. **REJECTED**.
- Based on that collapse, `nli-deberta-v3-small-v1` tested one bounded task-pretrained alternative, `cross-encoder/nli-deberta-v3-small`, with the same fixed training/evaluation contract. Epoch1 Macro-F1 `.030722`, Micro P/R/F1 `.244565/.272727/.257880`; epochs2/3 again produced all-negative outputs. No epoch met the `.50` precision guard. **REJECTED**; fixed blend was therefore not run.
- Current best remains RoBERTa standard-continuation-v1 epoch2: Macro-F1 `.3318122835`, Micro P/R/F1 `.577778/.472727/.520000`. Two materially different DeBERTa initializations did not approach it, so another backbone trial on the same small Train/Dev would now add model-selection bias with weak expected value.
- Next evidence-based direction is new leakage-safe aligned Train signal, preferably a Train-only, label-balanced synthetic augmentation protocol derived from taxonomy definitions and Train counts (never Dev text/errors), followed by one fixed training run. This requires new paid API generation and explicit budget authorization before starting. No forbidden evaluation, production change, commit, or push occurred.

### Recent experiment record consolidation (2026-09-10)

- **aligned-supervision-v1** — Replaced existing Train targets with fixed Gemini-aligned labels after independent Pass A/B plus disagreement adjudication; trained the prespecified 2-epoch RoBERTa configuration. Legal149 Dev selected18 Macro-F1 improved `.232600 -> .308555`; epoch2 Micro P/R/F1=`.553957/.466667/.506579`. **PROMOTE** as development candidate. Key conclusion: supervision alignment helped, but rare-label recall remained the bottleneck.
- **class-balanced-v1** — Continued from aligned epoch2 with Train-only sqrt positive weights clipped to `[1,4]` for2 epochs, testing whether rare-label recall could improve without changing evaluation. Macro-F1=`.312237/.303352`, but Micro precision=`.461538/.435407`, below the fixed `.50` guard. **REJECT**. Weighting reproduced the recall-for-precision tradeoff.
- **standard-continuation-v1** — Continued aligned epoch2 with standard BCE, lower LR, and fixed2-epoch budget because the prior standard-BCE trajectory was still rising. Macro-F1 `.308555 -> .323107 -> .331812`; best epoch2 Micro P/R/F1=`.577778/.472727/.520000`. Fixed blend scored `.312216`. **PROMOTE**. This is the historical legal-Dev best: **`.3318122835`**.
- **Generic DeBERTa-v3-small** — Trained a materially different `microsoft/deberta-v3-small` backbone with a new 21-label head, aligned Train only, fixed3 epochs. Epochs1/2/3 all produced all-abstain outputs: Macro-F1=`0`, Micro P/R/F1=`0/0/0`. **REJECT**. Generic backbone plus new multilabel head collapsed under the task’s label imbalance.
- **NLI-DeBERTa-small** — Repeated the materially different backbone test using `cross-encoder/nli-deberta-v3-small` NLI-pretrained weights and the same fixed aligned-Train contract. Epoch1 Macro-F1=`.030722`, Micro P/R/F1=`.244565/.272727/.257880`; epochs2/3 Macro-F1=`0`. No epoch passed the precision guard. **REJECT**. NLI initialization did not prevent collapse.
- **public-human augmentation v1** — Acquired the official Facebook Research/Meta EmpatheticDialogues archive (CC BY-NC 4.0; acquired 2026-09-10), used only its publisher `train.csv`, and deterministically selected 444 human-written situation prompts from 444 distinct source authors. Normalized-text overlap with existing Train, legal Dev, and within augmentation was `0/0/0`; selection used no Dev content or labels. Continued the current-best RoBERTa checkpoint with the 444 added Train rows for2 epochs: epoch1 Macro-F1=`.323889`, epoch2=`.312497`; Micro P/R/F1 epoch1=`.580882/.478788/.524917`, epoch2=`.577778/.472727/.520000`. Per-label gains included fear `.353 -> .636` and caring `.273 -> .400`, but excitement `.545 -> .308`, sadness `.692 -> .609`, and love `.167 -> .000` regressed. **REJECT**; current best remains `.3318122835`.

### Public human-written source shortlist (research only; 2026-09-10)

- No training, download/admission, model selection, or evaluation was run. Research used only current Train counts: curiosity8, anger14, confusion15, admiration18, disgust24, excitement24, remorse24, surprise29, caring34, love36, fear39.
- **Top candidate: GoEmotions.** Official Google Research corpus: 58,009 human-written Reddit comments; agreement-filtered train split 43,410; direct human labels include all seven priority rare labels except none are missing from the 27-label taxonomy; author/comment/subreddit metadata supports leakage audits. Recommend qualifying a conservative **1,000–5,000-row** tranche only after exact/normalized/near-duplicate and author/source audit against current Train and sealed legal Dev. Reddit overlap with existing PHQ-family Train is the main risk.
- **Second candidate: ISEAR.** Approximately 7,666 human-written first-person emotion episodes with human labels; strong personal-experience fit and direct anger/disgust/fear/joy/sadness coverage. Guilt/shame→remorse is not a reliable automatic mapping; curiosity/confusion/admiration/excitement are absent. Canonical rights and persistent author linkage remain unresolved, so do not admit yet.
- **Conditional: DailyDialog.** Approximately 11,118 train dialogues, manually labelled with seven coarse emotions; can add anger/disgust/fear/joy/sadness/surprise but is dialogue rather than journaling and does not solve rare-label boundaries. Keep lower priority pending rights/provenance review.
- **Do not use now:** EmotionLines/MELD (scripted/contextual conversational source, weak PetalPal fit) and another EmpatheticDialogues tranche (the prior audited 444-row augmentation was rejected: `.331812 -> .323889/.312497`).
- Full source table, official links, license/author caveats, expected yields, mappings, and leakage prerequisites: `v4/aligned-supervision-v1/public-source-shortlist-20260910.md`. Training remains paused pending user direction.

### Public-data lineage inventory and high-quality candidate pool (2026-09-10)

- Historical source inventory was reconstructed from local artifacts without rereading the full progress file: current aligned Train contains 468 PHQ/public-journaling rows, 319 CoSoWELL rows, and 54 consented rows; current legal Dev contains 149 CoSoWELL rows. Older hybrid artifacts used GoEmotions and EmpatheticDialogues repeatedly, but those counts are per artifact and overlap; they are not new current aligned Train.
- Historical GoEmotions/EmpatheticDialogues Train/Dev/Test artifacts, current aligned Train/Dev, Gemini cohort files, Frozen/evaluation files, auto-v1–v4 files, and independent-human files were indexed by dataset, path, split, source-group/row ID, author field when present, and normalized text SHA-256. Dev/holdout text was used only inside the hash comparison and never emitted or used for data design. Reference: `v4/aligned-supervision-v1/public-source-shortlist-20260910/lineage-reference.jsonl`.
- Built a machine-readable **GoEmotions candidate pool** from the official agreement-filtered `train.tsv` only. It retains direct current-taxonomy labels, at least one priority rare label, 4–40 word rows, and excludes all indexed historical GoEmotions IDs and normalized-text overlaps. Result: **1,605** candidate rows; rare-label membership: admiration250, anger250, confusion250, curiosity250, disgust250, excitement250, remorse141. No legal Dev/Gemini content was used for selection; no author IDs are present in the local filtered TSV, so author/source audit remains a prerequisite.
- Candidate pool is **not yet admitted to Train** and no model was trained. Final machine-readable pool (text, original labels, mapped labels, row ID, source, official split, author field when available, provenance, license note, selection reason): `v4/aligned-supervision-v1/public-source-shortlist-20260910/goemotions-candidate-pool-final.jsonl`. Summary: `candidate-pool-summary.json`; historical inventory: `historical-data-source-inventory.json`.
- Recommendation for any future data review: first obtain/verify official GoEmotions raw metadata and usage terms, then audit author/subreddit/source isolation and inspect a small quality sample. Use a conservative rare-label tranche only if that audit passes; do not repeat EmpatheticDialogues augmentation.

### Targeted GoEmotions augmentation v1 (2026-09-10)

- Completed official-metadata provenance audit for the 1,605-row candidate pool. All 1,605 IDs resolved against the three official raw CSVs; 1,566 unique authors, 449 subreddits, 16 `example_very_unclear` rows, 0 within-pool normalized-text duplicates, and 0 normalized-text overlaps against the 45,345-row hash-only lineage index. Recoverable historical GoEmotions-author overlap was 39; author overlap with historical Go IDs was excluded from the tranche. Residual risk: transformed historical artifacts lack complete author metadata, PHQ/other sources lack cross-source author identity, and subreddit overlap is inherent to the source. Official README/model card were recorded, but no dataset license file was found; usage/redistribution remains `REVIEW_REQUIRED` for production.
- Designed a conservative, fixed tranche without reading Dev/Gemini text or using them for selection: 204 rows, 204 unique authors, max two rows per subreddit, no unclear or >2-label source examples, and exactly 30 membership rows for each target label (admiration, anger, confusion, curiosity, disgust, excitement, remorse). Base aligned Train 841 rows became 1,045 rows. Target support changed: admiration 18→48, anger 14→44, confusion 15→45, curiosity 8→38, disgust 24→54, excitement 24→54, remorse 24→54. Tranche audit: `goemotions-tranche-audit.json`; locked protocol: `goemotions-targeted-v1/protocol.json`.
- Ran one fixed continuation configuration from the promoted standard-continuation-v1 epoch-2 checkpoint (standard BCE, lr `2e-6`, batch2/accum8, seed44, fixed threshold `.35`, two epochs, no sweep). Legal149 Dev: epoch1 Macro-F1 `.345179`, Micro P/R/F1=`.579710/.484848/.528053`; epoch2 `.343674`, Micro=`.576642/.478788/.523179`. Epoch1 was selected under the existing precision guard and **PROMOTED**, improving the historical best `.331812` by `+.013366` (`+1.34`pp). New checkpoint: `goemotions-targeted-v1/experiment/epoch-1-checkpoint`.
- Selected epoch1 final per-label support/F1: admiration `2/.000`, amusement `7/.250`, anger `0/.000`, annoyance `21/.345`, caring `15/.348`, confusion `1/.000`, curiosity `2/.000`, disappointment `4/.857`, disgust `2/.000`, excitement `8/.500`, fear `10/.444`, gratitude `12/.700`, joy `42/.680`, love `9/.167`, optimism `12/.480`, remorse `2/.000`, sadness `11/.692`, surprise `5/.750`. The gain came mainly from caring, fear, gratitude and optimism; the targeted zero-F1 rare labels remained unresolved and excitement regressed slightly, so this is a modest improvement rather than evidence for `.60`.
- Conclusion: targeted high-quality GoEmotions signal is useful but domain/label-boundary mismatch remains material. Do not stack more GoEmotions immediately; use the promoted checkpoint only as the new development best and require a materially different bounded hypothesis for the next round.

### Train-side weak-label diagnosis and domain-restoration-v1 (2026-09-10)

- Diagnosis used only the 1,045-row Train (841 aligned PetalPal + 204 audited GoEmotions rows), taxonomy labels, saved losses and checkpoint head parameters. The six zero-Dev-F1 labels are not globally probability-collapsed: on Train, positive/negative probability separation was substantial (positive median vs negative p95: admiration `.640/.112`, anger `.560/.092`, confusion `.646/.087`, curiosity `.478/.067`, disgust `.749/.066`, remorse `.598/.060`); each had many positive Train rows above fixed `.35`. Train BCE was low for these labels (`.056–.085`).
- The source-shift signal was stronger than a threshold explanation: GoEmotions positive means exceeded original PetalPal positives for admiration (`.644 vs .397`), anger (`.539 vs .340`), remorse (`.705 vs .278`) and excitement (`.434 vs .281`), while negative distributions stayed low. The continuation classifier head changed only about `0.0002–0.0008` in target-row weight norm, so the augmented examples were learnable in-sample but the low-LR continuation barely adapted the boundary. Evidence supports source/domain mismatch plus weak adaptation; it does not support overall threshold mismatch or head collapse.
- One bounded repair was locked: `domain-restoration-v1`, no new data, one epoch of standard BCE (`lr=2e-6`, seed44) on the original 841 aligned Train only, starting from the promoted GoEmotions epoch-1 checkpoint. No Dev text/errors, opened Gemini-300, Frozen/holdout or production data were used for design. Legal149 Dev was evaluated once at the unchanged `.35` threshold.
- Result: Macro-F1 `.345179 -> .332792`; Micro P/R/F1=`.591241/.490909/.536424`. Admiration, anger, confusion, curiosity, disgust and remorse remained F1 `0`; excitement became `.400` (from `.500`). **REJECTED**. The promoted targeted GoEmotions epoch-1 checkpoint remains the best at `.345179`; do not overwrite it. This rules out simple one-epoch domain restoration as the next fix and leaves label-boundary/source mismatch or supervision quality as the leading unresolved bottleneck.

### Public journaling-domain source research and candidate pool v1 (2026-09-10)

- Training remains paused. Historical source inventory was rechecked locally from keyword snippets and the existing machine-readable inventory. GoEmotions and EmpatheticDialogues are historical/used sources; EmpatheticDialogues is rejected for another tranche after the audited 444-row augmentation regressed the legal Dev. ISEAR was previously only a research shortlist; the new enISEAR release below is distinct and was lineage-audited.
- **Lemotif** is the strongest domain match found: official authors collected 1,473 cleaned text samples from 500 anonymous Amazon Mechanical Turk respondents answering a daily-journal prompt about salient aspects of yesterday and feelings, with respondent-selected multi-emotion labels. A targeted exact-mapping subset contributes 323 candidate rows covering anger 28, confusion 28, disgust 22 and excitement 251 (no fuzzy proud→admiration or shame/guilt→remorse mapping). The flat CSV has no respondent ID; dataset-specific licensing is not stated separately from the MIT code repository, so redistribution/production use remains rights-review gated.
- **enISEAR** is a new, official 1,001-row English first-person event corpus created by crowdsourcing with Phase-2 validation and ODC-By 1.0. The pool retains 592 rows with direct Anger/Disgust/Fear/Joy/Sadness labels and validation score ≥3/5; guilt and shame are explicitly excluded rather than mapped to remorse. Worker IDs are preserved (63 unique workers in the retained rows); source-local author isolation is auditable, but cross-source identity cannot be proven for historical artifacts.
- Built a new independent, machine-readable pool with **915 rows**: Lemotif 323 + enISEAR 592. Exact direct mapped-label membership: anger 140, confusion 28, disgust 106, excitement 251, fear 127, joy 316, sadness 142, surprise 21. Priority-label coverage: admiration 0, anger 140, confusion 28, curiosity 0, disgust 106, excitement 251, remorse 0. Two normalized duplicates between the new sources were removed; original-row-ID overlap=0, normalized-text overlap against the 45,345-row historical hash lineage=0, source-dataset overlap=0, and enISEAR worker-ID overlap with historical author IDs=0. Dev/Gemini/Frozen text was not read; only existing hash/source lineage metadata was compared.
- Other sources were evaluated but not admitted: crowd-enVENT (high-quality prompted event descriptions, but no additional priority-label coverage beyond anger/disgust and unclear dataset licensing), MEMO4000 (CC BY 4.0 and admiration/anger/disgust coverage, but social-network status domain and weak provenance), and Facebook Curiosity Dialog (conversation/QA without reliable emotion labels). Full artifacts: `v4/aligned-supervision-v1/public-domain-data-v1-20260910/petalpal-domain-candidate-pool.jsonl`, `source-summary.json`, `lineage-audit.json`, `historical-source-inventory-v2.json`, and `retrieval-manifest.json`.
- Recommendation for the next data review: prioritize a small Lemotif tranche first for direct journaling-domain supervision, optionally paired with a bounded validated enISEAR anger/disgust supplement. The new pool does not solve admiration/curiosity/remorse; public human-written sources with reliable direct labels for those three remain the main gap. No training, model selection, threshold change, taxonomy change, production change, commit, or push was performed.

### Lemotif/enISEAR bounded pilot v1 (2026-09-10)

- Completed a strict Train-side lineage audit before selection. The 915-row candidate pool had zero normalized-text overlap and zero row-ID overlap with canonical aligned Train and the prior 204-row GoEmotions tranche. No legal Dev, opened Gemini-300, Frozen, or holdout text was read for selection. Audit status: `PASS_WITH_RESIDUAL_RISK`; Lemotif has no respondent IDs in the released flat file, and source/license completeness remains a documented residual risk.
- Ran exactly one locked pilot using 150 new rows: Lemotif `120` and enISEAR `30`. Selection was deterministic and Train-side only: direct taxonomy mappings, support targeting, provenance, and enISEAR validation/worker isolation. Added label membership: anger `43`, sadness `12`, confusion `28`, surprise `8`, disgust `37`, excitement `48`, joy `38`, fear `3`. Existing 1,045 rows became 1,195; no canonical Train/Dev/holdout files were modified.
- Used the verified standard continuation configuration for one epoch only (standard BCE, lr `2e-6`, seed `44`, fixed threshold `.35`, unchanged selector/evaluation rules), starting from the promoted GoEmotions epoch-1 checkpoint. Legal149 Dev was evaluated once. Macro-F1 changed `.345179 -> .328226` (delta `-.016953`); Micro P/R/F1=`.562044/.466667/.509934`. Key final F1: excitement `.428571`; admiration, anger, confusion, curiosity, disgust and remorse remained `0`.
- **REJECTED.** The domain-matched 150-row tranche did not improve the current candidate; the prior GoEmotions targeted epoch-1 checkpoint remains the best at Macro-F1 `.345179` and was not overwritten. Per the bounded protocol, stop this direction and do not add more rows, retune, or retrain automatically.

### Uncertain-negative mask v1 (2026-09-10)

- Root-cause review used only aggregate metrics, Train-side probabilities, locked label definitions/sets, source metadata, and Pass A/B label decisions; no Dev text, individual Dev predictions/logits/errors, Gemini-300, Frozen, or other holdout content was read. The six reported weak labels are not six equally established failures: legal Dev support is admiration2, anger0, confusion1, curiosity2, disgust2, remorse2. Their Train probabilities separate positives from negatives, so head collapse and a simple threshold explanation remain unsupported. Source-conditioned positive scores, failed domain restoration, and failed journal-like augmentation support taxonomy/supervision-boundary shift as the leading cause. The annotation protocol permits only0–2 labels, while standard BCE treats every omitted label as a certain negative; 193/841 aligned Train rows use both label slots. Pass A/B also supplied direct uncertainty evidence: 111 Train rows contained116 labels selected by an independent pass but omitted from the locked final set, including admiration4, anger2, confusion2, disgust1 and remorse5 (curiosity0).
- Locked one materially different experiment before training/evaluation: unchanged best initialization, unchanged841 aligned rows + unchanged204-row audited GoEmotions tranche, one epoch, lr`2e-6`, seed44, standard sampling, threshold`.35`, and unchanged max-two selector. The only change was masking negative BCE for those116 pass-supported but final-omitted labels on aligned Train; final positives, all reliable negatives and all GoEmotions targets remained unchanged. One predetermined legal149 Dev evaluation was run.
- Result: selected18 Macro-F1 `.345179 -> .340457`; Micro P/R/F1=`.566434/.490909/.525974`. Per-label F1: admiration`.000`, amusement`.250`, anger`.000`, annoyance`.344828`, caring`.347826`, confusion`.000`, curiosity`.000`, disappointment`.666667`, disgust`.000`, excitement`.545455`, fear`.444444`, gratitude`.631579`, joy`.693069`, love`.307692`, optimism`.480000`, remorse`.000`, sadness`.666667`, surprise`.750000`. None of the six weak labels was rescued. **REJECT.** The promoted GoEmotions epoch-1 checkpoint remains best and was not overwritten.
- Interpretation: explicitly observed Pass A/B negative-label uncertainty is too sparse to explain the transfer failure by itself. Together with the source-conditioned Train separation and the two failed domain interventions, the remaining evidence favors unstable/narrow cross-source label semantics plus extremely weak legal-Dev support, rather than a repairable local BCE-negative bug. Stop automatic experimentation on legal149 now: after repeated checkpoint/backbone/data/objective comparisons, another Dev-selected run would materially increase model-selection bias. The next defensible step requires user authorization for either new independent annotation or a new sealed evaluation protocol/holdout; do not tune another variant on this Dev.

### Sealed Blog Evaluation v1 preparation (2026-09-10)

- Locked a new evaluation protocol before candidate extraction or any model inference. Source is the human-written Blog Authorship Corpus (personal blogs;19,320 author IDs), source-disjoint from the known PHQ/Reddit, CoSoWELL, GoEmotions, EmpatheticDialogues, Lemotif and enISEAR histories. Planned fixed asset is360 rows from360 unique authors:270 taxonomy-cue strata rows fixed at15 per label plus90 deterministic natural-domain rows. Hard cases/abstentions may never be removed; all18 labels remain in scope; seal requires final support>=15 per label (target20).
- Retrieved source archive SHA-256 `1dfa6996663515a4baf8c1b71713ce8fe9a314b13778701447e4663bbc64c983`. Scripted candidate audit against the existing45,345-row historical lineage index found normalized-hash overlap0, recoverable author overlap0, recoverable source-group overlap0, internal hash duplicates0 and internal author duplicates0. Candidate manifest SHA-256 is `376d2ba645af8a90f5a8b34dd3281f59a31c1e6cb8bd8d190172704aa6c45544`. No protected holdout semantics or candidate checkpoint outputs were used.
- Locked annotation as independent Gemini Pass A + reverse-order Pass B + fresh disagreement adjudication, with estimated full cost US$1.63 and hard stop US$2. The first request could not execute: configured Gemini project returned HTTP403 `PERMISSION_DENIED` due billing/dunning denial. No response was produced and actual API cost is US$0.
- Status: **NOT_SEALED / BLOCKED_BEFORE_ANNOTATION**. Label support is unknown; cue strata are not treated as reference labels. No model evaluation or training is permitted. Resume unchanged only after an authorized Gemini billing project is available; seal only after all annotations/adjudications, support>=15 for every label, final hashes, and research-use rights approval. Do not replace rows if support fails.

### Sealed Blog Evaluation v1 annotation outcome (2026-09-10)

- Resumed from persisted IDs/usage. Pass A and reverse-order Pass B completed `360/360` over unchanged candidate SHA-256 `376d2ba645af8a90f5a8b34dd3281f59a31c1e6cb8bd8d190172704aa6c45544`. Exact agreement=`228`; only all `132` disagreements were adjudicated. Actual Gemini cost=`US$1.88420325`, within the `US$2` cap. No classifier inference/training or other holdout access occurred.
- Final support: admiration25, amusement49, anger14, annoyance58, caring7, confusion22, curiosity11, disappointment28, disgust13, excitement47, fear18, gratitude17, joy40, love17, optimism19, remorse10, sadness43, surprise9. Minimum15 failed for anger, caring, curiosity, disgust, remorse and surprise.
- All other integrity checks passed; final manifest SHA-256=`1482f372360c6fd726cf30ba045b0921397da7a9f664e482dc6d7b5ec35a4bc7`. Decision: **NOT_SEALED**. No row was replaced, removed or relabeled; model evaluation/tuning is forbidden.

### group-oof-transformer-v1 (2026-09-10)

- **Experiment:** `group-oof-transformer-v1`. **Purpose:** diagnostic test of source-disjoint Transformer generalization.
- **Initialization:** `candidate-c/artifacts/checkpoint`. This candidate-c checkpoint predates the aligned 841-row Train; it was not initialized from any checkpoint fine-tuned on the complete aligned Train. Each fold independently initialized from the same candidate-c weights and trained only on the other four folds.
- Ran strict 5-fold sourceGroup OOF using the fixed assignment from `group-oof-tfidf-v1`: fold sizes `169 / 168 / 168 / 168 / 168`; sourceGroup overlap across folds `0`; every row assigned to exactly one validation fold.
- Evaluation remained fixed to the existing 18-label product set, threshold `0.35`, maximum outputs `2`. Complete OOF predictions are `841 × 21`; the three non-product checkpoint outputs were excluded from the fixed 18-label report. No threshold, hyperparameter, fold, or checkpoint selection was performed.
- Per-fold Macro/Micro-F1: fold0 `0.487964 / 0.569620`; fold1 `0.501839 / 0.579618`; fold2 `0.420455 / 0.542587`; fold3 `0.451609 / 0.569579`; fold4 `0.490403 / 0.592145`.
- Aggregate OOF Macro-F1=`0.492306`; Micro-F1=`0.570888`. For comparison, the strict sourceGroup TF-IDF OOF baseline reached Macro-F1=`0.203350`.
- **Decision: DIAGNOSTIC ONLY.** Do not mark this checkpoint as the new promoted production/development candidate, do not replace the legal149 development score of `0.345179`, and do not present `0.492306` as a final or product score.
- Interpretation: the result provides evidence that the Transformer learns source-disjoint signal within the current aligned supervision and weakens the hypothesis that lexical memorization or representation failure is the primary bottleneck. It does not establish external-domain or human-gold generalization. Artifacts: `v4/group-oof-transformer-v1/oof-probabilities.npy`, `metrics.json`, `summary.json`, and `run.log`. No production change, commit, or push.

## 2026-09-08 to 2026-09-12 — Supervision / Human Diagnostic Phase

### Locked evaluation

- `v4/gemini-eval-v1` completed the locked 300-row human-written, Gemini-annotated / Gemini-adjudicated reference. Pass A and B each completed 300/300; exact agreement was `219/300`; all `81/81` disagreements were adjudicated successfully; `0` rows were excluded. Leakage audit passed. This is not human gold and not a human-labeled product evaluation. The locked artifact records `candidateInferencePerformed: false` and forbids post-inference relabeling.
- The one-time fixed `v4f-fixed-blend` score on that opened reference was selected18 Macro-F1 `.341139` and Micro P/R/F1 `.698225/.348083/.464567`. It was diagnostic only; it did not select a checkpoint, threshold, selector, or label policy.

### Canonical 841 and supervision disagreement

- `v4/aligned-supervision-v1` is the current canonical aligned dataset: `841` Train rows and `149` author-disjoint Dev rows, locked by hashes in `annotation-lock.json`. Train composition is `468` PHQ/public-journaling rows, `319` CoSoWELL rows, and `54` HUMAN_CONSENTED rows. The labels are Gemini-annotated/adjudicated supervision, not human gold.
- `v4/petalpal-train-ab-boundary-audit-v1-r1` is a diagnostic of the two Gemini supervision passes on all `841` Train rows: `662` A=B rows, `137` strict-subset rows, and `42` replacement rows. The replacement family is concentrated in `CROSS_FAMILY_OTHER` (`27/42` weighted rows); this is evidence of supervision-boundary disagreement, not a relabeling authorization.

### Strict sourceGroup OOF and recent diagnostics

- Strict 5-fold sourceGroup OOF Transformer used fold sizes `169/168/168/168/168`, zero sourceGroup overlap, fixed threshold `.35`, and maximum two outputs. Aggregate OOF Macro/Micro-F1 were `.492306/.570888`. This is diagnostic only and does not replace the fixed legal-Dev result or establish external-domain or human-gold generalization.
- The matched strict sourceGroup TF-IDF OOF baseline scored Macro/Micro-F1 `.203350/.356093`; its artifact is `v4/group-oof-tfidf-v1/summary.json`. The Transformer result therefore supports learned source-disjoint signal relative to the lexical baseline, while leaving supervision and domain shift unresolved.
- The bounded ASL round (`v4/gemini-improvement-v1`) reached internal Dev Macro-F1 `.459329/.491064/.508348` at epochs `0/1/2`, but trained epochs had Micro precision `.449495/.454106`, below the fixed `.50` guard; ASL was rejected. Zero-cost OOF calibration reduced Macro-F1 `.459329 -> .440367`; saved Hybrid V2 Clean gave `.409435`; a fixed original+ASL 50/50 blend gave `.477911` with Micro precision `.540000`. These are internal diagnostics, not final product scores.
- Macro AP diagnostics were `.621371` for the original internal ranking and `.663175` for its oracle-threshold diagnostic; oracle values are not deployable scores and were not used as thresholds. No new experiment is authorized by these diagnostics.

### 221-row human review diagnostic

- `petalpal-train-decomposed-inclusion-policy-v1-r1` is preparation-only and remains `HUMAN RATINGS REQUIRED`. The locked sample is `179` disagreement rows plus `42` controls (`14` each at cardinality 0, 1, and 2), for `221` rows and `3,978` label opportunities per reviewer. The protocol requires applicability (`NO/PLAUSIBLE/CLEAR`) followed by writer-owned evidence (`NONE/WEAK/SUFFICIENT`), with eligibility `CLEAR AND SUFFICIENT`.
- Both reviewer packages are blind local UIs with no model predictions, original labels, or gold fields. Their rating fields are blank in the distributed CSVs. This is a supervision/root-cause diagnostic, not a product final evaluation and not permission to change Train labels.
- A separate text-integrity audit found the two CSV parsers remove ASCII double-quote characters from `13` rows. This is not tokenizer truncation, but it can affect quotation boundaries and writer-ownership judgments. It must remain an unresolved review-integrity issue until checked against the raw text.

### Input and text-length audit

- Current RoBERTa training and inference code explicitly uses `MAXLEN=512`, `truncation=True`, right-side truncation, and dynamic batch padding (`v4/aligned-supervision-v1/train_aligned.py`, `standard-continuation-v1/train.py`, and `group-oof-transformer-v1/run.py`). The tokenizer/backbone supports a 512-token sequence; there is no 60-word or 60-token input cap in the current pipeline. The older C-Lite Render benchmark separately uses 128 tokens and is not the current aligned Transformer pipeline.
- On the `221` review texts, Python `text.split()` word counts were median `31`, P75 `135`, P90 `220`, P95 `268`, max `397`. The current 512-token encoding truncated `0/221`; at hypothetical caps 60, 128, and 256 tokens, `100/221`, `74/221`, and `24/221` would truncate. No evidence span was recorded, so evidence loss cannot be inferred from length alone.
- On canonical aligned Train, word counts were median `21`, P75 `100`, P90 `188`, P95 `253`, max `398`; all `841` rows fit under the current 512-token model limit. CoSoWELL is the source of the long tail; its rows have median `124`, P90 `273`, P95 `304`, max `398`, versus Reddit-derived rows max `45` and consented rows max `266`.

### Current blockers and safeguards

- No production-promoted emotion model exists. Current development data and checkpoints remain experimental; the strongest recent scores are diagnostics under narrow, source-specific supervision and must not be presented as final product quality.
- The immediate blocker is independent human review of supervision boundaries and writer-owned evidence, together with adequate rare-label support. The 221-row package is still awaiting human ratings; its results cannot be treated as human gold or directly used to rewrite Train labels.
- Opened Gemini evaluation data, Frozen/Frozen-2, Hybrid Test, sealed Blog evaluation, and other protected final-holdout artifacts remain prohibited from training, tuning, threshold selection, calibration, or candidate selection. No row-level protected holdout content was read in this phase.
- No new training experiment is authorized. Existing artifacts, labels, protocols, hashes, and historical results remain unchanged. Production routing and the user-selected Primary Mood policy remain unchanged.

## CURRENT TRUE STATUS — 2026-09-12

- **Production-promoted emotion model:** None.
- **Current canonical Train:** `841` locked aligned rows: `468` PHQ/public-journaling, `319` CoSoWELL, and `54` consented rows; labels are Gemini-annotated/adjudicated supervision, not human gold.
- **Most important diagnostic:** the `221`-row disagreement/control human-review package for semantic applicability and writer-owned evidence, alongside the A/B supervision-boundary audit.
- **Waiting for:** completion of independent human ratings and evidence-based adjudication under the locked review protocol.
- **Main blocker:** supervision alignment and rare-label coverage are not independently human-validated; current development/Dev support is too narrow for a product claim.
- **Protected/opened evaluations:** Gemini 300, Frozen/Frozen-2, Hybrid Test, sealed Blog evaluation, and other locked holdouts must not be used for selection, tuning, calibration, or relabeling.
- **New training authorization:** none.

Product ML scope is currently being redefined around Event → emotion → flower; no Event-only dataset restructuring has been authorized yet.




## Human Review 221 — Stage 1 Core/Auxiliary Audit

Date: 2026-09-14. Artifact: `v4/stage1-human-review-core-v1/`.

### Protocol

- Human Review is now formally **Stage 1 only**, using applicability NO / PLAUSIBLE / CLEAR. Stage 2 deprecated. Stage 3 deprecated. `evidence / rank_order / tie_group` are legacy unused fields and are not missing work. This current protocol supersedes earlier log entries and bundle metadata describing later stages.

### Reviewer hierarchy

- Core anchor reviewers: Reviewer 1 and Reviewer 2 only. Auxiliary: AUX-R01 through AUX-R08, each a distinct human reviewer. No equal-status ten-reviewer pool or reviewer weighting.

### Core validity

- Reviewer 1: 221 samples, 3,978 potential judgments, four missing: R3-087/fear; R3-163/surprise; R3-168/admiration; R3-168/amusement. All four remain missing.
- Reviewer 2: valid only R3-001..R3-183, 3,294 valid judgments. R3-184..R3-221 permanently excluded: all 684 invalid export-placeholder judgments are barred from every judgment statistic, QC distribution, comparison and downstream reference construction regardless of blankness.
- Both supplied desktop clean Core CSVs passed schema, keys, label-set, legal-value and cross-Core exact-text/definition checks. Actual nonblank Core overlap = 3290; derived from the files, not an assumed denominator. No raw exports or historical reviewer files were substituted.

### Core agreement

- Exact/raw agreement: 2160/3290 = 0.656534954 (65.6535%). Unweighted three-class Cohen's kappa = 0.233754933. Total disagreement 1130; severe NO/CLEAR 337; adjacent 793. PLAUSIBLE remains a third category.
- Highest label disagreement rates: optimism 113/183 (61.75%), excitement 112/183 (61.20%), surprise 94/182 (51.65%), joy 91/183 (49.73%), gratitude 79/183 (43.17%).
- Highest-disagreement samples (rate then count): R3-022 12/18, R3-093 12/18, R3-127 12/18, R3-016 11/18, R3-100 11/18, R3-124 11/18, R3-063 10/18, R3-076 10/18, R3-081 10/18, R3-085 10/18. Diagnostic only; no examples removed or adjudicated.

### Auxiliary QC

| Reviewer | Valid coverage | Missing | NO | PLAUSIBLE | CLEAR | QC flag |
|---|---:|---:|---:|---:|---:|---|
| AUX-R01 | 3978/3978 | 0 | 3726 | 69 | 183 | NONE |
| AUX-R02 | 3978/3978 | 0 | 3474 | 154 | 350 | NONE |
| AUX-R03 | 3978/3978 | 0 | 3731 | 44 | 203 | NONE |
| AUX-R04 | 3978/3978 | 0 | 3383 | 207 | 388 | NONE |
| AUX-R05 | 3978/3978 | 0 | 3345 | 379 | 254 | NONE |
| AUX-R06 | 3942/3978 | 36 | 2946 | 521 | 475 | INCOMPLETE_COVERAGE |
| AUX-R07 | 3978/3978 | 0 | 3477 | 257 | 244 | NONE |
| AUX-R08 | 3978/3978 | 0 | 1 | 1719 | 2258 | EXTREME_DISTRIBUTION |

- Table order: reviewer | valid/3978 | missing | NO | PLAUSIBLE | CLEAR | flag. These counts were recomputed from the eight individual CSVs. All eight are retained for descriptive comparisons and support counts. Missing ratings stay missing. Flags are not exclusion/downweighting decisions.
- AUX-R06: INCOMPLETE_COVERAGE; 36 missing. AUX-R08: EXTREME_DISTRIBUTION; distribution reported explicitly above, including its separately computed Core comparisons in the artifact.
- All Auxiliary comparisons with Reviewer 2 apply the same permanent 183-sample boundary. Per-Core-disagreement Auxiliary counts do not select a final category. Bundle suggestions to exclude AUX-R08 by default or later complete deprecated stages were not followed because the latest user protocol overrides them.

### Methodology boundary

- **NO GOLD LABELS CREATED**
- **NO MAJORITY-VOTE ADJUDICATION**
- **NO AUTOMATIC CORE OVERRIDE**
- **STAGE 2 / STAGE 3 DEPRECATED**
- **ADJUDICATION NOT PERFORMED IN THIS TASK**
- Point estimates describe the observed valid overlap; kappa depends on class prevalence. Partial Core coverage and the enriched sample preclude full-Train population reliability or model-quality claims. Clean-export text consistency does not independently resolve the historical UI quote-rendering concern. No legal149, Blog360, protected holdout, training, model inference, taxonomy modification, commit or push.
- Next: ML Lead / Sol decides Stage 1 adjudication methodology from these artifacts. No follow-up experiment or adjudication is automatically started.


## Human Review 221 — Stage 1 Methodology Decision

Date: 2026-09-14. Decision artifacts: `v4/stage1-human-review-decision-v1/`.

### Astra audit

- **PASS** for the stated descriptive Stage 1 Core/Auxiliary audit. Effective Core overlap, Reviewer-2 validity masking, Reviewer-1 missing preservation, three-category agreement, unweighted Cohen's kappa, severe-disagreement definition, and Auxiliary/Core hierarchy were implemented correctly.
- No majority vote, automatic Core override, gold/final label creation, adjudication, Stage 2/3 use, training, or protected evaluation access occurred.

### Core results and interpretation

- Effective overlap = `3290`; exact agreement = `2160/3290 = 65.6535%`; unweighted Cohen's κ = `0.233755`; total disagreement = `1130`; severe NO↔CLEAR disagreement = `337`.
- Top disagreement labels: optimism `61.75%`, excitement `61.20%`, surprise `51.65%`, joy `49.73%`, gratitude `43.17%`.
- Raw agreement is dominated by NO↔NO: `1945/2160 = 90.05%` of agreements and `1945/3290 = 59.12%` of all comparable cells. Marginals are strongly mismatched: Reviewer 1 uses NO/PLAUSIBLE/CLEAR `2842/300/148`, while Reviewer 2 uses `1995/729/566`. Marginal-expected agreement is already `55.18%`, explaining why `65.65%` raw agreement corresponds to κ≈`.234`.
- Direction is systematic: Reviewer-1-NO/Reviewer-2-PLAUSIBLE `573` versus reverse `37`; Reviewer-1-NO/Reviewer-2-CLEAR `324` versus reverse `13`; Reviewer-1-PLAUSIBLE/Reviewer-2-CLEAR `145` versus reverse `38`. Current disagreement therefore reflects substantial general inclusion/evidence-threshold and CLEAR-threshold calibration mismatch, plus label-specific semantic overlap.
- **Do not directly adjudicate the 1,130 disagreements under the current guide.** Definitions/applicability anchors must be revised and human-frozen first; otherwise adjudication would impose another private threshold rather than a stable rule.

### Protocol state

- Human review: `STAGE1_ONLY` using applicability `NO / PLAUSIBLE / CLEAR`.
- Stage 2: `DEPRECATED`.
- Stage 3: `DEPRECATED`.
- Legacy unused fields: `evidence`, `rank_order`, `tie_group`; do not fill, analyze, infer, or treat as pending.

### Reviewer hierarchy and validity

- Core anchors: Reviewer 1 and Reviewer 2.
- Auxiliary supporting reviewers: AUX-R01 through AUX-R08. Auxiliary evidence never becomes an equal-status vote or automatic Core override.
- Reviewer 2 is valid only for `R3-001..R3-183`. `R3-184..R3-221` contains `684` export-placeholder judgments that remain permanently `INVALID / EXCLUDED`; they must never be restored or used in any statistic or reference construction.
- After the revised Stage 1 guide is human-frozen, Reviewer 2 must supply real judgments for all 38 tail samples. Because the guide changes, Reviewer 1 will independently refresh the same 38×18 cells under the identical guide.
- Reviewer 1's genuine missing cells remain: `R3-087/fear`, `R3-163/surprise`, `R3-168/admiration`, `R3-168/amusement`. Do not impute. Reviewer 1 completes them after guide freeze; Reviewer 2 refreshes the paired cells because all four labels receive HIGH/MEDIUM clarification.

### Auxiliary policy

- AUX-R01..R05 and AUX-R07: supporting evidence only. Strong support may trigger review or inform a later independent adjudicator; it never creates a final category.
- AUX-R06: retain normally on valid overlap using pairwise-complete denominators. Its 36 blanks remain missing; `99.095%` coverage does not justify global downweighting.
- AUX-R08: retain raw judgments but exclude from consensus/strong-support counts and vote-like adjudication summaries. Distribution is NO/PLAUSIBLE/CLEAR `1/1719/2258`; exact agreement/kappa are `5.66%/-0.005` with Reviewer 1 and `22.53%/.040` with Reviewer 2. Report separately as sensitivity evidence; do not delete or rewrite.
- Future strong Auxiliary support means at least `80%` of at least five valid judgments among AUX-R01..R07 select the same category. This remains supporting evidence only.

### Label revision and targeted re-review

- **Revise definitions/applicability guide first: YES.** Final wording requires human confirmation and version freeze; model-written suggestions are not frozen definitions.
- HIGH priority: optimism, excitement, surprise, joy, gratitude, amusement, disappointment, love. Love (`20` severe), disappointment (`18`), and amusement (`17`) are HIGH despite not all being top-five by total disagreement.
- MEDIUM priority: admiration, anger, annoyance, caring, confusion, curiosity, disgust, fear, sadness.
- LOW priority: remorse.
- Targeted re-review: **YES**. Both Core reviewers re-review every HIGH-label Core-disagreement cell, every MEDIUM-label severe cell, and masked exact-agreement controls under the frozen guide. Reviewers remain blind to old Core values, Auxiliary values, disagreement status, and model output.
- Full 3290-cell re-review: **NO**. Stable cells are retained provisionally and sampled as drift controls; no automatic widening is authorized.

### Adjudication and reference status

- Adjudication protocol status: `DRAFT`. It covers Core exact agreement, both adjacent disagreement types, severe disagreement, one-Core missing, Reviewer-2 invalid tail, strong/mixed Auxiliary support, AUX-R06 pairwise coverage, AUX-R08 exclusion from consensus counts, and versioning after definition revision.
- Core exact agreement is provisionally retained after guide/calibration gates pass; only strong Auxiliary support at the opposite extreme triggers manual reopening. Adjacent disagreements receive targeted re-review when affected, then adjudication if persistent. Every severe disagreement receives dual-Core re-review and independent human adjudication if it persists.
- Final Stage 1 reference set allowed now: **NO**. Stable definitions, calibrated Core semantics, frozen adjudication rules, and resolved invalid/missing coverage are not yet all present.

### ML implication and one sequence

- Current verdict: Human Review **partially supports and materially strengthens** supervision semantics / label-boundary consistency as a principal current bottleneck rather than model architecture alone. Systematic Core threshold mismatch and `337` severe disagreements align with the strict sourceGroup Transformer OOF evidence that representation can learn within current supervision. This is not proof that architecture is irrelevant because the 221-sample package is disagreement-enriched and is not an independent model evaluation.
- Required order: build blinded boundary-calibration packet → human-revise and freeze Stage 1 guide → fixed calibration check → targeted dual-Core re-review → post-freeze Reviewer-2 tail completion and Reviewer-1 missing completion → remeasure agreement → freeze adjudication protocol only if gates pass → independently adjudicate remaining queue → freeze final Stage 1 reference → create versioned supervision-delta and rare-label support/diversity audit → only then consider one bounded ML experiment with an eligible new evaluation protocol.
- No training, legal149 reuse, Blog360 evaluation, protected-holdout access, label overwrite, hard-example deletion, taxonomy reduction, commit, push, or automatic follow-up was performed.

`NO FINAL GOLD LABELS CREATED IN THIS TASK`


## Human Review 221 — Transition to Model Adjudication

Date: 2026-09-15. Artifact: `v4/stage1-model-adjudication-v1/`.

- **No further human review = true.** Previous targeted human re-review/calibration/completion plan = **SUPERSEDED**. Human Stage 1 NO / PLAUSIBLE / CLEAR judgments are **FROZEN HUMAN OBSERVATIONAL EVIDENCE**. Stage 2/3 are **DEPRECATED**; `evidence / rank_order / tie_group` remain legacy unused fields.
- Core/Auxiliary hierarchy is unchanged: Core1/Core2 are frozen anchors; Auxiliary is frozen supporting evidence. Reviewer 1's four missing cells remain `CORE1_HUMAN_MISSING`; Reviewer 2 R3-184..R3-221 remains `CORE2_INVALID_PLACEHOLDER`, permanently excluded and never restored or imputed.
- Reused the existing **1,818-cell queue** without rebuilding or repeating the old audit. The **2,160 CORE_HUMAN_AGREEMENT** cells remain outside it and cannot be automatically overridden.
- **Astra: COMPLETE, 1,818/1,818; validation PASS.** Latest cross-account recovery found **918 valid rows**, then added **900 missing IDs** only. Earlier recovery began at 585; the explicit **Extremely High / xhigh** transition occurred after **667 completed rows**, and xhigh supplied 1,151 rows across interruptions. The original **186** and all 585/667/918 checkpoint prefixes were preserved. Runtime agent dispatch exposed **gpt-6-astra** with `reasoning_effort=xhigh`; earlier reasoning levels were not independently instrumented and are not retroactively relabeled. Account change is operational only: this remains one Astra run and one panel vote. See `account-continuation-checkpoint.json`, `astra-configuration-transition.json`, and `astra-judgment-provenance.csv`.
- Blind source: unchanged `model-judge-blind-input.csv` and `model-stage1-guidance-v1.md`; Luna's semantic input remains byte-identical. Astra was fully validated and hash-locked before revealing Human/Luna answers for comparison. The existing **Luna 1,818/1,818** artifact was validated and preserved; Luna was not rerun. Model-model matrix, per-label agreement, transitions and disagreement rows are in `model-model-*.csv`; separate Core/Auxiliary comparisons are in `model-human-comparison.csv` and `model-human-pairwise-summary.csv`.
- Auxiliary evidence remains supporting evidence, with Core1/Core2 as anchors. Per the latest user instruction, **AUX-R06 and AUX-R08 are separately identified sensitivity evidence**; current primary support excludes both. R06's earlier audit flag was INCOMPLETE_COVERAGE; no new quality/distribution audit was performed. R06 missing values remain missing. The original R01..R07 master counts are preserved and marked legacy sensitivity-only; `auxiliary-sensitivity-summary.csv` reports the inclusion variants. No all-human vote or Core override was applied.
- All judge outputs remain model-generated evidence. No new human adjudication or final/reference/gold labels were created. Future `MODEL_ADJUDICATED_*` categories are reserved, not assigned. **Final reference set = NOT ALLOWED YET**: Sol final adjudication and final provenance freeze remain outstanding. This is a supervision diagnostic, not product final evaluation.
- Next step: **Sol review of the completed panel for final adjudication/provenance freeze**; no automatic follow-up or final resolution was started.

## Stage-1 Final Adjudication Triage Preparation

- Methodology reconciliation completed with authoritative deterministic rules: Bucket A=847, B=356, C=409, D=206; uncertainty queue=562; Sol blind queue=409.
- The 50-cell ambiguity was resolved deterministically: primary Aux non-support means `primary_aux_supports_model_consensus == false`, including `DEFINED_OPPOSING_CATEGORY`.
- Triage package generated at `v4/stage1-final-adjudication-plan-v1/`. No judge was called; no judgment, final label, final reference set, or training artifact was created.
- Validation PASS. Next step: Sol High performs blind applicability adjudication on the sealed 409-cell Bucket-C queue only.


## Stage-1 Final Assembly

- Finalization protocol `stage1-finalization-protocol-v1` applied without new voting, tie-break, adjudication, training, or holdout access.
- A=847 and C=409 finalized; hard reference total=1256. B=356 and D=206 remain unresolved; uncertainty total=562.
- Sol Bucket-C exact-ID merge PASS (409/409). Reference designation is `model-adjudicated reference set`, not human gold or ground truth.
- Artifacts: `v4/stage1-final-adjudication-plan-v1/final-assembled-decisions.csv`, `final-hard-reference.csv`, `final-unresolved-uncertainty.csv`, `final-assembly-provenance.json`, `final-validation.json`.
- Final assembly validation PASS.

## Stage-1 Diagnostic Decision Record

- Reviewed rows: 221; authoritative lineage recovered: 221/221.
- Role: `model-adjudicated, disagreement-enriched semantic audit set`. This is NOT human gold, NOT a representative Train benchmark, and NOT suitable for direct hard-label Train augmentation.
- Full Stage-1 direct supervision patch: 213 canonical rows and 1,256 hard-reference cells; NO=988, PLAUSIBLE=123, CLEAR=145; existing positive→NO=0; existing negative→CLEAR=88.
- Baseline Macro-F1=0.34517862965139323; patched Macro-F1=0.3287162196992808. Decision: **REJECT**.
- Dev delta: predictions 138→149; added 13 (2 TP, 11 FP); removed 2 (1 TP, 1 FP); net +1 TP and +10 FP. Precision decreased substantially while recall increased only slightly.
- Interpretation: Stage-1 measures broad semantic applicability; canonical Train/Dev uses selective 0–2 emotion labels for central/non-redundant labels. Stage-1 CLEAR is therefore not equivalent to canonical evaluation-positive, and direct patching primarily created false positives.
- Strict sourceGroup OOF diagnosis: overall Macro-F1≈0.492306; PHQ≈0.497711; COSO≈0.370892; HUM≈0.486308. Fixed Dev is 149/149 COSO. Source composition/domain difficulty, sample/support differences, and non-identical training procedures descriptively explain most of the gap; canonical annotation policy is the same.
- Current direction: `COSO + selective 0–2 label selection/ranking`. Do not return to Stage-1 direct patch, CLEAR-as-hard-positive, PLAUSIBLE masking, missing-positive repair, threshold/seed/backbone sweeps.
- Detailed evidence: `experiments/emotion-classifier-v2/v4/stage1-supervision-diagnostic-v1/REPORT.md`.
- `RECORD ONLY — NO TRAINING`.

## Data Rights Clearance Checkpoint — Reddit / CoSoWELL Pending

- Reddit-derived data rights: `PENDING RIGHTS CLEARANCE`.
- CoSoWELL rights: `PENDING RIGHTS CLEARANCE`.
- Consented 54-row data: existing documentary consent provenance supports research/training/product/deployment/commercial use; no new rights determination was made in this checkpoint.
- Historical experiments, checkpoints, metrics, and failed-run provenance are preserved; no existing artifact was deleted or rewritten.
- No new production-targeted training using pending Reddit-derived or CoSoWELL sources is authorized. Checkpoints trained on pending sources must not be marked production-cleared.
- Created `experiments/emotion-classifier-v2/DATA_RIGHTS.md`.
- Next action: wait for written permission / rights clarification. Cleared-data fallback dataset work may continue independently.

## COSO Selective Ranking v1 — Legacy Failure, Repair, and First Valid Test

- Legacy invalid run: Macro-F1 `0.0449506987`; Micro-F1 `0.1362007168`; TP/FP/FN `19/95/146`. Status: `IMPLEMENTATION FAILURE / INVALID HYPOTHESIS TEST`. Causes: 21-column probability indices were used for 28-head outputs; 11 of 18 product-label mappings were wrong; `model.train()` was missing; partial accumulation normalization was wrong; scheduler was missing. `Ranking hypothesis NOT FALSIFIED by this run.`
- Repair-v2 integrity: authoritative 28→18 mapping PASS; namespace isolation PASS; checkpoint integrity PASS; full/partial accumulation equivalence PASS; frozen 53 optimizer-step / 6-warmup scheduler PASS; train/eval/dropout guards PASS. Repaired training completed 53 optimizer steps. The later literal `num_labels` check was adjudicated `GUARD IMPLEMENTATION FAILURE — CHECKPOINT INTACT`; the trained checkpoint remained valid and no retraining occurred.
- First valid repaired hypothesis test used frozen evaluator `canonical-direct-top2-v1`. Incumbent: Macro-F1 `0.3665010477`; Micro P/R/F1 `0.5972222222 / 0.5212121212 / 0.5566343042`; TP/FP/FN `86/58/79`; exact-set `55/149`. Candidate: Macro-F1 `0.3563948287`; Micro P/R/F1 `0.5931034483 / 0.5212121212 / 0.5548387097`; TP/FP/FN `86/59/79`; predicted cardinality `0:38, 1:77, 2:34`; exact-set `56/149 = 0.3758389262`; verdict `REJECT`.
- Interpretation: valid candidate did not improve Macro-F1; TP/FN and recall were unchanged; FP increased by 1; exact-set improved by 1 row. The frozen `COSO ×2 + BCE + 0.25 all-pair ranking` intervention did not improve the revised incumbent. Do not promote it, interpret the `.04495` run as evidence, or run λ/COSO-weight/threshold/seed sweeps.
- Current canonical best: `research_direct_top2 Macro-F1 = 0.3665010477` from the GoEmotions-targeted epoch-1 incumbent checkpoint.
- Current research direction: return to COSO supervision semantics, label-selection behavior, rare-label/support structure, and data/supervision analysis. No next experiment designed. `RECORD ONLY — NO TRAINING.`

## Stage-1 Lineage Recovery and Supervision Patch History

- The initial exact-text crosswalk was incomplete (109 mapped, 111 unresolved) and is not authoritative. The authoritative `sample-manifest.json` crosswalk recovered 221/221 Stage-1 samples to 221 unique canonical Train IDs: PHQ=110, COSO=103, HUM=8. Manifest: `experiments/emotion-classifier-v2/v4/stage1-final-adjudication-plan-v1/r3-canonical-crosswalk-manifest-v2.csv`.
- The incomplete patch (108 rows, 694 cells) was rejected and remains provenance-only. Full authoritative patch: 213 canonical rows, 1,256 cells; NO=988, PLAUSIBLE=123, CLEAR=145; existing positive→NO=0; existing negative→CLEAR=88; PLAUSIBLE existing positive=5 and negative=118. PLAUSIBLE was masked, not thresholded. Patch artifacts: `experiments/emotion-classifier-v2/v4/stage1-final-adjudication-plan-v1/stage1-supervision-patch-full-v2.csv` and `stage1-supervision-patch-full-v2-summary.json`.
- Full patch training was rejected: baseline Macro-F1=0.34517862965139323 versus patched=0.3287162196992808; Dev predictions 138→149, with net +1 TP and +10 FP. Current development best remains `goemotions-targeted-v1 / epoch-1` at 0.34517862965139323. Failed pre-training schema launches did not consume Dev evaluation and are retained as provenance.
- Stage-1 role: `model-adjudicated, disagreement-enriched semantic audit set`; not human gold, not representative Train performance, and not suitable for direct hard-label Train augmentation. Stage-1 CLEAR is not equivalent to canonical evaluation-positive. The 88 canonical-negative→CLEAR cells are diagnostic model-adjudicated evidence, not human consensus gold; 87/88 came from Bucket C Sol adjudication and 71/88 were COSO.
- OOF diagnosis: strict sourceGroup overall≈0.492306; PHQ≈0.497711; COSO≈0.370892; HUM≈0.486308; fixed Dev is 149/149 COSO. Reviewed-set OOF≈0.411337 versus non-reviewed Train≈0.523877. Source/domain composition, sample/support differences, and non-identical procedures explain most of the apparent gap; OOF and Dev use the same canonical annotation policy.
- Current direction: `COSO + selective 0–2 label selection/ranking`. Do not return to Stage-1 direct patch, CLEAR-as-hard-positive, PLAUSIBLE masking, missing-positive repair, threshold/seed/backbone sweeps, or additional human review. Detailed evidence: `experiments/emotion-classifier-v2/v4/stage1-supervision-diagnostic-v1/REPORT.md`.
- `RECORD ONLY — NO TRAINING`.

## Frozen Epoch-1 Runtime Checkpoint

Date: 2026-09-17.

- Frozen incumbent: `v4/aligned-supervision-v1/goemotions-targeted-v1/experiment/epoch-1-checkpoint`. PyTorch production-style inference parity **PASS** with explicit `max_length=512` and the frozen `28 → 21 → 18 → threshold 0.35 → probability-descending/fixed-order tie-break → max-2` policy.
- CPU FP32 ONNX export/parity **PASS**: 149/149 final predictions exactly match PyTorch and all metric deltas are zero. The validated FP32 ONNX artifact remains an optional runtime artifact.
- Existing dynamic INT8 path **FAILS parity** and cannot replace FP32; no further INT8 or quantization work is authorized.
- Apple/macOS: FP32 ONNX showed a severe latency regression and higher RSS versus PyTorch.
- Linux/aarch64 (Debian 13 container on Apple M2/Virtualization.framework, same 149 rows, batch 2, one thread): PyTorch `755.563 ms/sample`; ONNX `706.762 ms/sample`. The macOS latency regression did not reproduce: ONNX was 6.46% faster, but its peak RSS was about 43.6% higher and artifact size was effectively unchanged.
- Practical runtime default remains **PyTorch FP32**. Actual Linux/x86 production benchmarking is deferred until genuine deployment work.
- Runtime and production engineering are now **FROZEN**. Return to model-quality/product-evaluation work only; **DO NOT TRAIN** without a newly authorized evaluation foundation and experiment.

## enISEAR Rights / Independent-Evaluation Admission Audit

Date: 2026-09-17. Artifact: `v4/aligned-supervision-v1/public-domain-data-v1-20260910/enisear/RIGHTS_AND_EVAL_ADMISSION_AUDIT_20260917.md`.

- Highest-value task: determine whether the already-retrieved, Event-like enISEAR corpus can supply a rights-cleared independent evaluation component before any further model training. Audit verdict: **PASS**; dataset decision: **EXCLUDE**; training decision: **DO_NOT_TRAIN**.
- Official release license is ODC-By 1.0. It explicitly permits commercial use of database rights, but explicitly does not cover independent rights in individual contents. The 1,001 first-person event descriptions are original Figure-Eight contributor text, and no separate content license or contributor-to-licensor commercial sublicense grant was found in the official release, paper, supplement, University of Stuttgart page, or creator data-set page. Therefore commercial use, ML-training use, and product-evaluation use of the text remain **UNCLEAR**, which fails the strict PetalPal rights gate.
- Dataset facts verified from the authoritative local release: 1,001 English generation rows, exactly 143 per native emotion, 65 generation worker IDs; 5,005 human validation rows from 34 validation worker IDs. Native labels are anger, disgust, fear, guilt, joy, sadness, shame.
- Product mapping is **NOT DEFENSIBLE** for the whole dataset. Anger/disgust/fear/joy/sadness are exact mappings; guilt or shame to remorse is not defensible without subjective reinterpretation. The prompt-balanced corpus also lacks 13 product labels and natural zero-label coverage, so it cannot be Natural Product Evaluation even if rights were later resolved.
- No rows were admitted, no evaluation set was constructed, no model inference or metric computation occurred, and no threshold/checkpoint/taxonomy changed. The existing historical enISEAR candidate pool remains non-admitted. Model-quality improvement remains unproven pending a rights-cleared, methodologically defensible independent evaluation foundation.

## crowd-enVENT Admission Audit

Date: 2026-09-17. Cumulative artifact: `v4/aligned-supervision-v1/DATASET_ADMISSION_AUDITS_20260917.md`.

- Audit verdict: **PASS**; dataset decision: **EXCLUDE**; source-specific training decision: **DO_NOT_TRAIN**.
- The authoritative corpus archive/readme, official University of Stuttgart page, paper, and supplement contain no dataset/content license. The separate modeling repository's MIT license applies to code and does not establish rights to 6,600 personal event descriptions written by Prolific contributors. Commercial, training, and evaluation rights are therefore **UNCLEAR** and fail the strict admission gate.
- The source has strong Event-domain relevance and source grouping (`prolific_id`): 6,600 generation texts / 2,379 generation IDs and 6,000 validations over 1,200 texts / 1,217 validation IDs. However the whole label mapping is **NOT DEFENSIBLE**: only anger, disgust, fear, joy, sadness, and surprise map exactly; guilt/shame/trust/pride/relief/boredom cannot be remapped subjectively into Product-18 gold.
- No row was admitted and no model inference/training occurred. Incumbent remains `goemotions-targeted-v1/epoch-1-checkpoint`. Next selected task: audit the newly released `Less is More Corpus`, a labeled crowd-enVENT derivative whose authoritative catalog states CC BY 4.0 but also states a research-only restriction.

## Less is More Corpus Admission Audit

Date: 2026-09-17. Cumulative artifact: `v4/aligned-supervision-v1/DATASET_ADMISSION_AUDITS_20260917.md`.

- Audit verdict: **PASS**; dataset decision: **EXCLUDE**; source-specific training decision: **DO_NOT_TRAIN**.
- The University of Bamberg-stewarded Mozilla Data Collective record labels the 250-text/500-annotator release CC BY 4.0, but the same authoritative record explicitly restricts it to research purposes. That restriction is incompatible with PetalPal's potentially commercial long-term training/evaluation requirement. It is also derived from crowd-enVENT, whose original personal-text content license remains unresolved.
- The set is intentionally selected for low emotion-label agreement and is therefore a boundary challenge distribution, not Natural Product Evaluation. Its native 12-label scheme still has only six exact Product-18 mappings (anger/disgust/fear/joy/sadness/surprise); whole-dataset mapping is **NOT DEFENSIBLE**.
- The dataset was not downloaded; no row was inspected/admitted and no inference/training occurred. Incumbent unchanged. Next selected task: audit `MINDS`, an English multi-label emotion dataset advertised under CC BY 4.0, focusing first on authoritative provenance and whether its underlying text is original/licensable rather than scraped social content.

## MINDS Admission Audit

Date: 2026-09-17. Cumulative artifact: `v4/aligned-supervision-v1/DATASET_ADMISSION_AUDITS_20260917.md`.

- Audit verdict: **PASS**; dataset decision: **EXCLUDE**; source-specific training decision: **DO_NOT_TRAIN**.
- Repo-independent authoritative review found that MINDS contains 227,229 English Twitter posts collected through the Twitter API under Omicron hashtags. The CC BY 4.0 notice is for the paper, while the paper describes the dataset as available “for research purposes”; it does not establish a commercial license for the Twitter content. This independently fails both the research-only and scraped social-platform rights gates.
- Labels are not human gold: IBM Watson NLU, Komprehend, and Text2emotion outputs were combined with a threshold tuned on SemEval-2018. The five names sadness/joy/fear/disgust/anger map exactly, but model-generated labels cannot support independent product evaluation and whole-taxonomy mapping remains **NOT DEFENSIBLE**.
- Dataset not downloaded; no rows admitted, no inference/training performed, incumbent unchanged. Next selected task: search authoritative repositories for a genuinely permissive, originally collected human emotion/event corpus rather than another social-media derivative.

## BRIGHTER English Admission Audit

Date: 2026-09-17. Cumulative artifact: `v4/aligned-supervision-v1/DATASET_ADMISSION_AUDITS_20260917.md`.

- Audit verdict: **PASS**; dataset decision: **EXCLUDE**; source-specific training decision: **DO_NOT_TRAIN**.
- Although the official Hugging Face releases state CC BY 4.0, the authoritative BRIGHTER paper explicitly prohibits commercial use without creator approval. English data are Reddit/social-media and subreddit diary posts. Additional approval and underlying social-content rights are therefore both incompatible with the current gate.
- Human multi-label annotation and the six exact labels (anger/disgust/fear/joy/sadness/surprise) are methodologically useful, but the release does not provide source/user grouping and has high unresolved overlap risk with the Reddit-derived incumbent lineage. No data were downloaded or evaluated.
- Incumbent unchanged. Next selected task: audit CR4-NarrEmote at its authoritative Dataverse record, including whether a strictly public-domain book subset plus direct human labels can avoid both content-rights and subjective-mapping failures.

## CR4-NarrEmote Admission Audit

Date: 2026-09-17. Cumulative artifact: `v4/aligned-supervision-v1/DATASET_ADMISSION_AUDITS_20260917.md`.

- Audit verdict: **PASS**; dataset decision: **EXCLUDE**; source-specific training decision: **DO_NOT_TRAIN**.
- The authoritative Borealis record applies CC0 1.0 to the deposited dataset, but the required text consists of passages from book-length fiction/non-fiction spanning roughly 1800–2000, including contemporary and twentieth-century collections. Neither the release nor paper establishes per-work public-domain or commercial relicensing rights; CC0 cannot be assumed to waive third-party passage copyrights. Underlying-content rights therefore remain **UNCLEAR**.
- `t1` contains genuine citizen-science labels, and `file_id` enables source-document isolation. However the released NRC labels use lexical/model mappings, and a direct-label-only exact Product-18 subset would still retain uncleared passages. Only metadata/readme were retrieved; the passage table was not downloaded or evaluated.
- Incumbent unchanged. Next selected task: audit Hippocorpus, the most product-like rights candidate found (6,854 crowd-written diary-like event stories), to determine whether its license and native fields provide any defensible existing emotion gold without new review.

## Hippocorpus Admission Audit (superseded by rights-first unlabeled-data policy)

Date: 2026-09-17. Cumulative artifact: `v4/aligned-supervision-v1/DATASET_ADMISSION_AUDITS_20260917.md`.

- Audit verdict: **PASS**; current dataset decision: **ADMIT_UNLABELED**; source-specific training decision: **UNLABELED_OBJECTIVES_ONLY**.
- Rights/provenance pass: Microsoft's authoritative release uses **O-UDA-1.0**, which imposes no restriction on data use/modification or on use/modification/distribution of results. The 6,854 recalled/imagined/retold stories were written for the project by MTurk workers rather than scraped, and `WorkerId` plus recalled/imagined/retold pair IDs support source isolation.
- No native Product-18 labels exist: questionnaire scalars and event-boundary/unexpectedness annotations must not be mapped to emotions or represented as gold. Under the updated policy this does not prevent unlabeled use.
- The official archive was downloaded and automatically minimized to 2,776 unique recalled summaries after two >300-character exclusions and one contact-pattern exclusion. The author-disjoint train/validation split is 2,637/139 rows across 2,524/135 anonymized author groups. Long stories, demographics, questionnaires, imagined/retold variants, and free-text metadata are excluded. No human review was performed.

## Sentiment-Focused Journaling Dataset Admission Audit

Date: 2026-09-17. Cumulative artifact: `v4/aligned-supervision-v1/DATASET_ADMISSION_AUDITS_20260917.md`.

- Audit verdict: **PASS**; dataset decision: **EXCLUDE**; source-specific training decision: **DO_NOT_TRAIN**.
- The single-user Hugging Face card declares CC BY 4.0, but supplies no original source, author/participant consent or ownership statement, paper, collection method, synthetic-generation disclosure, or label-annotation procedure. Its referenced `LICENSE` file and optional validation file are absent from the published four-file tree. The 3.38 KB CSV therefore has unclear underlying-content and label-provenance rights despite the metadata tag.
- Labels such as joy/sadness/gratitude/anger overlap exactly, but anxiety/peace/burnout/acceptance/confidence cannot be subjectively remapped. There is no source/user grouping and no basis for treating labels as independent human gold.
- Dataset not downloaded; no rows admitted, no inference/training performed, incumbent unchanged. Next selected task: audit `MEMO4000`, a larger multi-emotion corpus with closer nominal labels, at its authoritative Mendeley record and any linked paper/source.

## MEMO4000 Admission Audit

Date: 2026-09-17. Cumulative artifact: `v4/aligned-supervision-v1/DATASET_ADMISSION_AUDITS_20260917.md`.

- Audit verdict: **PASS**; dataset decision: **EXCLUDE**; source-specific training decision: **DO_NOT_TRAIN**.
- Mendeley declares CC BY 4.0, but the linked author paper says the 4,000 texts were collected from social-network statuses “such as Twitter” in 2018–2020. No post-author commercial relicense/consent, platform-level rights chain, stable author grouping, or source IDs are documented. Dataset-level CC BY therefore does not clear the underlying posts.
- The paper merely says texts were labeled with emotions; it gives no annotator count/identity, rubric, independence, agreement, adjudication, or quality control. Seven labels are exact Product-18 names, but hope/pride/other are not exact and the gold provenance is insufficient for independent evaluation.
- Dataset not downloaded; no rows admitted, no inference/training performed, incumbent unchanged. Next selected task: audit Persona-E2, whose first-party card exposes both broad source composition and an explicit non-commercial license, to close that candidate without handling its text.

## Persona-E2 Admission Audit

Date: 2026-09-17. Cumulative artifact: `v4/aligned-supervision-v1/DATASET_ADMISSION_AUDITS_20260917.md`.

- Audit verdict: **PASS**; dataset decision: **EXCLUDE**; source-specific training decision: **DO_NOT_TRAIN**.
- The creator's release is explicitly **CC BY-NC-SA 4.0**, “Academic Use Only,” and limited to non-commercial work. It also aggregates news, Reddit/social media, and life-narrative sources, including 440 Reddit events, creating unresolved underlying-content and incumbent-overlap concerns.
- Its 36-person human annotations measure each reader's elicited response, not the original writer's emotion; the paper says General Writer labels are produced by an external classifier because writer ratings are unavailable. Thus even the six exact Product-18 label names do not represent the PetalPal target construct.
- Dataset not downloaded; no rows admitted, no inference/training performed, incumbent unchanged. Next selected task: audit the CC BY 4.0 `Three Datasets Reporting Unexpected Events` release as a rights-clear original-participant alternative, focusing on whether its labels contain any discrete emotion gold rather than only valence/unexpectedness.

## Unexpected-Events Datasets Admission Audit (superseded by rights-first unlabeled-data policy)

Date: 2026-09-17. Cumulative artifact: `v4/aligned-supervision-v1/DATASET_ADMISSION_AUDITS_20260917.md`.

- Audit verdict: **PASS**; current dataset decision: **ADMIT_UNLABELED**; source-specific training decision: **UNLABELED_OBJECTIVES_ONLY after schema verification**.
- Rights/provenance pass: the Mendeley release is CC BY 4.0 and contains 9,720 original Prolific participant responses elicited for the authors' everyday-scenario experiments. The article documents at least two independent human raters, high agreement, and majority/discussion resolution.
- Native labels are event topic, positive/neutral/negative valence, and goal-object relation. They cannot be expanded into Product-18 emotions, and “unexpected event” is not gold `surprise`; nevertheless, the original rights-cleared Event text is valid for unlabeled adaptation. Participant-level grouping must be verified from the released tables before a held-out experiment.
- Dataset not downloaded in this step; Hippocorpus is the first admitted-unlabeled experiment.

## IDEST Admission Audit

Date: 2026-09-17. Cumulative artifact: `v4/aligned-supervision-v1/DATASET_ADMISSION_AUDITS_20260917.md`.

- Audit verdict: **PASS**; dataset decision: **EXCLUDE**; source-specific training decision: **DO_NOT_TRAIN**.
- The PLOS article is CC BY, but calls the OSF database “freely available for academic research”; an authoritative project/file license establishing commercial text reuse was not available in this audit. Texts were supplied through volunteer writing competitions or written by researchers and translated into English, with no accessible per-contributor commercial relicensing chain.
- More decisively, 250 first-person stories have human valence, arousal, comprehensibility, and plot-arc ratings, not categorical emotions. The paper explicitly chose a dimensional approach and leaves emotion-category assignment to future work. Mapping dimensions/arcs into Product-18 would be prohibited new interpretation.
- Dataset not downloaded; no rows admitted, no inference/training performed, incumbent unchanged. Next selected task: audit Stanford Emotional Narratives (SENDv1), the closest remaining first-person autobiographical resource, for exact reuse rights and whether its text has categorical emotion gold rather than continuous valence only.

## SENDv1 Admission Audit and Independent-Eval Limitation

Date: 2026-09-17. Cumulative artifact: `v4/aligned-supervision-v1/DATASET_ADMISSION_AUDITS_20260917.md`.

- SENDv1 audit verdict: **PASS**; dataset decision: **EXCLUDE**; source-specific training decision: **DO_NOT_TRAIN**. Official terms limit controlled access to academic researchers/research purposes and require an EULA. Raw video/transcripts are consent-tiered: 81/193 clips are `Limited-Use`, 112/193 are `Share-Ok` for researchers. Native supervision is continuous self/observer valence, not Product-18 categories.
- The external admission sweep now covers 12 plausible candidates including the separately recorded enISEAR audit. None simultaneously has clear commercial/content rights, original human Event-like English text, existing human Product-18-compatible labels, source grouping, and independence. Discrete-label candidates fail rights/provenance/construct gates; rights-clear candidates have only valence, unrelated fields, or no emotion gold.
- Status: **TRAINING_LOOP_ACTIVE; MODEL_PROMOTION_INCONCLUSIVE_WITHOUT_INDEPENDENT_GOLD**. New human labeling/review remains prohibited, and pseudo-labeling cannot create independent gold. Rights-cleared unlabeled corpora may nevertheless support bounded self-supervised/domain-adaptation experiments. Incumbent and frozen inference path remain unchanged unless later evidence satisfies the promotion gate.
- Minimum external state change: documentary commercial/content clearance for an already human-labeled independent candidate, or an already-labeled, commercially consented, source-grouped independent English Event set. No new labeling is requested.
- Autonomous loop can continue: **YES**, using admitted unlabeled data without gold/evaluation/promotion claims.

## Rights-First Unlabeled Admission Policy Applied

Date: 2026-09-17.

- All 13 audited external candidates now have one of the required classifications in `v4/aligned-supervision-v1/DATASET_ADMISSION_AUDITS_20260917.md`: 2 `ADMIT_UNLABELED`, 4 `BLOCKED`, and 7 `EXCLUDE`; no new `ADMIT_GOLD` source was found.
- Hippocorpus is the first operational `ADMIT_UNLABELED` corpus. Preparation is reproducible at `v4/aligned-supervision-v1/admitted-unlabeled-v1/hippocorpus/prepare.py`; its `prepared/audit.json` records the minimized fields, automatic contact-pattern exclusion, source-group isolation, and explicit forbidden roles.
- Generated/weak/pseudo labels remain non-gold and may not produce an independent product score or independently justify promotion. The absence of independent rights-cleared human gold limits promotion conclusions, not continued engineering.
- Rights correction: the existing candidate-c / GoEmotions-derived encoder is a **historical research incumbent only**. Because its underlying Reddit-derived training-data rights remain unresolved, neither that checkpoint nor any DAPT descendant may be described as production-cleared. Hippocorpus DAPT is therefore a research adaptation of unresolved historical lineage, even though the newly admitted Hippocorpus input itself is rights-cleared.
- Product-domain length correction: `max_length=512` is only the runtime safety ceiling; the target Event is approximately at most 300 characters. Before filtering, the 2,779 recalled summaries have median/P75/P90 character lengths 167/213/259; 99.9280% are at most 300 characters and 0.0720% are over. The simplest policy retains complete summaries `<=300` characters and excludes the 2 longer summaries without manual review or truncation.

## Hippocorpus DAPT v1 and Fixed Midpoint Repair

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/admitted-unlabeled-v1/hippocorpus/dapt-v1/`.

- Full DAPT used 2,637 admitted-unlabeled train summaries and 139 author-isolated validation summaries, all complete and at most 300 characters. One epoch updated only the top two encoder layers and MLM transform head (14,818,137/124,697,433 parameters). No Product-18 labels were created or used for DAPT.
- Held-out MLM loss improved from `9.098327` to `3.742931` (`-58.86%`), but MLM improvement was not treated as model-quality improvement. On the same frozen 149-row historical development diagnostic, micro-F1 changed `0.401575 -> 0.394052`; 0/1/2 output counts changed `71/67/11 -> 69/56/24`; false positives changed `38 -> 51`, or `+0.087248` per row. This exceeded the locked `+0.05` guard, so full DAPT was **REJECTED**.
- A single predeclared 50% encoder-weight midpoint repair was run with the original classifier head unchanged and no alpha sweep. Held-out MLM loss was `5.106241` (`-43.88%` versus incumbent). Frozen-development micro-F1 was `0.398467` (`-0.003107`); output counts were `67/68/14`; false positives were `44` (`+0.040268` per row); exact selected-output agreement was `93.96%`; mean absolute probability drift was `0.006137`.
- Per-label check: among labels with support at least 3, the worst F1 change was sadness at `-0.031621`, within the locked `-0.10` guard. No catastrophic-forgetting guard fired. The midpoint is therefore **RETAINED_AS_RESEARCH_CANDIDATE_ONLY**.
- Reload verification: **PASS**. The saved checkpoint reproduces the recorded development metrics exactly, retains an unchanged classifier head, and its binary probability artifacts were saved. Frozen product evaluation was not opened; no human review occurred.
- Rights/promotion status: the retained checkpoint still inherits the historical GoEmotions/Reddit-derived incumbent whose underlying training-text rights are unresolved. It is not production-cleared. There is no independent rights-cleared human-gold Product-18 evaluation, so promotion remains **INCONCLUSIVE** and production inference remains unchanged.

## Short-Event Domain Diagnostic v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/short-event-domain-diagnostic-v1/`.

- Status: **PASS — DESCRIPTIVE ONLY**. No training occurred and the incumbent did not change. The canonical repository evaluator/Node selector exactly reproduced the locked incumbent micro-F1 `0.5280528053` on all 149 historical development rows. An earlier local draft using a simplified noncanonical selector was invalidated and renamed `*.invalid-*`.
- The historical COSO-149 development diagnostic is length-mismatched: character median/P75/P90 are `616/906/1189`; only `19/149` (`12.75%`) are at most 300 characters and `130/149` are longer. Token median/P90/max are `133/275/421`, with zero rows over the 512-token runtime ceiling. Therefore `max_length=512` is not the issue; product-domain length coverage is.
- On the 19-row `<=300` slice, incumbent micro-F1 is `0.6154`, 0/1/2 output counts are `8/9/2`, and false positives are `5` (`0.2632/row`). On the 130 rows over 300 characters, micro-F1 is `0.5199`, output counts are `27/81/22`, and false positives are `53` (`0.4077/row`). The short-minus-long differences are descriptive only because the short slice is tiny/sparse and COSO is not independent rights-cleared product gold.
- On Hippocorpus's independent rights-cleared but **unlabeled** 139-row validation split, the incumbent produced 0/1/2-label counts `21/100/18`; the most frequent predictions were sadness 46 and joy 39. This is only a behavior profile, not correctness or product evaluation.
- Conclusion: short-event evaluation coverage is a material unresolved bottleneck. No quality/promotion claim is made. The incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`, whose historical GoEmotions/Reddit-derived training-text rights remain unresolved and which is not production-cleared.

## Unexpected Events Operational Admission and Preparation

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/admitted-unlabeled-v1/unexpected-events/`.

- Admission: **ADMIT_UNLABELED**, qualified as `AUXILIARY_HYPOTHETICAL_EVENT`. The official Mendeley v1 release is CC BY 4.0 and consists of participant-written everyday-event continuations. Its human valence/topic/goal-relation fields are not Product-18 emotion gold and are excluded from prepared records.
- Schema/provenance verification: all three selected authoritative tables contain participant `user_id`; 486 global participant groups support leakage-controlled splitting. Raw identifiers, including IP-like values, are replaced by deterministic aliases and never written to prepared files.
- Release discrepancy: the publication/release claims 9,720 text responses, while the selected released tables reproducibly contain 8,700 nonblank responses (`2540 + 5140 + 1020`). The missing 1,020 are not inferred or synthesized; the discrepancy is retained in `prepared/audit.json`.
- Before policy, character median/P75/P90 are `46/79/125`; `99.1954%` are at most 300 characters and `0.8046%` are over. Automatic preparation retains 8,122 unique complete `<=300`-character responses and creates a participant-disjoint 7,716/406 train/validation split across 460/26 participant groups. It excludes 70 long rows, 4 rows with fewer than three ASCII letters, and 504 normalized duplicates; no human sample review occurred.
- Training decision: **DO_NOT_TRAIN YET**. This preparation establishes admissible data and leakage control, but does not supply an uncontaminated Product-18 quality evaluation or authorize another DAPT sweep.

## Cross-Source Short-Event Coverage Diagnostic v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/cross-source-domain-coverage-v1/`.

- Status: **PASS — NO TRAINING**. A protocol was locked before automatic analysis. Hippocorpus remains `PRIMARY_FIRST_PERSON_EVENT`; Unexpected Events is `AUXILIARY_HYPOTHETICAL_EVENT` and must not dominate merely because it is larger.
- Hippocorpus has first-person markers in `95.53%` of 2,776 rows; Unexpected Events has them in only `0.89%` of 8,122 rows and third-person markers in `74.75%`. Median character lengths are `167` versus `49`. These automatic surface diagnostics confirm a strong construct/style difference without reading samples.
- Vocabulary Jaccard overlap is `0.3081`; Unexpected Events contributes 2,848 source-unique normalized word types across 21 scenario materials, so it offers auxiliary coverage, but vocabulary breadth is not model-quality evidence.
- No new DAPT run is started: prior full DAPT was rejected, its single fixed midpoint remains research-only/inconclusive, and the instruction forbids further DAPT intensity/LR/epoch sweeps. Neither unlabeled source can independently evaluate Product-18 correctness or justify promotion.

## Story Commonsense Admission Audit and Current Loop Boundary

Date: 2026-09-17. Cumulative artifact: `v4/aligned-supervision-v1/DATASET_ADMISSION_AUDITS_20260917.md`.

- Story Commonsense is **EXCLUDE**. Its 15,000 ROCStories source texts are governed by an accompanying non-commercial, non-revenue-generating research license. The human labels describe third-person story-character reactions/motivations, not the writer's PetalPal Event emotion; six names overlap exactly but the construct is not defensible Product-18 gold.
- The cumulative external audit now covers 14 candidates including the separate enISEAR record: 2 `ADMIT_UNLABELED`, 4 `BLOCKED`, 8 `EXCLUDE`, and 0 `ADMIT_GOLD`.
- Current autonomous-loop boundary: admissible short-event corpora are prepared and source roles are locked; the remaining high-value model-changing paths would either repeat the forbidden DAPT sweep family or lack an uncontaminated Product-18 evaluation. This is not a claim that unlabeled data is useless: both sources remain valid for future bounded representation/weak-supervision research with explicit non-gold status. It is a guard against running an unjudgeable model-selection experiment.
- Minimum external state change for promotion-quality work remains an already-human-labeled, commercially/content-cleared, source-grouped, independent English short-Event evaluation set. No human labeling/review is requested. Until then the model decision is **INCONCLUSIVE**, the incumbent is unchanged, and neither the incumbent nor the midpoint is production-cleared.

## Incumbent Aggregate Error / Rare-Label Profile v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/incumbent-error-profile-v1/`.

- Status: **PASS — DIAGNOSTIC ONLY**. The canonical selector exactly reproduces incumbent micro-F1 `0.5280528053`. No sample was reviewed, no gold changed/deleted, no threshold/taxonomy changed, and no training occurred.
- All COSO-149 aggregate counts: 58 false positives and 85 false negatives. Largest FP contributors are joy 24, optimism 7, sadness 6, caring 4, and fear 4. Largest FN contributors are annoyance 16, caring 11, joy 8, love 8, and amusement 6.
- Gold-by-predicted 0/1/2 matrix: gold-0=`18/12/0`; gold-1=`14/49/10`; gold-2=`3/29/14`. The incumbent therefore misses at least one label on many historical two-label rows, while joy dominates false positives.
- Rare-label limitation: admiration, anger, confusion, curiosity, disgust, and remorse each have support below 3 across all 149 rows. In the 19-row `<=300` slice, only joy has support at least 3. The short slice is not adequate for Product-18 per-label model selection.
- Decision: **DO_NOT_TRAIN**. The evidence identifies error locations but does not supply an uncontaminated protocol for selecting a loss, sampling, calibration, or encoder intervention. Acting on these counts would optimize the same sparse historical diagnostic. Credible model-quality improvement remains **NOT YET PROVABLE**; current model decision remains **INCONCLUSIVE** and the historical research incumbent is unchanged.

## Status Correction — Research Continues

Date: 2026-09-17.

- Current status is **BLOCKED_FOR_CREDIBLE_PRODUCT_PROMOTION**, not blocked for all model research. Missing independent, rights-cleared, Product-18-compatible human gold prevents a credible `PROMOTE` conclusion, but does not prohibit bounded research-only candidates using admitted data and explicit weak supervision.
- The frozen research incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`. It and every descendant inherit unresolved historical GoEmotions/Reddit-derived underlying-text rights and are not production-cleared.

## Selective Consensus Distillation v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/selective-consensus-distillation-v1/`.

- Product problem: the incumbent has 58 FP and 85 FN, and simple MLM DAPT increased FP. Hypothesis: exact-output, high-confidence consensus from two fixed teachers could supply conservative short-Event weak supervision, with uncertain labels masked, and improve selective 0-2 behavior without another DAPT sweep.
- Exact teachers: (1) frozen incumbent `goemotions-targeted-v1/experiment/epoch-1-checkpoint`; lineage is historical candidate-c/GoEmotions Reddit-derived research initialization -> aligned/standard continuation -> fixed targeted GoEmotions continuation. (2) `domain-restoration-v1/experiment/epoch-1-checkpoint`; initialized from the incumbent and continued for one fixed epoch on the existing 841-row aligned PetalPal Train. The second teacher had COSO micro-F1 `0.5364` and FP/FN `56/84` versus incumbent `0.5281` and `58/85`, but worse macro-F1 `0.3328` versus `0.3452`. Both teachers remain unresolved-lineage research models.
- Pseudo-label status: **WEAK_PSEUDO_NOT_HUMAN_GOLD**. Text came only from `ADMIT_UNLABELED` Hippocorpus and Unexpected Events. A deterministic 1:1 train pool contained 2,637 rows per source; prepared participant-disjoint validations remained unopened until after the candidate existed.
- Locked feasibility gate: **PASS**. Exact teacher output agreement was `98.27%`; fixed confidence rules yielded 2,416 eligible weak rows (Hippocorpus 1,162; Unexpected Events 1,254), 995 confident abstentions, and 9 labels with at least 20 strong positives. No threshold was relaxed.
- Fixed training: one epoch, LR `2e-6`, seed 44, masked BCE, classifier plus top two encoder layers only, 14,787,868/124,667,164 trainable parameters. All text was complete and `<=300` characters; `max_length=512` remained runtime safety only. No sweep occurred.
- COSO-149 result: micro P/R/F1 `0.5797/0.4848/0.5281 -> 0.5532/0.4727/0.5098`; FP `58 -> 63`; FN `85 -> 87`; 0/1/2 outputs `35/90/24 -> 31/95/23`. On the 19-row short slice, F1 `0.6154 -> 0.5926`, FP `5 -> 6`, FN stayed 5.
- Supported-label F1 regressions included gratitude `-0.2294`, disappointment `-0.1905`, optimism `-0.1164`, excitement `-0.1000`, caring `-0.0621`, and sadness `-0.0471`; joy improved `+0.0181` and love `+0.1410`, but the broad regressions and aggregate degradation fail the locked rules.
- Previously untouched unlabeled validations passed stability-only guards: incumbent/candidate exact-output agreement was `89.21%` on Hippocorpus and `95.07%` on Unexpected Events; every 0/1/2 distribution shift was below 1.5 percentage points. These are not correctness scores and cannot offset labeled-diagnostic failure.
- Decision: **REJECT**. All labeled quality guards failed; both unlabeled stability guards passed. Candidate checkpoint is not retained as an improved research candidate, incumbent remains unchanged, promotion remains **INCONCLUSIVE**, frozen final evaluation was not opened, and no human review occurred.

## Native Human-Valence Auxiliary Adaptation v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/native-valence-aux-v1/`.

- Distinct hypothesis: the rights-cleared native human `pos/neg/neither` task in Unexpected Events might improve short-event affect representations without converting valence into Product-18 pseudo labels. Only the incumbent's top two encoder layers and a temporary 3-class valence head were trainable; the Product-18 classifier head was frozen and later verified tensor-identical.
- Data feasibility: **PASS**. Native valence exists for 8,120/8,122 prepared rows (`99.975%`). Participant-disjoint train/validation contain 7,714/406 rows across 460/26 groups. Train counts are neg/neither/pos `4523/363/2828`; validation `170/26/210`. Two missing-label rows were automatically excluded. Status is `NATIVE_HUMAN_VALENCE_NOT_PRODUCT18_GOLD`; no Product-18 mapping or human review occurred.
- Fixed training: one epoch, LR `2e-6`, batch 16, seed 44, train-derived square-root inverse-frequency cross-entropy, 14,175,744 trainable encoder parameters. Every text was complete and `<=300` characters; `max_length=512` was runtime safety only. No sweep occurred.
- Auxiliary validation: accuracy `0.8251`, macro-F1 `0.5680`. Negative F1=`0.8455`, positive F1=`0.8585`, but `neither` F1=`0.0` with zero predictions, failing the locked auxiliary macro-F1 `>=0.65` guard.
- COSO-149 emotion result: micro P/R/F1 `0.5797/0.4848/0.5281 -> 0.5563/0.4788/0.5147`; FP `58 -> 63`; FN `85 -> 86`; 0/1/2 outputs `35/90/24 -> 32/92/25`. The 19-row short slice changed F1 `0.6154 -> 0.5926`, FP `5 -> 6`, FN stayed 5.
- Supported-label regressions included disappointment `-0.2571`, caring `-0.0751`, gratitude `-0.0684`, sadness `-0.0256`, and joy `-0.0067`; love improved `+0.1410`. The classifier-head integrity guard passed, locating the regression in encoder representation drift rather than head mutation.
- Unlabeled stability guards passed: exact incumbent/candidate output agreement was `97.12%` on Hippocorpus and `96.06%` on Unexpected Events; 0/1/2 distribution changes stayed within the fixed bounds. These are behavior checks, not correctness scores.
- Decision: **REJECT**. The auxiliary task, aggregate emotion, FP/FN, supported-label, and short-slice guards failed. Candidate is not retained; incumbent stays unchanged; promotion remains **INCONCLUSIVE**; frozen final evaluation was not opened.

## Agreement-Gated Selector v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/agreement-gated-selector-v1/`.

- Distinct non-training hypothesis: because representation adaptation twice increased FP, retain only labels independently selected by both the frozen incumbent and fixed domain-restoration checkpoint under the existing canonical threshold `.35`/max-2 selector. Combination was a set intersection preserving incumbent order; no probability blend, label-specific rule, threshold change, or sweep was permitted.
- COSO-149 result: FP `58 -> 53`, FN `85 -> 88`, micro precision `0.5797 -> 0.5923`, recall `0.4848 -> 0.4667`, F1 `0.5281 -> 0.5220`, and 0/1/2 outputs `35/90/24 -> 40/88/21`. The 19-row short slice was unchanged at F1 `0.6154`, FP/FN `5/5`, and outputs `8/9/2`.
- Supported-label regression guard failed: love F1 `0.1667 -> 0.0`, excitement `0.5000 -> 0.4000`, and gratitude `0.7000 -> 0.6316`. Joy precision improved enough for F1 `0.6800 -> 0.7010`, but this did not offset lost recall elsewhere.
- Unlabeled behavior guards passed: candidate/incumbent exact-output agreement was `98.56%` on Hippocorpus and `98.52%` on Unexpected Events; distribution changes were small and toward slightly more abstention. These are not correctness scores.
- Decision: **REJECT**. FP, FN, precision, short-slice, and stability guards passed; overall micro-F1 and supported-label guards failed. No follow-up union/blend/label-specific selector is run because that would tune variants against the same sparse historical development set. Incumbent remains unchanged; promotion stays **INCONCLUSIVE**.

## Dropout Uncertainty Feasibility and Consistency v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/dropout-uncertainty-v1/` and `dropout-consistency-v1/`.

- Feasibility question: whether stochastic instability on admitted short-event text supplied evidence for a consistency objective, rather than running representation learning merely because it was available. Five fixed dropout passes used 512 participant-diverse train rows per source; prepared validation remained unopened.
- Feasibility: **PASS**. Hippocorpus had `204/512` unstable rows (`39.84%`) with mean pairwise exact-output agreement `0.7762`; Unexpected Events had `144/512` (`28.13%`) and agreement `0.8525`. This exceeded the locked `15%`/`0.90` gate and authorized exactly one candidate.
- Fixed candidate: 5,274 admitted train rows, source-balanced 1:1; one epoch at LR `1e-6`, batch 16, seed 44; top two encoder layers only. Two dropout passes were softly anchored to frozen incumbent Product-18 probabilities and received unit-weight probability-MSE consistency loss. The classifier head was frozen and verified tensor-identical. No hard labels, pseudo-gold, threshold changes, or sweep occurred.
- Independent validation stability failed. Hippocorpus unstable rows stayed `35.97% -> 35.97%` and pairwise agreement changed `0.8036 -> 0.8000`. Unexpected Events instability worsened `26.11% -> 29.06%` and agreement `0.8648 -> 0.8547`. Average relative unstable-row reduction was `-5.66%`.
- COSO-149 result: micro P/R/F1 `0.5797/0.4848/0.5281 -> 0.5586/0.4909/0.5226`; FP `58 -> 64`; FN `85 -> 84`; 0/1/2 outputs `35/90/24 -> 32/89/28`. The 19-row short slice retained F1 `0.6154` and FP/FN `5/5`, but outputs shifted `8/9/2 -> 7/11/1`.
- Supported-label regressions included surprise `-0.0833`, gratitude `-0.0684`, sadness `-0.0256`, fear `-0.0234`, and joy `-0.0133`; love improved `+0.1410`. Core stability, aggregate F1, FP, and supported-label guards failed.
- Decision: **REJECT**. No consistency-weight, dropout-strength, LR, or epoch follow-up is run. Incumbent remains unchanged; promotion remains **INCONCLUSIVE**; frozen final evaluation and human review were not used.

## Current Autonomous Research Boundary

Date: 2026-09-17.

- Status remains **BLOCKED_FOR_CREDIBLE_PRODUCT_PROMOTION**, not a claim that model research is universally impossible.
- With current assets, materially different evidence-backed families have now been reasonably exercised: historical supervised continuation/loss weighting and two alternative encoders; short-domain MLM DAPT; high-confidence Product-18 pseudo-label distillation; native human-valence auxiliary adaptation; fixed agreement-gated selection; and soft dropout consistency. The new short-domain paths all failed their locked quality guards, most commonly by increasing false positives or regressing supported labels.
- Further immediate variants would be intensity/threshold/loss/selector tuning against COSO-149 or the same admitted validations, which would violate the anti-sweep and evaluation-integrity constraints. No such variants are authorized.
- The next justified restart trigger is one of: a newly discovered `ADMIT_GOLD` source; a materially new `ADMIT_UNLABELED` source with a distinct, relevant native signal; an independently callable model-teacher resource enabling genuinely diverse weak-label consensus; or independent rights-cleared Product-18 human gold. Any future candidate remains research-only until promotion evidence exists.
- Current best frozen research incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`; its historical GoEmotions/Reddit underlying-text rights remain unresolved and it is not production-cleared.

## ML V1 Freeze — 2026-09-17

- Freeze decision: **FREEZE ML V1 — PASS**. Do not start further model, threshold, loss, dropout, selector, DAPT, ONNX, deployment, benchmark, or dataset-search work until a restart condition below is satisfied. No new human review will be performed.
- Frozen incumbent, unchanged: `v4/aligned-supervision-v1/goemotions-targeted-v1/experiment/epoch-1-checkpoint`. This is the only current ML V1 model. Every rejected candidate remains non-current and must not replace or be described as the incumbent.
- Status and rights: **RESEARCH-ONLY**. The incumbent belongs to the historical GoEmotions/Reddit-derived lineage; underlying training-text rights remain unresolved. It is not rights-cleared or production-cleared, and there is **no production promotion**.
- Frozen inference policy: named `28 → 21 → Product-18` projection, global threshold `0.35`, probability-descending order with fixed-order tie-break, maximum two outputs. `max_length=512` tokens is a runtime safety ceiling, not the expected product length; PetalPal Events target approximately `<=300` characters.
- Frozen historical development diagnostic (COSO-149; not independent promotion evidence): micro precision/recall/F1 `0.579710 / 0.484848 / 0.528053`; macro F1 `0.345179`; false positives `58`; false negatives `85`; predicted 0/1/2-label counts `35/90/24`. Sparse per-label support and long-text mismatch remain documented limitations.
- Rejected research paths: selective consensus distillation — **REJECT**; native valence auxiliary adaptation — **REJECT**; teacher-intersection selector — **REJECT** (artifact name `agreement-gated-selector-v1`); dropout consistency adaptation — **REJECT**. None is a current model or promotion candidate. Further threshold/loss/dropout/selector variants would be an unsupported sweep against the same limited diagnostics.
- Data admission state: Hippocorpus — **ADMIT_UNLABELED**; Unexpected Events — **ADMIT_UNLABELED**. Their text may remain a future research resource, but neither supplies Product-18 human gold or an independent model-quality score.
- Promotion state: **INCONCLUSIVE / BLOCKED_FOR_CREDIBLE_PRODUCT_PROMOTION**. No independent rights-cleared Product-18 gold exists, so current evidence cannot justify model-quality or production promotion.
- ML work may restart only on at least one concrete external state change: (1) new `ADMIT_GOLD`; (2) resolved data rights for a relevant lineage or dataset; (3) a new independent rights-cleared short-Event evaluation; (4) new rights-cleared native supervision relevant to Product-18 or the PetalPal Event domain; or (5) real product evidence revealing a concrete classifier gap that defines a bounded, testable intervention.
- Until a restart condition occurs, the incumbent, inference policy, and metrics above remain frozen. No new framework, hash, or manifest is created by this freeze.

## Independent Model-Consensus Reference 300 v1

Date: 2026-09-17. Artifacts: `v4/model-consensus-reference-300-v1/`.

- User-authorized restart scope: source search and independent model-consensus reference construction only. No training, threshold/taxonomy change, promotion experiment, or incumbent modification was authorized or performed.
- The initial Hippocorpus/Unexpected Events draft was invalidated because both prepared validation pools had participated in historical model/candidate decisions. Draft row and label outputs were deleted; those sources remain valid `ADMIT_UNLABELED` resources but are ineligible for this independent reference.
- New source: Roadtrip Nation personal narratives from Saldias & Roy (2020), admitted as `ADMIT_UNLABELED_REFERENCE_ONLY`. The official repository releases the corpus under CC BY 4.0 and states that Roadtrip Nation collected and shared the underlying data. The release contains 10,296 clauses from 594 real-world English personal-narrative transcripts.
- Untouched audit: targeted working-tree and Git-history searches found no prior PetalPal occurrence of the source; exact normalized selected-row overlap against repository text values outside the new artifact was zero. No source group had entered a prior PetalPal ML decision path.
- Neutral deterministic freeze: 300 rows from 300 distinct `story_id` groups, one row per group, 60-300 characters, no truncation, no normalized exact duplicates. Median/P75/P90/max length is `182/243/284/300` characters. Selection used only source admission, structural Action/Orientation metadata, first-person/past-event surface rules, contact/safety filters, and a fixed SHA-256 rank; no emotion prediction, confidence, desired label balance, or agent output was used.
- Blind panel completed with `gpt-6-astra / medium`, `gpt-5.6-sol / medium`, and `gpt-5.6-luna / medium`. Each received only `rowId`, Event text, canonical Product-18 definitions, and the 0-2 rule.
- Deterministic exact-set consensus: 3/3=`106/300` (`35.33%`); 2/3=`138/300` (`46.00%`); unresolved=`56/300` (`18.67%`). Unresolved rows retain null consensus labels; no fourth model or human adjudicator was used.
- Bias diagnostics: Agent A was substantially more conservative (empty rate `69.33%` versus `33.67%` and `35.67%`); Agent C marked `96.67%` LOW uncertainty; all agents gave zero disgust support. The source is career-path-heavy and is not population- or Product-18-label-balanced.
- Result: **PASS — SAFE FOR FUTURE RESEARCH DIAGNOSTICS**, with frozen hashes, attribution/change notices, sourceGroup reservation, unresolved-null handling, and documented bias limitations preserved. This is `MODEL_GENERATED / WEAK_PSEUDO` reference data, **not human gold**, and it does not change the existing product-promotion blocker or frozen incumbent.

## Frozen Incumbent Baseline on RTN-300

Date: 2026-09-17. Artifacts: `v4/model-consensus-reference-300-v1/incumbent-baseline-diagnostic-v1/`.

- Status: **PASS — INFORMATIVE DIAGNOSTIC ONLY**. The frozen `goemotions-targeted-v1/experiment/epoch-1-checkpoint` was evaluated once with the unchanged canonical Product-18 threshold `0.35` / max-two selector. No training, tuning, checkpoint selection, promotion, or incumbent/reference modification occurred.
- HIGH_CONSENSUS (106 rows): exact-set agreement `55.66%`; micro precision/recall/F1 `0.3404/0.4000/0.3678`; all-18 Macro-F1 `0.3360`; FP/FN `31/24`; incumbent/consensus 0/1/2 distributions `63/39/4` vs `66/40/0`.
- RESOLVED (244 rows): exact-set agreement `50.41%`; micro precision/recall/F1 `0.3542/0.2857/0.3163`; all-18 Macro-F1 `0.3184`; FP/FN `62/85`; incumbent/consensus 0/1/2 distributions `153/86/5` vs `128/113/3`.
- Abstention mismatch on RESOLVED: consensus empty/incumbent non-empty `34`; consensus non-empty/incumbent empty `59`. Overall the incumbent is more conservative than resolved consensus, but this hides label-specific imbalance.
- Strongest over-production is joy (`29` predicted vs `5` consensus); strongest under-production is curiosity (`1` vs `15`), followed by annoyance/caring/disappointment (`-6` each). These are model-consensus mismatches, not human-gold correctness findings.
- Agent agreement: Astra `59.00%`, Sol `33.33%`, Luna `36.33%`. The incumbent is slightly more aggressive than conservative Astra but markedly more conservative than Sol and Luna.
- UNRESOLVED (56 rows) was behavior-only: incumbent 0/1/2 distribution `33/23/0`; no precision, recall, or F1 was computed against null consensus.
- Strongest bottleneck: **label-specific short-Event calibration skew**—broad under-production/extra abstention coexists with strong joy over-production. RTN-300 remains model-generated weak/pseudo reference, permanently reference-only, and non-equivalent to COSO-149 human-labeled development diagnostics.

## Independent Consensus Weak Supervision v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/independent-consensus-weak-supervision-v1/`.

- Highest-value hypothesis: independent Product-18 semantic labels from distinct language models on rights-admitted short Event text could add missing taxonomy supervision without inheriting incumbent priors. The frozen pool used 450 Hippocorpus and 450 Unexpected Events training rows from 900 distinct source groups; both sources are `ADMIT_UNLABELED`. Prepared-validation group overlap and normalized RTN-300 overlap were zero. RTN, COSO, incumbent outputs, desired label counts, and native labels were excluded from selection and labeling.
- Blind agents were `gpt-6-astra / medium`, `gpt-5.6-sol / medium`, and `gpt-5.6-luna / medium`. Each saw only `rowId`, text, taxonomy definitions, and the 0-2 rule. All outputs were frozen before deterministic exact-set consensus. Status is `MODEL_GENERATED_WEAK_PSEUDO_NOT_HUMAN_GOLD`; no human/fourth-model adjudication occurred.
- Consensus feasibility passed: high/medium/unresolved=`60/577/263`; 637 resolved rows, 240 non-empty, 17 labels represented, and 10 labels with at least 10 positives. However natural label coverage remained strongly skewed: joy=105, disappointment=41, sadness=27, but curiosity=1, annoyance=2, remorse=2, anger=3, disgust=0. The frozen balanced-output training rule yielded 372 rows (240 non-empty, 132 empty).
- Fixed training: incumbent initialization, classifier plus top two encoder layers only, one epoch, LR `1e-6`, batch 16, seed 46, standard unweighted Product-18 BCE. No sweep, interim diagnostic selection, or rescue variant occurred.
- COSO-149: micro-F1 `0.5281 -> 0.5183`; macro-F1 `0.3452 -> 0.3381`; exact-set `34.90% -> 33.56%`; FP/FN `58/85 -> 58/87`; 0/1/2 outputs `35/90/24 -> 35/92/22`. All frozen COSO tolerance gates passed, narrowly.
- RTN-300 RESOLVED: micro-F1 `0.3163 -> 0.3208`; macro-F1 `0.3184 -> 0.3223`; exact-set `50.41% -> 50.82%`; FP/FN `62/85 -> 59/85`; 0/1/2 outputs `153/86/5 -> 156/83/5`. HIGH_CONSENSUS micro-F1 improved `0.3678 -> 0.3765`, exact-set `55.66% -> 56.60%`, and FP/FN `31/24 -> 29/24`.
- Decision: **REJECT**. The locked RESOLVED micro-F1 gain gate required `>=+0.015` but observed only `+0.0045`; summed 0/1/2 distribution error worsened `54 -> 60`. Research evidence improved under the complete gate: **NO**. Credible promotion: **NO**. Incumbent unchanged.
- Next selected task: one materially different taxonomy-balanced synthetic-semantic supervision experiment with blind model validation. The motivation is the weak training pool's independent coverage failure, not RTN row/threshold fitting.

## Taxonomy-Balanced Synthetic Supervision v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/taxonomy-balanced-synthetic-v1/`.

- Distinct hypothesis: natural three-model consensus remained label-skewed, so equal-budget original synthetic Events across all 18 labels might supply missing taxonomy semantics. `gpt-6-astra / medium` generated 24 single-label Events per label plus 100 empty-target Events. `gpt-5.6-sol / medium` and `gpt-5.6-luna / medium` independently blind-labeled text without targets, generator identity, desired counts, incumbent, COSO, or RTN. Both validators had to reproduce the exact target; no human/fourth-model adjudication occurred.
- Feasibility passed: 532 mechanically valid unique Events, 406 validator-exact-agreement/accepted rows, accepted per-label support 12-22, accepted empty=96. The frozen training set used exactly 12 rows per label plus 72 empty rows, 288 total. Status is `MODEL_GENERATED_SYNTHETIC_WEAK_PSEUDO_NOT_HUMAN_GOLD`.
- Fixed training: incumbent initialization; classifier plus top two encoder layers; one epoch; LR `1e-6`; batch 16; seed 47; standard Product-18 BCE. No regeneration, checkpoint/loss/threshold/selector sweep, or rescue variant.
- COSO-149: micro-F1 `0.5281 -> 0.5263`; macro-F1 `0.3452 -> 0.3479`; exact-set `34.90% -> 34.23%`; FP/FN `58/85 -> 59/85`; outputs `35/90/24 -> 35/89/25`. All locked tolerance gates passed.
- RTN-300 RESOLVED: micro-F1 `0.3163 -> 0.3256`; macro-F1 `0.3184 -> 0.3252`; exact-set `50.41% -> 50.82%`; FP/FN `62/85 -> 61/84`; outputs `153/86/5 -> 154/84/6`. HIGH_CONSENSUS micro-F1 `0.3678 -> 0.3765`, exact-set `55.66% -> 56.60%`, FP/FN `31/24 -> 29/24`.
- Decision: **REJECT**. Mandatory RESOLVED micro-F1 required `>=0.3313` but reached `0.3256`; 0/1/2 distribution error required `<=54` but was `58`. The generator/validators share model families with the RTN panel, so RTN is also correlated research evidence, never independent promotion evidence. Incumbent unchanged; no rescue variant.

## Post-RTN Autonomous Restart Search and Boundary

Date: 2026-09-17.

- After both new weak-supervision families failed the complete frozen gate, another loss, threshold, selector, seed, intensity, or weak-label quota variant would be a prohibited rescue/sweep. The two new results instead narrow the path: broader model-generated semantics can move RTN metrics slightly, but did not produce a gate-clearing Product-18 candidate or independent truth evidence.
- A fresh authoritative-source search found no new `ADMIT_GOLD` English short-Event source. `MEMO4000` is CC BY 4.0 at Mendeley but its paper states the text was collected from social-network statuses, so underlying platform/user rights and the forbidden social-source gate fail. The St Andrews autobiographical-memory release is institutionally hosted under CC BY and contains participant memories with cue/valence-related measures, but it does not supply Product-18 labels; its relevant native signal is valence, a materially similar route already tested and rejected. Newly found autobiographical corpora were Italian-only, metadata/summary-only, non-commercial, clinical/controlled-memory tables rather than Product-18 text, or lacked exact taxonomy labels.
- Exact blocker: no independent rights-cleared human Product-18-compatible short-Event gold/native source exists, new human review is absolutely prohibited, and the materially distinct available model-only routes now tested (natural independent consensus and taxonomy-balanced validated synthesis) both failed locked classifier gates. The historical incumbent remains rights-unresolved and research-only.
- Minimum external state change required to restart defensibly: a new rights-cleared English short-Event dataset with existing human Product-18-compatible labels and source grouping; written rights clearance for a relevant existing source; or a genuinely new rights-cleared native signal materially different from valence. No paid service, permission request, or human labeling is initiated.
- Overall autonomous loop: **STOP — EXTERNAL EVIDENCE BLOCKER**. Research candidate decisions remain `REJECT`; production promotion remains **NO**; incumbent unchanged.

## NLI Label Entailment v1 — Autonomous Research Restart

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/nli-label-entailment-v1/`.

- The latest instruction restarted bounded classifier-quality research despite the unchanged product-promotion evidence blocker. The tested mechanism preserved the pretrained `cross-encoder/nli-deberta-v3-small` three-class NLI head, unlike the historical NLI experiment that replaced it with a new multilabel head.
- Fixed training used 1,045 historical research rows and 4,213 Event/definition pairs: 1,078 selected-label entailments and 3,135 deterministic sampled-absence neutral pairs, with no constructed contradictions. One epoch updated all parameters at LR `2e-6`, batch 16, seed 48. RTN was excluded from construction and training.
- COSO-149 micro/macro-F1 changed `0.5281/0.3452 -> 0.3667/0.2428`; FP/FN changed `58/85 -> 129/99`; outputs `35/90/24 -> 35/33/81`.
- RTN-300 RESOLVED micro/macro-F1 changed `0.3163/0.3184 -> 0.1803/0.1960`; exact-set `50.41% -> 26.23%`; FP/FN `62/85 -> 214/86`; outputs `153/86/5 -> 85/71/88`; distribution error was 170. HIGH micro-F1 changed `0.3678 -> 0.1926`.
- Decision: **REJECT**. Only output integrity passed; 13/14 gates failed. The failure is systematic overproduction, not all-negative collapse. No post-hoc threshold, forced-cardinality, template, blend, or seed rescue is authorized. Incumbent unchanged; rights and promotion status unchanged.

## Repaired Selective-Ranking Canonical/RTN Evaluation v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/ranking-repair-rtn-evaluation-v1/`.

- A pre-existing correctly mapped repaired ranking checkpoint was evaluated once with the current canonical COSO/RTN framework. No training or parameter change occurred. Its original training used the 841 aligned historical research rows, incumbent initialization, and source-weighted BCE plus 0.25 pairwise ranking; RTN had never been opened for it.
- COSO-149 micro/macro-F1 changed `0.5281/0.3452 -> 0.5364/0.3307`; exact-set `34.90% -> 36.24%`; FP/FN `58/85 -> 56/84`; outputs `35/90/24 -> 38/85/26`.
- RTN RESOLVED micro/macro-F1 changed `0.3163/0.3184 -> 0.3208/0.3204`; exact-set `50.41% -> 51.23%`; FP/FN `62/85 -> 59/85`; outputs `153/86/5 -> 156/83/5`; distribution error was 60. HIGH micro-F1 improved `0.3678 -> 0.3855` and exact-set `55.66% -> 58.49%`.
- Decision: **REJECT**. The candidate showed consistent FP/exact-set gains but missed the RTN-resolved gain/distribution gates and regressed COSO macro-F1. Supported COSO regressions were concentrated in excitement, surprise, and gratitude. Incumbent unchanged.
- Next task: one correctly mapped selective-ranking run with the existing 204 targeted GoEmotions rows replayed alongside the 841 aligned rows, chosen to test general rare-label retention rather than any RTN-specific fix.

## Selective Ranking with Targeted Replay v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/ranking-targeted-replay-v1/`.

- Fixed training replayed the existing 204 targeted GoEmotions rows with the 841 aligned rows, initialized from the incumbent, and applied correctly mapped Product-18 BCE plus 0.25 pairwise ranking for one epoch at LR `2e-6`, batch 16, seed 44. RTN was excluded from training and parameter/data selection.
- COSO-149 micro/macro-F1 changed `0.5281/0.3452 -> 0.5298/0.3296`; exact-set `34.90% -> 36.24%`; FP/FN `58/85 -> 57/85`; outputs `35/90/24 -> 38/85/26`.
- RTN RESOLVED micro/macro-F1 changed `0.3163/0.3184 -> 0.3333/0.3285`; exact-set `50.41% -> 52.05%`; FP/FN `62/85 -> 56/84`; outputs `153/86/5 -> 159/79/6`; distribution error rose to 68. HIGH micro-F1 improved `0.3678 -> 0.3810` and exact-set `55.66% -> 57.55%`.
- Decision: **REJECT**. This is the highest RTN RESOLVED micro-F1 candidate in the current loop and clears the aggregate RTN gain gate, but fails RTN distribution, COSO macro, and supported-label guards. The frozen incumbent remains current best overall; no rescue variant is authorized.
- Next task: one decoupled classifier retraining (cRT) experiment that freezes incumbent representations and updates only Product-18 output rows under a fixed label-balanced sampler. This is distinct from the rejected full-model positive-weight experiment.

## Decoupled Balanced Product-18 Head v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/decoupled-balanced-head-v1/`.

- A cRT stage froze the incumbent encoder and classifier dense transform, copied the Product-18 output rows, and trained only those 18 rows/biases for one epoch on frozen features. A deterministic inverse-frequency label-balanced sampler drew 1,045 replacement rows from the combined 841 aligned + 204 targeted training set. Ordinary BCE, AdamW LR `1e-3`, batch 32, seed 44; no RTN use.
- An initial artifact-assembly run was invalid because advanced-index `.copy_()` changed a temporary tensor. It is preserved as `invalid-assembly-run/` and excluded from evidence. The corrected exact-protocol rerun used `index_copy_`; only Product-18 output rows changed, while every other tensor remained identical.
- COSO-149 micro/macro-F1 changed `0.5281/0.3452 -> 0.5521/0.3505`; exact-set `34.90% -> 36.24%`; FP/FN `58/85 -> 71/75`; outputs `35/90/24 -> 27/83/39`.
- RTN RESOLVED micro/macro-F1 changed `0.3163/0.3184 -> 0.3644/0.3660`; exact-set stayed `50.41%`; FP/FN `62/85 -> 83/74`; outputs `153/86/5 -> 127/106/11`; distribution error improved `54 -> 16`. HIGH micro-F1 improved `0.3678 -> 0.4468` and exact-set `55.66% -> 59.43%`.
- Decision: **REJECT**. This is the strongest RTN F1/macro candidate, but FP guards failed on COSO and RTN and gratitude F1 regressed beyond the supported-label tolerance. Incumbent unchanged.
- Next task: one training-prior-only analytical log-odds correction of the cRT biases, using original versus deterministic sampled label priors with unit strength and no evaluation-derived calibration or sweep.

## Training-Prior-Corrected Decoupled Head v1 and Current Boundary

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/prior-corrected-decoupled-head-v1/`.

- The cRT head received one unit-strength analytical bias correction: `logit(original combined-train prior) - logit(realized balanced-sampler prior)`. Priors came only from the fixed 1,045 training rows and deterministic seed-44 sample. No evaluation-derived fitting or sweep occurred.
- COSO-149 micro/macro-F1 changed `0.5281/0.3452 -> 0.5287/0.3274`; exact-set stayed `34.90%`; FP/FN `58/85 -> 66/82`; outputs `35/90/24 -> 32/85/32`.
- RTN RESOLVED micro/macro-F1 changed `0.3163/0.3184 -> 0.3144/0.3293`; exact-set `50.41% -> 50.00%`; FP/FN `62/85 -> 74/83`; outputs `153/86/5 -> 142/94/8`; distribution error was 38. HIGH micro-F1 remained improved at `0.4176` with exact-set `59.43%`.
- Decision: **REJECT**. The fixed correction failed RTN micro/exact/FP and COSO macro/FP/supported-label gates. No strength/threshold/blend rescue is authorized.
- Current best retained model remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`: COSO micro `0.5281`; RTN RESOLVED micro/macro `0.3163/0.3184`.
- Best rejected score candidate is the uncorrected `decoupled-balanced-head-v1/candidate/checkpoint`: COSO micro/macro `0.5521/0.3505`; RTN RESOLVED micro/macro `0.3644/0.3660`; it was rejected because FP rose to 71/83 and supported-label stability failed.
- Current boundary: materially different locally actionable routes have been reasonably exhausted. Further changes would be evaluation-selected calibration/replay/threshold rescue sweeps. The strongest unlock is a rights-cleared, source-grouped, independently human-labeled short-Event Product-18-compatible dataset, or a genuinely new rights-clear short-text emotion backbone for a fresh architecture test.

## Balanced-Head Error Analysis and Next Data Acquisition v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/balanced-head-error-analysis-v1/` and `v4/aligned-supervision-v1/next-data-acquisition-v1/`.

- A deterministic COSO-development comparison was run from the existing incumbent and balanced-head prediction artifacts. RTN was not inspected at row level and was not used for diagnosis, ranking, parameter selection, or route selection.
- The balanced head changed COSO TP/FP/FN from `80/58/85` to `90/71/75`. It recovered 13 incumbent false negatives, lost 3 incumbent true positives, added 20 new false positives, and removed 7 old false positives.
- Newly added false positives were distributed rather than dominated by one label: caring 4, gratitude 4, annoyance 3, disappointment 3, sadness 2, excitement 2, fear 1, surprise 1. Fifteen of 20 had scores in `[0.35, 0.50)`, four in `[0.50, 0.70)`, and one at least 0.70.
- Only 13/71 balanced-head false positives were on gold-empty rows. The other 58 were split evenly between an extra label beside a true positive and a substitution-style error on a nonempty row. Gold-empty rows forced nonempty declined `12 -> 11`; therefore a presence/abstention gate does not address the dominant failure.
- The largest substitution-style patterns were sadness->caring (3), caring->love (2), joy->optimism (2), excitement->joy (2), caring->gratitude (2), joy->love (2), and fear->annoyance (2). One-label gold rows predicted with two labels increased `10 -> 18`. The dominant failure is distributed, near-boundary related-emotion confusion caused by broadening recall without explicit negative evidence.
- COSO contains only 19/149 Events at most 300 characters. Balanced-head gains came entirely from the 130 longer rows: short-slice F1 changed `0.6154 -> 0.5926`, while long-slice F1 changed `0.5199 -> 0.5485`. The current development evidence therefore cannot establish short-Event generalization.
- Decision: choose exactly one next route, `confusion-aware-hard-negative-v1`. This is a supervision/representation-boundary intervention, not a threshold, calibration, sampler, replay, or class-weight rescue.
- No model was trained. The canonical train rows use selective model-generated agreement labels (`humanGold=false`), so omitted labels cannot be treated as explicit hard negatives; feeding COSO errors back into training would contaminate development evidence. Training is blocked until the documented acquisition gate is met.
- The acquisition package freezes a target of 400 rights-cleared, source-grouped, pre-existing independently human-labeled English first-person Events of 30-300 characters: 280 direction-balanced hard negatives across seven confusion families, 60 no-clear-emotion lexical controls, and 60 true two-label co-occurrence controls. Synthetic/model/weak labels and mere label omission are ineligible as gold.
- Incumbent remains frozen at `goemotions-targeted-v1/experiment/epoch-1-checkpoint`. Next action: collect and validate the frozen acquisition manifest; only after acceptance, run one predetermined hard-negative configuration without RTN tuning.

## Confusion-Aware Hard-Negative Existing-Data Audit and Blind Panel v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/confusion-aware-hard-negative-v1/`.

- The frozen pair priorities follow legal COSO development evidence only: sadness/caring, caring/love, joy/optimism, joy/excitement, caring/gratitude, joy/love, and fear/annoyance. No RTN row-level evidence was inspected or used.
- Existing-data audit produced 1,152 directional candidates. Canonical weak supervision contributed 1,097 unresolved negatives because `humanGold=false` label omission is not an explicit negative. GoEmotions supplied 55 human-positive/per-rater-explicit-zero records across 10/14 directions, but its underlying Reddit rights remain `REVIEW_REQUIRED`; directly eligible existing hard negatives were therefore 0.
- Because existing supervision failed the mechanical sufficiency gate, three fresh-context judges (`gpt-6-astra`, `gpt-5.6-luna`, `gpt-5.6-sol`) independently labeled the same sealed 1,005-cell blind input. Each saw only ID, text, target label, definition, and allowed values. All three 1,005-row outputs and per-row input hashes validated before comparison; no human review or manual adjudication occurred.
- Three-way exact agreement was `463/1005 = 46.07%`; Astra/Luna, Astra/Sol, and Luna/Sol pairwise agreement was `54.43%/53.33%/79.30%`. Status counts: unanimous NO 392, unanimous CLEAR 58, strong NO 223, strong CLEAR 52, direct CLEAR/NO conflict 181, ambiguous 99. Astra was materially more permissive; votes were not recalibrated or overridden.
- The strict `3/3 CLEAR` positive plus `3/3 NO` paired-negative rule admitted only 9 hard negatives across 5/14 directions. Forty 2/3-style rows remain secondary and were not mixed into the main pool. Strict controls admitted 5 no-clear rows and 0 genuine two-label rows. All panel labels remain `MODEL_PANEL_WEAK_PSEUDO_NOT_HUMAN_GOLD`.
- Leakage audit passed on the 314 unique train-only selected samples: exact normalized overlap 0, lexical near-duplicate overlap at 0.80 Jaccard 0, and source-group overlap 0 against legal Dev, Gemini opened evaluation, and RTN. Protected labels/errors were not read and RTN did not influence selection.
- Decision: **DATA NOT READY — NO TRAINING**. Hard-negative quantity, direction coverage, and both control gates fail despite rights/provenance and leakage passing for the panel input. No threshold, sampler, replay, class-weight, calibration, or classifier run occurred. Incumbent remains frozen.
- Next exact action: require an external evidence change—an existing rights-cleared exhaustively human-labeled corpus, or authoritative underlying-content/commercial-training clearance for an already exhaustively annotated source—then rerun the deterministic source/quota audit without new human review. Do not scale the same model-only panel based on its low unanimous yield and judge-distribution mismatch.

## External Dataset Search and Due Diligence v1

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/external-dataset-search-v1/`.

- Trigger: `confusion-aware-hard-negative-v1` had zero rights-eligible existing hard negatives and the blind model panel yielded only 9 strict hard negatives, 5 no-clear controls, and 0 true two-label controls. The panel was not expanded. This task searched for pre-existing human-written, exhaustively annotated, rights-clear external supervision; no new human review, manual adjudication, crowdsourcing, paid annotation, synthetic rows, or model labels were used.
- Method: official paper/repository/card/institution/license evidence was checked before data access. Dataset/annotation licensing was separated from underlying text, redistribution, commercial use, and model-training rights. Omission was treated as negative only for `EXHAUSTIVE_MULTILABEL`. No forced taxonomy mapping was accepted.
- Coverage: 30 named datasets were investigated. Admission statuses were: eligible 0; permission-required 3; rights-unresolved 12; annotation-not-exhaustive 3; taxonomy-mismatch 5; domain-mismatch 1; reject 6. Across controlling and secondary failures, 25/30 lacked adequate whole-source exhaustive Product-18 negative semantics.
- Top technical candidate: GoEmotions has an annotator-level binary matrix and all 18 exact Product-18 names. The pre-existing bounded artifact contains 55 explicit-negative candidates, 46 within the seven pair families requested here. However, its CC BY dataset/annotation release does not establish commercial ML rights to Reddit user content; Reddit's current Developer Terms state that User Content remains user-owned and that ML/AI training requires express permission from applicable rightsholders. Admission remains permission-blocked and admissible yield is 0.
- SemEval-2018 Affect in Tweets E-c is exhaustively multi-label, but underlying tweet commercial/model-training rights are not affirmatively granted. It cleanly covers only `joy ↔ optimism`; its own definition folds annoyance into anger and therefore cannot supervise `anger ↔ annoyance`.
- BRIGHTER English has strong exhaustive binary labels and released disaggregated judgments, but the official paper prohibits commercial use without creator approval and the English taxonomy has no complete current confusion pair. Current-pair yield is structurally 0 even if permission is obtained.
- First-person/event-like alternatives failed independent gates: crowd-enVENT/enISEAR/ISEAR are prompted or single-dominant; EmpatheticDialogues and several dialogue resources are noncommercial; rights-clear Unexpected Events and SemEval-2026 ecological essays have no discrete Product-18 labels; HISEMOTIONS is historical Spanish and uses model-assisted train labels.
- Decision: **NO ELIGIBLE SOURCE FOUND — NO DOWNLOAD / NO TRAINING**. No artifact was downloaded, no row entered Train, no protected evaluation row content was accessed, and no `admission-plan.md` was created. The incumbent remains frozen.
- Permission requests worth pursuing: (1) GoEmotions stewards plus Reddit licensing/rightsholder clarification, highest value; (2) SemEval-2018 organizers plus X/Twitter rights clarification, narrower value for `joy ↔ optimism`; (3) BRIGHTER creator approval only as a secondary basic-emotion/abstention resource, not for current pair hard negatives. No request was sent.
- Exact next action: seek written GoEmotions/Reddit authorization that explicitly covers commercial model training on the underlying comments. Only after such clearance, perform a checksum/schema/source-group and aggregate protected-overlap local admission audit. If clearance is not obtained, keep the route data-blocked and do not replace missing human evidence with more model votes or synthetic rows.

## External Dataset Search and Due Diligence v2

Date: 2026-09-17. Artifacts: `v4/aligned-supervision-v1/external-dataset-search-v2/`.

- Search v2 was opened because v1 found no source jointly satisfying rights, exhaustive negative semantics, and the current adjacent-emotion pair needs. Reddit has already been contacted and was not re-contacted or re-researched without new official evidence. GoEmotions is now `PENDING_EXTERNAL_PERMISSION_RESPONSE`; it is one pending option, not the whole ML blocker.
- Eighteen previously unaudited datasets were checked from official repositories, institutional pages, papers, and license records; all 30 v1 datasets were skipped by name. The new admission statuses are: rights unresolved 7, permission required 3, annotation not exhaustive 3, rights clear but taxonomy mismatch 2, model-generated reject 1, and non-commercial reject 2.
- Clearly rights-clear releases: Empathic Reactions v1 (CC BY 4.0) and SENSE-7 (CDLA-P 2.0). Neither supplies Product-18 categorical labels or a current hard-negative pair, so both have zero admissible main-pool yield.
- Five sources have whole-taxonomy or conditionally exhaustive native judgments: SemEval-2007 Affective Text, Story Commonsense fine-grained dev/test, Stack Overflow Emotion Gold Standard (SO-E), childTale-A, and CMU-MOSEI. None also clears the required underlying-content/annotation rights and current Product-18 pair gate.
- SO-E is the highest-value new permission lead: three annotators recorded YES/NO for all six labels and exact `joy` plus `love` can support that bidirectional pair. Stack Overflow posts have dated CC BY-SA coverage, but the released annotation workbook has no explicit license. Published marginals only bound potential directions at `0..491` and `0..1220`; strict admissible yield remains 0 until written annotation-layer commercial/product-ML permission and a local schema audit.
- GoodNewsEveryone directly names three current pairs, but writer emotion is dominant-only; its exhaustive reader checklist is the wrong perspective, and the copyrighted headline/corpus rights are not explicit. Permission alone would not repair the supervision semantics. Empathic Reactions is retained only as rights-clear auxiliary human-reaction text; empathy/distress must not be mapped to Product emotions. REMAN is only an auxiliary permission candidate because positive spans are not exhaustive negatives and its annotation-layer license is unclear.
- Result: **NO ELIGIBLE SOURCE FOUND — NO DOWNLOAD / NO TRAINING**. Rights-clear plus Product-18 explicit-negative candidates: 0. Sources admitted for local audit: 0. Admissible hard-negative yield: 0. No human/model labels were added, no protected evaluation content was accessed, and the frozen incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`.
- Exact next action: ask the SO-E authors/University of Bari for a written license covering the annotation workbook for commercial/product ML training, modification, retention, and derived models. If granted, perform one checksum/schema/source-group and aggregate-overlap local admission audit and compute exact `joy positive / love NO` and `love positive / joy NO` yields; do not train at that stage. Separately wait for the already-sent Reddit response.

## Targeted Short-Event Synthetic Weak Supervision v1

Date: 2026-09-18. Artifacts: `v4/aligned-supervision-v1/synthetic-targeted-short-event-v1/`.

- A fully automatic product-fit audit processed the 800-row targeted synthetic candidate pool. Final rows remained 800; 218 rows were minimally repaired, 0 replaced, and 0 removed. Generated transition tails were removed from 99 rows, excessive explanatory tails from 80, and 47 role-led third-person reports gained concrete personal relationship context. No emotion terms or intended labels were injected.
- After repair, character min/max/mean/median were `34/192/106.6825/107`. Exact, normalized, and TF-IDF near duplicates were all 0. Product-fit heuristic failures changed `43 -> 0`; transition-template occurrences `99 -> 0`; repeated clause types `2 -> 0`; repeated five-word suffix types `31 -> 0`.
- Blind independent agents were `gpt-6-astra / medium`, `gpt-5.6-sol / medium`, and `gpt-5.6-luna / medium`. Each saw only rowId, final Event text, Product-18 definitions, and the 0-2 policy. Outputs were frozen before exact-set consensus; no fourth adjudicator or human review occurred. Forty-eight Luna rows received mechanical canonical-order normalization without label-set changes.
- HIGH/MEDIUM/UNRESOLVED counts were `274/420/106`. Resolved 0/1/2 counts were `65/621/8`; 14 labels had nonzero support, but amusement/caring/confusion/surprise had zero and annoyance/disappointment/gratitude/joy were very sparse.
- The frozen HIGH-only gate failed because `274 < 300`. The HIGH+MEDIUM gate passed every row-count, non-empty, label-support, dominance, and empty-rate check but failed true two-label coverage because `8 < 15`.
- Decision: **INCONCLUSIVE — DO_NOT_TRAIN**. Training rows were 0; the predeclared one-epoch candidate was not run; RTN was not opened for this task; no rule was relaxed and no post-consensus coverage regeneration occurred. Classifier actually improved: **NO**. Incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`.
- No new SHA/hash/manifest infrastructure was added. Task-local generator SHA reporting was removed; historical frozen-protocol integrity artifacts remain untouched.
- Next highest-value task remains an external evidence change: rights-cleared, source-grouped, independently human-labeled short-Event Product-18-compatible data, or written clearance for a suitable exhaustive source. Do not rescue this result with a lower two-label gate or another model-only synthetic variant.

## Synthetic Generator Semantic Fidelity Audit and Targeted v2

Date: 2026-09-18. Artifacts: `v4/aligned-supervision-v1/synthetic-targeted-short-event-v1/generator-fidelity-audit.json` and `v4/aligned-supervision-v1/synthetic-semantic-v2/`.

- V1 intended targets were recovered exactly through deterministic replay of generator-side strata, selection, hard-negative construction, and seed-20260918 shuffle, without using validator output. The 800 rows comprised 720 single-label targets across only 10/18 Product-18 labels, 80 empty contrasts, and zero intended two-label rows.
- V1 target-included rates were admiration 88.9%, anger 93.1%, curiosity 73.6%, disgust 83.3%, excitement 84.7%, fear 94.4%, love 65.3%, optimism 87.5%, remorse 97.2%, and sadness 75.0%. Love had 24/72 unresolved rows; amusement, annoyance, caring, confusion, disappointment, gratitude, joy, and surprise had no generation channel. V1 generator fidelity was therefore **INADEQUATE** despite strong channels for several covered labels.
- A generator-only protocol was locked before v2. It produced the smallest meaningful targeted pool: 108 single-label rows (12 each for the eight omitted labels plus love), 30 coherent two-label rows across five pairs, and 18 empty boundary controls, for 156 total. All rows were 63–152 characters; exact/normalized/near duplicates, repeated clause/suffix types, transition occurrences, and product-fit failures were zero.
- Three fresh independent blind validators were `gpt-6-astra / medium`, `gpt-5.6-sol / medium`, and `gpt-5.6-luna / medium`. They saw only row ID, Event text, Product-18 definitions, and the 0–2 policy. Their complete outputs were frozen before consensus; no fourth model or human review was used.
- V2 HIGH/MEDIUM/UNRESOLVED was `123/32/1`; pairwise exact-set agreement was `89.74%/84.62%/82.69%`. Resolved 0/1/2 was `18/103/34`. Every target reached support >=8. The 30 intended pairs yielded 30 resolved, 28 exact-pair, and 28 resolved two-label outputs; all 18 empty controls resolved exactly empty.
- Decision at generator gate: **PASS — TRAIN**. All 155 resolved HIGH+MEDIUM rows were frozen as model-generated weak pseudo-labels; the unresolved row was excluded. The training protocol was frozen before opening COSO/RTN.
- Exactly one run initialized the incumbent and updated the classifier plus encoder layers 10–11 for one epoch with ordinary unweighted BCE, LR `1e-6`, batch 16, weight decay `0.01`, seed 49. No rescue run occurred.
- COSO-149 was exactly unchanged: micro/macro-F1 `0.5281/0.3452 -> 0.5281/0.3452`, exact-set `34.90% -> 34.90%`, FP/FN `58/85 -> 58/85`, outputs `35/90/24 -> 35/90/24`.
- RTN RESOLVED micro/macro-F1 changed `0.3163/0.3184 -> 0.3134/0.3160`; exact-set `50.41% -> 50.00%`; FP/FN `62/85 -> 64/85`; outputs `153/86/5 -> 151/88/5`; distribution error was 50. HIGH micro-F1 and exact-set were unchanged at `0.3678` and `55.66%`. No supported label gained the required 0.02 F1.
- Final decision: **REJECT**. The resolved micro, macro, exact-set, and broad per-label-improvement gates failed. Generator semantic fidelity improved, but classifier quality did not. Incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`; no production promotion or rights claim is made.
- Next highest-value task remains an external evidence change: rights-cleared, source-grouped, independently human-labeled short-Event Product-18-compatible data, or explicit clearance for a suitable exhaustive source. Do not rescue this run with seed/LR/threshold/gate changes or emergency synthetic additions.

## Existing NLI Hypothesis Reconciliation

Date: 2026-09-18. Artifact: `v4/aligned-supervision-v1/nli-label-entailment-v1/REPORT.md`.

- A new request proposed selected weak labels as NLI entailment, unselected labels as neutral, no automatic contradiction, and a preserved pretrained NLI head. Repository inspection found this exact core hypothesis already frozen and completed in `nli-label-entailment-v1`; it was not restarted or retrained on synthetic-semantic-v2 because matching experiments must not be duplicated and failed NLI runs must not receive threshold/template/neutral-ratio/LR/seed rescues.
- The model is `cross-encoder/nli-deberta-v3-small`; its official model card declares Apache-2.0 and the local config maps contradiction/entailment/neutral to `0/1/2`. The separate 1,045-row historical PetalPal training lineage remains rights-unresolved and research-only.
- The completed run used 1,078 entailment, 3,135 deterministic sampled-neutral, and 0 contradiction pairs. Of 1,045 Events, 196 empty Events supplied 588 neutral pairs. The original NLI head, all parameters, one epoch, LR `2e-6`, batch 16, and seed 48 were frozen before evaluation.
- COSO micro/macro-F1 was `0.5281/0.3452 -> 0.3667/0.2428`; exact-set `34.90% -> 16.78%`; FP/FN `58/85 -> 129/99`; outputs `35/90/24 -> 35/33/81`.
- RTN RESOLVED micro/macro-F1 was `0.3163/0.3184 -> 0.1803/0.1960`; exact-set `50.41% -> 26.23%`; FP/FN `62/85 -> 214/86`; outputs `153/86/5 -> 85/71/88`. HIGH micro/macro-F1 was `0.3678/0.3360 -> 0.1926/0.1680`; exact-set `55.66% -> 33.02%`; FP/FN `31/24 -> 82/27`.
- Decision remains **REJECT**. Neutral-only NLI avoided all-negative collapse but caused systematic false-positive and two-label overproduction while retaining label-specific skew. No post-hoc margin, threshold, template, forced-cardinality, or synthetic-v2 rerun was performed.
- Incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`. The next materially different NLI hypothesis requires genuine contradiction/explicit-negative supervision from a rights-cleared exhaustive source. Autonomous local loop: **NO — EXTERNAL EVIDENCE BLOCKER**.

## External Dataset Search and Rights Audit v3

Date: 2026-09-18. Artifact: `v4/aligned-supervision-v1/external-dataset-search-v3/REPORT.md`.

- Search v3 skipped the 48 sources already resolved in v1/v2 and audited nine newly serious candidates from primary papers, institutional repositories, official records, and author repositories. No RTN/COSO row was opened; no training, tuning, pseudo-labeling, synthetic generation, human review, or data admission occurred.
- The best new technical candidate is the Real World Worry Waves Dataset (RW3D): 1,152 participants each contributed short English-survey text in three waves, paired with independent 1–9 self-ratings for anger, disgust, fear, anxiety, sadness, happiness, relaxation, and desire. Exact rating 1 means `none at all`; only that value is a legitimate explicit negative. The unselected best emotion and ratings 2–8 are not negatives.
- RW3D contains 3,456 short texts with median/P75/P90 character lengths `109/171/253.5`; `3,455 (99.97%)` are at most 300 characters. A conservative included language flag marks 3,237 rows English, of which 3,236 are at most 300 characters. Participant IDs permit a mandatory 1,152-group disjoint split.
- Product mapping is partial but useful: anger, disgust, fear, and sadness are exact; happiness→joy is defensible. Explicit score-1 negative counts are 971/1,476/720/587/388 respectively. Anxiety, relaxation, and desire are not forced into Product-18.
- RW3D's OSF Data component is CC BY 4.0, which is copyright-commercial-compatible with attribution, license-link, change-notice, and retained-notice obligations. However, the paper says participants consented to data sharing **for research purposes**. That does not affirmatively clear commercial/product ML processing, retained derivatives, or deployed models. Strict decision: **BLOCKED**, not `ADMIT_PARTIAL_GOLD`.
- The other eight candidates failed independent gates: ETC is Japanese and CC BY-NC; Lost in Transmission is Dutch, word-tag rather than Event-negative, and unlicensed; MARHE is research-only scraped app-review text; EPS is eight unreleased/unlicensed long student stories; i2b2 Suicide Notes are DUA-restricted research data; SenWave is Twitter/X-derived; DAPPER is Chinese with product-use scope unclear; and the nursery-rhyme set is dominant-single-label literary text with unresolved upstream rights.
- Conditional next experiment after written RW3D clearance only: `rw3d-explicit-extremes-v1`, a five-label participant-disjoint partial-label run using exact score 1 as negative, a predeclared high-intensity band as positive, and masking intermediate/no-map ratings. This was specified but not run.
- Decision: **NO SOURCE ADMITTED — NO TRAINING — EXTERNAL EVIDENCE BLOCKER**. Incumbent and scores remain unchanged: `goemotions-targeted-v1/experiment/epoch-1-checkpoint`; COSO micro `0.5281`; RTN RESOLVED micro `0.3163`.

## Three-State Partial Supervision v1

Date: 2026-09-18. Artifact: `v4/aligned-supervision-v1/three-state-partial-supervision-v1/REPORT.md`.

- A fully original 126-Event pool was generated from hidden cell-level specifications: 90 single-positive, 18 two-positive, and 18 zero-positive rows. Every Product-18 label had exactly seven intended-positive and nine intended-negative trials; all other cells were intentionally unclear. Events were 97–208 characters with zero exact, normalized, or token-Jaccard near duplicates, no repeated opening-four-word template, and zero product-fit failures.
- Independent blind validators were `gpt-6-astra / medium`, `gpt-5.6-sol / medium`, and `gpt-5.6-luna / medium`. Each judged all 2,268 Event × label cells as POSITIVE, NEGATIVE, or UNCLEAR without seeing generator targets, evaluations, or another output. All files were frozen before aggregation; no fourth adjudicator or human review occurred.
- Cell consensus was HIGH_POSITIVE/MEDIUM_POSITIVE/HIGH_NEGATIVE/MEDIUM_NEGATIVE/UNCERTAIN = `102/29/65/93/1979`; one direct positive-vs-negative conflict was masked. The frozen agreement-only choice was HIGH+MEDIUM equal weight because HIGH-only did not cover pair or negative requirements.
- Chosen supervision was 131 positive, 158 negative, and 1,979 masked cells (`5.78% / 6.97% / 87.26%`). Per-label combined support was broad: positives were at least 7 and negatives at least 6 for every label. Consensus-positive Event cardinality 0/1/2/>2 was `18/85/23/0`; 17/18 intended two-positive rows retained both targets and 0/18 intended-zero rows gained a positive.
- Generator fidelity was 99.21% positive and 91.98% negative globally. Every per-label positive channel passed. Admiration negative fidelity was 6/9; the frozen serialized threshold `0.6666666667` is marginally above exact 2/3. Separately and decisively, only 65 negative cells reached 3/3 agreement versus the frozen minimum 72.
- Decision: **INCONCLUSIVE — DO_NOT_TRAIN**. No gate was lowered, no rows were added, validators were not rerun, and no fourth model was used. The masked-BCE candidate was not trained; RTN and COSO per-row evidence remained unopened. The primary classifier hypothesis is untested, not rejected.
- Incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint` with COSO micro/macro approximately `0.5281/0.3452` and RTN RESOLVED micro/macro `0.3163/0.3184`, exact-set `50.41%`, FP/FN `62/85`. Do not rescue this result with another synthetic quota, weaker consensus, or hyperparameter change.

## Three-State Partial Supervision v2

Date: 2026-09-18. Artifact: `v4/aligned-supervision-v1/three-state-partial-supervision-v2/REPORT.md`.

- V2 isolated explicit-negative strength in a new 90-Event pool: 54 single-positive, 18 two-positive, and 18 zero-positive Events. Each Product-18 label had five intended-positive and ten intended-negative trials; all 180 intended negatives used nearby cues plus context that actively argued against the target label. Events were 136–227 characters with zero exact, normalized, or token-Jaccard near duplicates, no repeated opening-four-word template, and zero product-fit failures.
- Validators were three distinct model validators under a strict blind independent protocol: `gpt-6-astra / medium`, `gpt-5.6-sol / medium`, and `gpt-5.6-luna / medium`. Each received an isolated payload and saw only frozen Event text, common definitions, decision rules, and schema. All outputs were frozen before aggregation; no intended targets, other outputs, incumbent predictions, RTN/COSO, cross-agent review, repeated-model votes, fourth adjudicator, or human review entered the process.
- Consensus HIGH_POSITIVE/MEDIUM_POSITIVE/HIGH_NEGATIVE/MEDIUM_NEGATIVE/UNCERTAIN was `90/1/98/80/1351`, with zero direct polarity conflicts. HIGH+MEDIUM equal weight yielded 91 positive, 178 negative, and 1,351 masked cells. Event cardinality 0/1/2/>2 was `18/53/19/0`.
- Positive combined fidelity was `90/90 = 100%`; negative combined fidelity was `169/180 = 93.89%`; intended-negative HIGH fidelity was `95/180 = 52.78%`. All thresholds were exact count comparisons. All 18 intended two-positive Events retained both targets, and all 18 intended zero-positive Events remained positive-free.
- Aggregate negative strength passed with margin: HIGH_NEGATIVE was `98 >= 72`, improving from V1's 65. The frozen per-label gates nevertheless failed: curiosity had only five combined negative cells and 5/10 intended-negative combined hits versus required seven; disappointment had 2/10 intended HIGH-negative hits versus required three.
- Decision: **INCONCLUSIVE — DO_NOT_TRAIN**. No rows were added, no gate changed, and no validator reran. No training protocol, candidate checkpoint, RTN evaluation, or COSO evaluation was created. The classifier hypothesis remains untested and the incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`.
- V2 shows that stronger contrastive wording fixes the aggregate negative-confidence bottleneck but not every label-specific boundary. Do not create a V2 rescue or another synthetic quota. The next materially different evidence change requires externally justified exhaustive explicit-negative judgments; no external search or permission request occurred here.

## Three-State Partial Supervision v3

Date: 2026-09-18. Artifact: `v4/aligned-supervision-v1/three-state-partial-supervision-v3/REPORT.md`.

- V3 created a new independent balanced cohort of 108 Events: 72 single-positive, 18 two-positive, and 18 zero-positive. Every Product-18 label had six intended-positive and eighteen semantically varied intended-negative opportunities; totals were 108 positive and 324 negative generation cells. Events were 160–238 characters with zero exact, normalized, or token-Jaccard near duplicates, maximum repeated opening-four-word count one, and zero product-fit failures.
- The frozen policy was HIGH+MEDIUM equal weight. Integer gates required at least 12 combined and five HIGH intended-negative hits per label, plus global HIGH_POSITIVE/HIGH_NEGATIVE minima of 90/130. Three distinct validators (`gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-luna`, medium) received isolated `fork_turns=none` payloads containing only frozen text, definitions, rules, and schema. All outputs froze before aggregation; no targets, other outputs, incumbent predictions, RTN/COSO, cross-review, repeated vote, fourth adjudicator, or human review entered validation.
- Consensus HIGH_POSITIVE/MEDIUM_POSITIVE/HIGH_NEGATIVE/MEDIUM_NEGATIVE/UNCERTAIN was `95/12/209/113/1515`. Final supervision was 107 positive, 322 negative, and 1,515 masked cells; direct polarity conflicts were 3/1,944 and all were masked. Positive Event cardinality 0/1/2/>2 was `18/73/17/0`.
- Positive combined fidelity was `107/108 = 99.07%`; combined negative fidelity was `303/324 = 93.52%`; intended HIGH-negative fidelity was `206/324 = 63.58%`. Two-positive retention was 17/18 and all 18 zero-positive rows remained positive-free. Every global, independence, product-fit, conflict, multi-label, zero-positive, and per-label positive gate passed.
- Per-label negative robustness still failed: curiosity had ten combined negative cells and 10/18 intended combined hits versus required twelve; fear had 0/18 intended HIGH-negative hits versus required five. Disappointment improved from V2's 2/10 to V3's 9/18 intended HIGH hits.
- Decision: **INCONCLUSIVE — DO_NOT_TRAIN**. No weak-training file, training protocol, checkpoint, RTN evaluation, or COSO evaluation was created. No row, gate, consensus rule, validator, or model vote was changed after aggregation. The masked three-state classifier hypothesis remains untested.
- Incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint` with carried-forward COSO micro/macro approximately `0.5281/0.3452` and RTN RESOLVED micro/macro `0.3163/0.3184`, exact-set `50.41%`, FP/FN `62/85`. Do not rescue V3 with more synthetic rows or sharper negation templates; the next task must change the evidence source or learning objective materially.

## Counterfactual Pairwise Ranking Supervision v1

Date: 2026-09-18. Artifact: `v4/aligned-supervision-v1/counterfactual-pairwise-ranking-v1/REPORT.md`.

- The Three-State line remained frozen. A materially different pairwise cohort contained 144 fully original counterfactual pairs, exactly eight per Product-18 label and 72/72 intended A/B direction globally, with four of each direction per label. The 288 Events were at most 112 characters; exact and near duplicates and mechanical product-fit failures were zero.
- Three isolated validators (`gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-luna`, medium) received only target definition, Events A/B, decision options, and schema. All 144 judgments per agent were frozen before consensus; no target direction, other output, RTN/COSO, fourth adjudicator, repeated vote, or human review entered validation.
- Consensus was HIGH_PAIR/MEDIUM_PAIR/CONFLICT/UNRESOLVED = `100/0/44/0`; usable HIGH+MEDIUM was 100. Usable direction was 48 A and 52 B. Every usable pair matched generator intent, but usable-and-correct yield over all intended pairs was only `100/144 = 69.44%`.
- Post-freeze only, Astra and Sol agreed on 144/144 and each matched all intended directions; Luna agreed with them on 100/144 and chose the opposite direction on 44. No validator used TIE_UNCLEAR. This is diagnostic evidence of validator dependence, not adjudication and not proof that one model was correct.
- Frozen gates failed: usable pairs `100 < 108`; direct conflicts `44 > 14`; seven labels had fewer than six usable/correct pairs; and excitement/optimism lacked two usable pairs in each direction. Global HIGH count, per-label HIGH minimum, uniqueness, product fit, and global direction balance passed.
- Decision: **INCONCLUSIVE — DO_NOT_TRAIN**. The ranking-only logistic objective and one-run protocol were frozen but not executed. No candidate or checkpoint was created, and RTN/COSO remained unopened for this experiment. Classifier actually improved: **NO**.
- Incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`. Do not rescue Pairwise V1 with rewritten pairs, more validators, weaker gates, or training only the 100-pair core. The next materially different task requires an evidence-source change: independently human-labeled, rights-cleared short-Event explicit-label evidence; the conditional RW3D explicit-extremes experiment remains blocked pending written product-use clearance.

## Positive-Unlabeled Learning v1

Date: 2026-09-18. Artifact: `v4/aligned-supervision-v1/positive-unlabeled-learning-v1/REPORT.md`.

- The PU pool reused only frozen, fully synthetic Three-State V1/V2/V3 training-side cohorts. HIGH+MEDIUM positive consensus produced 329 P cells across 324 Events; all remaining 5,503 Product-18 cells were U. Every label had 17–21 P cells. No U cell became target 0 or neutral gold, and no RTN/COSO/reference row entered training.
- The sole frozen objective was per-label nnPU logistic risk: `pi*mean_P(softplus(-z)) + max(0, mean_U(softplus(z)) - pi*mean_P(softplus(z)))`. Uniform `pi=1/18` came from the balanced training-side generator design of one intended positive assignment per Event on average; it was not estimated from evaluation data or swept.
- Exactly one run initialized the incumbent and updated classifier plus encoder layers 10–11 for one U-pass epoch, AdamW LR `1e-6`, weight decay `0.01`, at most 32 cells per label-stratified batch, seed 54, unchanged threshold 0.35 and max-2. It used 234 updates, all 5,503 U cells once, and 1,872 seeded P draws. The checkpoint froze before evaluation artifacts were opened.
- COSO Micro/Macro-F1 changed `0.5281/0.3452 -> 0.5125/0.3365`; exact-set `34.90% -> 31.54%`; FP/FN `58/85 -> 73/83`; outputs 0/1/2 `35/90/24 -> 29/85/35`.
- RTN RESOLVED Micro/Macro-F1 changed `0.3163/0.3184 -> 0.3305/0.3373`; exact-set `50.41% -> 47.95%`; precision/recall `0.3542/0.2857 -> 0.3333/0.3277`; FP/FN `62/85 -> 78/80`; outputs 0/1/2 `153/86/5 -> 135/101/8`.
- RTN label gains included gratitude `+0.1500`, love `+0.1212`, optimism `+0.0929`, and disappointment `+0.0455`; confusion fell `-0.0667` and surprise `-0.0635`. The candidate improved recall and Macro-F1 but became too aggressive, missed the frozen Micro-F1 minimum by about 0.0008, and failed exact-set, precision, and FP gates. COSO materially regressed.
- Decision: **REJECT**. Classifier actually improved: **NO**. No prior/LR/epoch/seed/threshold/inclusion/gate change or rescue run occurred. Incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`; do not run PU V2.
- Next materially different task requires an evidence-source change: independently human-labeled, rights-cleared short-Event explicit positive and negative judgments. Conditional `rw3d-explicit-extremes-v1` remains blocked pending written product-use clearance; no external search or permission request occurred here.

## Label-Wise Prototype Supervision v1

Date: 2026-09-18. Artifact: `v4/aligned-supervision-v1/label-prototype-supervision-v1/REPORT.md`.

- The frozen positive pool combined 270 positive-bearing Three-State V1/V2/V3 Events with 137 positive-bearing Synthetic Semantic V2 Events: 407 Events, 500 validated label memberships, 314 single-label and 93 two-label Events. Per-label support was 18–39. No new generation or validation was needed; all memberships reused previously frozen blind Astra/Sol/Luna consensus evidence.
- One fixed 768-dimensional centroid per Product label was built from L2-normalized incumbent final-layer CLS representations and frozen before training. Multi-label Events contributed to both prototypes. The objective was positive-only masked BCE plus weight-1.0 cosine attraction to each validated label centroid; all unconfirmed cells remained masked and no repulsion or negative pair was created.
- Exactly one candidate updated encoder layers 10–11 only with the classifier frozen, AdamW LR `1e-6`, weight decay `0.01`, two epochs, batch 16, seed 55, unchanged threshold 0.35 and max-2. It ran 52 updates over 1,000 positive-membership visits. The checkpoint froze before evaluation artifacts were opened.
- The auxiliary positive-geometry metric worsened: overall centroid cosine `0.73914 -> 0.73644` (`-0.00270`); single-label `-0.00246`; multi-label `-0.00310`; every per-label mean declined.
- COSO Micro/Macro-F1 changed `0.5281/0.3452 -> 0.5143/0.3302`; exact-set `34.90% -> 32.89%`; FP/FN `58/85 -> 69/84`; outputs 0/1/2 `35/90/24 -> 29/90/30`.
- RTN RESOLVED Micro/Macro-F1 changed `0.3163/0.3184 -> 0.3246/0.3302`; exact-set `50.41% -> 49.18%`; precision/recall `0.3542/0.2857 -> 0.3394/0.3109`; FP/FN `62/85 -> 72/82`; outputs 0/1/2 `153/86/5 -> 142/95/7`.
- RTN gains included gratitude `+0.1944`, love `+0.1212`, and disappointment `+0.0455`, while fear fell `-0.0364` and surprise `-0.0357`. The candidate recovered some positives but failed RTN Micro, exact-set, FP, and HIGH exact-set gates. COSO Micro, Macro, exact-set, FP, and supported-label guards also failed.
- Decision: **REJECT**. Classifier actually improved: **NO**. No loss-weight/prototype/LR/epoch/seed/threshold/pool change or rescue run occurred. Incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`; do not run Prototype V2.
- Positive-only representation shaping did not provide sufficient precision control. The next materially different task requires independently human-labeled, rights-cleared short-Event explicit positive and negative evidence; conditional `rw3d-explicit-extremes-v1` remains blocked pending written product-use clearance.

## Frozen Scale / Ranking Mechanism Diagnostic v1

Date: 2026-09-18. Artifact: `v4/aligned-supervision-v1/frozen-scale-ranking-mechanism-diagnostic-v1/REPORT.md`.

- This was a frozen-model diagnostic only. It analyzed incumbent, PU V1, Prototype V1, and balanced head; no training, fine-tuning, candidate creation, threshold/selector change, or incumbent change occurred. COSO is recorded as a historical model-labeled development diagnostic (111 Gemini two-pass agreements, 38 Gemini adjudications, zero human-gold rows), and RTN as a model-consensus short-Event research diagnostic.
- Per-label affine maps were fit from raw logits on deterministic source-balanced samples of 1,000 admitted Hippocorpus and 1,000 admitted Unexpected Events training rows, then frozen before any RTN/COSO access. Out-of-fit validation used all 139 Hippocorpus and 406 Unexpected Events validation rows with source-group bootstrap intervals.
- PU aggregate centered delta-R² was `-0.0440 / 0.3701` on Hippocorpus / Unexpected Events; Prototype was `0.0363 / 0.3811`; balanced head was `-0.0614 / -0.0035`. PU/Prototype output-change reproduction F1 was nevertheless `0.8182/0.9200` and `1.0000/0.9143`, showing that simple affine terms reproduce discrete threshold behavior much better than sample-level centered delta variation.
- COSO supported-label Macro-AP was incumbent/PU/Prototype/balanced `0.5938/0.5961/0.5961/0.6134`; paired delta intervals were `[-0.0115,+0.0152]`, `[-0.0065,+0.0159]`, and `[-0.0100,+0.0508]`. RTN RESOLVED Macro-AP was `0.3967/0.4013/0.4013/0.3997`; intervals were `[-0.0076,+0.0227]`, `[-0.0045,+0.0202]`, and `[-0.0214,+0.0251]`. These model-derived references do not establish ranking improvement or equivalence.
- Candidate-vs-incumbent changes were dominated by threshold crossings. PU/Prototype scale reset reduced output-membership disagreements from `23→1 / 14→1` on COSO and `21→4 / 13→3` on RTN, while removing most extra FP and their accompanying few extra TP. This is mechanism evidence, not deployable calibration. Balanced head reverted less completely.
- Current selector constraints make 19/149 COSO targets and 2/244 RTN RESOLVED targets unrepresentable because each contains two labels in the same emotion cluster. No reference row exceeded max-2 or used a target outside Product-18.
- Predeclared outcome: **INCONCLUSIVE**. The support gate failed the `>=0.80` centered delta-R² requirement and narrowly failed the RTN AP-upper-bound requirement; falsification also failed because PU/Prototype change-reproduction F1 remained high and no candidate showed a robust >=0.02 Macro-AP gain on both references. Strongest conclusion: PU/Prototype's visible recall/FP shift is largely offset-sensitive threshold permissiveness, but the checkpoints did not change only scale/offset.
- Previously rejected candidates remain rejected. **SHOULD SOL TRAIN NEXT: NO.** The conditional next single model experiment remains `rw3d-explicit-extremes-v1` only after written product/commercial-ML clearance and local admission audit; do not start it now.

## Frozen Balanced-Head Parameter Decomposition v1

Date: 2026-09-18. Artifact: `v4/aligned-supervision-v1/frozen-balanced-head-parameter-decomposition-v1/REPORT.md`.

- Frozen tensor inspection confirmed that valid Balanced Head differs from incumbent only in the Product-18 `classifier.out_proj` rows/biases. No training, fine-tuning, threshold/selector change, checkpoint save, candidate creation, or incumbent change occurred.
- A 768-dimensional feature mean was frozen using every admitted Hippocorpus train row (2,637) and Unexpected Events train row (7,716), with equal 50/50 source weighting and no emotion labels. For each label, `w_B=alpha*w_I+v`, `v⊥w_I`; direction-only used `v·(h-mu)`, while scale-only received the complete training-mean score shift. The four conditions reconstruct full Balanced exactly.
- Weight rotation was material for every label: 8.79°–16.55°. Mean logit shifts were heterogeneous, from curiosity `-0.8283` and joy `-0.5999` to surprise `+0.5690`, excitement `+0.5819`, and caring `+1.2165`.
- COSO Micro-F1 for incumbent/scale-only/direction-only/full was `0.5281/0.5311/0.5188/0.5521`; FP was `58/59/72/71`; supported-label Macro-AP was `0.5938/0.5938/0.6139/0.6134`. RTN RESOLVED Micro-F1 was `0.3163/0.3348/0.3401/0.3644`; FP was `62/70/86/83`; Macro-AP was `0.3967/0.3967/0.4000/0.3997`.
- Scale-only leaves AP exactly unchanged because it is per-label strictly monotonic. Direction rotation accounts for essentially all Macro-AP point change, but its paired AP intervals include zero on both references. Direction-only Micro-F1 falls on COSO and rises on RTN, with both intervals crossing zero.
- Direction-only decisively fails the desired FP behavior: relative to incumbent, FP increases were COSO `+14 [6,23]` and RTN `+24 [14,34]`, exceeding even full Balanced by one and three FP. Scale-only controls FP but retains only 10%/36% of full COSO/RTN TP gains. Full gains therefore require direction/mean-offset interaction, and label-specific mean shifts partially cancel rotation-driven FP.
- Head-direction outcome: **INCONCLUSIVE** under the frozen gate. The support gate fails because direction-only does not reduce FP and is not robust across references; the NOT_SUPPORTED gate also does not fire because scale-only does not reproduce most gains and direction contains real AP/TP point signal. The narrow practical question is negative: direction-only does not preserve Balanced gains while reducing extra FP.
- Historical Balanced Head remains **REJECT**. **SHOULD SOL TRAIN A NEW HEAD NEXT: NO.** No Balanced Head V2, threshold rescue, or head LR/epoch/seed follow-up should run.

## Balanced Head Mean Anchor v1

Date: 2026-09-18. Artifact: `v4/aligned-supervision-v1/balanced-head-mean-anchor-v1/REPORT.md`.

- Exactly one frozen run initialized from incumbent and trained only the 18 Product-18 `classifier.out_proj` rows/biases (`13,842` parameters). Encoder, dense transform, tokenizer, label mapping, and non-Product rows remained exactly frozen. The historical 841+204-row supervision pool, seed-44 weighted replacement sampler, 1,045 draws, ordinary BCE, one epoch, LR `1e-3`, batch 32, and 33 updates were reproduced without rescue.
- The one-sided training-side anchor used all 2,637 admitted Hippocorpus train rows and 7,716 admitted Unexpected Events train rows, separate FP64 means, equal 50/50 source weight, and lambda `0.125`. Validation partitions, anchor labels, and evaluation rows were not used before checkpoint freeze.
- Final-update BCE was `0.100186`; post-training raw/weighted anchor loss was `0.003313/0.000414`. Candidate positive source-mean drift RMS was `0.05756` versus historical Balanced `0.38285`, a ratio of `0.1503` and reduction of `84.97%`. **MEAN_CONTROL_MECHANISM_EFFECTIVE = YES.**
- Mean control did not control example-level output expansion. Across the anchor pool there were 1,001 raw threshold additions versus 265 removals and 789 canonical membership additions versus 342 removals. Candidate output counts shifted from `5372/4513/468` to `5180/4450/723` for 0/1/2 outputs despite mostly negative per-label mean drift.
- COSO incumbent/historical Balanced/mean-anchor Micro-F1 was `0.5281/0.5521/0.5375`; Macro-F1 `0.3452/0.3505/0.3406`; TP/FP/FN `80/58/85`, `90/71/75`, and `86/69/79`; exact `52/54/53` of 149. Mean anchor failed Micro, FP, and supported-label gates; gratitude remained `-0.1783` F1 versus incumbent.
- RTN RESOLVED Micro-F1 was `0.3163/0.3644/0.3306`; Macro-F1 `0.3184/0.3660/0.3358`; TP/FP/FN `34/62/85`, `45/83/74`, and `40/83/79`; exact `123/123/119` of 244. Mean anchor failed Micro, Macro, FP, exact, and supported-label gates; confusion declined `-0.1212` F1. The 56 UNRESOLVED rows were not negative gold.
- RTN HIGH auxiliary Micro/Macro-F1 was `0.3678/0.3360 -> 0.3958/0.3768`, but FP rose `31 -> 37` and exact fell `59 -> 58` of 106; historical Balanced remained stronger at `0.4468/0.4301`.
- Decision: **REJECT**. Classifier actually improved under the frozen gate: **NO**. Current incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`. The fixed anchor controls positive source means but does not solve rotation-driven/example-dependent FP, and loses Balanced TP without reducing RTN FP.
- **SHOULD TRAIN ANOTHER VARIANT: NO.** Do not run a lambda/LR/epoch/seed/anchor/sampling/threshold rescue or Balanced Head Mean Anchor V2.

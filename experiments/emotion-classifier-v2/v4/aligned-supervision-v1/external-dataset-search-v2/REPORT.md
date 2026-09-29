# External Dataset Search v2

Date: 2026-09-17  
Decision: **NO ELIGIBLE SOURCE FOUND — NO DOWNLOAD / NO TRAINING**

## Why v2 was opened

`confusion-aware-hard-negative-v1` is still `DATA NOT READY`. Search v1 found no source that jointly cleared rights, exhaustive negative semantics, and current adjacent-emotion coverage. Reddit has already been contacted, so v2 deliberately searched new non-Reddit/non-X alternatives rather than re-running the same policy analysis. GoEmotions remains `PENDING_EXTERNAL_PERMISSION_RESPONSE`; it is not treated as the whole ML blocker.

## Result

- **18 new datasets** were investigated; the prior 30 were skipped by name.
- Clearly rights-clear packages: **2** — Empathic Reactions v1 (CC BY 4.0) and SENSE-7 (CDLA-P 2.0).
- Strict/conditional all-label candidates: **5** — SemEval-2007 Task 14 Affective Text, Story Commonsense, Stack Overflow Emotion Gold Standard (SO-E), childTale-A, CMU-MOSEI.
- Candidates satisfying both clear rights and Product-18 explicit-negative requirements: **0**.
- Sources reaching `ELIGIBLE_FOR_LOCAL_ADMISSION_AUDIT`: **0**.
- Admissible hard-negative yield across all seven current pairs: **0**.

## Top new candidates

| Candidate | Rights/commercial ML | Annotation / raw negatives | Direct taxonomy and pair coverage | Yield / decision |
|---|---|---|---|---|
| SO-E | Stack Overflow text has CC BY-SA coverage by date, but the annotation workbook has no explicit license | Three raters judged presence/absence of all six labels; raw YES/NO available | exact joy + love; covers `joy↔love` | published marginals bound directions at 0..491 and 0..1,220 before co-occurrence removal; admissible **0**; ask authors for annotation license |
| GoodNewsEveryone | no corpus license and copyrighted news headlines | writer label is dominant-only; reader checklist is multi-label but the wrong emotion perspective; raw responses exist | joy/optimism, joy/love, fear/annoyance | strict **0**; permission alone would not fix annotation semantics |
| Empathic Reactions v1 | CC BY 4.0, commercial/model use allowed with attribution | exhaustive empathy/distress ratings, not categorical emotion | no Product-18 labels or current pairs | **0** hard negatives; retain only as auxiliary human-reaction text |
| Story Commonsense | no explicit data/source commercial license | eight Plutchik ratings only on fine-grained affect-selected dev/test units; training labels are open text | six basic Product labels; no current pair complete | structural **0**; no admission |
| CMU-MOSEI | dataset license and YouTube transcript rights unresolved | six emotions each scored 0-3 by three raters | happiness is not mapped to joy; no current pair complete | structural **0**; no admission |

## Why the near misses do not compose into a legal mixed-source pool

The rights-clear sources do not carry Product-18 categorical judgments. The sources with genuine all-label matrices do not cover a current pair, except SO-E, whose annotation-layer license is absent. GoodNewsEveryone has the attractive exact names but not an exhaustive writer-emotion matrix. Combining these sources would therefore combine different missing gates, not solve them.

## Long-text auxiliary retention

Empathic Reactions v1 is worth retaining as `AUXILIARY_ELIGIBLE_NON_PRODUCT_SIGNAL_ONLY`: it is human-written and CC BY 4.0, with article/respondent grouping to verify before any later protocol. It cannot supply Product-18 negatives, and empathy/distress must not be mapped to caring/sadness/fear. REMAN is only an auxiliary permission candidate because its annotation-layer license is not explicit. DENS and REN-20k are not retained: Wattpad/news rights and non-commercial terms fail.

## Integrity

- Dataset archives downloaded: **0**.
- Rows entering Train: **0**.
- Human/model labels added: **0**.
- Models trained or evaluated: **0**.
- Protected evaluation sample content accessed: **0**.
- Frozen incumbent changed: **no**.

## Exact next action

Seek a written license from the SO-E dataset authors/University of Bari that explicitly covers the annotation workbook for commercial/product ML training, modification, retention, and derived models. If granted, run one local checksum/schema/source-group and aggregate-overlap admission audit and calculate exact `joy positive / love NO` and `love positive / joy NO` yields. Do not train at that stage. Separately, wait for the already-sent Reddit response without re-contacting or making GoEmotions the sole blocker.

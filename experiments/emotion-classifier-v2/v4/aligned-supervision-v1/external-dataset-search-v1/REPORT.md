# External Dataset Search v1

Date: 2026-09-17  
Decision: **NO ELIGIBLE SOURCE FOUND — DO NOT DOWNLOAD / DO NOT TRAIN**

## Objective and hard gates

This search asked whether a public, human-written source can safely supply explicit negative supervision for `confusion-aware-hard-negative-v1`. Admission required all of the following at once:

1. commercial model-training and underlying-text rights clearly allowed;
2. `EXHAUSTIVE_MULTILABEL` annotation so omission is a real negative;
3. defensible direct coverage of both labels in at least one current confusion pair;
4. human labels rather than synthetic/model-generated labels;
5. feasible source-group separation and leakage auditing.

Metadata, rights, annotation protocol, and taxonomy were checked before data access. No source met every gate, so no archive was downloaded and no local admission or overlap audit was started.

## Result

- Investigated: **30 datasets**.
- `ELIGIBLE_FOR_LOCAL_ADMISSION_AUDIT`: **0**.
- `PROMISING_BUT_PERMISSION_REQUIRED`: **3**.
- `RIGHTS_UNRESOLVED`: **12**.
- `ANNOTATION_NOT_EXHAUSTIVE`: **3** as the controlling admission status.
- Annotation non-exhaustive/inadequate in total: **25/30** when datasets blocked by other gates are also counted.
- `TAXONOMY_MISMATCH`: **5**; `DOMAIN_MISMATCH`: **1**; explicit `REJECT`: **6**.

The controlling result is not a shortage of downloadable corpora. It is the absence of a source that jointly satisfies rights, exhaustive negatives, and the adjacent Product-18 label pairs.

## Top candidates

| Dataset | Rights | Exhaustiveness / explicit negative | Taxonomy fit | Current-pair yield | Decision |
|---|---|---|---|---:|---|
| GoEmotions | Dataset annotations are CC BY 4.0, but Reddit User Content rights are separate. Reddit's current terms say no third-party ML/AI training right is implied without applicable rightsholder permission. | `EXHAUSTIVE_MULTILABEL`; per-rater binary matrix | 18/18 exact Product-18 labels; strongest by far | 46 current-pair rows are already known inside the pre-existing bounded 55-row candidate artifact; admissible yield **0** | `PROMISING_BUT_PERMISSION_REQUIRED` |
| SemEval-2018 Affect in Tweets E-c | Official materials say freely available but do not grant commercial model-training rights to underlying tweets. | `EXHAUSTIVE_MULTILABEL`; 11 emotions + neutral presented to each rater; median 7 raters | Only clean requested pair is `joy ↔ optimism`; `anger` explicitly includes annoyance and cannot supervise that boundary | Unknown; not computed after rights stop | `PROMISING_BUT_PERMISSION_REQUIRED` |
| BRIGHTER English | HF metadata says CC BY 4.0, but the official paper says commercial use is prohibited absent creator approval; English source-text rights remain separate. | `EXHAUSTIVE_MULTILABEL`; binary columns and disaggregated labels | Only anger/fear/joy/sadness/surprise in English | Structural **0** for all seven current pairs | `PROMISING_BUT_PERMISSION_REQUIRED`, low current utility |

### Why GoEmotions is still not admissible

The annotation layer is unusually suitable, but that does not clear the source-text layer. The official Google Research repository licenses its datasets CC BY 4.0, while the raw texts are Reddit comments. Reddit's official Developer Terms state that User Content is owned by users and specifically deny an implied right to train ML/AI models without the applicable rightsholders' express permission. Therefore `CC BY annotations/data package` cannot be equated with `commercial training rights to every Reddit comment`.

The historical 55-row candidate artifact remains evidence of technical value, not rights clearance. Of those 55 rows, 46 fall within the seven pair families requested here; coverage is still incomplete and asymmetric. No new row was opened or mined.

### Why SemEval-2018 is narrower than its 11-label count suggests

Its protocol is strong: annotators chose among eleven emotions plus neutral and could select multiple emotions. However, the task's own definition treats `anger` as including annoyance/rage. That makes it invalid for teaching the Product-18 `anger ↔ annoyance` boundary. Among current pairs, only `joy ↔ optimism` has two clean, separate labels. Rights for commercial training on the tweet text are not affirmatively granted in the official materials.

### Why BRIGHTER does not unlock this task even with permission

BRIGHTER supplies strong human binary judgments, but the English taxonomy does not contain both members of any current pair. Creator permission could make it useful for basic-emotion or abstention work; it would still yield zero direct hard negatives for the present seven adjacent-label pairs.

## Other decisive findings

- **High text fit but non-exhaustive:** crowd-enVENT, enISEAR, ISEAR, HappyDB, and EmpatheticDialogues contain first-person or short emotional events, but prompts/single labels do not make all omitted Product-18 emotions negative.
- **Rights-clear text but no label fit:** Unexpected Events is CC BY 4.0, participant-written, groupable short text, yet its human labels are valence/topic/goal relation rather than discrete emotions. It remains unlabeled auxiliary text, not hard-negative gold.
- **Noncommercial/research-only:** EmpatheticDialogues, DailyDialog, EmoWOZ, Persona-E2, SENDv1, and Less is More cannot support a commercial PetalPal training pool under their public terms.
- **Underlying-content failures:** Twitter corpora, Friends-derived dialogue, movie subtitles, Reddit corpora, and book-passage datasets cannot inherit commercial model-training clearance merely from a repository or annotation license.
- **No forced mapping:** guilt→remorse, happiness→joy, hope→optimism, affection→love, anxiety→fear, and system-specific dialogue labels were not used.
- **New 2026 sources do not solve the blocker:** SemEval-2026 ecological essays offer first-person longitudinal text but only valence/arousal; HISEMOTIONS has exhaustive human labels only in historical Spanish dev/test and model-assisted training labels, with no complete requested pair.

## Permission strategy

The only request with high expected value is a GoEmotions/Reddit rights-chain clarification. It must explicitly cover commercial ML training on the underlying comments, not just the annotation files. SemEval-2018 is a second-priority request for `joy ↔ optimism`. BRIGHTER creator approval is technically clear to request but low-value for the current pair set.

No email or request was sent. Exact scopes and official contact routes are recorded in `permission-request-candidates.md`.

## Integrity and actions not taken

- Dataset downloads in this task: **0**.
- Rows added to Train: **0**.
- Human review/adjudication: **0**.
- Model-panel expansion: **0**.
- Protected evaluation row access: **0**.
- Model inference/training: **0**.
- Incumbent change: **none; frozen incumbent remains frozen**.
- `admission-plan.md`: **not created**, because no source reached `ELIGIBLE_FOR_LOCAL_ADMISSION_AUDIT`.
- Graph/code graph: **not changed**, because no acquisition, ingestion, or validation code was added.

## Exact next action

Prepare and send the Priority-1 permission request to the GoEmotions stewards and Reddit licensing route. Do not perform a local download from this search until a written response expressly clears commercial model training on the underlying user-authored text. If that clearance is obtained, create a new local-admission audit that freezes the archive checksum, verifies the raw rater matrix, restricts mappings to exact Product-18 names, enforces author/thread-disjoint splits, and reports only aggregate duplicate/near-duplicate overlap against canonical Train, legal Dev, and protected evaluation sets. If clearance is not obtained, the current hard-negative route remains data-blocked; do not substitute model votes or synthetic rows.

## Evidence index

- GoEmotions: <https://github.com/google-research/google-research/blob/master/goemotions/README.md>
- Google Research repository licensing: <https://github.com/google-research/google-research/>
- Reddit Developer Terms: <https://redditinc.com/policies/developer-terms>
- SemEval-2018 official paper: <https://saifmohammad.com/WebDocs/semeval2018-task1.pdf>
- BRIGHTER project and paper: <https://brighter-dataset.github.io/>, <https://arxiv.org/html/2502.11926>
- Full per-source evidence: `rights-evidence.jsonl` and `annotation-protocol-evidence.jsonl`.

# Target-First Selective Data V1

Status: `DESIGN_FROZEN / NO_DATA / NO_TRAINING`

## Purpose and closed decisions

This protocol creates new English PetalPal Events from a selective-supervision target that is frozen before any Event prose exists. Its only purpose is to teach the Product-18 model which zero, one, or two emotions should survive the final selector when several emotions are semantically reasonable.

Post-hoc labeling of the recovered 1,000 Events is permanently closed for V1. The keyword pass failed by under-selecting, and the semantic pilot failed by promoting secondary emotions into `SELECTED`. A third labeling pass would turn an unstable judgment process into the source of truth rather than test a predeclared target.

The recovered Events are now classified only as:

`OWNED_SYNTHETIC_UNLABELED_DOMAIN_POOL`

They may inform aggregate constraints—short, natural, personal Event style and the existing `<=300` character limit. They are excluded from Train, Dev, and Final Test, cannot receive selective labels, and cannot be copied, retrieved, quoted, transformed, or paraphrased during generation. Their row-level content is unavailable to target authors, writers, and QA.

This design does not authorize data generation, training, incumbent changes, protected-holdout access, or commit/push.

## Frozen semantics

Each target partitions all 18 Product labels exactly once:

- `SELECTED`: zero, one, or two independently central, text-supported emotions PetalPal should display.
- `PLAUSIBLE_NOT_SELECTED`: genuinely supported for the Event author, but clearly secondary to every selected label and therefore not part of the final output.
- `NOT_APPLICABLE`: unsupported for the Event author. Uncertainty is never converted into this state.

The arrays are disjoint and their union is Product-18. Two selected labels must be non-redundant and occupy different production selector clusters. An abstention target has empty selected and plausible arrays and all 18 labels in not-applicable. The dataset has no Primary; `primaryGardenMood` is always `null` and never inferred.

All admitted rows are `SYNTHETIC_WEAK_SUPERVISION`, never human gold.

## Append-only workflow

1. **Plan coverage without prose.** Choose a split, target kind, coverage tags, and a new scenario-family skeleton. Do not inspect legacy rows, model outputs, error rows, protected data, or rights-pending text.
2. **Freeze a target record.** Assign all 18 states, justify every selected label, justify why every plausible label is secondary to every selected label, declare any P0 role, and record a finite attempt budget. Canonicalize and hash the target. No Event text is present.
3. **Generate from scratch.** A writer receives only the frozen target, Product-18 definitions, abstract scenario plan, and style constraints. It writes one original Event; the target is read-only.
4. **Run mechanical checks.** Validate schema, English, Unicode character count, prohibited label-word leakage, rights declarations, exact/normalized duplicates, near-duplicate candidates, delexicalized templates, and scenario-family isolation. Mechanical checks never infer labels.
5. **Run independent semantic QA.** QA sees the frozen target and Event but no model predictions or evaluation results. It returns only `PASS`, `REJECT`, or `FLAG`; it cannot edit either artifact.
6. **Admit or retry.** Only `PASS` joins the split. `FLAG` is quarantined. `REJECT` is excluded. A failed Event attempt remains immutable. Regeneration appends a new uniquely identified attempt against the same frozen target ID and hash, within that target's frozen attempt budget and without showing rejected prose to the next writer. At most one passing attempt may be admitted for a target. Exhausted targets remain shortfalls. A new target is required only when the frozen semantic target or scenario family itself is invalid, not solely because Event prose failed.
7. **Lock splits.** Freeze and seal Final Test before training. Dev is the only model-selection gate. Final targets, text, references, or row-level diagnostics are unavailable to training and candidate selection.

The existing `PRE_GENERATION / SCENARIO_SKELETON_OVERLAP` invalidation remains limited to targets with no attempts, QA, or admission. A separate terminal path is permitted only after the designated feasibility artifact explicitly records `TARGET_CONSTRAINT_CONFLICT`. A `POST_GENERATION_TERMINAL` record binds the immutable target ID/hash to one reserved replacement target ID. It preserves the target and all attempts, permanently excludes the target from candidate selection, QA `PASS`, and admission, and permits only that one replacement. The replacement must use a new ID, hash, and scenario family while exactly preserving split, target kind, coverage tags, Product-18 states, boundary pairs, and P0 coverage. Event failure alone never qualifies.

Target, generation-attempt, and QA records are separate append-only records under `schema.json`. Temporal order is enforced by storage: every generation attempt must reference a pre-existing target hash, and QA must reference a pre-existing attempt and the same target hash. Multiple attempts may reference one frozen target, but their count may not exceed `attemptBudget`; attempt IDs remain globally unique and only one attempt per target may receive an admissible `PASS`.

## Smallest defensible release plan

The planning point is **2,400 accepted rows**:

| Split | Accepted planning size | Role |
|---|---:|---|
| Train | 1,800 | Sole future training split |
| Dev | 300 | One-time candidate PASS/REJECT gate |
| Locked Final Test | 300 | One-time terminal estimate after Dev PASS |

These are planning caps, not permission to accept weak rows. Do not pad, template, relabel, or keep generating after a target's attempt budget. Report the smaller accepted dataset and all shortfalls. If Dev has an undefined required metric or insufficient predeclared support, record `INCONCLUSIVE_COVERAGE / DO_NOT_TRAIN`.

Coverage planning, subordinate to semantic quality:

- all 14 P0 directions: Train 40 each; Dev and Final 8 each;
- every Product-18 selected label: Train 60; Dev and Final 15;
- legitimate both-selected P0 cases only for the two cross-cluster pairs, plus varied non-P0 two-label cases;
- neither-selected controls for every P0 pair;
- clear single-label cases, genuine abstentions, rare labels, ordinary daily events, mixed valence, and subtle evidence.

These are minimum evidence targets, not desired population proportions. A naturalness or semantic shortfall wins over a count target.

## Split and duplication firewall

A scenario family is the causal skeleton: author role/relationship, precipitating event, stakes, response/action, and outcome. The family and split are assigned before prose. Names, places, objects, dates, numbers, tense, or synonyms do not create a new family.

- Scenario family, generator prompt-template family, rejected-attempt lineage, and near-duplicate component are atomic to one split.
- Separate generation contexts are used for Train, Dev, and Final; a writer never sees another split's rows.
- Exact equality is checked on stored Unicode text.
- Normalized equality uses NFKC, lowercase, whitespace collapse, and canonical quote/dash handling for comparison only.
- Deterministic character 3–5-gram cosine at `>=0.80` creates near-duplicate candidates; semantic QA decides equivalence without changing labels.
- A delexicalized comparison replaces names, locations, dates, numbers, and superficial slots to detect templates.
- No exact/normalized duplicate is admitted. Near duplicates and template relatives share one component and cannot cross splits; keep at most the natural, semantically faithful rows needed within that family.

## Rights and information boundary

All Event text must be created from scratch. Reddit raw text, GoEmotions raw text, CoSoWELL, rights-pending material, protected holdouts, incumbent predictions, COSO/RTN row-level errors, model votes, and individual legacy Events are prohibited as source or prompt material. No paraphrase workaround is allowed. Each attempt records creator/generator version, prompt/process version, timestamp, and an explicit no-source-text declaration.

## Release gates

Before generation begins, the schema, target manifest builder, split/family registry, normalization/dedup implementation, prohibited-source boundary, QA form, and finite per-target attempt budgets must be frozen. Before dataset release, every accepted row must have a valid target hash, one passing QA record, clean isolation checks, and verified synthetic provenance.

`READY_FOR_TARGET_FIRST_DATA_GENERATION = YES`

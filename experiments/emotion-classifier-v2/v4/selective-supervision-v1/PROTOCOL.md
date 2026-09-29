# Selective Supervision V1

Status: `DESIGN_ONLY / NO_DATASET / NO_TRAINING`

This protocol tests one idea: teach the Product-18 classifier which zero, one, or two secondary emotions should survive final selection when several labels are semantically reasonable. It does not authorize training, dataset generation, threshold changes, incumbent changes, or access to protected holdout row-level content.

## Frozen repo facts

- Product-18 is `admiration`, `amusement`, `anger`, `annoyance`, `caring`, `confusion`, `curiosity`, `disappointment`, `disgust`, `excitement`, `fear`, `gratitude`, `joy`, `love`, `optimism`, `remorse`, `sadness`, and `surprise`.
- Production selection is capped at two labels. The current selector removes Primary-redundant labels and allows at most one label from each existing emotion cluster.
- The current research incumbent is `experiments/emotion-classifier-v2/v4/aligned-supervision-v1/goemotions-targeted-v1/experiment/epoch-1-checkpoint`, with threshold `0.35` and the canonical max-two selector. Historical COSO-149 metrics are approximately Macro-F1 `0.3452`, Micro-F1 `0.5281`, exact-set `34.90%`, FP/FN `58/85`. These numbers are provenance, not a substitute for scoring both systems on Selective Dev. Locked Final Test is eligible only after Dev PASS.
- The incumbent inherits rights-pending Reddit/GoEmotions and CoSoWELL lineage and remains research-only. Fine-tuning it does not create a production-cleared checkpoint.
- Reddit raw text, GoEmotions raw text, and CoSoWELL are forbidden in this dataset, including paraphrases intended to evade the rights restriction.

## Source discovery result and hard gate

`DATA RECOVERY BLOCKER = ACTIVE`: the prior discovery record reports that `synthetic_personal_events_1000.csv` was not found in the working tree, Git history, or the current machine. This scoped design audit does not repeat that machine-wide search or independently certify its exhaustiveness. No claim is made about the missing artifact's row count, labels, duplicates, quality, or provenance.

Recovery/localization of the exact old owned artifact and its provenance is the permitted next prerequisite, before dataset implementation. Its absence never authorizes generation of a replacement 1,000 rows, a renamed substitute, or supplement generation from an assumed empty old pool. This design audit performs no recovery or dataset execution.

The repository does contain a different historical synthetic artifact: `tuning-data-v1/train.jsonl` (2,000 rows), `tuning-data-v1/dev.jsonl` (400 rows), and their `state/final-validation-report.json`. Repo governance describes it as PetalPal AI-assisted synthetic generation/review, historical only, with production rights/provenance still requiring review. It must not be silently substituted for the missing 1,000-row CSV.

Before annotation, the exact old CSV must be restored or supplied without changing its Event text. Its provenance record must identify creator/generator, generation date or version when known, prompt/process when known, original path, intended license/use, any prior Train/Dev/Test use, and whether any protected or rights-pending text influenced generation. Missing fields are recorded as `UNKNOWN`; they are not guessed. If prohibited source influence cannot be ruled out, the affected row or whole pool is quarantined.

## Reuse workflow for the old 1,000

The original CSV is immutable candidate input. It is never deleted, regenerated, normalized in place, or rewritten to fit the new schema.

1. **Structural audit:** verify readable encoding, header, parseable row count, stable row identity, one non-empty Event field per row, and no accidental truncation. A filename containing `1000` is not evidence of 1,000 valid rows.
2. **Provenance and exposure audit:** establish source/generator lineage, rights status, and all prior training, prompt, evaluation, or model-selection exposure. Rows with unclear or rights-pending source influence are quarantined.
3. **Text audit without mutation:** compute length; English status; personal-Event fit; label-word leakage; exact, normalized, near-duplicate, and name/place-substitution-template groups; and scenario-family membership. Normalization is for comparison only.
4. **Admission decision:** `PASS` rows keep the exact original Event string and may receive new supervision. `FLAG` rows remain in the source pool but are not admitted until the flag is resolved. `REJECT` rows remain preserved but never enter the new dataset. Event repair or paraphrase is forbidden.
5. **Weak selective annotation:** a single annotation pass applies the frozen three-state rubric to each eligible old Event. An independent QA pass may only return `PASS`, `REJECT`, or `FLAG`; it cannot edit states, vote labels into existence, or adjudicate a new target. Admitted annotations are always marked `SYNTHETIC_WEAK_SUPERVISION`, never human gold.
6. **Gap report:** only after all eligible old rows are frozen, count state coverage and determine the minimum new generation needed. Do not set a supplement size from the filename or from desired headline balance.

Rows with verified previous model-training exposure are Train-only. Rows with unclear exposure are Train-only only after protected-evaluation and prohibited-source influence have been ruled out; otherwise quarantine them. No old row may enter Locked Final Test. An old row may enter Dev only if its non-exposure is affirmatively verified. Rights admission must be verified for every admitted old or new row; `PARTIAL`/`MISSING` provenance is not admission. Nonessential historical fields may remain `UNKNOWN` without inventing rights evidence.

## Admission checks

An admitted Event must be English, at most 300 Unicode characters, naturally phrased as a personal Event, and not copied or paraphrased from a rights-pending or protected source. The preferred length is 40–220 characters; otherwise-valid shorter or longer rows are reported separately rather than padded or rewritten.

Duplicate checks use the untouched Event plus comparison-only views:

- exact Unicode equality;
- normalized equality after Unicode NFKC, lowercase, whitespace collapse, and canonical quote/dash handling;
- deterministic character 3–5-gram cosine candidate detection at `>=0.80`, followed by blind QA of semantic equivalence;
- a delexicalized skeleton check that replaces names, locations, dates, and numbers, catching rows that differ only by slots;
- scenario-family grouping by the same causal setup, relationship, stakes, action, and outcome.

Exact/normalized duplicates retain at most one admitted representative. Near duplicates and template variants stay in one scenario family; the best natural row may be retained, but no family crosses splits. Rejected copies remain in the untouched source CSV.

## Three-state contract

Every admitted row exhaustively partitions all Product-18 labels:

- `SELECTED`: a central, text-supported emotion that should appear in the final zero-to-two output; two is a ceiling, not an obligation.
- `PLAUSIBLE_NOT_SELECTED`: genuinely supported in the author's experience, but clearly lower priority than **every** selected label because of centrality, the output budget, or cluster choice. It is not an uncertainty state. Each selected-versus-plausible comparison must be defensible; otherwise `FLAG` and exclude the row rather than invent an ordering.
- `NOT_APPLICABLE`: no reasonable evidence for this label in the author's experience under the frozen rubric. This is a weak annotation about the text, not a claim about the author's hidden emotions. Unresolved applicability is `FLAG`, never an automatic negative or a catch-all plausible label.

The three arrays must be disjoint and their union must equal Product-18. `SELECTED` contains at most two labels and must be representable by the canonical selector: no two selected labels may come from the same selector cluster. An abstention row has no selected or plausible labels and marks all 18 labels `NOT_APPLICABLE`, only after each label passes that rubric. Ambiguity between reasonably supported emotions does not establish 18 negatives; such a row is excluded if a defensible partition cannot be made. A plausible label is never placed in BCE as target zero, but does receive the explicit relative ranking gradient.

V1 is Event-only: the schema has no user-selected Primary, so pass `primaryGardenMood = null` for every row. Never infer a Primary, manufacture Primary-redundant abstentions, or mark a supported emotion `NOT_APPLICABLE` because of a guessed Primary. Primary-aware product behavior is outside this experiment; the production redundancy rule remains unchanged.

The annotation concerns the Event author's emotion, not another person's emotion, an inferred diagnosis, generic valence, or an unexpressed hidden motive. A two-label output requires two independently central signals; two synonyms from one cluster do not qualify.

## Required audit statistics before supplement generation

The old-pool report must include, for the full source and admitted subset:

- physical rows, parsed rows, unique Events, admission/flag/reject counts, reason counts, and provenance/exposure tiers;
- character-length buckets `<40`, `40–220`, `221–300`, and `>300`, English failures, naturalness failures, and label-leakage flags;
- exact, normalized, near-duplicate, delexicalized-template, and scenario-family group counts;
- selected, plausible-not-selected, and not-applicable counts for every Product-18 label;
- selected cardinality `0/1/2`, abstention rate, and rows containing any plausible-not-selected label;
- an 18x18 directional boundary matrix counting `selected_label > plausible_label` within the same Event;
- both directions of every P0 boundary, plus selector-cluster conflicts and cross-cluster top-two exclusions;
- split eligibility after prior-exposure and scenario-family rules.

This report determines deficits. It must not inspect incumbent predictions, Dev errors, Final Test results, protected holdout rows, or external model votes.

## Coverage targets and supplement rule

Final size bands are guidance, not quotas: Train `1,800–2,400`, Dev `300–400`, Locked Final Test `300–400`. Prefer the smallest dataset that clears semantic coverage and isolation gates.

After old-pool admission, generate only missing cells in this order:

1. P0 directional boundaries;
2. labels below the selected-support target;
3. missing two-selected, single-selected, or true-abstention behavior;
4. non-P0 selector-cluster boundaries with weak plausible-not-selected coverage;
5. style, length, and scenario-family diversity deficits.

Coverage targets are 60 selected examples per label in Train and 15 per label in Dev and Final Test; **7 P0 pairs / 14 directions, with Train 40/direction and Dev and Final Test each 8/direction**; `15–25%` genuine abstentions; `20–30%` two-selected rows; and `30–45%` rows with at least one plausible-not-selected label. These are planning targets, not hard row quotas or empirical population proportions. Existing eligible qualifying rows count toward their assigned split's target. Preserve naturalness, rights, and isolation when targets cannot be met; report actual counts and shortfalls instead of padding, templating, duplicating, or relabeling. Metric support thresholds in `evaluation-gates.md` determine what evidence is evaluable, not permission to manufacture it.

The supplement count is:

`accepted_new_rows = only natural, eligible rows addressing the frozen semantic coverage deficits`.

Size-band shortfalls alone do not justify generation. Freeze a finite maximum attempt budget per semantic target in the gap plan before generation; stop at that budget or when natural, distinct scenarios are exhausted. Accept and report unresolved shortfalls. If a required metric cannot be evaluated, stop as insufficient evidence rather than force coverage or relax the gate.

Rejected generation attempts do not enter the dataset. They may be replaced only against the same predeclared semantic target; QA feedback cannot create or change labels.

## Split and lock policy

- Assign a scenario family before split assignment. All exact/normalized/near-duplicate components, delexicalized template variants, and related scenario families are atomic split groups.
- Split the old pool only after exposure audit. New generation targets are assigned to Train, Dev, or Final Test before prose is generated.
- Generator batch, prompt-template family, scenario family, and near-duplicate component must not cross splits.
- Locked Final Test is entirely new, targets 300–400 accepted rows, and is created and locked before training. A separate preparation/evaluation role may verify schema, rights, isolation, and aggregate coverage; the training/candidate-decision process receives no Final text, labels, logits, or model-dependent diagnostics. Aggregate Final coverage shortfalls are recorded, never used to select a candidate or make a training decision.
- Selective Dev is the sole candidate PASS/REJECT gate, evaluated once after the final checkpoint freezes. All quality, mechanism, and output-behavior guards are in `evaluation-gates.md`. Failure ends V1 and leaves Final Test sealed; it never authorizes rescue.
- Only after recorded `PASS_DEV` may a separate evaluator run both frozen systems on Final Test once. Freeze checkpoint, tokenizer, objective, threshold, selector, and evaluation code before access; freeze Final predictions before revealing references or scores. No Final-dependent candidate selection, training decision, promotion gate, rescue, tuning, second candidate, or error-driven data generation is permitted. Final scores and limitations are reported once, even when unfavorable, and V1 closes without changing the Dev decision.

## Forbidden routes

Do not reopen Balanced Head/Mean Anchor, ASL, class weighting/positive weighting, continuation/extra-epoch rescue, Stage-1 patching, missing-positive repair, threshold/LR/seed sweeps, DAPT, distillation, dropout consistency, backbone search, model-vote hard negatives, or external-dataset search. Do not use Event-to-model-vote-to-gold. Do not access protected holdout row-level content. Do not modify the incumbent.

## Readiness

Design audit corrections are applied. Dataset implementation remains blocked until the exact old owned CSV and its provenance are recovered/located. After recovery, implementation must start with the ordered provenance/rights and admission audits above; annotation or supplementation cannot bypass them. Recovery is a prerequisite, not a dataset-generation authorization. Synthetic benchmark success cannot clear model lineage or establish real-domain product quality; independent rights-cleared human Product-18 evidence remains required outside V1. No new human review is authorized here.

`AUDIT = PASS` (corrected protocol design only; no dataset or model evaluated)

`DATA_RECOVERY_BLOCKER = ACTIVE`

`READY_FOR_DATA_IMPLEMENTATION = NO`

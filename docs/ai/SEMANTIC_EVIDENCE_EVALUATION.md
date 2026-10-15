# Semantic evidence — evaluation and limits

This is **same-task developer-authored synthetic evidence**, not blind evaluation, an external language review, a representative user sample, or a Claude-output benchmark. The author saw the reference implementation. The 32 source strings were newly written for this task, are not copied from older fixtures, and were not rewritten to raise acceptance. No historical classifier final-evaluation data was used. Synthetic semantic annotations used by the conditional proof tests are a separate lane, not ground truth for this corpus.

## Identical-source comparison

The fresh corpus covers eight domains: work/study, technical projects, friendship, daily life, creative activities, rest/leisure, mixed emotions, and sensitive ordinary experiences. Sources include English, Simplified Chinese, Traditional Chinese, and code switching. They include positive, negative, uncertain, mixed, and figurative feelings, plus negation, possibility, intention, quantity, explicit cause, ambiguous relationships, and third-party speech.

Each scenario has four complete synthetic Event strings. Weekly uses its first two on September 15/18, 2026; Monthly uses all four on September 2/9/16/27, spanning four calendar weeks. Within each report/locale case, v1, v2, v2.1, and the proposed prototype receive identical source text and owner/identity/revision/period metadata. All selected sources are retained; topic metadata is empty. Each report type runs in all three output locales: 8 × 2 × 3 = **48 cases**. The same source string can occur in more than one case; 48 is not an independent sample size.

The comparator independently authors both `occurredAt` (the baseline Event field) and `recordedAt` (the research field) and deliberately sets them equal in these fixtures. It does **not** infer one from the other. This fixture equality supplies no production migration or time-semantics rule. Event and Memory text also happen to be identical by fixture authorship; a production summary would need distinct source alignment and loss analysis. The research adapter uses sourceLanguage `unknown`, deliberately declining to infer source language from output locale.

Reference modules are loaded read-only from PR #49 at `09f6aee0584c386c99523e81657413efab32f1af`, which contains the v1, v2, and hardened v2.1 contracts. The comparator checks that commit and rejects dirty implementation/dependency declarations before importing. It calls only packet builders and validators, never provider generation or persistence functions. The reference import graph initializes database configuration, so the command below supplies an explicit synthetic non-listening URL and disables dotenv. No database operation occurs. Fetch is disabled before imports. The prototype itself has no production imports.

Candidates are authored deterministically from the actual public packet forms: v1 selects its available cards/sentences; v2 selects the first eligible fact or source quote for each reference; v2.1 selects eligible episode fragments and whole-record quotations. Each is validated once. There is no repair, inference, provider retry, optimized prompt, or fallback. These decisions differ from the older review's mock author, so its counts are not a trend or improvement benchmark.

The proposed autonomous lane receives no trusted annotations or text realizations. An executable source-copy text probe with an unestablished semantic atom is rejected in every case. This demonstrates the empty-registry boundary, **not empirical failure on 48 model-written reflections**. No native text is generated. A separate call to the prototype's exact-source quotation API verifies the entire source and snapshot in each case. It produces structured quote artifacts, not localized reports.

| Contract/lane | Accepted by its reference validator / 48 | Preflight abstention | Output rejection | Interpretation |
|---|---:|---:|---:|---|
| v1 | 37 | 11 | 0 | Existing verified cards/quotation contract |
| v2 | 48 | 0 | 0 | Predominantly attributed source quotations; no unrestricted paraphrase proof |
| v2.1 | 18 | 30 | 0 | At least one native episode is required; remaining sources commonly quoted |
| Proposed autonomous semantic prose | 0 | — | 48 | `ATOM_NOT_ESTABLISHED`; no independent semantic authority exists |
| Proposed exact-source artifacts | 48 bundles | — | 0 | Exact attributed text only; excluded from native-report yield |

Only **3/32** source strings receive a v2.1 native parse. This fraction describes these particular authored strings; it is not production coverage. Every other source is preserved verbatim or causes report abstention under that contract. Counts are reproduced in [comparison-results.json](../../experiments/semantic-evidence/comparison-results.json), including all actual narratives and abstention codes. The output is approximately 127 KiB of synthetic text, with no user data.

Source input immutability, entire source-string equality, exact quote/source-snapshot identity, and proposed rejection reason are asserted during the run. `referencedEvents` measures metadata references, **not semantic coverage of every experience**. For example, v1 Monthly references all four selected records in an overview but narrates two sentence anchors. v2's deterministic author often uses the first sentence and omits a later recorded feeling. A quotation can be exact and still be a poor selection for a personal reflection.

## What the product comparison actually shows

The creative Weekly/Simplified case is a concrete limitation: v1 produces 152 graphemes with its event count and generic reassurance; v2 produces 77 graphemes of quotation framing; v2.1 abstains. The v2 English sentence about sketching omits the source's next sentence about liking uneven lines and struggling with the reflection. The target-style draft preserves those details and the mixed feelings about writing, but the prototype cannot certify its translations, emotion scope, or invitation. The same sources therefore demonstrate the desired writing gap and the unresolved proof gap together.

The six manually authored [product targets](SEMANTIC_EVIDENCE_EXAMPLES.md) are a writing specification, not accepted outputs or evidence of a natural-writing implementation. They reuse the creative scenario across locales. Each has exact source references, lengths, and explicit unresolved semantic concerns. Chinese Weekly meets the approximate length target; Monthly is deliberately below 250 graphemes after removing recap and source-commentary filler. More words are not scored as better quality.

The following are **developer observations, not scores**:

| Dimension | v1 / v2 / v2.1 observation | Target/prototype implication |
|---|---|---|
| Naturalness and idiom | v1's procedural frame repeats; v2 switches attribution wrappers; eligible v2.1 fragments are smoother but many sources remain quotes | Targets are more connected but their cross-language mappings are unproved; no naturalness gain is claimed for executable code |
| Warmth | v1 generic reassurance is not tied to the recorded problem; optional closings were omitted from v2/v2.1 mock candidates | Targets use optional source-specific questions, whose factual premises still need review |
| Personalization/usefulness | Quotes preserve detail but selection can omit the user's mixed feeling; generic record counts dominate v1 | The complete source should inform selection; metadata coverage cannot substitute for useful narrated detail |
| Repetition | Same wrapper structure remains visible, especially Monthly | Target drafts remove repeated recap; conditional semantic composition is not itself good prose |
| Meaningful insight | Neither recurrence nor record order licenses growth, habit, cause, or improved mood | Only supported juxtaposition, explicitly recorded relations, and source-scoped comparisons are candidates for acceptance |
| Source coverage | Calendar-week/reference coverage is measurable; full claim/feeling coverage is not yet rated | Independently review omitted qualifiers and lost negative/mixed feelings, not only IDs |

## Grounding metrics: reported vs unmeasured

- **Unsupported factual claim count:** `null`, not independently measured for the reference narratives or six targets. Validator acceptance is not relabeled as an independent semantic audit. Production-eligible proposed prose is zero because no prose is certified.
- **Negation, actor/relationship, quantity, modality, temporal and causal preservation:** concrete corpus risk notes and focused mutation checks identify the required invariants. Conditional proof tests measure field/scope rejection under developer assumptions; they do not prove the extraction or translation assumptions.
- **Source attribution accuracy:** exact quotation/source-snapshot identity and unchanged source text are executable assertions. That proves what the synthetic source says, not real-world truth.
- **Rejected unsafe claims:** the focused proof suite reports deliberately altered claims separately. A test count is not an estimated false-accept rate.
- **Valid-report yield / reasons:** baseline acceptance and preflight/output stages appear above. Proposed native certification is absent by design; exact quotes and conditional fixtures are not included in that yield.
- **Naturalness, warmth, personalization, repetition, insight, idiom, coverage and usefulness:** unscored until a separate blind review. No same-author numerical rating is presented as independent evidence.

## Adversarial and metamorphic coverage

The fixture risk notes specify meaningful counterexamples: local test success → deployed fix; possible move → moved; sibling's tiredness → user's tiredness; requested extension → approved extension; wanted contact → contacted; past job loss → current job loss; “not a little” → slight or absent emotion; figurative storm → weather; relaxing walk → improved sleep; friend preference → user's choice. These are semantic review cases, not assumed implemented language understanding.

The credential-free prototype tests separately mutate owner, consent, source kind, source identities, revision, whole-source context, spans, actor, negation, modality, quantity, time scope, relation and exact output text. They test record-order versus action-order separation, recurrence across distinct records, source-coverage requirements, locale mismatch, and free-form text rejection. Success means an explicit assumption cannot be silently weakened or promoted to independent truth. Changing a source outside a cited span must invalidate its old annotation; reordering conjunctions must not add causality; changing requested locale must not alter original source or Profile state. See the focused test file and its actual runner output for executable evidence; not every semantic corpus risk has an automatic natural-language oracle.

## Fresh independent evaluation required before a rollout recommendation

1. Before tuning a new extractor or allowed language mapping, commission separately authored Event bundles in all domains above. Keep development examples and the externally authored acceptance set separate. Freeze the latter before candidate selection. Never use the protected classifier final-evaluation set.
2. Have bilingual reviewers independently decompose complete sources into explicit facts, self-reports, speaker/actor, negation, modality, intensity, quantities, time scope, causal/contrast links, and unresolved ambiguity. Adjudicate disagreements; keep ambiguous cases as abstention cases. Record whether a claim is source-attributed or asserted about the world.
3. Give every version the same authorized source snapshots and coverage requirements. Keep exact quote baseline, conditional semantic fixture lane, and autonomous prose lane separate. A second model may flag a case for review; its agreement is never semantic proof.
4. Hide version/origin from product raters. Ask them to rate naturalness, warmth, personalization, repetition, meaningful supported reflection, idiom, retained positive/negative/mixed feelings, source coverage, and usefulness on an anchored scale. Evaluate English and both Chinese scripts with fluent reviewers. Report disagreement and examples, not just averages.
5. Independently annotate **every factual clause and every question's premise**, including clauses the generator omitted from its own claim list. Count unsupported claims by severity and feature; report source-level and complete-report yield, exact abstention reason, source coverage, and interval estimates. A single unsupported accepted high-impact claim blocks that class rather than being hidden in a high aggregate acceptance rate.
6. Use paired mutations of genuine cases: swap actors, flip negation, change quantities, replace actual/planned/wanted/possible, alter record dates while keeping activity text fixed, add a later explicit correction, remove a causal connective, duplicate one record, add conflicting text outside the quoted span, change requested output locale without changing source, and inject a factual premise in a question. Revalidate both source extraction and complete prose.

This plan is not an executed independent evaluation and does not authorize provider calls. Review semantics first. Any future bounded model-writing experiment, cost/latency measurement, or production activation requires the user's separate approval.

## Reproduction

From this repository root, with an existing untouched reference checkout at the pinned commit:

```sh
env -i PATH="/Users/xingranma/.nvm/versions/node/v24.7.0/bin:/usr/bin:/bin" \
  NODE_ENV=test DOTENV_CONFIG_PATH=/dev/null \
  DEV_DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:1/petalpal_test \
  node experiments/semantic-evidence/compare-baselines.mjs \
  --reference /Users/xingranma/Documents/ChatGPT/jev/petalpal-native-reflection-review49 \
  > experiments/semantic-evidence/comparison-results.json
node experiments/semantic-evidence/render-examples.mjs
```

The observed runtime was Node 24.7.0. On another machine, change only the executable search path and reference checkout location. The comparator's guard requires the exact synthetic environment values shown. No `.env`, secret, production connection, live model, or private data is needed. Reference dependencies must already be available; this script does not install them or edit another branch.

**Decision from this evidence: revise the semantic evidence architecture before an implementation rollout.** Typed conditional composition can be inspected and tested, and exact source attribution is defensible. The two missing semantic bridges—untrusted source to meaning, and actual multilingual prose to complete claims—remain open. Adding fixture realizations or grammar synonyms would not close them. There is no demonstrated certified native-prose improvement to integrate.

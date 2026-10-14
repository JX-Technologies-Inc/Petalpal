# Semantic evidence experiment

**Offline research, synthetic data only. No native AI writing is implemented.**
The result is a compositional proof-obligation checker, not a general language
understanding system. It has no production imports, router flag, provider call,
network client, database, persistence, retry or migration.

## What this tests

The existing v2/v2.1 parser combines source interpretation and allowed wording in
finite language rules. This experiment separates three obligations:

1. Bind a proposed meaning to the complete authorized source context.
2. Check an explicit composition of those meanings.
3. Establish that **all actual output wording**, including implications and
   questions, expresses only that composition.

Only obligation 2 has a general executable checker here. Obligations 1 and 3
cannot be discharged by a model citation, JSON shape, span match, confidence,
keyword overlap or another model's verdict. Developer-authored source annotations
and whole-text realizations explicitly simulate those missing judgements. They
are never accepted as independent semantic evidence.

The checker has no emotion lexicon, source sentence parser, output sentence
templates or synonym expansion. Predicate/actor/object symbols are opaque. It
checks exact values and composes arbitrary annotated predicates with neutral
conjunction, explicit relation edges, recording chronology, occurrence chronology
with explicit activity intervals, and recurrence of a selected recorded subject.
This demonstrates reusable structural composition without demonstrating broader
autonomous source understanding or natural-language generation.

## Run without credentials

Use Node 24 (the repository's runtime). These files import only Node built-ins and
local experimental files; there is no install step or `.env` loading. Strip the
inherited environment, including `NODE_OPTIONS`, before execution:

```sh
env -i PATH="$PATH" node --test experiments/semantic-evidence/test.mjs
env -i PATH="$PATH" node experiments/semantic-evidence/demo.mjs
```

The comparison command and pinned reference checkout requirement are documented
in [the examples and comparison](../../docs/ai/SEMANTIC_EVIDENCE_EXAMPLES.md).
Comparison imports prior pure report modules only in its own explicitly selected
offline process; it does not install, invoke or modify a provider or worker.

## Contract and evidence status

`createExperiment({ request, sources, annotations, realizations })` captures
bounded JSON snapshots. A candidate can call `evaluatePlan(plan)` or
`evaluateText({ locale, reportType, plan, text })`; it cannot amend that captured
registry or add proof fields to its response. Mutating original input objects
does not alter the captured evidence.

Every source binds owner, Event and Memory identity, source/memory revision,
recording and update timestamps, source language, exact Event and Memory text,
and synthetic consent epoch/eligibility. A memory revision equals the source
revision **in this synthetic schema only**; it is not a claim about production
Prisma field semantics. The constructor models a snapshot admission check, not
Firebase authorization or a transaction. A real integration would need canonical
server-derived sources and every existing consent, source and lease fence.

Every annotation binds that **whole** snapshot plus exact UTF-16 text spans, an
assertion type and all actor, predicate/object, polarity, modality, intensity,
quantity, time-scope and qualifier fields. Matching spans prove text location,
not interpretation. A sentence in quoted speech, a negation outside the span or
a misleading Memory summary is still capable of invalidating its interpretation;
the experiment has no automated semantic adjudicator for that problem.

| Status | What is established | What is not established |
| --- | --- | --- |
| `EXACT_ATTRIBUTED_SOURCE` | Complete synthetic source text and bound metadata match | External-world truth, translation, or a usable reflection |
| `CONDITIONAL_SEMANTIC_PLAN` | Operator/field/scope checks hold **assuming** the explicit developer annotations | Independent source entailment |
| `CONDITIONAL_FIXTURE_TEXT` | Complete text and plan exactly match a developer-authored realization fixture | Independent multilingual meaning preservation or safe free prose |
| `UNVERIFIED_FREE_TEXT` | Structured plan passed conditionally; actual prose has no matching realization | Any certification of that prose |
| `REJECTED` | A specific structural/admission/proof rule failed | A probabilistic judgement of likely truth |

**All results have `productionEligible: false`.** There is deliberately no flag,
certificate origin string or constructor option that promotes them. The quote
method returns structured data, not a Markdown/HTML renderer: future display must
use inert text nodes and visually separate source content from application text.
Source-language and output-language fields are independent; no profile exists or
is updated, and source text is never translated or overwritten.

## Acceptance rules and deliberate exclusions

* Atoms must equal a captured annotation in **every** field. Changing a quantity,
  actor, intensity, polarity, modality, temporal scope or qualifier rejects.
* Conjunction adds no causal or chronological semantics. Explicit contrast,
  reported cause and explicit order require a separate annotated relation edge,
  the exact endpoint direction and the same full Event context. A reported cause
  remains the user's report, not an objective causal conclusion.
* `recorded-before` compares distinct Event recording instants. `occurred-before`
  requires positive actual actions with independently assumed explicit activity
  intervals; recording timestamps, planning timestamps, overlapping or absent
  intervals cannot substitute.
* `recurs` requires distinct Events with positive actual fact annotations sharing
  actor, predicate and object. Its scope is **selected records**; no habits,
  growth, recovery, commitment, causation or representative-life inference follows.
  This tests distinct Event identity, not proof that two copied entries describe
  independent real-world occurrences. Qualifiers stay in the constituent atoms.
* Full requested source coverage is checked. `requiredEventIds` is synthetic
  fixture policy, not implementation of production Monthly calendar-week selection.
* Unknown operators and hidden prose/extra properties reject. An invitation label
  cannot bypass a presupposition check; open-ended invitations are unverified.
* Whole-text fixture matching covers every character. An otherwise valid plan
  plus `you recovered`, a changed date, a causal connective or an altered question
  is never certified by that plan.

## Decision

Focused local verification on 2026-10-13 used Node 24.7.0 with a stripped
environment: **79/79 tests passed**, zero failures/skips. Tests cover semantic
field mutations, relation direction, distinct-record recurrence, temporal scope,
source identity/revisions/spans, simulated consent/owner/Event-only admission,
locale separation, injection-as-data, bounds, input immutability and false prose
paired with a correct plan. A separate same-task code review found two structural
edge cases: expanded ISO years could misorder lexical timestamp comparisons, and
an emotion with an activity-scoped fixture time could pass activity chronology.
The constructor now restricts timestamps to canonical four-digit UTC ISO dates;
activity chronology requires recorded facts. Both regression cases pass. This
review is not independent semantic or product validation.

`demo-results.json` is actual reproducible output of `demo.mjs`, including the
composed plan and accepted-conditionally/rejected/unverified results. The fresh
48-case comparison records every source string and baseline output in
`comparison-results.json`; its separately documented empty-registry abstention is
not a useful-native-yield improvement. Production code, dependencies, schema,
workflows and the manual security checklist have no diff against the base.
JavaScript syntax checks, local documentation links, exact demo reproduction and
whitespace checks pass. AST-only Graphify update ran without model calls; its
parser reported partial extraction for the documentation renderer despite Node's
syntax check passing. Generated graph files are excluded from the change.

**Revise the semantic evidence architecture before integration.** The typed layer
makes trust, relation and temporal obligations inspectable and reusable, but it
does not solve the two natural-language entailment gaps. Treat the synthetic
conditional lane as research evidence only. A scalable independently reviewed
source/realization mapping process and fresh blind multilingual product evaluation
are still missing. Expanding hand-authored realization fixtures to raise yield
would recreate the fixed-language limitation.

See [research and future contract](../../docs/ai/SEMANTIC_EVIDENCE_RESEARCH.md)
and [product examples and comparison](../../docs/ai/SEMANTIC_EVIDENCE_EXAMPLES.md).
Stop here: production integration requires a separate user approval and task.

# MODEL_CONSENSUS_REFERENCE_300 protocol

Status: `PASS_COMPLETE` on 2026-09-17. The cohort, three blind label files, and deterministic consensus are frozen.

This bounded artifact is `MODEL_GENERATED_REFERENCE` / `WEAK_PSEUDO_REFERENCE` data for research diagnostics and possible later weak supervision. It is not `HUMAN_GOLD`, `HUMAN_ADJUDICATED`, `INDEPENDENT_PRODUCT_GOLD`, or `PRODUCTION_PROMOTION_GOLD`. It cannot by itself justify production promotion.

## Source admission

The cohort uses the Roadtrip Nation (RTN) personal-narrative corpus released by Saldias & Roy (2020). The official repository describes 10,296 English narrative clauses from 594 real-world spoken personal-narrative video transcripts and states that the material is available under CC BY 4.0. It also states that Roadtrip Nation collected and shared the underlying data. CC BY 4.0 permits sharing and adaptation for any purpose, including commercial use, subject to attribution and change notices.

The source is admitted as `ADMIT_UNLABELED_REFERENCE_ONLY`. This task does not authorize training. Full evidence and excluded-source notes are recorded in `source-admission.json`.

## Untouched audit

- Targeted searches of the current repository and all Git history found no occurrence of `Roadtrip Nation`, `RTN corpus`, `Saldias`, or the repository identifier before this artifact was created.
- The source was not present in the PetalPal training, DAPT, auxiliary, pseudo-label, weak-supervision, feasibility, validation, model-selection, selector/threshold, error-analysis, or prior multi-agent-labeling paths.
- The source was downloaded only after the rights/provenance/schema gate was likely to pass.
- Before the reference files were written, all selected normalized row texts were compared with text-like repository values outside this artifact; exact overlap count was zero.
- `story_id` is the reservation unit. Exactly one row is selected from each of 300 distinct story groups. If this reference is ever used downstream, all 300 selected story groups remain reference-side and may not be moved into training.

## Frozen neutral selection

Selection is independent of incumbent/teacher predictions, confidence, known errors, desired Product-18 balance, source gender/partition metadata, and agent output.

For each `story_id`, `prepare_reference.py` enumerates contiguous windows of at most six clauses and at most 300 Unicode characters. A window must:

- contain 60–300 characters;
- use only the source's structural `Action` and `Orientation` clause types and include at least one `Action`;
- contain a first-person authorial pronoun and a deterministic past-event lexical cue;
- begin with an uppercase character, not begin with a fixed connector list, and end in sentence punctuation;
- contain no question mark, second-person pronoun, contact pattern, or fixed high-risk self-harm/sexual-violence pattern.

One window per eligible story is chosen by a fixed structural score using only Action count, past-event cue count, first-person count, distance from 180 characters, quote count, and deterministic positional tie-breaks. The resulting 321 eligible story rows are ranked by SHA-256 over the fixed salt `petalpal-rtn-reference-300-v1`, `story_id`, and text. The first 300 hashes form the cohort; rows are then ordered by `story_id` and assigned `MCR-0001` through `MCR-0300`.

The frozen cohort has 300 rows from 300 story groups, all English-source personal narratives, all at most 300 characters, no normalized exact duplicates, and no exact overlap with prior repository text. Raw narrator names are not present as source identifiers.

## Product-18 output contract

Label the Event author's own secondary emotion. Return zero, one, or two distinct labels. Empty is valid. Do not infer diagnoses, personality, hidden motives, or emotions not reasonably expressed. Do not convert generic valence into a label, and do not force guilt to remorse, positive to joy, negative to sadness, or arousal to excitement.

Canonical labels and definitions:

- `admiration`: respectful approval or being impressed by someone or something
- `amusement`: finding something funny, playful, or entertaining
- `anger`: strong displeasure, hostility, or rage
- `annoyance`: milder irritation, frustration, or being bothered
- `caring`: concern for, nurturing of, or desire to support another
- `confusion`: uncertainty about understanding, interpretation, or what to do
- `curiosity`: interest or desire to know, learn, or investigate
- `disappointment`: sadness or dissatisfaction because hopes or expectations were unmet
- `disgust`: revulsion, strong aversion, or moral/physical repugnance
- `excitement`: high-energy positive anticipation or enthusiasm
- `fear`: anxiety, worry, threat, dread, or feeling unsafe
- `gratitude`: thankfulness or appreciation for a benefit or kindness received
- `joy`: happiness, delight, contentment, or positive pleasure
- `love`: deep affection, attachment, or warmth toward someone
- `optimism`: hopeful expectation or confidence about a favorable future
- `remorse`: guilt, regret, or sorrow over one's own action or failure
- `sadness`: sorrow, grief, loneliness, or unhappiness
- `surprise`: being startled or encountering something notably unexpected

## Blind model labeling

Three genuinely separate agents run concurrently:

- Agent A: `gpt-6-astra`, reasoning `medium`
- Agent B: `gpt-5.6-sol`, reasoning `medium`
- Agent C: `gpt-5.6-luna`, reasoning `medium`

Each agent receives only the taxonomy/output contract plus `rowId` and Event `text`. Source identity, sourceGroup, source structural annotations, narrator metadata, incumbent/teacher predictions, COSO labels, prior adjudications, other agents' outputs, and consensus are forbidden. Each writes only its assigned output file with exactly:

```json
{"rowId":"MCR-0001","labels":[],"uncertainty":"LOW"}
```

No rationale or free text is permitted.

## Deterministic consensus

Consensus runs only after all three complete outputs are frozen and validated.

- `HIGH_CONSENSUS`: all three exact label sets match.
- `MEDIUM_CONSENSUS`: exactly two exact label sets match.
- `UNRESOLVED`: no exact two-of-three set agreement.

Label order is ignored when comparing sets. Uncertainty never overrides disagreement. No human or fourth model adjudicator is used. Unresolved rows remain unresolved and receive no forced consensus labels. Per-label vote counts are retained for diagnostics.

No training, fine-tuning, threshold tuning, taxonomy change, incumbent modification, candidate promotion, or tuning against these labels is permitted in this task.

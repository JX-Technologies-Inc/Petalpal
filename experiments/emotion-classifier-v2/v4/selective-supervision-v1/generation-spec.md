# Selective Supervision V1 generation specification

Status: `DESIGN_ONLY`. No Event generation is authorized by this file.

## Order of operations

`DATA RECOVERY BLOCKER = ACTIVE`: the exact old owned `synthetic_personal_events_1000.csv` and its provenance must first be recovered/located. A missing file never authorizes a replacement 1,000 rows, substitution of the historical 2,000-row pool, or a gap report that assumes zero reusable rows. New rows are created only after the recovered old candidate pool has been audited, annotated, frozen, and summarized. Freeze semantic targets and a finite attempt budget before writing prose:

1. split and scenario-family slot;
2. zero, one, or two `SELECTED` labels;
3. any `PLAUSIBLE_NOT_SELECTED` labels;
4. all remaining Product-18 labels as `NOT_APPLICABLE`;
5. a concrete causal situation and the evidence that makes the selected label more decision-relevant than each plausible label;
6. only then write an original Event from scratch.

The writer never sees incumbent outputs, protected rows, Dev/Final errors, Reddit, GoEmotions raw text, CoSoWELL, or another model's vote. No source text may be paraphrased, including indirectly prompted rewrites of rights-pending text. Record generator/creator, version/date when known, prompt/process, intended use/rights, and source influence; admit only verified rights/provenance, never assume `SYNTHETIC` implies clearance. Model consensus cannot create, change, or upgrade a target. Use separate split preparation contexts; no Final text/targets reach the training or candidate-decision process.

## Event requirements

- English only; at most 300 Unicode characters; prefer 40–220.
- Natural first-person personal-Event style. It should describe what happened and enough context for the author's emotion, not explain the taxonomy.
- Do not use canonical label words or transparent morphological variants as shortcuts. Also reject conspicuous definition-copying and repetitive cue phrases.
- Vary syntax, tense, relationship, setting, stakes, action, outcome, and narrative focus. Do not create batches by swapping names, places, objects, dates, or numbers.
- Avoid repeated openings, closing reflections, sentence counts, punctuation patterns, and “I felt …” frames.
- Do not force two labels. Two `SELECTED` labels require two independently central signals and must be from different selector clusters.
- A `PLAUSIBLE_NOT_SELECTED` label must have real textual support in the author's experience and be clearly lower priority than every selected label. It is not an uncertainty bucket, a decorative near-synonym, another person's emotion, or an invented emotion. Unresolved applicability/order is `FLAG` and excluded.
- A zero-label target requires no reasonable author-specific evidence for any of the 18 labels. Ambiguity between supported labels is not an all-negative example. Do not hide a strong emotion behind euphemism.
- V1 has no user-selected Primary and evaluates with `primaryGardenMood = null`. Do not infer a Primary or create abstentions/negative targets by imagining Primary redundancy.

## Scenario-family isolation

A scenario family is the shared causal skeleton: relationship/role + precipitating event + stakes + response/action + outcome. Surface changes do not create a new family. Family IDs and split assignments are frozen before prose generation. The same family, delexicalized template, or near-duplicate component cannot cross Train, Dev, and Final Test.

Within a split, retain only enough variants to cover materially different semantic decisions. A family cannot contribute both directions of a P0 contrast merely by changing an emotion cue; use a genuinely different causal focus.

## P0 directional boundaries

There are **7 unordered pairs / 14 directions**. The text must make the first label selected and the second genuinely plausible but lower priority. **Coverage targets**, not hard quotas, are Train 40/direction and Dev and Final Test each 8/direction, counting admitted split-eligible old rows first (no old rows in Final). Record unmet targets and low-support evidence. Never pad, template, relabel, or extend generation beyond the frozen attempt budget to achieve the counts.

| Direction | Semantic distinction to encode |
|---|---|
| sadness > caring | The author's loss, loneliness, or sorrow is central; supportive concern/action is present but secondary. |
| caring > sadness | The author's active concern and support is central; the author's own sadness in response to the hardship is supported but secondary. Another person's sadness alone is not evidence. |
| caring > love | Concrete concern, protection, or support drives the Event; affection is plausible but not the deciding signal. |
| love > caring | Enduring attachment or deep warmth is central; a helpful act is incidental evidence rather than the main emotion. |
| joy > optimism | A favorable outcome is already experienced and present pleasure is central; future hope is only a consequence. |
| optimism > joy | Confidence or hope about a future outcome is central; present happiness is mild or background. |
| joy > excitement | Realized, possibly calm pleasure is central; activation or anticipation is secondary. |
| excitement > joy | High-energy anticipation or enthusiasm is central; positive pleasure is plausible but less specific. |
| caring > gratitude | The author is giving concern/support; appreciation for what was received is secondary. |
| gratitude > caring | Thankfulness for another's benefit or kindness is central; reciprocal concern is secondary. |
| joy > love | Delight in an event or outcome is central; affection toward a person is contextual. |
| love > joy | Deep attachment or warmth toward someone is central; momentary happiness is secondary. |
| fear > annoyance | Threat, uncertainty, worry, or safety concern governs the response; irritation is secondary. |
| annoyance > fear | Being bothered or frustrated governs the response; possible risk or worry is present but not central. |

For same-cluster pairs (`caring/love`, `joy/optimism`, `joy/excitement`, `caring/gratitude`, `fear/annoyance`), the target explicitly teaches which cluster member should survive. For cross-cluster pairs (`sadness/caring`, `joy/love`), ensure the lower-priority label is genuinely non-selected because it is less central, not merely because a cluster rule removed it. With a spare output slot, ordering alone cannot exclude a plausible label above threshold; preserve the semantic target and measure actual selection error as well as raw ranking. Do not force a second selected emotion or falsely mark the plausible label `NOT_APPLICABLE` to make selection easier.

## Other coverage to fill only after audit

- Aim for each Product-18 selected-support target; report shortfalls instead of repeating stock scenarios.
- Include genuine two-selected rows across different clusters so the model does not learn single-label collapse.
- Include true abstentions across varied mundane situations with no reasonable label evidence, without turning uncertain or Primary-like emotions into template negatives.
- Cover non-P0 same-cluster choices observed as deficient in the old-pool boundary matrix.
- Balance relationship and context types sufficiently that no label is predictable from one occupation, location, family role, or event frame.

## Independent QA

QA receives the frozen Event, target states, Product-18 definitions, and quality rules. It is blind to model predictions and evaluation outcomes, but target-visible; do not call it blind independent label evidence or real-domain validation. It returns only `PASS`, `REJECT`, or `FLAG` plus standardized flags. QA cannot relabel, repair prose, choose between model votes, or turn agreement into gold.

`PASS` requires semantic fidelity to the predeclared state partition and all selected-versus-plausible orderings, English/length/product fit, naturalness, no label leakage, verified rights/provenance with prohibited/protected-source influence ruled out, and clean duplicate/family isolation. `FLAG` is excluded pending resolution; resolving uncertainty cannot edit supervision or prose. `REJECT` is excluded permanently. A rejected new attempt may be replaced only within the frozen pre-evaluation gap plan and attempt budget, using the same semantic target but a new scenario family. This never permits replacement of the missing old artifact, repair of old Event text, or generation after Dev/Final results.

All admitted rows are `SYNTHETIC_WEAK_SUPERVISION`, including reused old Events that receive new selective annotations. They are never described as human gold.

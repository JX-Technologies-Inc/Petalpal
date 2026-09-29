# Balanced-head COSO development error analysis v1

Status: **COMPLETE — DEVELOPMENT DIAGNOSTIC ONLY**. RTN row-level data was not inspected.

## Dominant failure mode

The dominant failure is **distributed, near-boundary confusion among related emotions after balanced sampling broadens recall**, not a general failure to abstain on no-clear-emotion Events.

The balanced head recovers 13 incumbent false negatives and loses 3 incumbent true positives, producing the observed net FN reduction of 10. It also adds 20 new false positives and removes 7 incumbent false positives, producing the net FP increase of 13.

Of the balanced head's 71 false-positive label events:

- 13 (`18.31%`) occur on gold-empty rows;
- 29 (`40.85%`) are extra labels alongside at least one correct prediction;
- 29 (`40.85%`) are label confusions on nonempty rows with no true-positive label selected.

The number of gold-empty rows forced nonempty does not increase: incumbent `12`, balanced head `11`. The balanced head does emit two labels on two gold-empty rows, giving 13 label-level FP events. An emotion-presence gate therefore does not address most of the regression.

## Per-label errors

| Label | Inc TP/FP/FN | Balanced TP/FP/FN | Delta TP/FP/FN | Balanced P/R/F1 |
|---|---:|---:|---:|---:|
| joy | 34/24/8 | 33/19/9 | -1/-5/+1 | .635/.786/.702 |
| caring | 4/4/11 | 8/8/7 | +4/+4/-4 | .500/.533/.516 |
| sadness | 9/6/2 | 9/8/2 | 0/+2/0 | .529/.818/.643 |
| annoyance | 5/3/16 | 9/6/12 | +4/+3/-4 | .600/.429/.500 |
| optimism | 6/7/6 | 6/6/6 | 0/-1/0 | .500/.500/.500 |
| fear | 4/4/6 | 6/5/4 | +2/+1/-2 | .545/.600/.571 |
| gratitude | 7/1/5 | 6/5/6 | -1/+4/+1 | .545/.500/.522 |
| disappointment | 3/0/1 | 3/3/1 | 0/+3/0 | .500/.750/.600 |
| excitement | 3/1/5 | 3/3/5 | 0/+2/0 | .500/.375/.429 |
| surprise | 3/0/2 | 5/1/0 | +2/+1/-2 | .833/1.000/.909 |
| confusion | 0/2/1 | 0/2/1 | 0/0/0 | .000/.000/.000 |
| love | 1/2/8 | 1/2/8 | 0/0/0 | .333/.111/.167 |
| admiration | 0/1/2 | 0/1/2 | 0/0/0 | .000/.000/.000 |
| anger | 0/1/0 | 0/1/0 | 0/0/0 | .000/.000/.000 |
| remorse | 0/1/2 | 0/1/2 | 0/0/0 | .000/.000/.000 |
| amusement | 1/0/6 | 1/0/6 | 0/0/0 | 1.000/.143/.250 |
| curiosity | 0/1/2 | 0/0/2 | 0/-1/0 | .000/.000/.000 |
| disgust | 0/0/2 | 0/0/2 | 0/0/0 | .000/.000/.000 |

The largest balanced-head FP contributors are joy 19, caring 8, sadness 8, annoyance 6, optimism 6, fear/gratitude 5 each. The incremental regression is concentrated in caring `+4`, gratitude `+4`, annoyance `+3`, disappointment `+3`, sadness/excitement `+2` each.

The largest remaining FN contributors are annoyance 12, joy 9, love 8, caring 7, amusement/gratitude/optimism 6 each. Recovered incumbent false negatives are caring 4, annoyance 4, surprise 2, fear 2, and love 1.

## Confusions and co-predictions

Top substitution-style pairs, written `predicted instead of missed gold`, are:

- sadness → caring: 3
- caring → love: 2
- joy → optimism: 2
- excitement → joy: 2
- caring → gratitude: 2
- joy → love: 2
- fear → annoyance: 2

No single pair dominates. The pattern is a family of semantically adjacent boundaries. Two-label co-predictions increased most for caring+joy (`+4`), gratitude+joy (`+3`), and caring+fear (`+2`).

## Cardinality and length

Gold cardinality is `30/73/46` for 0/1/2 labels. Incumbent predictions are `35/90/24`; balanced predictions are `27/83/39`. The balanced head correctly reduces underprediction on one- and two-label rows, but also increases one-label gold rows predicted with two labels from 10 to 18.

Only 19/149 COSO rows are at most 300 characters:

- short slice incumbent TP/FP/FN/F1: `8/5/5/.6154`
- short slice balanced TP/FP/FN/F1: `8/6/5/.5926`
- long slice incumbent TP/FP/FN/F1: `72/53/80/.5199`
- long slice balanced TP/FP/FN/F1: `82/65/70/.5485`

Thus every net recall gain occurs on the 130 long rows. Of 20 newly added FP events, 19 occur on long rows. This development set cannot establish that the cRT gain generalizes to the target `<=300`-character domain.

## Confidence and examples

Balanced FP confidence bins are: `22` at `.35-.50`, `33` at `.50-.70`, and `16` at `>=.70`. For the 20 newly added FP events, the bins are `15`, `4`, and `1`. The FP regression is therefore mainly a new near-boundary separation problem; most high-confidence FP already existed in the incumbent.

Representative newly added FP examples include:

- `COSO-4b440...`: gold joy, added excitement `.8376` — joy/excitement boundary.
- `COSO-6e6af...`: gold joy, added caring `.5688` — caring language around friends/health.
- `COSO-74b0d...`: gold gratitude, added caring `.5605` — helping/receiving-help boundary.
- `COSO-036dc...`: gold caring, added fear `.5487` — sick family member boundary.
- `COSO-f413a...`: gold empty, added gratitude `.4903`.

Representative recovered false negatives include caring (`.2487 -> .6072`, `.2483 -> .5723`), surprise (`.2943 -> .5041`), annoyance (`.2431 -> .4472`), and fear (`.3026 -> .4248`). Full deterministic examples, including text and scores, are in `examples.jsonl`.

## Route decision

Chosen next route: **`confusion-aware-hard-negative-v1`**, not an emotion-presence gate. Contrastive/backbone work is lower priority because the frozen representation already supports substantial FN recovery after changing only the head; the immediate missing signal is boundary-specific negative evidence.

No model is trained now. The canonical training labels are selective model-generated weak supervision: an omitted label is not an explicit hard negative. Using COSO development errors as training examples would leak the development set, and the target-domain short slice has only 19 rows. A valid hard-negative experiment first requires rights-cleared, source-grouped, `<=300`-character Events with existing human positive labels **and explicit negative judgments for the paired confusable labels**.

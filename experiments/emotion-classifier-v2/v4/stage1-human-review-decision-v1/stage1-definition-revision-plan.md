# Stage 1 Definition Revision Plan

Status: PLAN ONLY — HUMAN CONFIRMATION REQUIRED

This document identifies questions and examples that must be resolved. It does not supply frozen replacement definitions and does not alter any original judgment.

## Global applicability anchors

The current guide needs human-confirmed operational anchors before label-specific adjudication:

- **NO:** the writer's own emotion is absent, contradicted, attributed only to someone else, merely a possible reaction, or supported only by an event stereotype.
- **PLAUSIBLE:** the label is a reasonable reading, but writer ownership, defining feature, intensity, or evidence is incomplete or genuinely ambiguous.
- **CLEAR:** the writer's own emotion and the label's defining feature are explicit or strongly entailed; the decision should not rely only on a positive/negative event occurring.

These are candidate clarification targets, not frozen wording. Human reviewers must decide whether "strongly entailed," intensity, and implicit evidence can be applied consistently and must add paired positive/negative examples.

## Revision workflow

1. Build a blinded calibration packet containing, per HIGH label, two severe disagreements, two dominant adjacent disagreements, and two Core-agreement controls. Include representative MEDIUM severe cases.
2. Reviewer 1 and Reviewer 2 independently explain which phrase/event supports the applicability category. They must not see their old judgment, the other Core value, Auxiliary ratings, or model output.
3. The ML Lead groups disagreements by rule failure: defining feature absent, writer ownership absent, intensity mismatch, temporal/causal requirement absent, overlap with another label, or general evidence threshold.
4. Core reviewers jointly approve inclusion requirements, exclusion rules, and paired examples. Do not resolve dataset rows during this meeting.
5. Freeze a versioned Stage 1 guide only after both Core reviewers can apply it to the masked calibration packet with exact agreement at least 75%, no more than 10% NO↔CLEAR disagreement, and no HIGH label below 60% exact agreement on its available packet cells. These are methodology gates, not quality claims.

## HIGH-priority labels

### Optimism

- Current issue: favorable present states, completed improvement, gratitude, praise, and generic positivity are sometimes treated as future expectation.
- Clarify: whether an explicit future statement is required; what counts as strong implicit anticipation; difference from hope, relief, joy, and excitement.
- Inspect: NO↔CLEAR examples without future language, plus positive controls with explicit expected future improvement.
- Risky wording: "Positive expectation" without stating that current positivity or a completed good outcome is insufficient.

### Excitement

- Current issue: general happiness, relief, interest, appreciation, and good news are elevated to CLEAR without high arousal or eagerness.
- Clarify: required arousal/eagerness evidence; whether excitement may concern something already happening; distinction from joy and optimism.
- Inspect: NO↔CLEAR cases involving smiles, recovery, praise, routine progress, and genuine eager anticipation controls.
- Risky wording: "anticipated or happening" may be read as any positive event currently occurring.

### Surprise

- Current issue: novelty, compliments, interestingness, or emotional intensity are treated as unexpectedness.
- Clarify: whether the text must state or strongly entail violated expectation; requirement that surprise be the writer's reaction.
- Inspect: unexpected compliment/found-object positives versus pleasant-but-expected and merely notable negatives.
- Risky wording: "Reaction to something unexpected" lacks an operational test for unexpectedness and writer reaction.

### Joy

- Current issue: used as a broad positive umbrella; reviewers disagree especially between PLAUSIBLE and CLEAR.
- Clarify: the meaning of "Strong"; treatment of mild happiness/contentment; exclusions when only gratitude, optimism, excitement, amusement, love, or relief is evidenced.
- Inspect: explicit delight positives, mild pleasant-state cases, favorable-event-only cases, and neutral routines.
- Risky wording: "Strong happiness or delight" provides no shared intensity anchors.

### Gratitude

- Current issue: family/friend mentions, praise, luck, recovery, relief, and general happiness are sometimes sufficient.
- Clarify: required benefit/kindness/source relation; treatment of explicit "grateful/thankful" and conversational "thanks"; difference from appreciation without receipt.
- Inspect: direct gratitude statements, praise/compliment cases, fortunate outcomes, and generic loved-one mentions.
- Risky wording: "benefit or kindness received" does not specify how explicit the receipt/source relation must be.

### Amusement

- Current issue: smiling, cuteness, positive affect, or an upbeat phrase may be treated as funny/entertaining.
- Clarify: whether humor/play/entertainment evidence is mandatory; distinction from joy and affection.
- Inspect: laughter/joke positives versus smile, cute pet, and general happiness negatives.
- Risky wording: "entertaining" may be interpreted as broadly pleasant or engaging.

### Disappointment

- Current issue: negative outcomes, sadness, frustration, or counterfactual wishes are labeled without evidence of a prior hope or expectation.
- Clarify: whether an unmet expectation must be explicit or strongly entailed; distinction from sadness and annoyance.
- Inspect: clear failed-expectation positives versus hardship, illness, inconvenience, and generalized dissatisfaction.
- Risky wording: "worse than hoped" needs examples showing when a prior hope can be inferred.

### Love

- Current issue: mentioning family/friends, caring behavior, companionship, warmth, or gratitude may be treated as deep affection.
- Clarify: attachment evidence, relationship mention insufficiency, and boundaries with caring and gratitude.
- Inspect: explicit affection/attachment positives versus neutral relationship narratives and practical support.
- Risky wording: "Deep affection or attachment" lacks examples separating depth from ordinary warmth.

## MEDIUM-priority labels

- **Admiration:** clarify person/quality-directed approval versus affection, gratitude, praise received, or generic positive appraisal.
- **Anger:** anchor strong hostility/displeasure against mild irritation, frustration, stress, and difficult events.
- **Annoyance:** anchor mild irritation against fatigue/inconvenience and against strong anger.
- **Caring:** require writer concern or desire/action to support another; distinguish from relationship mention and sympathy.
- **Confusion:** require understanding/interpretation/decision uncertainty; exclude unfamiliarity, detachment, and novelty alone.
- **Curiosity:** require desire to know/learn/investigate; exclude noticing, novelty, cuteness, and confusion alone.
- **Disgust:** require physical or moral revulsion; exclude discomfort, dislike, anger, and detachment.
- **Fear:** require writer-owned apprehension/threat distress; distinguish factual danger and concern for another.
- **Sadness:** require writer low mood/sorrow; distinguish negative events, empathy, worry, and another person's suffering.

For each MEDIUM label, inspect all severe Core disagreements and at least three exact-agreement controls before accepting clarification wording.

## LOW priority

- **Remorse:** retain the present self-caused guilt/regret requirement. Add an example only if revisions to disappointment/sadness expose a new conflict. Do not reopen it by default.

## Freeze boundary

Final wording must be approved by humans after the calibration exercise. Model-authored text in this plan is diagnostic scaffolding only and must not be treated as the frozen definition guide.

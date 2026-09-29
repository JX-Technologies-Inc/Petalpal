# Blind Product-18 labeling contract

Label the Event author's own secondary emotion. Return zero, one, or two distinct labels in canonical order. Empty is valid. Do not infer diagnoses, personality, hidden motives, or emotions not reasonably expressed. Do not convert generic valence into a label, and do not force guilt to remorse, positive to joy, negative to sadness, or arousal to excitement.

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

Read only `blind-input.jsonl`. Do not read the source generator, target design, incumbent predictions, COSO or RTN artifacts, source metadata, other agent files, consensus, or desired label counts. Write exactly one JSON object per input row, in input order, to your assigned output:

```json
{"rowId":"TARGET-0001","labels":[],"uncertainty":"LOW"}
```

Allowed uncertainty values are `LOW`, `MEDIUM`, and `HIGH`. Do not include rationale or any other keys.

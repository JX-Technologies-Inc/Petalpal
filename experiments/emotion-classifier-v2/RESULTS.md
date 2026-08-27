# Phase 1 TF-IDF baseline results

## Outcome

- Fine-grained labels: 21
- Official filtered samples: train 41,949; dev 5,245; test 5,228
- Test macro-F1: 0.506177
- Test micro-F1: 0.549516
- Artifact size: 9.2505 MiB
- Single-text CPU latency: median 1.0697 ms; p95 1.2582 ms
- Batch CPU latency: 0.0265 ms/text over 1,000 texts

The easiest labels by test F1 were gratitude (0.9004), amusement (0.7939), love (0.7699), neutral (0.6641), and remorse (0.6573). The hardest were disappointment (0.2280), caring (0.2746), approval (0.3081), annoyance (0.3197), and disapproval (0.3249).

## Garden Mood evaluation

The preliminary mapping is evaluated only where a directly supported mapping exists. `neutral`, `surprise`, and `confusion` remain unmapped. Drifting Bloom and Peaceful Bloom have no Phase 1 direct label and therefore correctly report zero support.

- Evaluable test samples: 3,398
- Unmapped-only test samples: 1,830
- Micro-F1: 0.680929
- Macro-F1 across the six supported moods: 0.595781
- Macro-F1 across all eight requested moods, including two zero-support moods: 0.446836

See `metrics.json` for the full mapping and per-mood metrics, `per-label-metrics.csv` for every fine label, `thresholds.json` for dev-selected thresholds, and `error-analysis.csv` for representative false positives and false negatives.

## Interpretation

This is a useful low-cost baseline but is not ready to replace production. Socially expressed labels such as gratitude, amusement, and love have strong lexical cues. Subtle overlapping labels such as disappointment, caring, approval, annoyance, and disapproval remain difficult. Typical errors show keyword sensitivity (`thanks`, `lol`, `sorry`, `yes`) and confusion between semantically adjacent labels.

The experiment stops here. No MiniLM, transformer, or LLM model was trained.

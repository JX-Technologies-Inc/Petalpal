# Next data acquisition v1 — confusion-aware hard negatives

Status: **BLOCKED_DATA_ACQUISITION — NO TRAINING**.

## Chosen route

The next model route is `confusion-aware-hard-negative-v1`. It is selected because balanced-head recall gains come with distributed false positives on nonempty Events and semantically adjacent label boundaries. A presence gate would target only 13/71 false-positive label events; it would not address the other 58.

This route differs from threshold, sampler, replay, or calibration rescue. Its missing ingredient is new supervision content: explicit evidence that a plausible competing emotion does **not** apply while another does. Existing selective weak labels do not provide that information.

## Why no training occurred

- COSO is an opened development set and cannot be converted into hard-negative training rows.
- Only 19 COSO rows match the `<=300`-character product target; the balanced head shows no TP/FN gain on that slice.
- Canonical Train labels are model-generated selective supervision. An omitted label is not an explicit negative, so emphasizing high-scoring omissions would manufacture false negatives.
- RTN is frozen reference-only and was not inspected granularly.
- No currently admitted source supplies rights-cleared short Events with existing human positive labels plus explicit paired negative judgments.

## Required acquisition

Target 400 already-human-labeled, rights-cleared, source-grouped English Events of 30-300 characters:

- 280 direction-balanced explicit hard negatives across seven priority confusion families;
- 60 no-clear-emotion lexical controls;
- 60 genuine two-label co-occurrence controls.

Priority pairs are sadness/caring, caring/love, joy/optimism, excitement/joy, caring/gratitude, joy/love, and fear/annoyance. Candidate ranking must be frozen before source labels are revealed, and source groups must be disjoint from all evaluation sets.

Model-generated, synthetic, or selective-omission labels cannot satisfy the explicit-negative requirement. Full legal, ranking, schema, and acceptance rules are in the adjacent JSON artifacts.

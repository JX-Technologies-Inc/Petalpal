# Incumbent Error Profile v1

Status: **PASS — aggregate historical-development diagnostic only**

The canonical selector exactly reproduces incumbent micro-F1 `0.5280528053` on COSO-149. Aggregate totals are 58 false positives and 85 false negatives.

The largest false-positive contributors are joy 24, optimism 7, sadness 6, caring 4, and fear 4. The largest false-negative contributors are annoyance 16, caring 11, joy 8, love 8, and amusement 6. Gold-by-predicted output counts are:

| Gold labels | Predicted 0 | Predicted 1 | Predicted 2 |
| --- | ---: | ---: | ---: |
| 0 | 18 | 12 | 0 |
| 1 | 14 | 49 | 10 |
| 2 | 3 | 29 | 14 |

Six Product-18 labels have fewer than three positive rows across all 149 rows: admiration, anger, confusion, curiosity, disgust, and remorse. In the 19-row `<=300` slice, only joy has support of at least three.

Conclusion: the aggregate profile locates historical errors but cannot support a credible label-targeted intervention for short Events. Selecting thresholds, losses, sampling, or another checkpoint from these sparse counts would tune the same non-independent historical diagnostic. No training or promotion is authorized by this result.

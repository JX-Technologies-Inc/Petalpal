# Frozen incumbent baseline diagnostic on RTN-300

1. **Incumbent path:** `experiments/emotion-classifier-v2/v4/aligned-supervision-v1/goemotions-targeted-v1/experiment/epoch-1-checkpoint`. Inference reused the existing Product-18 selector at threshold `0.35`, maximum two outputs, with no Primary-redundancy filter because RTN rows have no Primary mood.

2. **Reference subsets:** `HIGH_CONSENSUS` 106 rows (3/3 exact agent agreement); `RESOLVED` 244 rows (HIGH plus 2/3 MEDIUM); `UNRESOLVED` 56 rows. UNRESOLVED received behavior-only analysis and no precision, recall, or F1.

3. **HIGH_CONSENSUS metrics:** exact-set agreement `59/106 = 55.66%`; Macro-F1 across all Product-18 labels `0.3360`; supported-label-only Macro-F1 `0.4033`; micro precision/recall/F1 `0.3404 / 0.4000 / 0.3678`.

   | Label | Support | Predicted | Precision | Recall | F1 |
   |---|---:|---:|---:|---:|---:|
   | admiration | 2 | 1 | 1.000 | 0.500 | 0.667 |
   | amusement | 1 | 3 | 0.333 | 1.000 | 0.500 |
   | annoyance | 4 | 0 | 0.000 | 0.000 | 0.000 |
   | caring | 5 | 3 | 0.333 | 0.200 | 0.250 |
   | confusion | 2 | 3 | 0.667 | 1.000 | 0.800 |
   | curiosity | 6 | 1 | 1.000 | 0.167 | 0.286 |
   | disappointment | 2 | 1 | 0.000 | 0.000 | 0.000 |
   | fear | 3 | 2 | 1.000 | 0.667 | 0.800 |
   | gratitude | 3 | 2 | 0.500 | 0.333 | 0.400 |
   | joy | 2 | 15 | 0.133 | 1.000 | 0.235 |
   | love | 3 | 3 | 0.667 | 0.667 | 0.667 |
   | optimism | 2 | 6 | 0.000 | 0.000 | 0.000 |
   | remorse | 1 | 0 | 0.000 | 0.000 | 0.000 |
   | sadness | 3 | 6 | 0.333 | 0.667 | 0.444 |
   | surprise | 1 | 1 | 1.000 | 1.000 | 1.000 |

4. **RESOLVED metrics:** exact-set agreement `123/244 = 50.41%`; Macro-F1 across all Product-18 labels `0.3184`; supported-label-only Macro-F1 `0.3371`; micro precision/recall/F1 `0.3542 / 0.2857 / 0.3163`.

   | Label | Support | Predicted | Precision | Recall | F1 |
   |---|---:|---:|---:|---:|---:|
   | admiration | 4 | 3 | 0.667 | 0.500 | 0.571 |
   | amusement | 4 | 7 | 0.429 | 0.750 | 0.545 |
   | anger | 2 | 1 | 1.000 | 0.500 | 0.667 |
   | annoyance | 12 | 6 | 0.167 | 0.083 | 0.111 |
   | caring | 10 | 4 | 0.500 | 0.200 | 0.286 |
   | confusion | 5 | 4 | 0.750 | 0.600 | 0.667 |
   | curiosity | 15 | 1 | 1.000 | 0.067 | 0.125 |
   | disappointment | 14 | 8 | 0.625 | 0.357 | 0.455 |
   | excitement | 6 | 1 | 0.000 | 0.000 | 0.000 |
   | fear | 6 | 4 | 0.500 | 0.333 | 0.400 |
   | gratitude | 6 | 2 | 0.500 | 0.167 | 0.250 |
   | joy | 5 | 29 | 0.138 | 0.800 | 0.235 |
   | love | 7 | 4 | 0.750 | 0.429 | 0.545 |
   | optimism | 8 | 9 | 0.111 | 0.125 | 0.118 |
   | remorse | 3 | 0 | 0.000 | 0.000 | 0.000 |
   | sadness | 7 | 10 | 0.400 | 0.571 | 0.471 |
   | surprise | 5 | 2 | 0.500 | 0.200 | 0.286 |

5. **0/1/2 behavior comparison:** HIGH incumbent `63/39/4` versus consensus `66/40/0`; incumbent mean labels/row `0.443` versus `0.377`, so it is slightly more aggressive on HIGH. RESOLVED incumbent `153/86/5` versus consensus `128/113/3`; mean `0.393` versus `0.488`, so it is more conservative overall. UNRESOLVED incumbent behavior is `33/23/0` with no gold-based interpretation. Across all 300 rows the incumbent is `186/109/5` and abstains on `62.00%`.

6. **FP/FN-style mismatches:** HIGH has 31 FP and 24 FN; consensus-empty/incumbent-nonempty is 19 rows, consensus-nonempty/incumbent-empty is 16. RESOLVED has 62 FP and 85 FN; the corresponding abstention mismatches are 34 and 59. Thus RESOLVED mismatch is dominated by missed labels/extra abstention, despite localized over-production.

7. **Per-label over/under-production on RESOLVED:** strongest over-production is joy `29 predicted vs 5 consensus` (`+24`), followed by amusement `+3` and sadness `+3`; disgust is predicted once but has zero consensus support, so no correctness conclusion is available. Strongest under-production is curiosity `1 vs 15` (`-14`), then annoyance, caring, and disappointment (`-6` each), excitement `-5`, gratitude `-4`, and love/remorse/surprise `-3` each. Incumbent/consensus counts for every label are retained in `analysis.json`.

8. **Agreement with each blind agent:** Astra `177/300 = 59.00%`; incumbent is slightly more aggressive (`0.397` vs `0.320` labels/row; incumbent/agent 0/1/2 distributions `186/109/5` vs `208/88/4`). Sol `100/300 = 33.33%`; incumbent is more conservative (`0.397` vs `0.767`; `186/109/5` vs `101/168/31`). Luna `109/300 = 36.33%`; incumbent is more conservative (`0.397` vs `0.677`; `186/109/5` vs `107/183/10`). This confirms that apparent aggressiveness depends strongly on which model labeler is used.

9. **Important bias limitations:** RTN-300 is model consensus, not human gold; agreement is not true product accuracy. Astra is substantially more conservative. Only three RESOLVED rows have two labels. Disgust has zero consensus support, while anger, remorse, and several other labels are sparse. RTN is career/personal-narrative biased and not Product-18- or population-balanced. COSO-149 remains a distinct historical human-labeled development diagnostic and is not directly equivalent to RTN-300.

10. **Diagnostic result:** `INFORMATIVE`. All frozen inputs validated, inference and every requested subset/agent comparison completed, HIGH has 106 rows, RESOLVED has 244 rows, and incumbent predictions did not collapse. This classification is diagnostic only and has no promotion impact.

11. **Strongest short-Event bottleneck revealed:** label-specific short-Event calibration is skewed—the incumbent is broadly too conservative and misses many consensus labels, while simultaneously over-producing `joy`. A single global statement such as “too aggressive” or “too conservative” is therefore inadequate.

12. **Changed files:** `protocol.json`, `analyze.py`, `analysis.json`, and `REPORT.md` in this directory; `experiments/emotion-classifier-v2/ML_PROGRESS.md` records the completed diagnostic. No checkpoint, selector, reference row, consensus label, or incumbent artifact changed.

13. **Result:** `PASS`. No training, fine-tuning, calibration, threshold/max-2/taxonomy change, checkpoint selection, promotion, or follow-up model intervention occurred. RTN-300 remains permanently reference-only.

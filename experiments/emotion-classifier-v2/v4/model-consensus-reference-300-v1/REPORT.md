# MODEL_CONSENSUS_REFERENCE_300 final report

1. **Source dataset(s):** 300 rows from the Roadtrip Nation (RTN) personal-narrative corpus released by Saldias & Roy (2020). The [official repository](https://github.com/mit-ccc/acl-nuse-personal-narratives) and [ACL paper](https://aclanthology.org/2020.nuse-1.10/) describe 10,296 clauses from 594 real-world spoken personal-narrative video transcripts.

2. **Rights/admission status:** `ADMIT_UNLABELED_REFERENCE_ONLY`. The repository explicitly releases the RTN material under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), which permits sharing and adaptation for any purpose, including commercially, with attribution and change notices. The repository states that Roadtrip Nation collected and shared the underlying data. There is no NC, research-only, academic-only, social-platform, or extra-permission condition in the released corpus terms.

3. **Why the cohort is truly untouched:** before this artifact, targeted working-tree and all-history searches found no Roadtrip Nation/RTN/Saldias/repository occurrence. The source was absent from every PetalPal training, DAPT, auxiliary, pseudo/weak, feasibility, validation/model-selection, selector/threshold, intervention-driving error-analysis, and prior multi-agent path. Exact normalized comparison against repository text values outside this artifact found zero selected-row overlap. The source was downloaded only after the rights/provenance/schema gate was likely to pass.

4. **300-row source composition:** RTN 300/300. The source corpus's original structural-classifier partition metadata is train 264, test 19, validation 17; those source partitions were not used in PetalPal selection. Post-selection narrator metadata is Male 172, Female 120, 2-Males 5, Female&Male 2, and 2-Females 1.

5. **SourceGroup counts:** 300 distinct `story_id` groups for 300 rows, exactly one selected row per group. All 300 groups are permanently reference-side for this artifact and must not be moved into training.

6. **Length median/P75/P90/max:** 182 / 243 / 284 / 300 Unicode characters; minimum 60. All 300 rows satisfy the <=300 requirement with no truncation.

7. **Exact agents/models used:** Agent A `gpt-6-astra / medium`; Agent B `gpt-5.6-sol / medium`; Agent C `gpt-5.6-luna / medium`. Each saw only `rowId`, text, Product-18 definitions, and the 0–2 output rule.

8. **3/3 exact agreement:** 106/300 = 35.33% `HIGH_CONSENSUS`.

9. **2/3 exact agreement:** 138/300 = 46.00% `MEDIUM_CONSENSUS`.

10. **Unresolved:** 56/300 = 18.67%. These rows have `consensusLabels: null`; no fourth agent or human adjudication was used.

11. **Per-label support:** resolved-consensus row support / total agent-vote support: admiration 4/30; amusement 4/17; anger 2/7; annoyance 12/45; caring 10/34; confusion 5/29; curiosity 15/65; disappointment 14/50; disgust 0/0; excitement 6/31; fear 6/26; gratitude 6/27; joy 5/37; love 7/25; optimism 8/38; remorse 3/9; sadness 7/24; surprise 5/35.

12. **0/1/2-label distribution:** among the 244 resolved rows, 128/113/3 = 52.46% / 46.31% / 1.23%. As shares of all 300 rows, these are 42.67% / 37.67% / 1.00%, with the remaining 18.67% unresolved.

13. **Suspicious agent bias/collapse:** no full label-space collapse; every agent used 17/18 labels. Three diagnostics are material: Agent A is much more conservative (69.33% empty vs. 33.67% B and 35.67% C); Agent C marks 96.67% of rows `LOW` uncertainty; and all three give zero `disgust` support. Source/selector coverage is also career-path-heavy, Male metadata is 57.33%, and the deterministic safety filter excludes some high-risk content, so this reference is not population- or Product-18-label-balanced.

14. **Files created:** `source/Saldias-Roy-RTN_data.csv`, `source-admission.json`, `prepare_reference.py`, `selection-audit.json`, `frozen-reference-300.jsonl`, `blind-input.jsonl`, `agent-a-labels.jsonl`, `agent-b-labels.jsonl`, `agent-c-labels.jsonl`, `compute_consensus.py`, `consensus.jsonl`, `summary.json`, `protocol.md`, and `REPORT.md`. `experiments/emotion-classifier-v2/ML_PROGRESS.md` was updated with the final audit result.

15. **Result:** `PASS`. No training, fine-tuning, threshold/taxonomy change, promotion experiment, or incumbent modification occurred.

16. **Required status statement:** this is `MODEL_GENERATED / WEAK_PSEUDO` reference data, **NOT human gold**.

17. **Safe for future research diagnostics:** **YES**, provided the frozen hashes, CC BY attribution/change notices, reference-side sourceGroup isolation, unresolved-row null labels, and the bias limitations above remain intact. This result alone is not production-promotion evidence.

# enISEAR Rights and Evaluation Admission Audit

Date: 2026-09-17
Scope: decide whether enISEAR may be admitted as a new, commercially compatible PetalPal training or independent-evaluation source.
Audit result: **PASS** (the audit reached a supported decision).
Dataset decision: **BLOCKED** under the updated rights-first policy.
Training decision: **DO_NOT_TRAIN unless individual text rights are externally cleared**.

## Candidate record

| Required field | Finding |
|---|---|
| Dataset name | enISEAR, from *Crowdsourcing and Validating Event-focused Emotion Corpora for German and English* |
| Official source | University of Stuttgart IMS: <https://www.ims.uni-stuttgart.de/forschung/ressourcen/korpora/deisear/> |
| Hugging Face page | None used; the authoritative university/creator release was audited directly. |
| Original source / repository | Creator download indexed at <https://www.romanklinger.de/data-sets/>; paper and supplement at <https://aclanthology.org/P19-1391/> |
| Exact license | Open Data Commons Attribution License (ODC-By) v1.0, included as `raw/deISEARenISEAR/license.txt` |
| Commercial use allowed | **UNCLEAR for the individual event-description text.** ODC-By section 3.1 explicitly permits commercial use of the database rights, but sections 2.4 and the preamble explicitly say the license does not cover independent rights in individual contents. No separate content license was found in the official release, paper, supplement, or official source pages. |
| Training allowed | **UNCLEAR.** Database use is granted, but the human-written text-content rights needed for a commercially retained training source are not expressly licensed. |
| Evaluation allowed | **UNCLEAR.** The same content-rights gap applies to retention and use as a product evaluation corpus. |
| Underlying-content concern | **YES.** The texts are original first-person event self-reports written by Figure-Eight contributors, not public-domain facts. The release exposes worker IDs and demographic/location metadata. |
| Additional permission required | **UNCLEAR.** The release does not state that the contributors granted the dataset creators a sublicensable commercial content license. Under the PetalPal gate, this uncertainty cannot be resolved by inference from public availability. |
| Domain | English first-person descriptions of personally experienced emotion-eliciting events; strong Event-like relevance, but prompt-conditioned and balanced by construction rather than a natural PetalPal distribution. |
| Approximate size | 1,001 generation rows: exactly 143 prompted rows for each of seven emotions. Local release audit finds 65 generation worker IDs. Phase 2 contains 5,005 validations (five per row) from 34 validation worker IDs. |
| Native label scheme | Anger, disgust, fear, guilt, joy, sadness, shame. Phase 1 has a prompted prior emotion; Phase 2 has five human categorical validations per description. |
| Labels human-generated | **YES.** Both the prompted self-report and Phase-2 validations are human-produced. Prompting makes the Phase-1 label non-independent of text generation. |
| Source/user grouping available | **YES.** `Worker_id` is present for generation rows and validation rows. Any future split would have to isolate the generation worker, not merely `Sentence_id`. |
| Incumbent-overlap risk | **LOW but not zero.** The existing local lineage audit reports no original-ID or normalized-text overlap with indexed historical artifacts and no enISEAR worker-ID overlap with historical author IDs. Cross-platform real-person identity cannot be established, and source-local IDs do not prove global identity separation. |
| Mapping to product 18 | **NOT DEFENSIBLE for the dataset as a whole.** Anger, disgust, fear, joy, and sadness are exact label-name/meaning matches. Guilt→remorse and shame→remorse are not exact and require subjective reinterpretation, so those rows cannot supply PetalPal product gold. The corpus also lacks 13 product labels and credible zero-label cases. |
| Final decision | **BLOCKED**. The corpus is potentially useful as human-labeled challenge data or unlabeled adaptation text, but the individual text-rights gap requires an external authoritative permission/decision. |

## Decision basis

The authoritative release is not non-commercial or research-only: ODC-By expressly grants commercial use of the **database**. That is insufficient for PetalPal's stricter gate because the same license expressly excludes independent rights in the individual contents, and the release provides no separate content license for the crowd-authored narratives. Public download, academic publication, and author-hosted distribution do not close that gap.

Even if the rights gap were later resolved, enISEAR could not be a Natural Product Evaluation: it is seven-class prompt-balanced data, contains no natural no-emotion distribution, and covers only five exact PetalPal labels. At most, a rights-cleared five-label subset could support a separately reported event-emotion challenge set. It must never be combined with a Natural Product headline score.

## Integrity actions

- No enISEAR row was admitted to a training, development, challenge, or final-evaluation artifact.
- No model inference or metric computation was run on enISEAR.
- No threshold, checkpoint, taxonomy, mapping, or evaluation membership was changed.
- The existing 915-row historical candidate pool remains a non-admitted research artifact and must not be treated as rights-cleared data.
- No licensor or contributor was contacted, consistent with the task constraint.

## Evidence consulted

- Official University of Stuttgart corpus page and creator data-set index.
- Official release `readme.txt` and full bundled ODC-By 1.0 `license.txt`.
- ACL 2019 paper and its supplementary material, which document the two-phase Figure-Eight collection and human validation procedure.
- Open Data Commons ODC-By 1.0 authoritative license text: <https://opendatacommons.org/licenses/by/1-0/>.
- Existing repository artifacts `retrieval-manifest.json`, `source-summary.json`, and `lineage-audit.json`.

This is a dataset-admission and governance conclusion, not legal advice and not a model-quality result.

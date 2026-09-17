# PHQ / Reddit-derived 468 — provenance recovery

## Classification

`DIRECT REDDIT COLLECTION PROVENANCE RECOVERED — RIGHTS UNRESOLVED`

The original workbook evidence recovers the PetalPal collection process and Reddit-linked row provenance. It does not evidence an external named dataset/corpus, and no rights conclusion is inferred.

### Revision from recovered workbook evidence

Source: `PetalPal_Public_Human_Quality_Set_Combined_625_REAL.xlsx`.

- 625 rows are `PHQ-001–525` plus `PHQ-526–625`.
- Rows preserve `Source`, `Source URL`, and `sourceGroupId`.
- Provenance markers include `VERBATIM_PUBLIC_HUMAN` and `PUBLIC_USER_WRITTEN_AS_POSTED`.
- Source records point to Reddit subreddit/post/comment URLs.
- The README records: `Every new row has its source URL`.

Accordingly, `PHQ` is an internal PetalPal row-ID prefix, not evidence of an upstream named PHQ corpus. The acquisition classification is `DIRECT REDDIT-LINKED PUBLIC-HUMAN COLLECTION`, not `IMPORTED NAMED DATASET`.

## Original acquisition-record review

The previously requested workbook names were not found in the repository, but the recovered original workbook evidence is now recorded as:

- `PetalPal_Public_Human_Quality_Set_Combined_625_REAL(1).xlsx`
- `PetalPal_Public_Human_Quality_Set_Combined_625_REVIEWED.xlsx`
- `PetalPal_PHQ326_425_progress_75.xlsx` (not found)

- recovered: `PetalPal_Public_Human_Quality_Set_Combined_625_REAL.xlsx`

No separate collection script, search-query log, model-generated acquisition log, import/download command, or named external dataset identifier was recovered. The workbook and README establish direct Reddit-linked collection provenance, while the V4 build logic consumes those already-linked records.

## Recovered lineage

`row-level Reddit URLs / PHQ-* records (earliest data artifact present locally)` → `v4/auto-v1/pass1.jsonl` → `v4/auto-v1/train.jsonl` / `dev.jsonl` → `v4/auto-v2` (29-row provenance quarantine) → `v4/auto-v3/train.jsonl` (468 rows) → `v4/aligned-supervision-v1/train.jsonl` (canonical 841; PHQ component 468 rows)`

The V4 manifests describe 625 original `PUBLIC_HUMAN` records and preserve stable IDs, source groups and source URLs. Auto-v3 records 468 Train and 125 Dev, with stable-ID deduplication, 29 provenance-quarantined rows and 3 duplicate aliases. The current canonical Train contains exactly 468 PHQ-prefixed rows; no row rewriting or label-based source identification was found in the inspected lineage artifacts.

## Earliest recoverable project-history evidence

The earliest tracked artifact establishing the V4 construction is:

- path: `experiments/emotion-classifier-v2/v4/auto-v1/build.py`
- first tracked commit: `a24b65be2bc351ada8d3f5bd8f8955d544e3f582`
- date: 2026-09-07
- author: `starstarrr`
- message: `feat: add V4 human-domain emotion experiments`

The actual 625-row input and derived JSONL files are present locally but do not have an earlier recoverable Git commit in the repository history searched. No deleted/renamed tracked source import, download script, dataset archive, Hugging Face/Kaggle/Zenodo identifier, or official upstream license artifact was found for the PHQ rows.

## Mechanical evidence

- canonical path: `v4/aligned-supervision-v1/train.jsonl`
- canonical Train rows: 841
- PHQ rows: 468
- PHQ `sourceType`: `PUBLIC_HUMAN` for all 468
- distinct `sourceGroupId`: 135
- Reddit source identifiers: `reddit:<submission id>`
- row-level source URLs: present; URL values are Reddit URLs
- HUMAN_CONSENTED mixed into PHQ component: not found
- CoSoWELL mixed into PHQ component: not found
- representative schema: `id`, `journal`, `sourceType`, `sourceGroupId`, `provenance.sourceUrl`, annotation fields
- canonical Train SHA-256 at audit time: `daaf3ed65a72ece0e0421225b1fde863b4d8c686507a07da16167702526e013a`

The schema fingerprint supports “Reddit-linked public human text” but does not identify a named corpus. The internal `PHQ` prefix is not evidence that the rows came from a dataset named PHQ, nor does it establish that all rows share one upstream source. Multiple Reddit source groups are present; a single common upstream corpus is not demonstrated.

The best acquisition classification is `DIRECT REDDIT-LINKED PUBLIC-HUMAN COLLECTION`, not `IMPORTED NAMED DATASET`. `PHQ is an internal PetalPal row prefix, not evidence of an upstream named corpus.`

### Representative row audit

These rows are sampled mechanically from the locked canonical PHQ component. Their earliest recoverable project artifact is the locally present row lineage represented by `v4/auto-v1/pass1.jsonl`; no earlier acquisition artifact is present in project history. No row-level source note beyond the Reddit URL/provenance fields was found.

| PHQ ID | Reddit domain/subreddit | sourceGroup | earliest acquisition artifact | source note |
|---|---|---|---|---|
| PHQ-001 | reddit.com/r/Journaling | reddit:1q1rsj0 | `v4/auto-v1/pass1.jsonl` (local; no earlier Git data ancestor) | none |
| PHQ-050 | reddit.com/r/gratitude | reddit:1ucr1v3 | same | none |
| PHQ-115 | reddit.com/r/Journaling | reddit:1uiph3w | same | none |
| PHQ-167 | reddit.com/r/MadeMeSmile | reddit:1k9zkgf | same | none |
| PHQ-211 | reddit.com/r/offmychest | reddit:xk712f | same | none |
| PHQ-256 | reddit.com/r/Casualconversation | reddit:1ist8nz | same | none |
| PHQ-299 | reddit.com/r/AskReddit | reddit:ow51s2 | same | none |
| PHQ-350 | reddit.com/r/Journaling | reddit:1od5r6l | same | none |
| PHQ-412 | reddit.com/r/Journaling | reddit:1vleawe | same | none |
| PHQ-469 | reddit.com/r/Casualconversation | reddit:1ue1vfy | same | none |
| PHQ-517 | reddit.com/r/gratitude | reddit:k90gi4 | same | none |
| PHQ-569 | np.reddit.com/r/Lahore | reddit:1qa3et9 | same | none |

## Rights status

No official dataset license, repository terms, or rights grant was recovered alongside the PHQ rows. Reddit URLs and the workbook establish provenance only. Research, ML training, fine-tuning, product development, commercial use, attribution, and redistribution status remain `UNVERIFIED`.

Current status remains `BLOCKER`. The 468-row lineage cannot currently be made production-rights-clean from existing provenance evidence.

## Missing evidence

An authoritative source export/import record is needed that maps the PHQ IDs or original row IDs to an exact upstream corpus name, curator/organization, repository or dataset identifier, version/snapshot, and official license/terms covering the intended uses. The original 625-row source workbook/archive or its acquisition manifest would be the most direct missing evidence.

No training, evaluation, data modification, annotation, protected-content access, or license inference was performed.

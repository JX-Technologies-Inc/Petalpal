# PHQ / Reddit-derived canonical 468 — Rights Trace

## Final classification

**SOURCE / LINEAGE UNRESOLVED**

The repository identifies these rows as `PUBLIC_HUMAN`, with IDs `PHQ-*` and source groups of the form `reddit:<submission id>`. That establishes a Reddit-derived representation, but does not establish an upstream dataset/corpus name, curator, license, or commercial permission.

## Findings

- Exact row count: **468**; 135 preserved source groups.
- Current canonical path: `v4/auto-v3` final core public Train component → locked `v4/aligned-supervision-v1/train.jsonl` → canonical 841, where the other components are CoSoWELL 319 and HUMAN_CONSENTED 54.
- No HUMAN_CONSENTED or CoSoWELL rows are mixed into this 468-row component.
- Row IDs, sourceGroupIds, and Reddit URLs are preserved. The repository does not record a named upstream corpus, version/snapshot, repository, paper, dataset card, or license file for this component.
- The `PHQ` prefix is an internal naming convention, not evidence that the rows came from a dataset named PHQ.
- No license was inferred from Reddit provenance. Research, ML training, fine-tuning, product development, commercial use, attribution, and redistribution terms are **UNVERIFIED**.

## Rights decision

Current severity remains **BLOCKER**. The blocker cannot be removed from repo-local evidence. The exact upstream source and official rights terms require clarification; no data was downloaded or modified in this audit.

Machine-readable details: `phq-reddit-rights-audit.json`.

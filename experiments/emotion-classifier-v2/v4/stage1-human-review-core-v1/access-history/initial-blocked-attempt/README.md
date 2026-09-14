# Human Review 221 — Stage 1 Core/Auxiliary Audit

Status: **BLOCKED_INPUT_ACCESS**, 2026-09-14. This is an incomplete audit directory, not completed analysis.

The two specified Core files exist according to filesystem metadata. The operating system denied reading Reviewer 1 with `Operation not permitted`; Reviewer 2 contents were not attempted after that denial. Desktop directory listing was also denied. The specified Auxiliary ZIP was not found at its supplied path. No input contents, judgments, hashes, or statistics have been obtained.

`protocol.json` records the user's current Stage 1-only rules, including the permanent Reviewer 2 validity boundary. `input-audit.json` records the exact access failures. `core-data-audit.json` distinguishes user-supplied expectations from checks that have not run.

Stage 2 and Stage 3 are deprecated. Evidence, rank_order, and tie_group are legacy unused fields, not missing work. No ratings have been imputed, changed, adjudicated, or combined into gold. No reviewer has been weighted or automatically excluded. No training, protected-data access, commit, or push was performed.

Analysis requires readable copies of the exact two specified clean Core files and the actual Auxiliary ZIP. Do not substitute older experiment files or raw exports. Resume this incomplete directory once the input access is resolved, preserving this access-failure record. No completed agreement or Auxiliary QC files are claimed. Canonical ML_PROGRESS.md has not been updated because the analysis has not completed.

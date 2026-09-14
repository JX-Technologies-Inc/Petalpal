# PetalPal 221 Human Review — Auxiliary Reviewers (Stage 1 Final)

- Core reviewers remain separate: Xingran + partner.
- These 8 source files are 8 different human auxiliary reviewers.
- ALL 8 auxiliary reviewers have completed **Stage 1 only**.
- Every per-reviewer CSV uses the same 8-column schema as the core files:
  `sample_id, text, label, label_definition, applicability, evidence, rank_order, tie_group`
- Because only Stage 1 is complete, `evidence`, `rank_order`, and `tie_group` are intentionally blank in every normalized auxiliary file.
- AUX-R06 has 36 missing applicability judgments; use only its nonblank Stage 1 rows.
- AUX-R08 has an anomalous Stage 1 distribution (3977/3978 are CLEAR or PLAUSIBLE); preserve it for audit, but exclude it from default agreement/adjudication unless manually validated.

Recommended use now:
1. Keep Xingran + partner as the two CORE reviewers.
2. Compare core Stage 1 applicability first.
3. Use AUX-R01–R07 as independent Stage 1 support (R06 only where nonblank).
4. Do not let auxiliary majority automatically override the core.
5. Keep AUX-R08 quarantined unless its reviewer confirms the instructions were understood.
6. When Stage 2/3 is actually completed later, fill the existing blank columns rather than treating current values as completed.

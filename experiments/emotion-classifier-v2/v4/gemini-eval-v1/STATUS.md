# Current status

- Reference `LOCKED`: A300/300, B300/300, exact agreement219, disagreement/adjudication81/81, invalid0, included300, leakage audit PASS.
- One-time fixed `v4f-fixed-blend` baseline COMPLETE: selected18 Macro-F1 `0.3411390456`, Micro precision/recall/F1 `0.6982248521 / 0.3480825959 / 0.4645669291`. No tuning used this evaluation.
- Bounded internal `gemini-improvement-v1` ASL round COMPLETE and REJECTED. On isolated661 Train/180 Dev, epoch0 Macro-F1 `.459329`; epochs1/2 `.491064/.508348`, but Micro precision `.449495/.454106` failed the fixed `.50` guard. Gemini evaluation was not loaded.
- Current bottleneck: independently adjudicated supervision alignment and rare-label coverage. Repeating loss/threshold/selector relaxation on current labels has low expected information value.
- Zero-cost follow-ups complete: original macro AP `.6214`/oracle diagnostic `.6632`; OOF per-label calibration `.4404` REJECT; saved Hybrid V2 Clean `.4094` REJECT; fixed original+ASL 50/50 blend `.4779` with Micro-P `.5400` retained only for further development.
- Next proposed development step requires paid Gemini A/B annotation/adjudication of841 existing human-written Train rows plus149 pre-reserved author-disjoint Dev rows (about293 standard API calls, conservatively `$2–$8 USD`). Paused for explicit budget authorization. The opened300 reference remains immutable and prohibited from model selection; no candidate inference should be repeated on it during development.
- No final-holdout creation or evaluation is authorized. Production routing is unchanged.

This evaluation must be called **human-written, Gemini-annotated / Gemini-adjudicated evaluation**, never human-gold or human-labeled.

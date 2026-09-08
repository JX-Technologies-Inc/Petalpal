# Independent human narrative acquisition — 2026-09-07

This is an unfinished development-data acquisition, not a new benchmark result.
The previous 125-row Dev and its 0.5606315771 result are retired from additional model selection.
No Frozen-3 is created. Protected historical sets enter only the text/source exclusion firewall.

## Source decisions

- **CoSoWELL v1 — primary candidate.** Author-released https://osf.io/x4s28/ linked by https://akkyro.gitlab.io/project/cosowell/ . Collection method: https://doi.org/10.3758/s13428-022-01926-0 . Actual typed narratives by North American adults aged 55+, with participant IDs and repeated testing sessions. Select only `yesterday`, not imagined future events or the picture-description control (`cookie`). Original `narrative` strings are copied verbatim from the token-level archive; no reconstruction from tokens, paraphrase, translation or synthetic text. 7,975 distinct documents; 1,994 yesterday documents across 1,178 authors. Age/pandemic-period/source bias remains; this is not a population-representative PetalPal cohort. OSF license metadata says “Other” and refers to a license.txt absent from the inspected root and v1 folder listings; the article's CC BY license is not assumed to cover the dataset. Public research release verified; commercial redistribution/deployment permission not established.
- **CoSoWELL v2 — discovered, not merged.** https://osf.io/jguw3/ and https://doi.org/10.1016/j.dib.2025.111682 . Includes repeated participants from v1; never treat releases as independent sources. No license relationship returned by node API. Do not add it across splits without participant linkage.
- **HappyDB — downloaded, not admitted to Train/Dev.** https://github.com/megagonlabs/HappyDB . 101,094 raw records in original_hm.csv (different from the paper's cleaned total). Retains worker IDs and original human strings. Prompt explicitly requests happy events; unsuitable as sole natural-distribution validation. No forced positive-emotion balancing. License not explicitly established from inspected repository README.
- **Dreaddit — downloaded, not admitted to Train/Dev.** Author download https://www.cs.columbia.edu/~eturcan/data/dreaddit.zip linked from https://www.cs.columbia.edu/~eturcan/ ; paper https://aclanthology.org/D19-6213/ . 2,838 + 715 released text segments, post_id and sentence_range retained in raw snapshot. Author IDs absent, fragments and stress-domain selection limit independent daily-journal validation. Released stress labels are not PetalPal emotion labels.
- **COVID-19 ToM diaries — rejected for this English cohort.** https://github.com/humanfactorspsych/covid19-tom-empathy-diary . Korean sentence data, full Train restricted to verified institutions, CC BY-NC-SA. Translating would not preserve original English human-written text.
- **ISEAR — not acquired.** Elicited specific emotional experiences; cannot simply remap its original narrow emotion labels or use targeted sampling to manufacture coverage.
- **EmpatheticDialogues / GoEmotions — not new independent validation.** Already part of historical work or model initialization; retain as existing provenance references, not as a substitute for authentic journal validation.

## Label-blind candidate selection

20–400 whitespace words, at least one first-person reference; retain complete text. One document per author selected by deterministic document-ID hash. Exclude normalized historical/init-corpus overlaps, lexical cosine >= .8 (char 3–5 grams), then semantic cosine >= .85 using existing MiniLM. Author hash assigns 30% Dev and 70% Train without labels or student predictions. Do not resample to repair rare-emotion support. Exact/lexical scans use full text; semantic embedding max512 tokens is a documented limitation.

Before semantic filtering: 769 Train / 370 Dev, with no shared author. These are candidates, not automatically trainingEligible. Emotion annotations, contextual quality review and audit completion are still required. AI annotation must never be called human-gold; absent observed Primary remains null. No student inference, new threshold selection, training or new Macro-F1 result has occurred.

## Completed cohort and pilot checkpoint

Acquisition/semantic audit and Dev adjudication are complete; the earlier candidate-status paragraphs above describe the acquisition stage. Final Dev is367 authors, locked before model predictions. Fixed previous-candidate Macro-F1 is.253547 on this cohort; old125 remains.560632 and retired. Pilot uses255 new Train authors plus522 existing rows and64 separate calibration authors. One copied article excluded from pilot; one copied language-instruction narrative excluded from Dev. Same-assistant AI labels are not independent or human-gold. See `dev-lock.json`, `pilot-data/manifest.json`, and the latest `ML_PROGRESS.md` for current training state.

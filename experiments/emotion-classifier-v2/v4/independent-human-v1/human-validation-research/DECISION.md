# Human-labeled validation prerequisite — 2026-09-07

The CoSoWELL367 reference is assistant-labeled, not independent human gold. A result on it cannot satisfy the user's human-labeled acceptance criterion. Do not relabel it after inspecting model scores.

## New source reviewed once: EduAffect

Primary paper: https://link.springer.com/article/10.1007/s44217-026-02098-1
Author release: https://www.kaggle.com/datasets/adomaacheampong/the-eduaffect-dataset
API download (version2): https://www.kaggle.com/api/v1/datasets/download/adomaacheampong/the-eduaffect-dataset?datasetVersionNumber=2

The paper describes seven student annotators assigning one dominant emotion per entry, with expert review. Texts concern Ghanaian university experiences, including English/Twi and preprocessing/translation. This is human annotation, but does not enumerate co-occurring labels required by PetalPal's multilabel target. The paper reports2,423 entries and CC BY4.0; the actual version2 CSV has2,422 data rows and the Kaggle API reports CC BY-NC4.0. Do not infer commercial permission from the paper. DOI redirect returned404; the author API download succeeded.

Observed CSV columns: Texts, Emotion_Label, Entry_ID. No author/source-post identifier fields. ZIP SHA256:39d1786e1a7d84c0d92be2963f22b2f769ba4ddf9d50bab8ca9a578140f363aa.

Disposition: acquired and quarantined; no training, label remapping, model inference, or score-based filtering. Never split this source into Train/validation by random rows. Single-dominant-label scoring would be a different benchmark and cannot silently replace the existing18-label/0–2-output contract. Missing author linkage prevents claiming verified author disjointness. Do not repeat this acquisition/search.

## Other newly surfaced sources — triage only

- ANAD v1: https://pmc.ncbi.nlm.nih.gov/articles/PMC12996999/ — search metadata describes derived sentiment features, not human categorical emotion gold; not acquired.
- Narrative Dialogue Dataset: https://www.nature.com/articles/s41597-026-06891-3 — abstract identifies synthetic/model-annotated data; not acquired.
- CR4-NarrEmote: https://aclanthology.org/2025.emnlp-main.493/ — literary narrative passages/open-vocabulary annotations; not promoted as personal journal gold.

## Next prerequisite

Obtain independent human multilabel annotations under the existing taxonomy on a genuinely held-out human-written cohort, with author linkage and frozen exclusions. A paid annotation job or messages to annotators have not been authorized; none was placed or sent. AI annotations or independent AI agents are not a substitute. New model work can proceed internally, but human-labeled target certification is blocked until a suitable reference is available.

# Public human-written source shortlist

Research date: 2026-09-10. No new dataset was added to Train and no model was trained. The shortlist was designed only from current Train counts and the locked taxonomy; legal Dev text/errors and opened Gemini-300 were not accessed.

Current Train weak labels: curiosity 8, anger 14, confusion 15, admiration 18, disgust 24, excitement 24, remorse 24, surprise 29, caring 34, love 36, fear 39.

## 1. GoEmotions — recommend first

- Official source: [Google Research GoEmotions](https://github.com/google-research/google-research/tree/master/goemotions); paper: [Demszky et al., 2020](https://arxiv.org/abs/2005.00547).
- Human-written: yes, Reddit comments; human-labeled: yes, 27 emotions + neutral, with an agreement-filtered train split of 43,410 examples from 58,009 comments.
- Coverage: direct labels for admiration, anger, confusion, curiosity, disgust, excitement, remorse, surprise, and the other mapped taxonomy labels; no forced semantic remapping for these weak labels.
- PetalPal fit: natural short-form everyday language, but less journal-like than CoSoWELL/PHQ. The 30-token maximum also limits long-context transfer.
- Provenance: official data retains comment ID, author, subreddit, link/parent IDs, timestamps, rater IDs, and unclear-example flags, enabling source-level and author-level filtering.
- License/usage: official repository includes data/model-card guidance; Reddit content and redistribution/use constraints must be rechecked before admission. Do not assume an unrestricted commercial license.
- Leakage risk: Reddit overlaps the existing PHQ-family public source domain may be possible; admission requires deterministic ID, normalized/exact text, near-duplicate, and author/subreddit/source audit against current Train and the sealed legal Dev, with no Dev text inspection. Do not reuse any existing GoEmotions rows if provenance audit finds overlap.
- High-value yield: approximately 43k raw agreement-filtered rows, but after taxonomy mapping, overlap removal, length/quality filters, and a conservative per-author cap, a realistic first tranche is **1,000–5,000** rows; rare-label yield must be measured from metadata before inclusion.

## 2. ISEAR — recommend as a small personal-experience supplement, pending rights audit

- Official/research provenance: [Swiss Center for Affective Sciences / ISEAR research materials](https://www.unige.ch/cisa/); commonly cited survey paper: [Scherer & Wallbott, 1994](https://doi.org/10.1007/BF00282083).
- Human-written: yes, first-person emotion-antecedent episodes collected from roughly 3,000 participants; human-labeled: yes, one dominant emotion among seven categories; commonly reported total is about 7,666 entries.
- Coverage: anger, disgust, fear, joy, sadness, guilt, shame. Direct mappings are strong for anger/disgust/fear/joy/sadness; guilt is only a cautious proxy for remorse, and shame should not be silently mapped to remorse without a predeclared policy. No curiosity/confusion/admiration/excitement coverage.
- PetalPal fit: strongest journaling/personal-experience fit among candidates, but single-dominant labels do not express PetalPal's 0–2 multilabel semantics.
- Provenance: common downloadable mirrors do not reliably preserve persistent author IDs; source-level author disjointness is therefore uncertain.
- License/usage: official current download/permission terms were not located reliably; third-party mirrors are not sufficient for admission. **Do not add until rights, canonical release, and author linkage are resolved.**
- High-value yield: at most roughly **5,000–7,600** usable text rows in principle, but only a smaller subset should be admitted after rights, duplicate, and mapping audits.

## 3. DailyDialog — conditional, lower priority

- Official paper/source: [DailyDialog paper](https://arxiv.org/abs/1710.03957) and [author dataset page](https://yanran.li/dailydialog).
- Human-written/labeled: manually labelled multi-turn daily-life dialogues; approximately 13,118 dialogues (about 11,118 train, 1,000 validation, 1,000 test). Seven coarse emotion labels: anger, disgust, fear, happiness, sadness, surprise, and no-emotion.
- Coverage: direct/near-direct anger, disgust, fear, sadness, surprise, and happiness→joy. No reliable curiosity, confusion, admiration, remorse, or excitement.
- PetalPal fit: everyday language, but dialogue turns are not private journaling and labels are single coarse utterance-level classes. It would mostly add common-label negatives/examples rather than the missing boundaries.
- Provenance/license: official download exists, but redistribution and author identity/author-level linkage are not clearly documented on the source page. Treat as research-only pending rights review.
- High-value yield: approximately **10,000–11,000** train dialogues, but expected high-value PetalPal additions are only **1,000–3,000** after context handling and quality filtering. Recommend only if GoEmotions/ISEAR coverage is insufficient.

## 4. EmotionLines / MELD — not recommended for this Train

- Sources: [EmotionLines](https://github.com/declare-lab/conv-emotion) and [MELD](https://github.com/declare-lab/conv-emotion/tree/master/MELD).
- Human-written/labeled: human-authored conversational utterances with human emotion annotations; mostly Friends TV transcripts plus Twitter/dialogue material, with roughly seven coarse labels.
- Coverage: anger, disgust, fear, joy, sadness, surprise and related common labels; no dependable curiosity/confusion/admiration/remorse boundary coverage.
- PetalPal fit: poor. Scripted/performative conversation and context-dependent turn labels differ materially from standalone personal journaling. Author/source isolation and redistribution terms are also less suitable than GoEmotions.
- Recommendation: **do not use** except as a separately justified conversation-modeling study.

## 5. EmpatheticDialogues — already assessed; do not prioritize again

- Official source: [Facebook Research EmpatheticDialogues](https://github.com/facebookresearch/EmpatheticDialogues), [official archive](https://dl.fbaipublicfiles.com/parlai/empatheticdialogues/empatheticdialogues.tar.gz), CC BY-NC 4.0.
- Human-written: yes; emotion-situation labels: yes; about 25k conversations and 76,673 train utterance records in the official train split.
- Coverage/mapping: useful for anger, admiration, disgust, excitement, remorse, fear, surprise and several common labels, but mostly single context labels requiring remapping.
- Existing evidence: the bounded 444-row, 444-author augmentation passed exact/normalized overlap audits but reduced legal-Dev Macro-F1 from the `.331812` current best to `.323889`/`.312497`. It is therefore **not a higher-quality next source for this task** without a new, independently justified curation rule.

## Recommendation

1. First qualify a **small, auditable GoEmotions tranche** (target 1,000–5,000 rows), prioritizing direct weak-label coverage and retaining author/comment provenance.
2. In parallel, investigate canonical ISEAR rights and author metadata; admit only a small anger/disgust/fear/joy/sadness supplement if those checks pass, and keep guilt/shame mapping conservative.
3. Keep DailyDialog as a lower-priority common-label source; do not add EmotionLines/MELD or repeat EmpatheticDialogues now.

No data was added, no Dev/Gemini content was used for design, and no training/model selection was run.

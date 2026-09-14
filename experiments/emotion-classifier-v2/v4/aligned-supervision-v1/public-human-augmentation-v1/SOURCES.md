# Public human-written Train augmentation sources

Acquisition date: 2026-09-10

## EmpatheticDialogues

- Publisher: Facebook Research / Meta Research.
- Official repository: https://github.com/facebookresearch/EmpatheticDialogues
- Paper: https://arxiv.org/abs/1811.00207
- Official archive: https://dl.fbaipublicfiles.com/parlai/empatheticdialogues/empatheticdialogues.tar.gz
- Repository description: approximately 25,000 conversations grounded in emotional situations.
- License in official repository: Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0).
- Intended use here: research-only bounded experiment; no production or redistribution decision.
- Admission boundary: only the publisher-provided `train.csv`; use each conversation's human-written situation prompt once, never dialogue reactions, validation, or test rows.
- Provenance fields retained: source dataset/split, conversation ID, situation author/speaker ID, original emotion label, archive hash, and acquisition date.

Other source families were not admitted: DailyDialog has only seven coarse labels and scripted two-party dialogue rather than personal situations; EmotionLines is dialogue/TV-script oriented; ISEAR access/licensing and author linkage are insufficient for this bounded run. EduAffect remains quarantined under the prior decision because it lacks author linkage and includes translated/preprocessed single-label student text.

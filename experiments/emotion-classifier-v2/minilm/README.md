# Candidate B — all-MiniLM-L6-v2 + One-vs-Rest

This directory is isolated from both production and the frozen TF-IDF baseline.

- Encoder: `sentence-transformers/all-MiniLM-L6-v2`
- Encoder weights remain frozen; no transformer fine-tuning is performed.
- Classifier: One-vs-Rest Logistic Regression over 384-dimensional embeddings.
- Labels, official GoEmotions splits, dev threshold selection, error analysis, and Garden Mood mapping are imported from the Phase 1 TF-IDF experiment to ensure a fair comparison.

`neutral`, `confusion`, and `surprise` remain unmapped. No legacy PetalPal training data is loaded.

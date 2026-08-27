# PetalPal Emotion Classifier V2 — Phase 1

This is an isolated experiment. It does not import or modify the production Natural Bayes classifier, Daily Grow routing, Cloudflare Worker, frontend, Prisma schema, or legacy PetalPal training data.

## Data

Only the official GoEmotions `train.tsv`, `dev.tsv`, `test.tsv`, and `emotions.txt` files are used. Official splits remain unchanged. Multi-label rows are represented as independent binary targets.

## Baseline

- Word TF-IDF (1–2 grams)
- One-vs-Rest Logistic Regression
- Per-label decision thresholds selected on the official dev split by best F1
- Final metrics reported once on the official test split

`neutral` is evaluated as a fine-grained output and is never mapped to `Peaceful Bloom`. `surprise` and `confusion` remain unmapped during the Garden Mood evaluation so their behavior can be analyzed rather than forced.

Run:

```bash
python scripts/train_evaluate.py \
  --goemotions-dir /Users/xingranma/google-research/goemotions/data \
  --output-dir .
```

The experiment intentionally stops after the TF-IDF baseline. No transformer or LLM is trained.

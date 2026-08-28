# Candidate C — pretrained GoEmotions Transformer

This is an isolated experiment. It does not modify production inference, Candidate A,
Candidate B, the Flower Engine, Cloudflare Worker, Prisma, or the frontend.

Checkpoint: `SamLowe/roberta-base-go_emotions` (multi-label RoBERTa fine-tuned on
GoEmotions). Evaluation uses Candidate A's same 21 labels, official dev/test splits,
per-label dev threshold selection, and Garden Mood mapping.

Run from this directory:

```bash
python scripts/evaluate_transformer.py \
  --goemotions-dir /Users/xingranma/google-research/goemotions/data \
  --output-dir . \
  --baseline-metrics ../metrics.json
```

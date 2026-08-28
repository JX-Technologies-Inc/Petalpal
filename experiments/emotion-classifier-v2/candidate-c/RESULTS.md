# Candidate C results and decision

Candidate C uses `SamLowe/roberta-base-go_emotions`, a multi-label RoBERTa-base
checkpoint already fine-tuned on GoEmotions. No Transformer was trained by this
experiment. The checkpoint's 28 outputs are projected onto Candidate A's exact 21
labels. Thresholds are selected independently per label on the official dev split;
the official test split is used once for the final comparison.

## Aggregate comparison

| Metric | Candidate A | Candidate C | Difference |
|---|---:|---:|---:|
| Macro-F1 | 0.506177 | 0.573226 | +0.067049 |
| Micro-F1 | 0.549516 | 0.619073 | +0.069557 |
| Garden Mood micro-F1 | 0.680929 | 0.757580 | +0.076651 |
| Garden supported-mood macro-F1 | 0.595781 | 0.692449 | +0.096668 |
| CPU median latency (single text) | 1.0697 ms | 54.5907 ms | +53.5210 ms |
| CPU p95 latency (single text) | 1.2582 ms | 59.3793 ms | +58.1211 ms |
| Artifact size | 9.2505 MiB | 480.1851 MiB | +470.9346 MiB |
| Approx. process RSS after inference | 152.97 MiB | 633.78 MiB | +480.81 MiB |

Candidate C was measured on CPU with one Torch thread and 200 warmed-up single-text
requests. Its approximate RSS is a process-level measurement and includes Python,
PyTorch, Transformers, tokenizer state, model weights, and inference buffers.

## Candidate C test metrics

- Macro precision: 0.550963
- Macro recall: 0.616283
- Macro-F1: 0.573226
- Micro precision: 0.565799
- Micro recall: 0.683422
- Micro-F1: 0.619073
- Test samples: 5,228 (identical filtered official test split used by Candidate A)

The largest F1 gains over Candidate A are `surprise` (+0.180273), `curiosity`
(+0.175618), `caring` (+0.131825), `approval` (+0.127588), `disapproval`
(+0.114407), and `disappointment` (+0.110163). Candidate C declines on `optimism`
(-0.064101) and is essentially unchanged on `remorse` (-0.005491).

## Product mapping

The Garden Mood mapping is copied unchanged from Candidate A. `confusion`, `surprise`,
and `neutral` remain unmapped. The production Flower Variant filtering rule that
excludes `neutral`, `approval`, and `disapproval` is not changed or bypassed by this
experiment. No new mood taxonomy was created.

## Deployment assessment

The semantic improvement is real and broad: 19 of 21 labels improve in F1, Macro-F1
rises by 6.7 points, and Garden Mood micro-F1 rises by 7.7 points. However, the model
is approximately 52 times larger and single-text CPU inference is approximately 51
times slower than Candidate A. A default small Render instance would also need to
accommodate roughly 634 MiB process RSS before application/database overhead.

Recommendation: **retain Candidate A as the deployment default/cheap first layer for
now**. Candidate C is accuracy-superior and is worth keeping as a high-quality
candidate, but it should not replace Candidate A until deployment memory, cold-start,
concurrency, and cost are tested on the actual hosting tier. Quantization or an
optimized ONNX runtime could change that tradeoff, but those are outside this
experiment and were not attempted.

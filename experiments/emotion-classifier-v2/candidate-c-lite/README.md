# Candidate C-Lite — ONNX Runtime INT8

Independent experiment converting Candidate C (`SamLowe/roberta-base-go_emotions`)
to ONNX FP32 and ONNX Runtime dynamic INT8. Candidate A, B, C and production are not
modified.

The experiment reuses Candidate C's exact 21-label projection, dev-selected per-label
thresholds, Garden Mood mapping, and the same 5,228 filtered official test samples.

Experiment environment: Python 3.12, PyTorch 2.11.0, Transformers 4.57.6,
ONNX 1.19.1, and ONNX Runtime 1.22.1.

```bash
python scripts/run_experiment.py \
  --goemotions-dir /Users/xingranma/google-research/goemotions/data \
  --candidate-c-dir ../candidate-c \
  --output-dir .
```

`run_experiment.py` skips export or quantization when the validated artifact already
exists, so an interrupted evaluation can resume without rebuilding the models.

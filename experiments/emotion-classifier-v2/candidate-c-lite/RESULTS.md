# Candidate C-Lite results

Candidate C-Lite successfully exports `SamLowe/roberta-base-go_emotions` to ONNX
opset 17 and applies ONNX Runtime per-channel dynamic QInt8 weight quantization.
Candidate A, B, original C, and production are unchanged.

## Accuracy

| Metric | A | C PyTorch FP32 | ONNX FP32 | ONNX INT8 |
|---|---:|---:|---:|---:|
| Macro-F1 | 0.506177 | 0.573226 | 0.573226 | 0.573398 |
| Micro-F1 | 0.549516 | 0.619073 | 0.619073 | 0.618650 |
| Garden Mood micro-F1 | 0.680929 | 0.757580 | 0.757580 | 0.756672 |
| Supported Garden Mood Macro-F1 | 0.595781 | 0.692449 | 0.692449 | 0.691424 |

ONNX FP32 has zero thresholded decision disagreements versus PyTorch FP32 over all
5,228 test samples. INT8 changes 0.541954% of label decisions and at least one label
on 10.48202% of samples, but aggregate accuracy is effectively preserved. Relative
to PyTorch, INT8 Macro-F1 changes by +0.000172, Micro-F1 by -0.000423, Garden Mood
micro-F1 by -0.000908, and supported Garden Mood Macro-F1 by -0.001025.

## Consistent clean-process CPU benchmark

All four runtimes use the same first 200 filtered test samples, ten warm-ups,
single-text calls, one inference thread, and separate clean Python processes on
macOS 13.3 ARM64.

| Metric | A | C PyTorch FP32 | ONNX FP32 | ONNX INT8 |
|---|---:|---:|---:|---:|
| Median latency | 1.0430 ms | 55.9173 ms | 62.6403 ms | 47.1351 ms |
| P95 latency | 1.1279 ms | 67.4154 ms | 109.3668 ms | 81.1852 ms |
| Model file | 9.2505 MiB | 475.5905 MiB | 475.7992 MiB | 120.0635 MiB |
| Process RSS after inference | 163.80 MiB | 510.20 MiB | 832.14 MiB | 669.14 MiB |
| Incremental RSS | 133.52 MiB | 479.83 MiB | 802.09 MiB | 639.81 MiB |

INT8 reduces the ONNX model file by 74.7659%. Versus PyTorch FP32, median latency
improves by 15.71%, but P95 is 20.42% worse and process RSS is 31.15% higher on this
Apple Silicon environment. Versus ONNX FP32, INT8 improves both median and P95 and
uses less RAM, but ONNX FP32 itself is worse than PyTorch here.

## Decision

Accuracy preservation and size reduction pass. Local RAM reduction and tail-latency
criteria versus PyTorch do not pass, so Candidate C-Lite is **not yet marked as a
production candidate**. It is worth a Render Linux/x86 benchmark because ONNX Runtime
INT8 kernels, memory mapping, allocator behavior, and CPU instruction support are
platform-specific. Production remains unchanged.

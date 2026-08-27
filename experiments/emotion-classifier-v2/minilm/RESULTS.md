# Candidate B results and decision

Frozen `sentence-transformers/all-MiniLM-L6-v2` embeddings plus the same One-vs-Rest Logistic Regression setup did not improve this task.

| Metric | TF-IDF | MiniLM | Difference |
|---|---:|---:|---:|
| Macro-F1 | 0.506177 | 0.413176 | -0.093001 |
| Micro-F1 | 0.549516 | 0.461068 | -0.088448 |
| Garden Mood micro-F1 | 0.680929 | 0.623985 | -0.056944 |
| Garden supported-mood macro-F1 | 0.595781 | 0.537551 | -0.058230 |
| CPU median latency | 1.0697 ms | 10.5435 ms | +9.4738 ms |
| CPU p95 latency | 1.2582 ms | 11.8858 ms | +10.6276 ms |
| Artifact size | 9.2505 MiB | 87.6298 MiB | +78.3793 MiB |
| Incremental RSS after inference | 136.2188 MiB | 398.7812 MiB | +262.5624 MiB |
| Pipeline training time | 25.0128 s | 259.8293 s | +234.8165 s |

Only `caring` improved at aggregate label F1 (+0.025576). Every other label declined. MiniLM corrected individual keyword-driven TF-IDF errors—for example, some false gratitude predictions triggered by “thank you” in negative contexts and some confusion predictions triggered by “not sure”—but introduced more errors overall.

The largest F1 declines were fear (-0.211106), surprise (-0.166170), joy (-0.165552), optimism (-0.160783), remorse (-0.154032), confusion (-0.152077), love (-0.151462), and gratitude (-0.141197). The hardest MiniLM labels remain disappointment (0.171761), confusion (0.236273), annoyance (0.275449), surprise (0.276074), and disapproval (0.276892).

Decision: the frozen MiniLM embedding approach is not worth its approximately 9.5× artifact size, 2.9× incremental process memory, and 9.9× median latency because accuracy decreased rather than improved. It should not replace TF-IDF or production. The experiment stops here without training another model.

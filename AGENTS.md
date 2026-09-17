## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Engineering constraints

- Prefer the simplest correct implementation; do not over-engineer.
- Do not add new hashes, checksums, manifests, fingerprints, or provenance/integrity infrastructure unless explicitly required for correctness, security, or an existing protocol.
- Reuse existing required validation mechanisms when necessary; do not expand them without a concrete requirement.
- Repo truth > docs > prior chat. Do not infer completion without executable evidence.

## Scope Control

- Implement only what is required for the current task.
- Do not add adjacent features, abstractions, refactors, optimizations, or infrastructure unless they are required to make the current task correct.
- If a useful improvement is discovered but is not required for the current task, record it as a future note instead of implementing it.
- Prefer modifying existing files and abstractions over creating new systems.
- Stop once the requested behavior is implemented and the relevant tests pass.

## Stable emotion-system invariants

- Keep the user-selected Primary Garden Mood separate from secondary-emotion classification: ML must not override the user's Primary.
- Canonical Primaries are `SUNNY_BLOOM`, `GENTLE_BLOOM`, `QUIET_BLOOM`, `HEALING_BLOOM`, `FIRE_BLOOM`, `WONDER_BLOOM`, `DRIFTING_BLOOM`, and `PEACEFUL_BLOOM`.
- Primary-redundant secondary labels are: Sunny→`joy`, Gentle→`caring`, Quiet→`sadness`, Fire→`anger`, Wonder→`curiosity`, Drifting→`confusion`; Healing and Peaceful have none.
- The V2 classifier taxonomy is `admiration`, `amusement`, `anger`, `annoyance`, `approval`, `caring`, `confusion`, `curiosity`, `disappointment`, `disapproval`, `disgust`, `excitement`, `fear`, `gratitude`, `joy`, `love`, `neutral`, `optimism`, `remorse`, `sadness`, and `surprise`.
- Flower Variant output is limited to 0–2 non-redundant secondary emotions. `neutral`, `approval`, and `disapproval` are classifier labels but never Flower Variant outputs; empty, neutral, ambiguous, or entirely Primary-redundant journals should abstain.
- The frozen 100-example in-domain final evaluation set must not be used for training, tuning, few-shot prompts, synthetic imitation, or preprocessing optimization, and must remain leakage-free. Use it only for explicitly authorized final evaluation.
- Candidate C-Lite and the 21-label V2 pipeline are experimental and are not connected to production until an explicit integration task changes that boundary.

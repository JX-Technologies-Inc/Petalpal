# Current status

- Protocol locked before cohort selection and candidate inference: SHA-256 `47a3173a7193e537ad7c1fad2a21a45adf386fa83d1fa6b661358f0ec1e3f7ea`.
- Blind cohort locked at 300 new, unique CoSoWELL authors disjoint from all 320 pilot-selected authors: SHA-256 `ccb7bb53c74327aba6299a13c47acd105992f0c01181b75be995ca99874b27d9`.
- Gemini pass A (`gemini-3.6-flash`): 72/300 persisted and schema-validated; paused after repeated temporary 503 high-demand responses.
- Gemini pass B (`gemini-3.5-flash`): 136/300 persisted and schema-validated; blocked by the free-tier daily request limit of 20 (HTTP 429).
- Adjudication has not started because both passes must be complete.
- Final labels and `lock.json` do not yet exist.
- Candidate inference has not occurred and remains gated.
- Resume commands are idempotent: each pass skips already persisted ids.

This evaluation must be called **human-written, Gemini-annotated / Gemini-adjudicated evaluation**, never human-gold or human-labeled.

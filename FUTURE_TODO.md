# Future TODO

Only confirmed deferred work is listed here.

- **ML real-journal domain adaptation:** Wait for real PetalPal journals and human annotations, then run domain adaptation/fine-tuning and an independent frozen evaluation before considering production integration.
- **Flower Asset expansion:** Add approved assets for the documented species currently missing from `flowerDB`, then extend canonical mood mappings without changing the Flower Engine algorithm unnecessarily.
- **User Profile i18n:** Add complete language/locale preferences and use them consistently for localized UI and generated content.
- **Multi-instance rate limiting:** Replace the in-process rate-limit store with a shared store when Render runs multiple instances or limits must survive restarts.
- **Daily Grow Fast LLM fallback:** Remove the default low-confidence Fast LLM emotion fallback; the classifier should abstain when secondary-emotion confidence is insufficient.
- **Month 2 pgvector/RAG:** Implement embeddings, pgvector-backed retrieval, and RAG only as part of the Month 2 memory work.

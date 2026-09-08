# Future TODO

Only confirmed deferred work is listed here.

## Deferred — ML / Gemini Direction

- **User Profile i18n:** Wait for the multilingual ML strategy, then add complete language/locale preferences and use them consistently for localized UI and generated content.
- **ML real-journal domain adaptation:** Wait for real PetalPal journals and human annotations, then run domain adaptation/fine-tuning and an independent frozen evaluation before considering production integration.
- **Daily Grow Fast LLM fallback adjustment:** Wait for the current ML/Gemini architecture decision, then remove the default low-confidence Fast LLM emotion fallback; the classifier should abstain when secondary-emotion confidence is insufficient. The superseded Fast / Low-cost LLM proposal does not require adding or retaining a separate Fast LLM.

## Month 2+ — Product / AI

- **Flower Asset expansion:** Add approved assets for the documented species currently missing from `flowerDB`, then extend canonical mood mappings without changing the Flower Engine algorithm unnecessarily.
- **Month 2 pgvector/RAG:** Implement embeddings, pgvector-backed retrieval, and RAG only as part of the Month 2 memory work.
- **RBAC:** Defer until the first admin-only moderation/report review endpoint exists. Then add a trusted `USER`/`ADMIN` role, expose it as `req.auth.role`, enforce it with `requireAdmin` middleware, and test ordinary-user `403`, admin success, and that clients cannot alter their own role.

## Future Infrastructure / Security Hardening

- **Multi-instance rate limiting:** Replace the in-process rate-limit store with a shared store when Render runs multiple instances or limits must survive restarts.
- **Turnstile / bot challenges:** Add only when public abuse patterns or launch requirements justify browser challenges; it is not part of the Month 1 internal-beta baseline.
- **Automated IP blocking:** Defer automated reputation feeds, denylists, and escalating bans until there is operational evidence and an appeal/unblock process.
- **Mobile SSL pinning:** Evaluate with the production mobile client and certificate-rotation plan; do not pin the Month 1 web/internal-beta client.
- **Full security observability:** Centralized redacted audit events, alerting, dashboards, retention policy, and incident automation belong to later production hardening. Month 1 keeps minimal sanitized operational logging.

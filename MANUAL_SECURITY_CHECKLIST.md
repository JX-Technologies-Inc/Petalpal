# Manual Security Checklist

Provider and production-control-plane actions only. Never record passwords,
tokens, keys, credential-bearing URLs, or full secret fingerprints here.

## 1. Database / Prisma provider

- [ ] Verify the historical `DATABASE_URL` credential is revoked. Evidence: provider confirmation or non-secret credential status. Status: `ACTION REQUIRED`
- [x] Confirm the current Render `DATABASE_URL` differs from the historical credential. Evidence: provider-side comparison result without recording values. Status: `PASS`
- [ ] If revocation cannot be confirmed, rotate the current database credential. Evidence: rotation timestamp and deployment confirmation, without secret values. Status: `ACTION REQUIRED`
- [ ] AuditEvent Level 2: separate migration/admin and runtime database roles. Evidence: non-secret role/grant review. Status: `PROVIDER-LIMITED / NOT VERIFIED`; current runtime and migration share `DATABASE_URL`, and a pooled/direct URL pair alone does not create role separation.
- [ ] AuditEvent Level 2: grant the runtime role AuditEvent INSERT-only access. Evidence: non-secret grant review. Status: `PROVIDER-LIMITED / NOT VERIFIED`; INSERT-only grants were not verified.
- [ ] AuditEvent Level 2: revoke AuditEvent UPDATE, DELETE, and TRUNCATE privileges. Evidence: non-secret grant review. Status: `PROVIDER-LIMITED / NOT VERIFIED`
- [ ] AuditEvent Level 2: ensure the runtime role cannot ALTER, DROP, or grant database privileges. Evidence: non-secret role-capability review. Status: `PROVIDER-LIMITED / NOT VERIFIED`

## 2. GitHub

- [x] Enable or check MFA/passkey protection. Evidence: both repositories and account checked; MFA/passkey complete. Status: `PASS`
- [x] Review organization and repository members. Evidence: dated review of both repositories; no unexpected collaborator found. Status: `PASS`
- [x] Remove unnecessary access. Evidence: review found no unnecessary access; intended permissions retained. Status: `PASS`
- [x] Check Secret Scanning. Evidence: Secret Protection enabled in both repositories. Status: `PASS`
- [x] Check Push Protection. Evidence: Push Protection enabled in both repositories. Status: `PASS`
- [x] Review PAT and deploy credentials. Evidence: credential review completed; no further non-secret action recorded. Status: `PASS`
- [x] Verify branch and release protection if applicable. Evidence: repository security controls reviewed; no additional finding recorded. Status: `PASS`

## 3. Render

- [x] Review environment secrets. Evidence: production secrets confirmed as Render environment variables; no unexpected Secret Files. Status: `PASS`
- [ ] Verify no historical `DATABASE_URL` remains. Evidence: provider-side secret review without recording values. Status: `ACTION REQUIRED`
- [x] Verify `/api-docs/` is not explicitly enabled in production unless intentional. Evidence: `API_DOCS_ENABLED=true` absent from production environment. Status: `PASS`
- [x] Review members and permissions. Evidence: no unexpected workspace team member found. Status: `PASS`
- [x] Verify production/development separation. Evidence: current production configuration reviewed; no additional workspace finding recorded. Status: `PASS`
- [ ] Configure relevant Render monitoring, alerting, and retention where available. Evidence: non-secret configuration summary. Status: `PARTIAL / PLAN-LIMITED`

## 4. Cloudflare

- [x] Verify the current Worker shared secret. Evidence: synchronized Worker/backend contract verified without recording values. Status: `PASS`
- [x] Verify Render backend and Worker use the synchronized current secret. Evidence: deployment configuration and runtime contract confirmed without values. Status: `PASS`
- [ ] Rotate the Worker shared secret if uncertain. Evidence: rotation timestamp and deployment confirmation. Status: `NOT CHECKED`
- [x] Review account members and MFA. Evidence: one intended human member; 2FA active. Status: `PASS`
- [x] Review Worker logs, errors, timeouts, and AI usage monitoring. Evidence: Workers Logs, invocation logs, and persistence enabled; live invocation observed; traces intentionally disabled. Status: `PASS`
- [x] Review production/development separation. Evidence: Worker identity and account configuration reviewed. Status: `PASS`

## 5. Firebase / Google

- [x] Review Firebase Admin credential inventory. Evidence: two service accounts reviewed; active Admin key inventory recorded without key material. Status: `PASS`
- [x] Remove unused service-account keys. Evidence: old Firebase Admin key revoked/removed; Gemini service account had zero keys. Status: `PASS`
- [x] Verify MFA/passkey protection on administrator accounts. Evidence: Firebase project administrator review completed. Status: `PASS`
- [x] Review project members and permissions. Evidence: only intended Firebase human member found. Status: `PASS`
- [x] Verify Firebase Web config is treated as public, not secret. Evidence: configuration classification review. Status: `PASS`
- [ ] Review authentication abuse and security visibility where available. Evidence: non-secret monitoring configuration summary. Status: `ACTION REQUIRED`

## 6. Backup / Restore

- [x] Verify database backups exist. Evidence: automated backup status `COMPLETED`. Status: `PASS`
- [ ] Verify encryption and retention where supported. Evidence: non-secret provider settings. Status: `PARTIAL / NOT FULLY VERIFIED`
- [ ] Verify backup credentials and access are appropriately restricted. Evidence: non-secret access review. Status: `PARTIAL / NOT FULLY VERIFIED`
- [x] Perform an isolated restore drill before launch. Evidence: restored to new isolated database; production was not overwritten; schema/data verified; temporary database deleted. Status: `PASS`
- [x] Record only non-secret evidence. Evidence: checklist review contains no credentials or secret values. Status: `PASS`

## 7. AI provider / data handling

- [x] Verify Workers AI Customer Content training/data-use policy. Evidence: Cloudflare states Customer Content is not used to train Workers AI models or improve Cloudflare/third-party services without explicit consent. Status: `PASS`
- [x] Verify applicable Cloudflare DPA. Evidence: Customer DPA v6.4 effective 2026-04-03; processor/subprocessor terms limit processing to service provision and prohibit marketing/advertising use of personal data. Status: `PASS`
- [ ] Record ordinary Workers AI inference retention. Evidence: official documentation does not specify a general retention period for ordinary prompts/outputs; Customer Content may be stored when a Cloudflare storage service is specifically used. Status: `PARTIAL / EXACT INFERENCE RETENTION NOT SPECIFIED`
- [ ] Verify data residency and subprocessors. Evidence: published subprocessors include US and England operations; no Canada-only or single-region guarantee is configured. Status: `NOT VERIFIED / OPTIONAL HARDENING`
- [x] Verify Workers Logs configuration. Evidence: Workers Logs, invocation logs, and persistence enabled; live invocation observed; traces intentionally disabled; Free-plan retention documented as 3 days. Status: `PASS`
- [ ] Do not place private configuration values in this checklist. Evidence: final checklist review. Status: `NOT CHECKED / PASS / ACTION REQUIRED`

## 8. Final Security P0 closure

Repo Security P0 code work: `COMPLETE`. No remaining repo-level P0 blocker.

Provider/manual unresolved:

- Historical `DATABASE_URL` revocation proof: `ACTION REQUIRED / UNCERTAIN`; the old endpoint was unreachable, so neither revoked nor still-valid is claimed.
- Database runtime/migration role separation and grants: `PROVIDER-LIMITED / NOT VERIFIED`; AuditEvent Level 2 is not a repo P0 blocker.

Optional/compliance hardening:

- Exact Workers AI inference retention duration remains unspecified.
- Regional/data-residency requirements remain optional unless PetalPal later requires them.
- Plan-limited provider controls remain `PARTIAL / PROVIDER-LIMITED`; no plan upgrade is a P0 requirement.

## 9. Final global checkpoint

- Repository P0 code status: `PASS`; true remaining repo P0 blockers: `NONE`.
- GitHub: `PASS`; Render: `PARTIAL / PLAN-LIMITED`; Cloudflare: `PASS`; Firebase/Google: `PASS`.
- Backup/restore: `PARTIAL` (backup existence and isolated restore drill PASS; provider retention/encryption/access metadata not fully verified).
- Workers AI data handling/DPA: `PASS`; inference retention: `PARTIAL / EXACT INFERENCE RETENTION NOT SPECIFIED`; data residency: `NOT VERIFIED / OPTIONAL HARDENING`.
- AuditEvent Level 1: `PASS`; Level 2: `PROVIDER-LIMITED / NOT VERIFIED`.
- Historical `DATABASE_URL`: `ACTION REQUIRED / UNCERTAIN`.
- Final Security P0 classification: `P0 CLOSED WITH DOCUMENTED LIMITATIONS`.

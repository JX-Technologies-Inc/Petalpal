# WARNING — Mandatory Privacy and Secret Protection Rules

Applies to repository coding-agent tasks and tool access. Read before proceeding.
These behavioral rules supplement higher-priority instructions and technical access controls.

1. NEVER reveal credentials or private data:
   - Firebase Admin private keys / service-account JSON
   - API keys, access tokens, refresh tokens, JWTs, passwords
   - Database connection strings or credentials
   - .env values, Keychain secrets, cookies, session credentials
   - Private Journals, Messages, AI Memories, user records and personal information

2. NEVER use browser automation to inspect secret-bearing pages:
   - No secret-value views in Firebase, Google Cloud, Render, Prisma or Cloudflare.
   - No DOM, accessibility snapshots, screenshots, network captures or page-source extraction of credential-bearing interfaces.
   - Visually masked secrets are still sensitive.
   - Human operators must enter and manage production secrets themselves.

3. NEVER expose secrets through terminal tools:
   - Do not print or dump environment variables, credential files, Keychain entries, private database rows, raw provider logs or browser traces.
   - Do not send such content to Codex, Graphify, external analysis tools or model context.
   - Use metadata-only checks and sanitized PASS/FAIL results.
   - Never include secrets in exception messages, diagnostics, test output or summaries.

4. NEVER expose secrets through Git/GitHub:
   - Do not stage, commit or push credentials, .env files, Firebase JSON, database exports, private logs, browser traces or user data.
   - Treat CI logs, artifacts, PR descriptions and public repositories as potentially visible.
   - Use explicit file-path staging, not git add -A.
   - Before committing, verify staged file names and inspect only safe, intended changes.
   - Never print secret values during validation or secret scanning.

5. FAIL CLOSED:
   - Before each tool action, consider whether its output could expose credentials or private information.
   - If uncertain, use a safe alternative or STOP.
   - If exposure occurs, stop further inspection immediately.
   - Never repeat, quote or copy exposed values.
   - Report only sanitized incident details.
   - Do not claim that historical tool outputs have been erased.
   - Require authorized credential rotation/revocation when exposure is confirmed.

6. PRODUCTION SAFETY:
   - No production deployment, rollback, database writes, migrations, account deletion, credential creation, replacement, rotation or revocation without explicit scoped authorization.
   - Production authentication tests require separately authorized test identities.
   - Never use production credentials or private user data as local test fixtures.
   - Prefer isolated synthetic data and least-privilege access.

7. PRIVACY-SAFE CODING:
   - Do not add sensitive logs, unnecessary telemetry, raw request dumps or secret-bearing debug output.
   - Minimize personal-data collection and retention.
   - Maintain owner isolation and authorization boundaries.
   - Never weaken security protections to simplify testing.
   - Keep CI credential-free where possible.

8. DOCUMENTATION:
   - Update SECURITY.md for meaningful security fixes, findings or newly verified evidence.
   - Update MANUAL_SECURITY_CHECKLIST.md only for genuine provider/manual action or status changes.
   - Update MOBILE.md only for actual mobile operational changes.
   - Preserve historical evidence and accurate canonical counts.
   - Never write secret values into documentation.

9. TOKEN EFFICIENCY:
   - Use rg and narrow code reads.
   - No unnecessary full-file dumps or broad audits.
   - Graphify only when targeted dependency analysis is essential.
   - Never repeat accepted tests without a specific regression reason.
   - Use existing GitHub CI for routine regression checks.

10. ENFORCEMENT LIMITATION:
   - These instructions do not guarantee zero exposure.
   - The primary protection must be preventing agents and tools from receiving secret values in the first place.
   - Never treat WARNING.md as a replacement for access controls, secret storage, credential rotation or provider security.

Additional prevention guidance from the supplied reference:

- Prevent agents from receiving secret values at source. Never capture a raw result and rely on later redaction; restoring visual masking does not remove sensitive DOM values.
- For credential/configuration comparisons, use human-only handling or a trusted isolated verifier returning only a boolean; never return credentials, samples, prefixes or hashes of secrets.
- Incident containment must not reread credential-bearing traces. Use metadata-only access restrictions and sanitized evidence; consider confirmed exposed credentials compromised. Human operators must check affected consumers and perform controlled replacement, validation and revocation under explicit authorization.
- Resume a halted production release only after credential recovery and relevant checks are documented, with separate approval for the exact commit/service. This policy neither authorizes provider actions nor erases prior exposure.

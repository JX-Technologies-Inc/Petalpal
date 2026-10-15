# PetalPal release readiness — local candidate

Date: 2026-10-15. Primary: Apple iOS; secondary: Google Play Android.
Base: verified remote main `ba867045c0c044a25b04e99dee93c53f10351506`.
PR #59 head `933200a648193f88fc6e210ba8834d68c300f19e`; PR #60 head `993dae8ff75e1e689375c14ab5ce9f3aa9077374`, verified with `git ls-remote` before work. Neither is assumed deployed. Existing checkouts and PRs are untouched. A malformed shared local ref prevented fetching, so this worktree uses a separate bare Git store. No push, deployment, paid inference or production data access.

## Policy sources (reviewed 2026-10-15)

- [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/): 1.2 filtering/reporting/blocking/contact; 1.4 physical harm; 2.1 complete working submission; 5.1 privacy, consent and deletion; 5.2 licensed assets.
- [Google UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en): acceptance before publication and ongoing moderation.
- [Google AI content](https://support.google.com/googleplay/android-developer/answer/13985936): in-app output reporting.
- [Google account deletion](https://support.google.com/googleplay/android-developer/answer/13327111): in-app and external request path.
- [Google User Data](https://support.google.com/googleplay/android-developer/answer/10144311): accurate disclosure, affirmative consent and secure handling.

## A — Reporting and blocking

IMPLEMENTED: persistent directional UserBlock rows; either direction denies social contact. Only the blocker can unblock. Block removes both friendship directions and pending requests, evicts Garden sockets, filters social responses and leaves private owner access intact. Pair locks serialize block, friendship acceptance, friend requests and Garden writes. Unblock does not restore friendship. Reports accept structured user/message references and reasons only; message visibility is checked. No Journal/Event text or reporter identity is sent to the reported user. Serialized per-reporter dedup and 20 new reports/day cap. Moderator routes use authenticated verified Firebase identities plus a server-only UID allowlist, expose no reporter identity, and allow message removal and social-account restriction/restoration.

Evidence: `test/back/release-readiness.test.js`, `mobile/test/releaseReadiness.test.mjs`, migrations. TESTED: isolated PostgreSQL migrations plus actual Express/Socket.IO A/B/C paths: 2/2; UI component/API harness: 28/28 including existing detail cases; TypeScript noEmit passed. Signed native accessibility remains NOT VERIFIED. Commit: `139938e` (see final evidence index).

Operator: configure moderator allowlist, assign daily queue ownership and urgent escalation coverage; confirm contact inbox; native VoiceOver/TalkBack and real device testing NOT VERIFIED. Existing clients should refresh Garden data after revocation; previously delivered content cannot be recalled from another person's device.

## B — Social content screening and acceptance

IMPLEMENTED: backend screening of Flower messages and profile publication, including avatar strings; client-supplied visitor display text no longer overrides the stored avatar. Versioned Community Guidelines acceptance is explicit in onboarding and before messages, persisted server-side, and required before publication. Existing users can accept in Friends or Settings. PR #59 reuse was reviewed by scoped diff: only the independently authored v1.2 module, its test and policy document plus the specific Event/Daily Grow/Journal validation hooks were adopted. No cherry-pick, unrelated routing changes or PR #60 dependency. Owner-scoped historical Event retries remain compatible. Social-only rules supplement private reflection rules. No third-party dictionaries or external moderation service.

Policy: Apple 1.2, Google UGC. Deterministic coverage is bounded; this is not comprehensive semantic moderation. Human reports/moderation remain required. Test evidence: candidate bilingual/Unicode/benign-context tests and real API side-effect assertions. Commit recorded below. Publication of Guidelines needs owner review.

## C — AI privacy and reporting

IMPLEMENTED / TESTED: onboarding no longer grants AI through the insufficient old disclosure. Settings provides non-prechecked Processing, Personalization and Memory controls, named processors/configured-feature status, explicit version on grant and withdrawal. Migration revokes historical grants and cancels pending/running jobs; original content is retained. Existing epoch, cost reservation and worker/source fences remain, and the Workers AI emotion final write now shares the source/consent fence. Speech rechecks immediately before dispatch and after response; recording requires prior disclosed consent. Journal text/photos never enter Event Memory or Reflection, but optional voice composition is external transcription and is clearly disclosed. In-app Reflection/Event-emotion reporting stores reference/reason only, validates ownership, and routes metadata to moderators without full private content.

Policy: Apple 5.1 and Google User Data/AI content. No new processor, routing, budget or secret changes. Provider retention/regional settings and current contractual protections require owner verification; no no-training/zero-retention claims. Already dispatched requests cannot be recalled. A processor or materially different use requires new owner approval and consent version.

Evidence: integrated PostgreSQL/API 4/4; consent/worker/Haiku/speech focused regression 32/32; TypeScript and UI harness. Initial migration used the Prisma model name instead of mapped `AIJob` table; corrected and applied successfully to a fresh disposable database before PASS.

## D — Deletion

IMPLEMENTED / TESTED: Settings has a prominent destructive confirmation and existing five-minute recent-authentication requirement. PostgreSQL erasure and a durable identity-deletion record commit together; Firebase deletion follows with idempotent recovery. Database failures roll back all relational work. Identity failures return pending, clear local account-controlled caches and leave a retry task; they do not restore private data. A database trigger serializes account creation/relink with deletion and rejects old-UID resurrection. Owner-scoped cascades remove Journals/photos, Events, memories, vectors, evidence, jobs, social content, blocks and applicable reports; unrelated owners remain. Non-cascading security/cost and deletion records are explicitly retained.

Policy: Apple 5.1.1(v), Google deletion/User Data. Evidence: disposable real PostgreSQL with all migrations, actual DELETE API, vector cleanup and partial failures (integrated 5/5); updated deletion regressions 2/2. Initial vector test omitted the required GENERATED state/timestamp; fixed without weakening constraints. Signed-device cache erasure remains NOT VERIFIED.

External resource: `docs/release/account-deletion.html` opens a deletion-request email without reinstalling the app. NOT PUBLISHED; inbox delivery, identity verification/recovery process, retention limits, backup restoration exclusions and provider erasure must be approved/tested. `DELETION_OPERATIONS.md` includes the bounded operator retry command. No production identity was created/deleted.

## E — Policies and disclosures

DRAFTS IMPLEMENTED; PUBLICATION BLOCKED. `docs/release/POLICY_DRAFTS.md` contains Privacy, Terms, Community, Deletion, AI Sharing and Support documents, English with selected Simplified Chinese summaries. `STORE_PRIVACY_WORKSHEETS.md` maps actual fields/flows to Apple/Google questionnaires; `AUDIENCE_PERMISSIONS_RIGHTS.md` covers audience, permissions and commercial rights. In-app privacy/support is reachable from onboarding and Settings, with configurable public links and safe missing-link/error states. TypeScript passed. Final legal review, deployed-data reconciliation, working URLs, seller identity, audience decision, retention schedules and asset/SDK rights remain human blockers. Owner confirmed draft brand PetalPal/Jastrevia and proposed `contact@jastrevia.com`; delivery remains unverified. Legal publisher: [LEGAL PUBLISHER NAME — OWNER CONFIRMATION REQUIRED]. Internal “JX Technology Inc.” is not evidence of incorporation. No address, registration number or legal jurisdiction is asserted.

## F — Emotional safety

IMPLEMENTED / TESTED within bounded coverage: supportive, nonblocking local guidance for explicit current danger in Event/Journal composition; always-visible emergency-service boundary; no location guess or emergency-monitoring promise. Emotion suggestions and Reflection UI state the non-diagnostic boundary and offer AI reporting. Existing grounded validation/closed output contracts are preserved; report prompts exclude treatment, clinical-authority and outcome guarantees. Ordinary sadness, anxiety, trauma disclosure and help-seeking remain permitted.

Policy: Apple 1.4; relevant Google restricted/AI content requirements. Evidence: `mobile/test/emotionalSafety.test.mjs` 2/2 plus v1.2 synthetic bilingual coverage 7/7; TypeScript. Clinical/legal positioning, real-device presentation and complete language/risk coverage NOT VERIFIED. See `EMOTIONAL_SAFETY.md`.

## G — Build and review

IMPLEMENTED: dynamic Expo release identity/build configuration, production environment validation, preview/store EAS profiles, accurate microphone copy, reproducible isolated export/regression tools, dependency license collection, and App Store/Play checklists plus review-notes draft. Store IDs and public policy URLs must be owner-verified values; none was invented. The existing Expo account/project/slug/scheme is preserved pending ownership/callback confirmation. No dependencies or lockfiles changed.

TESTED: source TypeScript, release configuration guard, production route policy, and iOS/Android/web JavaScript export with synthetic configuration. These are compilation checks, not native signed distributions. Full Xcode is absent; Command Line Tools cannot produce a signed iOS archive. Android signing/install acceptance is also NOT VERIFIED. Current Expo template icon/splash is a branding blocker; actual device navigation, VoiceOver/TalkBack, privacy manifests/merged permissions, performance/crash profiling, signing, URLs and live Firebase/API configuration remain NOT VERIFIED. See `docs/release/STORE_SUBMISSION_CHECKLIST.md` for exact operator steps, current official SDK/API requirements and review notes. No guarantee of store approval.

### Checkpoint evidence

- G / final integration: `4ea40fd` — release configuration, integrated safety corrections, 255/255 regressions, 34/34 independent PostgreSQL race tests, 5/5 migrated PostgreSQL/pgvector scenarios, 7/7 HTTP security tests, TypeScript and final iOS/Android/web JavaScript export.

- A: `139938e` — PostgreSQL/Express/Socket.IO 2/2; UI harness 28/28; TypeScript passed. Initial fixture omission (required Flower coordinates) and UI mock assumption (DELETE/PUT without body) were corrected; these were not production passes.
- B: `f1ae5f2` — reused content-safety suite 7/7, integrated PostgreSQL/API A+B 3/3; TypeScript passed. Initial selective reuse omitted the Event helper hook; corrected before PASS.

- C: `d82f2e5` — evidence above. No unauthorized external network calls in isolated API tests.

- D: `a31e2d8` — PostgreSQL integration 5/5 and deletion contract 2/2. Added final social raw-message filtering and in-flight user-room revocation fences found during integration.

- E: `58d0ddb` — source-backed drafts and TypeScript validation; legal sufficiency, public URL delivery and store questionnaire answers NOT VERIFIED.

- F: `b3dfd3a` — local risk/benign UI policy 2/2, TypeScript passed.

## Final integrated evidence and limits

- Final impact-based regression: **255/255 passed**, zero failed/cancelled/skipped. Includes backend Journal isolation, Event/AI cost, consent/worker/source fences, prompt injection, safe logging, request/ownership boundaries, deletion/realtime/social payloads; mobile auth/session/cache, routes, report/block, consent, community acceptance, deletion confirmation and emotional guidance. See `scripts/release-regression.mjs` and the exact invocation in `docs/release/TEST_EVIDENCE.md`.
- Independent PostgreSQL social race suite: **34/34 passed**, 43 loopback requests, zero external attempts. Existing fixture updated for the new block table and accepted Community version; lock/deadlock/rollback assertions retained.
- Final fully migrated PostgreSQL/pgvector API/Socket.IO suite: **5/5 passed**, zero external attempts. Includes A/B/C identities, report privacy/moderator removal/restrictions, blocked access and session filtering, rejected-publication side effects, versioned AI consent/epoch, owner report references, actual erasure/vector cleanup, unrelated-owner preservation, recent auth, Firebase failure/retry, rollback and identity anti-resurrection.
- New privacy UI controls: **4/4 passed** (also included in 255). Signed-native screen rendering and accessibility remain unverified.
- TypeScript noEmit and diff whitespace checks passed. Build-configuration guard passed. No package/lockfile, model route or AI budget changes.
- Initial combined run: 189 passed, 25 failed, 5 cancelled. Failures exposed outdated fixtures for the new block/deletion queries, added public author ID, new onboarding child modules, and pre-existing cache-erasure behavior. HTTP static-content testing initially lacked the generated web build and still expected the legacy SVG favicon; the test now exercises Expo’s emitted ICO while preserving all header assertions. Fixtures/expectations were updated without removing security assertions; the final evidence supersedes only those runs, not historical production/device evidence. A first unrestricted Metro attempt was stopped during startup to bound resource use; the limited-worker export completed.
- Integration review added block filtering to session and support/message responses, paginated the unblock list, made blocked profile reads return safe 403, and allowed AI withdrawal even when disclosure loading fails. These corrections are in the final integration checkpoint.
- Production dependency metadata collection: 1,242 entries; 38 missing/undeclared license metadata, 191 without a top-level notice file. Local unreviewed notices are available under ignored `release-artifacts/`. This is not commercial-rights clearance.

### Remaining release gates

All source changes and drafts are local and reviewable. Overall **NOT READY for store submission**. Owner must confirm legal seller, audience/regions, support delivery, licensed final assets, retention/processor terms and deployment configuration; authorize and verify policy/support/deletion publication and staffed moderation/deletion operations; coordinate migrations/client rollout; and complete signed-device/store-console validation. No requirement is marked PASS solely because a draft or deterministic filter exists. The historical 67-item security backlog is not an automatic prerequisite that every item become VERIFIED; assess relevant release risks individually.

The consent migration revokes historical grants and cancels old pending/running jobs. It leaves historical derived rows behind denied consent reads; using the withdrawal/Memory-off control deletes those derived rows. Review retention and migration behavior before rollout. Original Event/Journal data remains unless the owner deletes it. Already-dispatched provider requests and other people's copies cannot be recalled.

- Final HTTP security regression after isolated web export: **7/7 passed** (public caching, authenticated/private no-store, CSP/HSTS, CORS and Socket.IO transport). No native runtime equivalence is inferred.
- Final iOS/Android/web export rerun: exit 0 for all platforms, after the last mobile edits. Scratch bundles used synthetic configuration and were removed after verification; no distributable release artifact was produced.

## Release decision table

READY/NOT READY below means readiness for store release, not whether the local code is reviewable.

| Workstream | Implemented | Tested | Manual actions | Remaining blockers | Decision |
|---|---|---|---|---|---|
| A Reporting/blocking | Yes | API/socket/UI harness; PostgreSQL races | Assign moderators, verify contact and native UX | Staffed operation and device acceptance unverified | NOT READY |
| B UGC moderation | Yes | Bilingual/Unicode/benign tests; API publication checks | Approve/publish Guidelines, coordinate acceptance rollout | Legal publication and operating coverage | NOT READY |
| C AI consent/privacy | Yes | Grants/withdrawal, worker epochs, output reporting, UI | Verify actual deployed processors/contracts and re-consent rollout | Provider retention/regions and deployed behavior unverified | NOT READY |
| D Deletion | Yes; external resource draft | Real DB/vector erasure, rollback, retry and UI | Publish/test external path; staff retry/inbox; approve retention | Public path, residual retention and signed cache QA | NOT READY |
| E Policies/disclosures | Six drafts and questionnaires | Source reconciliation | Confirm publisher, ages/regions, legal review, publish | Legal identity, rights, public URLs/inbox | NOT READY |
| F Emotional safety | Yes, bounded supportive guidance | Synthetic risk/benign tests and UI source | Review final positioning/languages and device presentation | Final audience/copy/native acceptance | NOT READY |
| G Native/store readiness | Config/tools/checklists | TypeScript, route guards, all-platform JS export | Final assets, signing, device matrix and console review | No signed archive/AAB or real-device acceptance | NOT READY |

## Unified integration follow-up — 2026-10-15

New isolated worktree: `/Users/xingranma/Documents/ChatGPT/jev/petalpal-release-candidate-integration`, branch `codex/release-candidate-integration`, based on exact candidate `7fa0a81557cca6c61e8805783f7e9f71a2e4c9b2`. Remote main and PR heads were reverified as `ba867045c0c044a25b04e99dee93c53f10351506`, #59 `933200a648193f88fc6e210ba8834d68c300f19e`, #60 `993dae8ff75e1e689375c14ab5ce9f3aa9077374`. The original candidate was clean and remains unchanged. This is selective local integration; no branch merge, push, PR modification, production action or store submission occurred.

All six reviewed conflicts are reconciled: server.js keeps screening hooks once plus admission ordering; ai-jobs/daily-flower-input keep their equivalent existing hooks; content-safety.md retains #59 and the social extension; SECURITY.md preserves all three histories; Daily Grow combines both PR fixture repairs and current block/user delegates without removing assertions. Missing #59 route tests/notices/CI selections are included. #60's rate-limit implementation, CPU optimization and dedicated rate/admission tests remain byte-identical to its pinned head.

The two social defects are corrected: support/visit/move/leave publish screened stored profiles instead of request avatar overrides, with versioned Community acceptance; HTTP lists and realtime deliveries filter blocked identities, and empty notifications from blocked records are suppressed. /leave uses pair locks and transactional writes. Privacy/friendship-revoked users retain a cleanup-only exit with empty data and no record/broadcast; blocked/restricted users cannot publish a departure. Failed transactions do not broadcast success. Original legacy mood-analysis and deletion handlers are preserved verbatim.

The four original migration files are unchanged. An additional, necessary `202610150005_ai_disclosure_grant_guard` migration atomically retires invalid enabled grants/jobs and adds a version constraint, rejecting the old server's unversioned regrant writes. Current-version grants and deletion tombstones/identity protections are preserved. [Rollout contract](release/INTEGRATION_ROLLOUT.md) requires closed ingress/executors and stopped old API/workers before migration; a mixed-version rolling deployment is not supported. Actual production drainage, backup/recovery and rollout remain NOT VERIFIED.

Local evidence for this follow-up:

- Focused Daily Grow/Event/Journal/admission/rate/Garden tests: **36/36 passed**. Daily Grow's seven subtests plus parent pass with assertions preserved.
- Auth and persisted Support fixture verification: **17/17 passed**; rollback, uniqueness, restart and original concurrency assertions retained.
- Consent, deletion, realtime and HTTP baseline: **36/36 passed**.
- Upgraded real PostgreSQL/pgvector: **3/3 passed** with old/current disclosure grants, null/stale/current Community states, Journal/Event/vector memory, pending/running jobs, cost tombstones and pending/completed deletion records. Legacy server grant transactions fail atomically; the new API rejects unversioned/stale grants, accepts current explicit consent, and permits withdrawal.
- Fresh Prisma migration/API/socket/deletion integration: **6/6 passed**, including override attempts, acceptance denial, A/B/C filtered HTTP/socket responses, cleanup-only exit and injected leave rollback. External network is forbidden by the test harness.
- Independent PostgreSQL lock/race suite: **34/34 passed**, 43 loopback requests and zero external attempts.
- CI contract: **6/6 passed**. Isolated DAST: **17/17 passed**, 261 loopback requests, zero external attempts/unexpected DB calls.
- Final affected security runner: **exit 0, 233/233 reported test executions across 23 subprocess summaries**, zero failures/cancellations/skips, including DAST 261 loopback requests with zero external attempts/unexpected DB calls. Completed on the already-installed Node 24.19 runtime with adjacent existing npm assembled temporarily; original 90-second subprocess limits retained.
- Syntax and whitespace checks passed. No dependencies, lockfiles, model routing/budgets, mobile code or Garden/Fairy assets/rendering were changed. Unchanged mobile TypeScript/export/rendering evidence is reused; no native signed build/device claim is added.

Temporary logs are `/tmp/petalpal-integration-{focused,fixtures,consent-final,upgrade,social,atomic,ci-contract,dast,security-complete}.log`. Initial integration runs exposed missing current-model fixture delegates, the known bundled-Node adjacent-npm prerequisite and a disposable PostgreSQL initialization readiness race. Fixtures were completed without weakening assertions; the runner now waits for the final TCP server. Installed Node 24.19 and existing npm were assembled temporarily for the original security-runner limits; no dependency installation/upgrade or timeout relaxation was used.

CodeQL review: exact #60 head's [findings check](https://github.com/JX-Technologies-Inc/Petalpal/runs/116621516518) is FAILURE with two High findings (#29/#30), despite successful managed analysis and regression jobs. Admission still precedes Firebase/profile work on speech/photo routes and general authenticated APIs; synthetic tests prove rejected admission causes no verifier/profile/database work. This supports the preserved likely-false-positive evidence, but an independent authorized reviewer must decide the disposition; neither finding was dismissed/suppressed and no failed check was bypassed. A unified-head hosted analysis cannot be claimed before separately authorized publication. See `security.go.md`.

All earlier store/production blockers remain: legal seller, verified inbox and public support/policy/deletion URLs, retention/provider/audience decisions, licensed final assets, moderation/deletion staffing, proxy/threshold/instance acceptance, signed native builds and device/accessibility/performance validation. This follow-up does not change the store-submission NO-GO table above.

Integration decision: **GO for publishing a Draft integration PR for independent review**, with the failed #60 CodeQL findings and absent unified-head hosted checks explicitly disclosed. This is **NO-GO for merge, production rollout or App Store submission** until applicable independent review/checks and operator/legal/native gates are met. Publishing was not performed or authorized by this local task. Local source, migrations and tests are committed together; obtain the exact checkpoint with `git rev-parse HEAD` on this integration branch.

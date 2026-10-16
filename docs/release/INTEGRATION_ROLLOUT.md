# Unified release integration — rollout contract

Local preparation only, 2026-10-15. This is not permission to change production.
Pinned sources: App Store `7fa0a81557cca6c61e8805783f7e9f71a2e4c9b2`, PR #59 `933200a648193f88fc6e210ba8834d68c300f19e`, PR #60 `993dae8ff75e1e689375c14ab5ce9f3aa9077374`. No merge, push or PR modification occurred. Integration uses only missing deltas on a new branch from the App Store candidate.

## Migration behavior and compatibility

The original four migration SQL files remain byte-identical to the pinned candidate. 001 adds blocks/restrictions; 002 leaves existing Community acceptance null (no implied acceptance); 003 revokes all prior AI grants, including grants already labeled with the new version, advances epochs and cancels pending/running jobs; 004 adds durable deletion recovery and the deleted-identity insert/relink trigger. Source Journals/Events/vectors and cost/security tombstones are retained by upgrade. Disabling Memory/deletion still performs the existing erasure paths.

One necessary additional migration, `202610150005_ai_disclosure_grant_guard`, handles the confirmed old-server regrant risk without rewriting migration history. In one transaction it revokes enabled grants with an obsolete termsVersion, cancels those owners' pending/running jobs and installs a CHECK constraint: any enabled processing/personalization/memory grant must carry `ai-2026-10-15`. Current-version grants and pending/completed AccountDeletion records are preserved. The old server hardcodes `2026-08-25`; its grant transaction is rejected and rolled back. Withdrawal with all options off remains permitted. A future disclosure-version change requires a reviewed compatible constraint migration and coordinated release; changing only the application constant is insufficient.

The constraint is defense in depth, not permission to run old/new servers together. Old binaries also lack Community and block enforcement. There is no supported rolling mixed-version release for this change. Old clients' enable-AI requests to the new API receive 428 until they provide the current explicit disclosure; stale Community versions are rejected. Ship compatible clients together, communicate the update requirement, and never restore legacy grant behavior to work around it.

## Required operator sequence — no unsafe mixed-version window

1. Obtain separate approval for the exact candidate SHA, database migration and affected API/worker/client release. Verify actual deployed baselines and trusted database identity under INTEGRATION_DEPLOYMENT.md; prepare backup/recovery and preserve deletion/cost tombstones. No credential values belong in this record.
2. Close admission for **every** public/direct API ingress and internal executor/scheduler path. Stop accepting uploads/new jobs. Drain in-flight requests and stop all old API/worker instances and scheduled dispatchers across replicas; record that none remain. Already-sent provider requests cannot be recalled. If old-process/drain status is uncertain, STOP. An AI feature flag alone is insufficient.
3. While admission and all old processes remain stopped, have the approved trusted runner apply reviewed migrations 001–005 in order (already-applied migrations remain untouched). Do not silently change the startup override to npm start or run automatic production migrations. On error, keep admission closed; inspect/repair through the approved database procedure rather than restarting old code.
4. Verify the grant constraint and migration-004 deletion trigger exist, invalid enabled grants are absent, old jobs are cancelled, and pending/completed deletion tombstones remain. Start **only** the pinned new API/worker binaries under closed admission. Confirm the actual version on every instance. Do not start an old binary against the new database.
5. Validate current-disclosure grants, legacy-client rejection, withdrawal, acceptance, block/visit/leave and deletion recovery using separately authorized synthetic identities in the intended acceptance environment. Reconcile public client builds and processor flags. Reopen approved ingress/dispatch only after those gates pass. Rollout verification is currently NOT VERIFIED; only isolated tests were performed.
6. Recovery: close admission/drain again. Use a forward-compatible repair or a previously verified binary that enforces the new contracts. Preserve the constraint and deletion trigger/tombstones. Database restore must preserve/reenact completed deletions and revoke unsafe grants; restoring a backup or an old binary blindly can resurrect data/permissions. If a safe recovery is not established, stay closed and escalate for owner approval.

## Isolated evidence

`node scripts/release-readiness-test.mjs --upgrade` builds historical main's schema in a unique disposable loopback PostgreSQL/pgvector database, seeds existing old/current-version consent, Journal/Event/vector memory, pending/running jobs and a cost tombstone, and applies the four unchanged release SQL migrations. It then seeds existing pending/completed deletion records and a simulated pre-guard old-server regrant before applying 005. Tests verify preservation/reset, rejected identity creation/relink, rejected old-server helper transactions, explicit new API consent, legacy-client failures and withdrawal. This exercises migration SQL and behavior; it does not certify production backup quality, topology, process drainage or live migration execution.

`node scripts/release-readiness-test.mjs` also exercises fresh Prisma migrate deploy of all five release migrations and real API/Socket.IO social/deletion scenarios. External network is forbidden in that API suite. No real provider identity or paid inference was used.

## Integration resolutions

- server.js: one set of existing screening handlers; preserve PR #60's shared IP admission before Firebase/profile work and larger speech/photo parsers, plus existing user/AI quotas.
- lib/ai-jobs.js and lib/daily-flower-input.js: existing equivalent v1.2 hooks retained once, including historical Event idempotency before screening.
- docs/content-safety.md: retain the candidate's PR #59 text plus social extension.
- SECURITY.md: retain all candidate evidence and import both PR histories with source labels.
- Daily Grow fixture: retain both PR assertions, explicit transaction branch and current user/block delegates. Fixture failures are not classified as production vulnerabilities.
- Missing #59 route tests, THIRD_PARTY_NOTICES.md and CI selections are included. #60 limiter/CPU optimization and its tests are preserved byte-for-byte.

## Social behavior

Support/visit/move/leave ignore request avatar overrides for publication and use stored profile name/avatar, screened at the action, with current Community acceptance before publishing. Legitimate stored avatars remain valid. HTTP visitor/history lists use the same recipient block filter as Garden snapshots; realtime retains per-recipient filtering and revalidation. /leave now uses sorted pair locks, block/friend/privacy authorization and transactional record creation. A privacy/friendship-revoked visitor may remove only their own cached presence and receives an empty cleanup response, with no database write or broadcast. A blocked/restricted pair is denied. Failed transactions do not broadcast successful departures.

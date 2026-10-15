# Release candidate change inventory

Local-only changes from verified main `ba867045c0c044a25b04e99dee93c53f10351506`. No dependency/lockfile updates. Four new migrations cover persistent social blocks/restrictions, Community acceptance, AI report references and historical consent revocation, and durable deletion recovery/identity protection. New controls are additive except intentional 428 acceptance/disclosure requirements and revocation of legacy AI grants; coordinate backend/client rollout.

## Backend and schema

- `lib/account-deletion-workflow.js`
- `lib/account-deletion.js`
- `lib/ai-disclosure.js`
- `lib/ai-jobs.js`
- `lib/ai-output-reporting.js`
- `lib/auth.js`
- `lib/community-policy.js`
- `lib/content-safety.js`
- `lib/daily-flower-input.js`
- `lib/flower-support.js`
- `lib/garden-access.js`
- `lib/garden-response.js`
- `lib/http-errors.js`
- `lib/http-security.js`
- `lib/report-narrative.js`
- `lib/social-safety.js`
- `lib/socket-security.js`
- `lib/speech-transcription.js`
- `prisma/migrations/202610150001_social_safety/migration.sql`
- `prisma/migrations/202610150002_community_acceptance/migration.sql`
- `prisma/migrations/202610150003_ai_disclosure/migration.sql`
- `prisma/migrations/202610150004_account_deletion_workflow/migration.sql`
- `prisma/schema.prisma`
- `server.js`

## Mobile implementation and build

- `mobile/app.config.js`
- `mobile/app.json`
- `mobile/eas.json`
- `mobile/release-config.cjs`
- `mobile/src/app/bookhouse.tsx`
- `mobile/src/app/reflection.tsx`
- `mobile/src/components/AuthGate.tsx`
- `mobile/src/components/features/AiPrivacySettings.tsx`
- `mobile/src/components/features/CommunityGuidelines.tsx`
- `mobile/src/components/features/DeleteAccountSettings.tsx`
- `mobile/src/components/features/EmotionalSafetyNote.tsx`
- `mobile/src/components/features/EventsPanel.tsx`
- `mobile/src/components/features/FeatureOverlay.tsx`
- `mobile/src/components/features/FriendsPanel.tsx`
- `mobile/src/components/features/PrivacyAndSupport.tsx`
- `mobile/src/components/features/SafetyActions.tsx`
- `mobile/src/components/garden/planting/FlowerDetailModal.tsx`
- `mobile/src/components/garden/planting/flowerDetailData.ts`
- `mobile/src/hooks/useEventVoiceInput.ts`
- `mobile/src/services/auth.tsx`
- `mobile/src/services/auth/registrationValidation.ts`
- `mobile/src/services/emotionalSafety.ts`

## Tests and local tools

- `mobile/test/applicationIntegration.test.mjs`
- `mobile/test/emotionalSafety.test.mjs`
- `mobile/test/privacyControls.test.mjs`
- `mobile/test/releaseConfig.test.mjs`
- `mobile/test/releaseReadiness.test.mjs`
- `mobile/test/routePolicy.test.mjs`
- `scripts/release-export.mjs`
- `scripts/release-license-inventory.mjs`
- `scripts/release-readiness-test.mjs`
- `scripts/release-regression.mjs`
- `scripts/resume-account-deletions.js`
- `test/back/account-deletion.route.test.js`
- `test/back/content-safety.test.js`
- `test/back/flower-social-mutations.test.js`
- `test/back/garden-privacy.test.js`
- `test/back/http-security.test.js`
- `test/back/garden-response.test.js`
- `test/back/realtime-security.test.js`
- `test/back/release-readiness.test.js`
- `test/back/social-authorization.postgres.test.js`

## Documentation and repository hygiene

- `.gitignore`
- `MANUAL_SECURITY_CHECKLIST.md`
- `MOBILE.md`
- `SECURITY.md`
- `cloudflare-worker/src/index.js`
- `docs/APP_STORE_RELEASE_READINESS.md`
- `docs/content-safety.md`
- `docs/release/AUDIENCE_PERMISSIONS_RIGHTS.md`
- `docs/release/CHANGE_SUMMARY.md`
- `docs/release/DELETION_OPERATIONS.md`
- `docs/release/EMOTIONAL_SAFETY.md`
- `docs/release/MODERATION_RUNBOOK.md`
- `docs/release/POLICY_DRAFTS.md`
- `docs/release/STORE_PRIVACY_WORKSHEETS.md`
- `docs/release/STORE_SUBMISSION_CHECKLIST.md`
- `docs/release/TEST_EVIDENCE.md`
- `docs/release/account-deletion.html`

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

Evidence: `test/back/release-readiness.test.js`, `mobile/test/releaseReadiness.test.mjs`, migrations. TESTED: isolated PostgreSQL migrations plus actual Express/Socket.IO A/B/C paths: 2/2; UI component/API harness: 6/6 including existing detail cases; TypeScript noEmit passed. Signed native accessibility remains NOT VERIFIED. Commit: phase A checkpoint (see final evidence index).

Operator: configure moderator allowlist, assign daily queue ownership and urgent escalation coverage; confirm contact inbox; native VoiceOver/TalkBack and real device testing NOT VERIFIED. Existing clients should refresh Garden data after revocation; previously delivered content cannot be recalled from another person's device.

## B — Social content screening and acceptance

IN PROGRESS.

## C — AI privacy and reporting

IN PROGRESS.

## D — Deletion

IN PROGRESS.

## E — Policies and disclosures

IN PROGRESS. Owner confirmed draft brand PetalPal/Jastrevia and proposed `contact@jastrevia.com`; delivery remains unverified. Legal publisher: [LEGAL PUBLISHER NAME — OWNER CONFIRMATION REQUIRED]. Internal “JX Technology Inc.” is not evidence of incorporation. No address, registration number or legal jurisdiction is asserted.

## F — Emotional safety

IN PROGRESS.

## G — Build and review

NOT VERIFIED: full Xcode is absent; Command Line Tools cannot produce a signed iOS archive. Store identifiers, publisher ownership and signed native acceptance require operator verification. No guarantee of store approval.

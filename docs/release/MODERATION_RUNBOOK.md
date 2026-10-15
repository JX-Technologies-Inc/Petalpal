# PetalPal moderation — owner review required

Assign a primary and backup moderator before release. Review the queue each staffed day; triage threats, exploitation and privacy exposure first, record decisions, and escalate imminent danger to the appropriate local services when reliable information exists. PetalPal is not an emergency response service. No response-time SLA is verified or promised. Reassess staffing from actual queue age; do not launch without coverage.

Authenticated HTTP workflow (small-team tooling, no public dashboard):

1. Operator configures `MODERATOR_FIREBASE_UIDS` with verified staff Firebase UIDs; empty denies everyone. Use verified-email staff accounts and short-lived Firebase ID tokens in an approved API client. Never paste tokens into shell history, logs, tickets or this chat.
2. `GET /moderation/reports` returns up to 50 oldest open reports. It excludes reporter identity and private entries. Handle visible message text as sensitive evidence; do not export it to external AI tools.
3. `POST /moderation/reports/:reportId` JSON `{"action":"remove-message"}` removes only the reported author's message. `restrict-user` denies social access; `restore-user` reverses that restriction. `dismiss` closes an unsupported report. Each decision is stored with action and time. Restrictions preserve private journaling and deletion access.
4. Refresh the queue and verify the content/action result with disposable staging accounts. Review appeals through the proposed support inbox; never reveal reporter identity. Staff should record minimal operational case notes outside chat using approved restricted storage.
5. Curate synthetic regression cases from patterns, never copy private user submissions into test fixtures. Filters miss semantic abuse; reports and human decisions are essential.

Proposed public contact: contact@jastrevia.com. Delivery, access control, mailbox coverage and response process must be verified by the owner before publication. This document authorizes no production configuration.

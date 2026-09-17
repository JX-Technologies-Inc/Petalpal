# Reddit direct-collection rights audit

Scope: `PHQ-001–625` → cleanup → `593 unique = 468 Train + 125 Dev` → canonical Reddit-derived Train 468. This is an evidence audit, not legal advice. No training, data modification, annotation, author contact, or deletion was performed.

## Evidence-based conclusion

Current classification: `RIGHTS UNVERIFIED`.

The workbook establishes `DIRECT REDDIT-LINKED PUBLIC-HUMAN COLLECTION`, preserves row-level URLs and source groups, and does not evidence a named external corpus. It does not establish ML-training or commercial rights for the individual posts/comments.

## Three separate questions

### 1. Copyright / ownership

Reddit’s current User Agreement, effective July 1, 2026 and last revised May 26, 2026, Section 5 states that users retain ownership rights they have in their content, while granting Reddit a broad, transferable and sublicensable license. Section 5 also says Reddit may make content available to companies, organizations, or individuals that partner with Reddit, and mentions Reddit’s own AI/ML use. This does not by itself grant PetalPal a direct license from each rightsholder.

Reddit’s Developer Terms, Section 5.2, state that User Content is owned by Users, require compliance with restrictions imposed by the respective owners, and say no other license is granted or implied for other purposes such as ML training without express permission of the applicable rightsholders. The presence of a public URL is not an individual Creative Commons or other reusable license notice.

### 2. Platform / API contract

The current Data API Terms were last revised July 20, 2026. Section 2.4 grants a limited, revocable, non-transferable, non-sublicensable license to copy/display User Content through the Data API for an App, and expressly excludes other purposes such as ML/AI training without express permission of the applicable rightsholders. Section 3.1 says commercial API purposes or uses not expressly permitted require a separate agreement with Reddit; Section 3.2 also requires express written approval for direct commercial or monetary gain from API access. Section 6 requires deletion of data and models derived from API-accessed content upon termination.

The Developer Terms Section 4.1 and 5.2 similarly reserve ungranted rights and prohibit accessing Reddit Services and Data, including by indexing/caching/crawling, to train AI/algorithmic models without Reddit permission and applicable rightsholder permission. These are platform/developer terms, distinct from copyright ownership.

### 3. Acquisition method

The recovered workbook supports direct Reddit-linked collection, but the repository does not prove whether collection used the Data API, manual browsing, direct webpage collection, or another permitted access route. Therefore:

- If collected through the Reddit API: the Data API Terms and Developer Terms apply; they do not provide a general ML-training license, and commercial/API use may require separate agreement or approval.
- If manually/directly collected from public webpages: API-specific license provisions should not be mechanically assumed to govern that access route; however public visibility still does not establish copyright permission, a user license, or commercial ML permission. The current User Agreement/Developer Terms also contain broad restrictions concerning Reddit Services and Data and model training.

`PUBLIC VISIBILITY DOES NOT ITSELF ESTABLISH ML-TRAINING RIGHTS`.

## Specific determinations

- User-content ownership: users retain ownership rights they have; Reddit receives its contractual platform license. No automatic PetalPal sublicense was established.
- Current official ML rule: no general PetalPal ML-training permission was found. Official API/developer text requires express rightsholder permission for ML training and reserves ungranted rights.
- Commercial use: free public viewing is not commercial ML permission. Commercial API/data use may require a separate Reddit agreement or written approval; commercial ML rights for these rows are not established.
- Attribution: User Agreement says users waive moral-right/attribution claims to Reddit, while Developer Terms/Data API documentation may require attribution when displaying User Content. No row-specific attribution/license terms were recovered; treat obligations as unresolved.
- Redistribution: no right to redistribute the 468 raw texts or derived dataset was established. API terms include non-sublicensable/revocable restrictions and deletion obligations.
- User-level license: no known individual Creative Commons or explicit reusable licenses are recorded for these rows. Individual permission would be one possible rights basis, but no authors were contacted.
- Research: Reddit’s Public Content Policy (updated May 29, 2025) says Reddit supports non-commercial uses such as learning/community and continues to provide access to public content for research, while also stating commercial purposes should be discussed with Reddit. This is not expanded here into commercial/product permission, and it does not verify the collection route or historical applicability.
- Copyright exceptions: `POTENTIAL LEGAL EXCEPTION — REQUIRES LEGAL REVIEW`; no exception was used to downgrade the blocker.

## Timing

The project records the collection as historical and preserves the workbook, but does not establish the exact collection date. Current terms cannot automatically determine rights for historical collection. `HISTORICAL TERMS UNVERIFIED`.

## Current implication

The 468 rows are provenance-recovered direct Reddit-linked public-human excerpts, but ML training, fine-tuning, internal R&D, future deployment, and commercial product use are not all supported by a verified rights basis. Current status remains `RIGHTS UNVERIFIED`; the existing `BLOCKER` cannot be removed on this evidence.

## Official evidence

- [Reddit User Agreement](https://redditinc.com/policies/user-agreement) — effective July 1, 2026; last revised May 26, 2026; Sections 5 and 11.
- [Reddit Developer Terms](https://redditinc.com/policies/developer-terms) — Sections 2.1, 4.1, 5.2, and model-training restriction in Section 4.
- [Reddit Data API Terms](https://redditinc.com/policies/data-api-terms) — last revised July 20, 2026; Sections 2.1, 2.4, 3.1–3.2, 4.2, and 6.
- [Reddit Public Content Policy](https://support.reddithelp.com/hc/en-us/articles/26410290525844-Public-Content-Policy) — updated May 29, 2025; Introduction and paragraphs on public visibility, non-commercial use, licensing, and restrictions.


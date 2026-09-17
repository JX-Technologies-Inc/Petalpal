# PetalPal ML Data Rights Audit

Read-only repo-local audit. No training, data modification, annotation, protected-content access, or downloads were performed.

| Dataset / internal name | Rows / role | Rights status | Commercial / ML training | Production relevance | Severity |
|---|---:|---|---|---|---|
| CoSoWELL v1 | 319 / canonical Train | OSF says `Other`; referenced license missing | unclear / unclear | current | BLOCKER |
| Reddit-derived PHQ/public-journaling | 468 / canonical Train | direct Reddit-linked public-human collection; rights unverified | unclear / unclear | current | BLOCKER |
| HUMAN_CONSENTED | 54 / canonical Train | documentary consent, collector-confirmed | allowed / allowed | current | NONE |
| GoEmotions official | lineage + historical | CC BY 4.0 dataset license; repository/code license distinct | allowed / allowed subject to terms | current lineage | NONE |
| Targeted GoEmotions | 204 / upstream training | CC BY 4.0 | allowed / allowed subject to terms | current lineage | NONE |
| EmpatheticDialogues | 444 / historical | CC BY-NC 4.0 | non-commercial / research use | no | NONE |
| PetalPal synthetic | 2,400 / historical | internal provenance; external rights unclear | unclear / internal allowed | no | REVIEW |
| Hybrid ED+GE | historical | mixed restricted/unverified | mixed | no | BLOCKER |
| FacebookAI/roberta-base | initialization lineage | MIT model license | allowed / allowed | current lineage | NONE |

## Canonical 841

The locked 841 consists of Reddit-derived PHQ/public-journaling `468` (BLOCKER), CoSoWELL `319` (BLOCKER), and HUMAN_CONSENTED `54` (NONE; collector-confirmed documentary consent covering research, training, evaluation, product, deployment, and commercial use). The PHQ prefix is an internal PetalPal row identifier; recovered workbook evidence supports direct Reddit-linked public-human collection, not an external named corpus. The combined lock is not a license grant.

## Current-best checkpoint lineage

`goemotions-targeted-v1/experiment/epoch-1-checkpoint` materially inherits the base RoBERTa/candidate-c lineage and the canonical aligned Train, and directly reflects the targeted GoEmotions tranche. EmpatheticDialogues is historical only and is not recorded as contributing to this current-best checkpoint.

## Classifications

1. CLEAR for current R&D / production lineage: HUMAN_CONSENTED 54, GoEmotions, targeted GoEmotions, FacebookAI/roberta-base.
2. R&D possibly usable but commercial/product rights unclear: CoSoWELL, PHQ/public-journaling, synthetic data.
3. Non-commercial / production blocker: none currently relevant; EmpatheticDialogues and historical hybrid ED+GoEmotions remain historically restricted and are not current lineage.
4. Historical only — no current model impact: EmpatheticDialogues, synthetic tuning data, hybrid ED+GE.
5. Eval/diagnostic only: no dataset in this scoped lineage was cleared as production evaluation data; protected evaluation rights remain UNVERIFIED.

Remaining current blockers: **2** — CoSoWELL 319 and Reddit-derived PHQ/public-journaling 468. Machine-readable details: `data-rights-audit.json`. Provenance is recovered for PHQ; rights remain explicitly `UNVERIFIED` and no license was inferred.

# Dataset Admission Audits — 2026-09-17

Minimal cumulative record for post-enISEAR external candidates. Effective with the updated 2026-09-17 policy, admission is based first on rights and domain usability; human Product-18 labels are required only for `ADMIT_GOLD`, not for `ADMIT_UNLABELED`.

Current classifications (these supersede any older decision language retained in the chronological audit notes):

| Candidate | Classification | Controlling reason |
| --- | --- | --- |
| crowd-enVENT | `BLOCKED` | Highly usable original Event text, but no dataset/content license was found; external clearance is required. |
| Hippocorpus | `ADMIT_UNLABELED` | O-UDA-1.0, original English Event-like narratives, and author/event grouping are available; no Product-18 gold. |
| Sentiment-Focused Journaling | `EXCLUDE` | Underlying text ownership/provenance and label provenance are materially unclear. |
| MEMO4000.2019 | `EXCLUDE` | Underlying social-post rights, author grouping, and annotation provenance are materially unclear. |
| Persona-E2 | `EXCLUDE` | CC BY-NC-SA / academic-only terms are incompatible with product/commercial use. |
| Unexpected-Events | `ADMIT_UNLABELED` | CC BY 4.0, original participant-written English event continuations, and participant/experiment/scenario grouping are available; no Product-18 gold. Prepared only as an auxiliary hypothetical-event source. |
| IDEST | `BLOCKED` | Potentially useful narratives, but commercial data/text rights require an external authoritative license decision. |
| SENDv1 | `EXCLUDE` | Controlled research-only EULA is incompatible with product/commercial use. |
| CR4 | `EXCLUDE` | Deposited CC0 does not clear the copyrights in the underlying modern literary passages. |
| BRIGHTER | `BLOCKED` | Commercial use requires approval and underlying social-post rights remain unresolved. |
| MINDS | `EXCLUDE` | Research-only Twitter-derived corpus with model-generated emotion labels. |
| Less is More | `EXCLUDE` | Explicit research-only terms are incompatible with product/commercial use. |
| Story Commonsense | `EXCLUDE` | Its ROCStories source license is non-commercial research only; labels describe third-person character reactions rather than the writer's Product-18 emotion. |

The separate enISEAR audit is reclassified `BLOCKED`: ODC-By covers the database, but a commercial license for the individual contributed texts was not established. `ADMIT_UNLABELED` text may support self-supervised/domain-adaptation work only; it is not human gold, independent product evaluation, or standalone promotion evidence.

## crowd-enVENT

- Official source: University of Stuttgart, <https://www.ims.uni-stuttgart.de/en/research/resources/corpora/emotionappraisal/>
- Hugging Face page: none used.
- Original source/repository: creator-hosted archive `crowd-enVent2023.zip`; modeling repository <https://github.com/sarnthil/crowd-enVent-modeling>; paper <https://aclanthology.org/2023.cl-1.1/>.
- Exact license: **NONE FOUND FOR THE DATASET OR INDIVIDUAL TEXT CONTENT** in the authoritative archive, readme, university page, paper, or supplement. The modeling-code repository is MIT-licensed, which does not license the separately distributed corpus.
- Commercial use allowed: **UNCLEAR**.
- Training allowed: **UNCLEAR**.
- Evaluation allowed: **UNCLEAR**.
- Underlying-content concern: **YES** — original personal event descriptions written by Prolific contributors, with encrypted contributor IDs and demographics.
- Additional permission required: **UNCLEAR**; no contributor-content commercial sublicense or independent corpus license was found. PetalPal will not contact the licensors in this task.
- Domain: English first-person emotion-eliciting event descriptions; highly Event-like but prompted and emotion-balanced rather than natural product distribution.
- Approximate size: 6,600 generation texts from 2,379 encrypted generation IDs; 6,000 validation judgments covering 1,200 texts from 1,217 encrypted validation IDs.
- Native label scheme: anger, boredom, disgust, fear, guilt, joy, pride, relief, sadness, shame, surprise, trust, no-emotion. Prompted generator label plus reader validation on a subset.
- Labels human-generated: **YES**.
- Source/user grouping available: **YES**, encrypted `prolific_id`.
- Incumbent-overlap risk: **LOW BUT UNRESOLVED**. It is a distinct Prolific source, but no complete comparison against all historical text/person identities exists; encrypted source-local IDs cannot establish global person separation.
- Mapping to Product-18: **NOT DEFENSIBLE for the whole dataset**. Anger, disgust, fear, joy, sadness, and surprise are exact; guilt/shame→remorse, trust→caring, pride→admiration, relief→optimism, and boredom→annoyance require subjective reinterpretation. `no-emotion` may diagnose abstention but does not repair missing taxonomy coverage.
- Final decision: **EXCLUDE**.
- Integrity result: no row admitted, no evaluation artifact created, no model inference or training performed.

Audit verdict: **PASS**; dataset decision: **EXCLUDE**; training decision: **DO_NOT_TRAIN on this source**.

## Hippocorpus

- Official source: Microsoft Download Center, <https://www.microsoft.com/en-us/download/details.aspx?id=105291>.
- Hugging Face page: secondary AllenAI packaging/documentation, <https://huggingface.co/datasets/allenai/hippocorpus>; it identifies the same Microsoft source and O-UDA license but is not treated as the rights authority.
- Original source/repository: ACL 2020 paper <https://aclanthology.org/2020.acl-main.178/>; 6,854 stories originally collected from U.S. Amazon Mechanical Turk participants for this project.
- Exact license: **Open Use of Data Agreement v1.0 (O-UDA-1.0)**. It permits use and modification of the data without use restrictions and use/modification/distribution of results without restrictions; data redistribution carries notice/disclaimer obligations.
- Commercial use allowed: **YES under O-UDA-1.0**.
- Training allowed: **YES**, including domain-adaptive pretraining and other unlabeled/self-supervised use. There is no usable native Product-18 supervision.
- Evaluation allowed: **YES as a rights matter**, but it cannot serve as emotion gold.
- Underlying-content concern: **LOW** — the stories were written by compensated crowdworkers for the collection rather than scraped from a third-party platform. The release includes sensitive autobiographical content and demographics, so only fields needed for a justified task should ever be retained.
- Additional permission required: **NO identified for licensed use**; O-UDA terms and notices would still need to be followed.
- Domain: long first-person diary-like recalled, imagined, and retold salient-event stories; highly relevant to Event semantics but much longer than typical PetalPal inputs.
- Approximate size: 6,854 stories: 2,779 recalled, 2,756 imagined, and 1,319 retold; version 3 additionally contains sentence-level event-boundary annotations for 240 stories.
- Native label scheme: memory type plus post-writing scalar/questionnaire fields (`distracted`, `draining`, `frequency`, `importance`, `similarity`, `stressful`) and free-text event metadata. The 240-story extension labels major/minor event boundaries and whether a new event was expected or surprising.
- Labels human-generated: **YES for those native fields**, but **NO Product-18 emotion labels exist**.
- Source/user grouping available: **YES** — `WorkerId` groups authors; `recAgnPairId` and `recImgPairId` link retold/imagined stories to recalled-source events.
- Incumbent-overlap risk: **LOW** because this is an original MTurk collection rather than Reddit/GoEmotions lineage; no text comparison was run because task-label applicability fails first.
- Mapping to Product-18: **NOT DEFENSIBLE**. Stress/task drain/importance are not discrete emotions. Event unexpectedness is not the experienced emotion `surprise`, and free-text `mostSurprising` is not an emotion label. Converting any of these into Product-18 gold would require prohibited new interpretation/labeling.
- Final decision: **ADMIT_UNLABELED**. It may be used for domain-adaptive pretraining, representation adaptation, or other unlabeled objectives. It remains forbidden as Product-18 human gold or independent evaluation.
- Integrity result: the official archive was downloaded. Before length filtering, recalled-summary character lengths are median 167, P75 213, and P90 259; 99.9280% are at most 300 characters and 0.0720% are over. Automated preparation admitted 2,776 unique recalled summaries after excluding two summaries over 300 characters and one contact-pattern match; author-disjoint train/validation splits contain 2,637/139 rows across 2,524/135 anonymized author groups. Long stories, demographics, questionnaire fields, imagined/retold variants, and free-text metadata were not copied into the prepared corpus. No human review was performed.

Audit verdict: **PASS**; dataset decision: **ADMIT_UNLABELED**; training decision: **UNLABELED_OBJECTIVES_ONLY**.

## Sentiment-Focused Journaling Dataset

- Official source: uploader's Hugging Face repository, <https://huggingface.co/datasets/chaosbringerc/sentiment-focused-journaling-dataset>.
- Original source/repository: **NONE DOCUMENTED** beyond the single-user Hugging Face repository. No paper, collection protocol, upstream corpus, consent statement, or source-author statement is linked.
- Exact license: repository metadata and card state **CC BY 4.0**. The card refers to a `LICENSE` file, but no such file appears in the published four-file tree; the license claim still does not establish that the uploader owns all text/label rights.
- Commercial use allowed: **UNCLEAR for underlying content** because provenance/ownership is undocumented.
- Training allowed: **UNCLEAR** for the same reason.
- Evaluation allowed: **NO for defensible independent evaluation** because both content provenance and gold-label provenance are undocumented.
- Underlying-content concern: **YES** — the card describes only “journal-style entries” and never states whether they are uploader-authored, contributor-written, scraped, copied, or synthetically generated.
- Additional permission required: **UNCLEAR**.
- Domain: short introspective journal-style entries; superficially Product-like.
- Approximate size: `train.csv` is only 3.38 KB; the repository is 7.66 KB total. The authoritative card gives no row count, train/validation protocol, or release split despite mentioning an optional validation file that is not present.
- Native label scheme: examples include joy, sadness, anxiety, gratitude, peace, anger, burnout, acceptance, and confidence.
- Labels human-generated: **UNKNOWN** — no annotator, elicitation, rubric, agreement, or quality-control method is documented.
- Source/user grouping available: **NO DOCUMENTED GROUPING**.
- Incumbent-overlap risk: **UNRESOLVED** because no text source is stated.
- Mapping to Product-18: only joy, sadness, gratitude, and anger are exact. Anxiety→fear and the remaining states require subjective remapping; the full scheme is **NOT DEFENSIBLE**.
- Final decision: **EXCLUDE**.
- Integrity result: dataset not downloaded; no row admitted; no inference or training performed.

Audit verdict: **PASS**; dataset decision: **EXCLUDE**; training decision: **DO_NOT_TRAIN on this source**.

## MEMO4000.2019

- Official source: Mendeley Data DOI <https://doi.org/10.17632/3j7cw552v6.1> / <https://data.mendeley.com/datasets/3j7cw552v6/1>.
- Original source/repository: author paper, *An Extension of Label-Oriented Approach for Multi-Labels Text Classification*, DOI <https://doi.org/10.24507/ijicic.18.04.1265>.
- Exact license: Mendeley record states **CC BY 4.0** for the deposited dataset.
- Commercial use allowed: **UNCLEAR for underlying social-network posts**. The dataset-level license does not establish that the depositor received commercial-relicensing rights from the original post authors.
- Training allowed: **UNCLEAR** because underlying-content rights fail.
- Evaluation allowed: **UNCLEAR** because retained evaluation would reproduce/use the same third-party posts.
- Underlying-content concern: **YES** — the paper says texts were collected from social-network statuses “such as Twitter” during 2018–2020.
- Additional permission required: **UNCLEAR** at platform/post-author level.
- Domain: very short, informal social-network status text; not diary/Event-distribution matched.
- Approximate size: exactly 4,000 texts in the paper; 5,656 total label assignments. Label cardinality: 2,683 one-label, 1,031 two-label, 237 three-label, 45 four-label, 4 five-label.
- Native label scheme: joy, sadness, hope, fear, love, disgust, pride, admiration, anger, other.
- Labels human-generated: **UNCLEAR** — the paper only states that collected texts “are then labelled with emotions” and gives no annotator identity/count, independence, rubric, agreement, adjudication, or quality-control protocol.
- Source/user grouping available: **NO DOCUMENTED GROUPING**; the paper used random 10-fold cross-validation rather than author/source grouping.
- Incumbent-overlap risk: **HIGH/UNRESOLVED**. Social-network source includes Twitter and may include copied/cross-posted text; stable user IDs are not documented.
- Mapping to Product-18: exact for joy, sadness, fear, love, disgust, admiration, and anger. Hope→optimism is not accepted as exact; pride/other are outside Product-18. Whole-dataset mapping is **NOT DEFENSIBLE**.
- Final decision: **EXCLUDE**.
- Integrity result: data files not downloaded; no row admitted; no inference or training performed.

Audit verdict: **PASS**; dataset decision: **EXCLUDE**; training decision: **DO_NOT_TRAIN on this source**.

## Persona-E2 (Persona-Event2Emotion)

- Official source: creator Hugging Face repository <https://huggingface.co/datasets/CRIS-Yang/Persona-E2-Dataset>; paper <https://aclanthology.org/2026.acl-long.1350/>.
- Exact license: **CC BY-NC-SA 4.0**. The card additionally states “Academic Use Only” and restricts use to pure academic research, education, and non-commercial alignment experiments.
- Commercial use allowed: **NO**.
- Training allowed: **NO for PetalPal production/commercial training**; ShareAlike would also apply to adaptations/fine-tuning under the card's terms.
- Evaluation allowed: **NO for a retained commercial-product evaluation foundation**.
- Underlying-content concern: **YES** — 3,111 events aggregate news publishers, Weibo/WeChat, SocialChem, Reddit, FMylife, and other life-narrative sources; the dataset license does not remove source-level concerns.
- Additional permission required: **YES** for commercial use, plus any unresolved underlying-source rights.
- Domain: news, social-media, and life-experience events; only part is Product-like.
- Approximate size: 3,111 filtered events, 36 human readers per event, 111,996 annotations; 413-event Subjective Divergence Subset.
- Native label scheme: Ekman's anger, disgust, fear, joy, sadness, surprise plus neutral. Human labels answer how the *reader* would feel on reading the event; the General Writer labels are external-classifier outputs because original writer ratings were unavailable.
- Labels human-generated: **YES for reader elicitation; NO for writer emotion**.
- Source/user grouping available: annotator IDs are available, but stable original-text author/source grouping sufficient for product split isolation is not documented across all aggregated sources.
- Incumbent-overlap risk: **HIGH/UNRESOLVED** due to 440 Reddit events and other social sources overlapping the incumbent's broad domain/lineage.
- Mapping to Product-18: exact names for six labels, but the target construct is reader reaction rather than author/event emotion, so it is **NOT DEFENSIBLE as PetalPal gold** even apart from the license failure.
- Final decision: **EXCLUDE**.
- Integrity result: dataset not downloaded; no row admitted; no inference or training performed.

Audit verdict: **PASS**; dataset decision: **EXCLUDE**; training decision: **DO_NOT_TRAIN on this source**.

## Three Datasets Reporting Unexpected Events for Everyday Scenarios

- Official source: Mendeley Data DOI <https://doi.org/10.17632/kkt999sn7b.1>; data article <https://doi.org/10.1016/j.dib.2021.106935>.
- Exact license: **CC BY 4.0** for the deposited data and article.
- Commercial use allowed: **YES under CC BY 4.0 with attribution**.
- Training allowed: **YES as a rights matter**, but no Product-18 supervision exists.
- Evaluation allowed: **YES as a rights matter**, but it cannot serve as discrete-emotion gold.
- Underlying-content concern: **LOW** — responses were newly elicited from Prolific participants in the authors' online experiments rather than scraped from external platforms.
- Additional permission required: **NO identified for licensed use**.
- Domain: short participant-written predictions of what unexpected event might occur next in everyday scenarios such as shopping or preparing breakfast. It is event-like, but hypothetical/prompt-conditioned rather than a natural private journal distribution.
- Approximate size: the release/article claims 9,720 text responses. The three selected authoritative released tables contain 8,700 nonblank response rows after the Experiment 1 rater-layout blanks are removed; this unreconciled 1,020-row difference is retained as a provenance caveat rather than guessed away.
- Native label scheme: event topic/category, positive/neutral/negative valence/sentiment, and whether the response mentions goal-related objects. Each response was labeled by at least two independent human raters; the article documents majority/discussion resolution and high agreement.
- Labels human-generated: **YES**, but only for valence/category/goal relation, not discrete emotions.
- Source/user grouping available: **YES** — all selected experiment tables contain `user_id`. The preparation aliases 486 participant groups globally and makes the train/validation groups disjoint. Raw IDs, including IP-like values, are never copied to prepared output.
- Incumbent-overlap risk: **LOW**, because this is an original Prolific collection; no text comparison was run because label applicability fails first.
- Mapping to Product-18: **NOT DEFENSIBLE**. Positive/neutral/negative valence cannot be expanded to discrete emotions. An event being prompted as unexpected does not mean the writer expresses `surprise`.
- Final decision: **ADMIT_UNLABELED**. Rights-clear Event-like text is useful for unlabeled adaptation even though it cannot create independent Product-18 gold. It is qualified as `AUXILIARY_HYPOTHETICAL_EVENT`, not a replacement for first-person product-like text.
- Integrity result: the official v1 archive was downloaded and automatically prepared without human text review. Before policy, the 8,700 nonblank rows have median/P75/P90 character lengths `46/79/125`; `99.1954%` are at most 300 characters and `0.8046%` are over. Preparation retains 8,122 unique complete responses at most 300 characters, split 7,716/406 across 460/26 disjoint participant groups. It excludes 70 long rows, 4 rows with fewer than three ASCII letters, and 504 normalized duplicates (reason counts may overlap). Contact-pattern matches were zero. Native valence/topic/goal labels, rater fields, comments, and participant identifiers are not copied.

Audit verdict: **PASS**; dataset decision: **ADMIT_UNLABELED**; training decision: **BOUNDED_AUXILIARY_UNLABELED_OBJECTIVES_ONLY**.

## IDEST — International Database of Emotional Short Texts

- Official source: PLOS ONE article <https://doi.org/10.1371/journal.pone.0274480>; data repository <https://osf.io/9tga3/>.
- Exact license: the **article** is CC BY, but the article describes the **database** as “freely available for academic research.” The OSF project's exact file/data license could not be verified from an authoritative accessible record during this audit.
- Commercial use allowed: **UNCLEAR/NOT ESTABLISHED** for the database files and text content.
- Training allowed: **NO for production/commercial PetalPal work** under the strict gate.
- Evaluation allowed: **NO for a retained commercial-product evaluation foundation**.
- Underlying-content concern: **YES** — texts came from volunteer writing competitions and researchers, then were translated to English; the accessible paper does not establish each contributor/translator's commercial relicensing grant for the database.
- Additional permission required: **UNCLEAR**.
- Domain: 250 roughly 1,000-character first-person emotional narratives across everyday topics; original texts are Finnish, French, German, Portuguese, Spanish, or Turkish, with English translations. They may be fictional or non-fictional.
- Approximate size: 250 original stories plus 250 English translations; English affective ratings from 573 native-English participants.
- Native label scheme: continuous valence, arousal, comprehensibility, readability, topic tags, and manually categorized plot/emotional arcs such as tragedy or rags-to-riches.
- Labels human-generated: **YES** for dimensional ratings and story-arc categorization, but **NO discrete emotion labels**.
- Source/user grouping available: story identity/language is available; original writer identity grouping is not documented as an evaluation split field in the article.
- Incumbent-overlap risk: **LOW**, because these are project-collected/written narratives rather than known Reddit lineage; no comparison was run because rights and target labels fail first.
- Mapping to Product-18: **NOT DEFENSIBLE**. Valence/arousal and plot trajectory cannot be expanded into discrete Product-18 labels. The paper explicitly chose a dimensional approach and identifies categorical emotion assignment as future work.
- Final decision: **EXCLUDE**.
- Integrity result: OSF data not downloaded; no row admitted; no inference or training performed.

Audit verdict: **PASS**; dataset decision: **EXCLUDE**; training decision: **DO_NOT_TRAIN on this source**.

## Stanford Emotional Narratives Dataset v1 (SENDv1)

- Official source: Stanford Social Neuroscience Lab repository <https://github.com/StanfordSocialNeuroscienceLab/SEND>; paper <https://doi.org/10.1109/TAFFC.2019.2955945>.
- Exact license: **controlled-access end-user license agreement; research purposes only**. The repository says academic researchers may request access and must agree to the EULA.
- Commercial use allowed: **NO/NOT ESTABLISHED**.
- Training allowed: **NO for PetalPal production/commercial training**.
- Evaluation allowed: **NO for a retained commercial-product evaluation foundation**.
- Underlying-content concern: **YES, consent-tiered personal narratives**. Of 193 clips, 81 are `Limited-Use` and cannot be released as raw video/transcript; 112 are `Share-Ok` for release to researchers. Consent does not establish commercial product use.
- Additional permission required: **YES** — controlled access and EULA; commercial authorization is not offered by the public terms.
- Domain: self-paced, unscripted, first-person autobiographical positive/negative life-event narratives; strongly Event-like but multimodal and much longer than typical product entries.
- Approximate size: 193 clips from 49 unique speakers, about 7 hours 15 minutes; roughly 20 observer annotations per clip.
- Native label scheme: time-varying self-report valence and independent-observer speaker-valence ratings, plus multimodal features. No discrete emotion taxonomy is provided.
- Labels human-generated: **YES**, but continuous valence only.
- Source/user grouping available: **YES** — 49 target speakers and a predefined train/validation/test split.
- Incumbent-overlap risk: **LOW**, as this is a distinct in-lab collection; no text comparison was run because rights and label applicability fail first.
- Mapping to Product-18: **NOT DEFENSIBLE**. Continuous positive/negative valence cannot be expanded into any of 18 categorical emotions.
- Final decision: **EXCLUDE**.
- Integrity result: no access request submitted, EULA not accepted, data not downloaded, no row/clip admitted, no inference or training performed.

Audit verdict: **PASS**; dataset decision: **EXCLUDE**; training decision: **DO_NOT_TRAIN on this source**.

## CR4-NarrEmote

- Official source: Borealis Dataverse DOI <https://doi.org/10.5683/SP3/XN4ZYZ>; creator lab index <https://txtlab.org/data-sets/>.
- Hugging Face page: none used.
- Original source/repository: EMNLP 2025 paper <https://aclanthology.org/2025.emnlp-main.493/>; 43,713 sentences sampled from three collections of book-length fiction/non-fiction published across roughly 1800–2000.
- Exact license: Borealis dataset version 1.0 metadata states **CC0 1.0** for the deposited dataset.
- Commercial use allowed: **UNCLEAR for the underlying book passages**. CC0 clearly covers rights held by the depositor, but the release/paper does not establish that the depositor holds relicensing rights for all third-party literary passages.
- Training allowed: **UNCLEAR** because the text-content rights are unresolved.
- Evaluation allowed: **UNCLEAR** because retained evaluation requires the same passages.
- Underlying-content concern: **YES** — passages include contemporary and twentieth-century books as well as older works; the paper does not provide per-work public-domain/license clearance. The ACL responsible-NLP checklist records that artifact license/terms were not discussed.
- Additional permission required: **UNCLEAR** at work level.
- Domain: sentence-level character emotions in literary/non-fiction narratives; a semantic-boundary challenge domain, not first-person PetalPal Event distribution.
- Approximate size: 43,713 passages; 207,721 citizen-science annotations from 3,738 volunteers; 38,209 passages with at least one label.
- Native label scheme: human open-vocabulary character-emotion labels. NRC discrete labels and contextual mappings are derived by lexicon/model pipelines rather than direct gold.
- Labels human-generated: **MIXED** — `t1` is human; corrected/unified and NRC mappings include automatic and model-assisted processing.
- Source/user grouping available: **YES** — `file_id` groups the source document, `user_id` groups annotators.
- Incumbent-overlap risk: **LOW**, but no text comparison was run because content rights fail first.
- Mapping to Product-18: **NOT DEFENSIBLE for the released mapped labels** because NRC mapping includes lexicon/BERT/LLM-assisted processing and targets eight broad categories. A hypothetical direct-label-only subset could retain exact product-name responses without semantic remapping, but cannot be admitted while passage rights remain unresolved.
- Final decision: **EXCLUDE**.
- Integrity result: only authoritative metadata and the 2 KB readme were retrieved; the 53 MB passage table was not downloaded, no row admitted, no model inference/training performed.

Audit verdict: **PASS**; dataset decision: **EXCLUDE**; training decision: **DO_NOT_TRAIN on this source**.

## BRIGHTER English emotion categories/intensities

- Official source: BRIGHTER project <https://brighter-dataset.github.io/> and official Hugging Face organization.
- Hugging Face pages: <https://huggingface.co/datasets/brighter-dataset/BRIGHTER-emotion-categories> and <https://huggingface.co/datasets/brighter-dataset/BRIGHTER-emotion-intensities>.
- Original source/repository: BRIGHTER paper <https://aclanthology.org/2025.acl-long.436/>; English texts are Reddit/social-media and subreddit diary posts.
- Exact license: Hugging Face metadata says **CC BY 4.0**, but the authoritative paper explicitly says commercial use is strictly prohibited unless dataset-creator approval is obtained.
- Commercial use allowed: **NO without additional explicit approval**.
- Training allowed: **NO** for production/commercial PetalPal work.
- Evaluation allowed: **NO** for retained commercial-product evaluation.
- Underlying-content concern: **YES** — English source is Reddit/social-media user content, including personal diary posts.
- Additional permission required: **YES** for commercial use; this task does not request it.
- Domain: short English social-media/personal-diary snippets; moderately Event-like but not rights-clean.
- Approximate size: category release 9,272 English rows; intensity release 5,643 English rows.
- Native label scheme: human multi-label perceived anger, disgust, fear, joy, sadness, surprise, with neutral when none is selected; intensity 0–3 where available.
- Labels human-generated: **YES**.
- Source/user grouping available: **NO** in the published dataset schema documented by the official card (`id`, `text`, label columns only).
- Incumbent-overlap risk: **HIGH/UNRESOLVED** because both BRIGHTER English and incumbent GoEmotions lineage are Reddit-derived, and author/subreddit grouping is unavailable in the release schema.
- Mapping to Product-18: **EXACT for six labels and neutral/abstention as a limited diagnostic; NOT DEFENSIBLE for the whole 18-label taxonomy**.
- Final decision: **EXCLUDE**.
- Integrity result: dataset not downloaded; no row inspected/admitted; no model inference/training performed.

Audit verdict: **PASS**; dataset decision: **EXCLUDE**; training decision: **DO_NOT_TRAIN on this source**.

## MINDS (COVID-19 emotion/sentiment dataset)

- Official source: authors' paper and stated author-hosted data URL, paper at <https://ceur-ws.org/Vol-3416/paper_2.pdf>.
- Hugging Face page: none authoritative found or used.
- Original source/repository: 227,229 English tweets collected through the Twitter API using six Omicron hashtags from 2021-12-17 through 2022-02-04; paper points to `http://www.abulaish.com/ldsa/dataset`.
- Exact license: **NO DATASET LICENSE ESTABLISHED**. CC BY 4.0 printed in the proceedings applies to the paper; the paper says the dataset is available **“for research purposes”** and does not state a commercial corpus/content license.
- Commercial use allowed: **NO/UNCLEAR** — research-only wording plus Twitter user-content provenance fails the PetalPal gate.
- Training allowed: **NO** for production/commercial PetalPal work.
- Evaluation allowed: **NO** for retained commercial-product evaluation.
- Underlying-content concern: **YES** — scraped/API-collected Twitter user content.
- Additional permission required: **UNCLEAR**; resolving Twitter/user/licensor rights is outside this task.
- Domain: COVID-19/Omicron social-media posts, not short private Event journals.
- Approximate size: 227,229 retained English tweets (241,419 raw collected).
- Native label scheme: multi-label sadness, joy, fear, disgust, anger plus positive/negative/neutral sentiment.
- Labels human-generated: **NO** — IBM Watson NLU, Komprehend, and Text2emotion model/package outputs were thresholded; SemEval-2018 was used to select the threshold.
- Source/user grouping available: **UNCLEAR** from the paper's released-data description.
- Incumbent-overlap risk: **MEDIUM/UNRESOLVED** because the incumbent lineage includes Reddit-derived social text and the corpus is another social domain; no audit was run because rights and label provenance already fail.
- Mapping to Product-18: **EXACT only for the five emotion names**, but **NOT DEFENSIBLE as product gold** because the labels are model-generated, the remaining taxonomy is absent, and zero-output semantics do not match PetalPal selective annotation.
- Final decision: **EXCLUDE**.
- Integrity result: dataset not downloaded; no row inspected/admitted; no model inference/training performed.

Audit verdict: **PASS**; dataset decision: **EXCLUDE**; training decision: **DO_NOT_TRAIN on this source**.

## Less is More Corpus

- Official source: Mozilla Data Collective record `cmp2hgs2j00nsmp07q9s6g3m0`, stewarded by the University of Bamberg: <https://mozilladatacollective.com/datasets/cmp2hgs2j00nsmp07q9s6g3m0>.
- Hugging Face page: none found or used.
- Original source/repository: official catalog archive `less-is-more-corpus-e6dc1838.tar.gz`; paper <https://aclanthology.org/2026.lrec-1.646/>; source text is a low-agreement subset of crowd-enVENT.
- Exact license: catalog says **CC BY 4.0**, but its authoritative `Restrictions/Special Constraints` simultaneously says: **“This data set should only be used for research purposes.”** It also forbids personalized author profiling.
- Commercial use allowed: **NO under the explicit research-only constraint**.
- Training allowed: **NO for production/commercial PetalPal training**; research-only use is outside the admission policy.
- Evaluation allowed: **NO for retained commercial-product evaluation**; research-only use is outside the admission policy.
- Underlying-content concern: **YES** — 250 personal event descriptions inherited from crowd-enVENT, whose original corpus/content license was not found.
- Additional permission required: **YES for use beyond the stated research-only purpose**, and this task does not request permission.
- Domain: English first-person Event-like descriptions selected specifically for low emotion-label agreement; an ambiguity/boundary challenge distribution, not a natural product distribution.
- Approximate size: 250 texts, 500 annotators.
- Native label scheme: anger, boredom, disgust, fear, guilt, joy, pride, relief, sadness, shame, surprise, trust; human single-label annotations compared with the original prompted label.
- Labels human-generated: **YES**.
- Source/user grouping available: **UNCLEAR from the public catalog**; author demographics exist, but a stable author/source grouping field is not documented there.
- Incumbent-overlap risk: **LOW BUT NONZERO**. It derives from crowd-enVENT and is not known to be in incumbent lineage, but was not downloaded or compared because the rights gate already fails.
- Mapping to Product-18: **NOT DEFENSIBLE for the whole dataset**. Only anger, disgust, fear, joy, sadness, and surprise are exact; the remaining native labels cannot be subjectively remapped.
- Final decision: **EXCLUDE**.
- Integrity result: dataset not downloaded; no row inspected or admitted; no model inference/training performed.

Audit verdict: **PASS**; dataset decision: **EXCLUDE**; training decision: **DO_NOT_TRAIN on this source**.

## Story Commonsense / ROCStories

- Official source: University of Washington project <https://uwnlp.github.io/storycommonsense/> and repository <https://github.com/uwnlp/storycommonsense>.
- Underlying source: 15,000 five-sentence stories from ROCStories, with more than 300,000 crowdsourced annotations about character motivations and emotional reactions.
- Exact license: the Microsoft Research license distributed with ROCStories permits use solely for non-commercial, non-revenue-generating research. No separate Story Commonsense data license was found that overrides or clears the underlying story-text restriction.
- Commercial use allowed: **NO for the underlying ROCStories text under the accompanying license**.
- Training allowed: **NO for PetalPal production/commercial training**.
- Evaluation allowed: **NO for a retained commercial-product evaluation foundation**.
- Domain: short coherent third-person fictional stories. They are event-related, but not first-person PetalPal Events and typically exceed the single-short-event construct.
- Native label scheme: eight Plutchik dimensions — anger, disgust, fear, joy, sadness, surprise, trust, and anticipation — plus character motivation annotations.
- Labels human-generated: **YES**, but they are reader annotations of story characters, not self-reported writer emotions.
- Source/user grouping available: story/character IDs exist; original writer grouping adequate for leakage isolation is not established by the project description.
- Incumbent-overlap risk: **LOW/UNRESOLVED**, but irrelevant because the rights gate already fails.
- Mapping to Product-18: six names are exact; trust and anticipation are not. More importantly, the character-reaction construct is not the PetalPal writer/event construct, so the labels are not defensible product gold.
- Final decision: **EXCLUDE**.
- Integrity result: no story text downloaded, no row admitted, no inference or training performed.

Audit verdict: **PASS**; dataset decision: **EXCLUDE**; training decision: **DO_NOT_TRAIN on this source**.

## Admission Search Milestone and Independent-Evaluation Limitation

This audit series, together with the separate enISEAR audit, has now tested both sides of the feasible public-data space:

- Candidate corpora with useful discrete human emotion labels fail commercial/content rights, provenance, target-construct, source-grouping, or independence gates (`enISEAR`, crowd-enVENT, Less is More, BRIGHTER, MEMO4000, Persona-E2, Story Commonsense; MINDS additionally uses model labels; CR4 has uncleared literary passages).
- Original/project-collected corpora with clear rights and useful Event-like English text are valid `ADMIT_UNLABELED` resources even without discrete emotion labels (`Hippocorpus`, Unexpected-Events); adjacent narrative resources remain research-only or rights-unclear (`IDEST`, `SENDv1`).

No discovered source simultaneously satisfies all of: (1) commercial training/evaluation and underlying-content rights, (2) original human Event-like English text, (3) existing human labels with exact Product-18 semantics, (4) author/source grouping, and (5) independence from incumbent/model-selection lineage. Creating the missing categorical labels would require new human review, which is absolutely prohibited; pseudo-labeling would not create independent evaluation gold.

Status: **TRAINING_LOOP_ACTIVE; MODEL_PROMOTION_INCONCLUSIVE_WITHOUT_INDEPENDENT_GOLD**. Rights-cleared unlabeled data authorizes bounded domain-adaptation and self-supervised experiments. It does not authorize describing generated labels as human gold, computing an independent product score from those labels, or promoting a model on that evidence alone. A promotion-quality conclusion still requires a rights-cleared, independent, human-labeled Product-18-compatible evaluation source. No new human labeling or review is requested.

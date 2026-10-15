// Reproducible documentation rendering only. The drafts remain UNVERIFIED.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const targets = JSON.parse(readFileSync(new URL('./product-targets.json', import.meta.url)));
const corpus = JSON.parse(readFileSync(new URL('./fresh-corpus.json', import.meta.url)));
const sources = corpus.scenarios.find(s => s.id === targets.sourceScenario).sources;
const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
const count = text => [...segmenter.segment(text.replace(/\s/gu, ''))].length;
assert.equal(targets.validationStatus, 'UNVERIFIED_TARGET_PROSE');
assert.equal(targets.productionEligible, false);
assert.equal(targets.examples.length, 6);
assert.equal(new Set(targets.examples.map(e => `${e.reportType}/${e.locale}`)).size, 6);
for (const example of targets.examples) {
  assert.deepEqual(example.sourceIndices, example.reportType === 'WEEKLY' ? [0, 1] : [0, 1, 2, 3]);
  assert.ok(example.supportConcerns.length >= 4);
}

const intro = `# Semantic evidence — six UNVERIFIED product targets

**Every draft below is UNVERIFIED_TARGET_PROSE and ineligible for production.** ${targets.origin} No source-to-meaning or meaning-to-prose alignment in these drafts has independent certification. Naturalness, plausible citations, correct length, and a manually written support table do not make the text safe. The prototype cannot certify these drafts. They are not registered conditional fixture realizations either.

The six drafts deliberately reuse the creative scenario to make the locale and report-type comparison inspectable. The separate evaluation corpus covers eight domains and 32 Events. Within each report type, all three locales use identical unchanged source strings; those same inputs appear in the v1/v2/v2.1 comparison. Weekly uses S1–S2. Monthly uses S1–S4. The synthetic recording dates are September 15/18 for Weekly, and September 2/9/16/27 for Monthly. They order records. Activity time is not established merely by those dates. The comparator authors recording and Event occurrence metadata separately, with equal values only in these fixtures.

## Exact source text

${sources.map((s, i) => `- **S${i + 1} / creative-${i + 1}:** ${s}`).join('\n')}

Original source text is never translated in storage. English, Simplified Chinese, and Traditional Chinese source languages are separate from the requested output locale. Event and Memory text are intentionally identical in these synthetic fixtures; this does not establish that production EventMemory summaries preserve original Events.

## Manual factual-support analysis (not independent proof)

| Draft claim group | Exact supporting source spans | Boundary and unresolved semantic work |
|---|---|---|
| User sketched a kitchen window; liked uneven lines; found the reflection difficult | S1: “I sketched the kitchen window.” / “I liked the uneven lines” / “the reflection was hard to draw” | Self-recorded experience, not external-world verification. Do not infer drawing location, accomplishment, pride, improvement, or a specific date. English “uneven” ↔ 不太规整/不太規整 needs intensity/idiom review. |
| Story opening changed; version not chosen; mixed emotion while writing | S2: “给短篇小说换了一个开头” / “还没决定用哪一版” / “写的时候既兴奋又烦躁” | The emotions are scoped to writing, not necessarily the act of replacement. Do not say the whole story was rewritten or finished. “irritated” is a proposed 烦躁 mapping; no exact equivalence is proved. |
| Returned to the same window sketch, added cup on sill, still liked lines | S3: “returned to the window sketch” / “added the cup on the sill” / “I still liked the uneven lines” | Same-sketch identity and a before/return relation are explicitly recorded. Record dates alone could not establish them. Neither recurring practice nor quality change follows. Cup ownership/color are unknown. |
| Read two openings to a friend; friend liked second; user had not chosen | S4: “把短篇小說的兩個開頭讀給朋友聽了” / “她喜歡第二版” / “我還沒有選好” | Preserve distinct actors. Her preference does not mean the user agreed. Non-decision is true of the recorded report, not necessarily now. Comparing S2/S4 must not imply a continuous state between them. |
| Both topics recur in the selected month's records | S1/S3 explicitly mention the window sketch; S2/S4 explicitly mention story openings | Counts concern distinct synthetic records with explicitly repeated subjects. No claim about habits, perseverance, recovery, personality, or increased activity is licensed. Topic equivalence remains a manual alignment assumption. |
| Optional source-specific questions | Referents: S1/S3 sketch and cup; S2/S4 openings | Optionality is not a proof that a question has no factual premise. Present availability, interest, an unfinished choice, and the wording “line or passage” require review. Every question remains uncertified. |

No draft asserts that drawing caused a feeling about story writing, that record order proves activity chronology, or that mixed feelings demonstrate growth. Those are excluded interpretations, not supported insights. The unresolved scope issues below are reasons to withhold certification even where the intended meaning seems reasonable.

## Lengths

Counts use Intl.Segmenter grapheme clusters, including punctuation and excluding whitespace. Chinese targets are approximately 100–180 Weekly and 250–350 Monthly; English word counts are descriptive, not a transferred Chinese limit.

| Draft | Graphemes | English words | Validation |
|---|---:|---:|---|
${targets.examples.map(e => `| ${e.reportType} / ${e.locale} | ${count(e.text)} | ${e.locale === 'en' ? e.text.split(/\s+/u).length : '—'} | UNVERIFIED |`).join('\n')}

The Chinese Weekly drafts fit the requested range; the Monthly drafts are shorter than 250 graphemes. This is an explicit unmet product target. The available details did not justify more prose without repeated recap or padding. Neither length compliance nor a shorter draft establishes factual certification or usefulness.
`;
const examples = targets.examples.map(e => `
## ${e.reportType} / ${e.locale} — UNVERIFIED

${e.text}

Specific unresolved concerns:

${e.supportConcerns.map(c => `- ${c}`).join('\n')}
`).join('');
writeFileSync(new URL('../../docs/ai/SEMANTIC_EVIDENCE_EXAMPLES.md', import.meta.url), intro + examples + `
## Reproduce

Run **node experiments/semantic-evidence/render-examples.mjs** from the repository root. This only renders the six developer-authored JSON drafts and lengths. It does not generate, validate, approve, publish, or persist a native reflection. See [evaluation](SEMANTIC_EVIDENCE_EVALUATION.md) for the identical-evidence baseline results and the separate blind-review plan.
`);
console.log('Rendered six UNVERIFIED target drafts; source references and status labels checked.');

import { readFileSync } from 'node:fs';
import { TYPES, LOCALES, prepareExperiment } from './experiment.mjs';
import { fixture, scenarios } from './fixtures.mjs';
import { authoredOutput } from './examples.mjs';
const chunks = [];
const emit = text => chunks.push(text);
const comparison = JSON.parse(readFileSync(new URL('./comparison-results.json', import.meta.url)));
emit('# Prompt-first reflection: same-evidence reading samples\n\nGenerated with `node experiments/prompt-first-reflection/render-examples.mjs`. A is actual deterministic rendering of an authored selection; B is an authored candidate run through the pinned reference validator; C is manually authored product direction. **None is a Claude output.** C remains semantically unverified even when structure passes.\n');
for (const type of TYPES) for (const locale of LOCALES) {
  const input = fixture(scenarios[0], type, locale), output = authoredOutput(type, locale), assessment = prepareExperiment(input).evaluate(output, input);
  const row = comparison.rows.find(r => r.scenario === scenarios[0].id && r.type === type && r.locale === locale);
  emit(`## ${type} / ${locale}\n\n### Identical synthetic evidence\n`);
  input.events.forEach((e,i) => emit(`- E${i+1} (${e.eventDate}): ${e.text}`));
  for (const v of ['v1','v2','v2.1']) emit(`\n### ${v === 'v1' ? 'A: deterministic v1' : 'B: restricted ' + v}\n\n${row.versions[v].narrative || 'ABSTAINED: ' + row.versions[v].code}\n`);
  emit(`### C: authored prompt-first target — NOT CLAUDE\n\n${output.reflection}\n\n${assessment.graphemes} graphemes excluding whitespace. Structure/traceability checked; meaning and writing quality require independent review.\n`);
}
console.log(chunks.join("\n").trimEnd());

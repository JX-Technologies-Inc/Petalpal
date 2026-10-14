import { pathToFileURL } from 'node:url';
import { createExperiment } from './prototype.mjs';
import { makeFixture, makeComposedPlan, makeTextCandidate, atomPlan } from './fixtures.mjs';

export function runDemo() {
  const fixture = makeFixture();
  const experiment = createExperiment(fixture);
  const plan = makeComposedPlan(fixture);
  const candidate = makeTextCandidate(fixture, plan);
  const changedActor = structuredClone(plan);
  changedActor.args[0].args[0].meaning.actor = 'someone-else';
  const missingCause = structuredClone(fixture);
  missingCause.annotations = missingCause.annotations.filter(a => a.id !== 'cause-relief');
  const explicitOrder = { op: 'occurred-before', left: atomPlan(fixture, 'tested-alpha'),
    right: atomPlan(fixture, 'tested-beta') };
  const noActivityTime = structuredClone(fixture);
  for (const a of noActivityTime.annotations.filter(a => ['tested-alpha', 'tested-beta'].includes(a.id))) {
    a.meaning.time = { kind: 'unknown' };
  }
  const noTimeOrder = { op: 'occurred-before', left: atomPlan(noActivityTime, 'tested-alpha'),
    right: atomPlan(noActivityTime, 'tested-beta') };
  return {
    origin: 'Same-task developer-authored synthetic sources, annotations and text; not Claude output or independent review.',
    decision: 'REVISE_ARCHITECTURE', productionEligible: false,
    originalSourceTexts: fixture.sources.map(s => ({ eventId: s.eventId, text: s.text })),
    composedPlan: plan,
    candidateText: candidate.text,
    results: {
      arbitraryPredicateComposition: experiment.evaluatePlan(plan),
      fixtureTextMatch: experiment.evaluateText(candidate),
      correctPlanFalseProse: experiment.evaluateText({ ...candidate,
        text: 'You recovered completely because you deployed the patch to production.' }),
      changedActor: experiment.evaluatePlan(changedActor),
      removedExplicitCause: createExperiment(missingCause).evaluatePlan(plan),
      occurrenceOrderWithExplicitActivityDates: experiment.evaluatePlan(explicitOrder),
      recordTimesCannotEstablishActivityOrder: createExperiment(noActivityTime).evaluatePlan(noTimeOrder),
      exactAttributedSource: experiment.quote('event-beta'),
    },
    limitation: 'Conditional derivation is not independent source entailment or whole-text semantic validation. No result can enter production.'
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(runDemo(), null, 2));
}

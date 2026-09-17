export function createRetrievalEvaluationTrace({ query, strategy, retrievedCandidates = [], chosenEvidence = [], generationVersion = null, modelVersion = null, startedAt = Date.now(), cost = null }) {
  return {
    query,
    strategy,
    retrievedCandidates,
    chosenEvidence,
    generationVersion,
    modelVersion,
    latencyMs: Math.max(0, Date.now() - startedAt),
    cost,
    metrics: {
      recallAtK: null,
      precisionAtK: null,
      mrr: null,
      groundedness: null,
      hallucinationRate: null,
      evidenceCoverage: null,
      userRating: null
    }
  };
}

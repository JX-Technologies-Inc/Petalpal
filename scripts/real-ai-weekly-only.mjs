// Test-runner helpers only. Never installed in the application/production path.
import { withMemoryConsent } from '../lib/ai-consent.js';
import { DeterministicMemoryExtractor, PrismaMemoryRepository } from '../lib/event-memory.js';

export function weeklyOnlyFetch({ providerOrigin, appOrigin, fetchImpl, calls, check, diagnostic }) {
  return async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.origin !== providerOrigin) {
      check(url.origin === appOrigin() || url.origin === 'http://127.0.0.1:9099', 'NETWORK_TARGET_DENIED');
      return fetchImpl(input, { ...options, redirect: 'error' });
    }
    check(url.pathname === '/v1/report-narrative' && options.method === 'POST', 'PROVIDER_ROUTE_DENIED');
    const body = String(options.body || '');
    check(Buffer.byteLength(body) <= 24000 && !body.includes('JOURNAL_DECOY_ONLY'), 'PROVIDER_INPUT_REJECTED');
    check(calls.narrative === 0 && calls.emotion === 0 && calls.embedding === 0, 'CALL_LIMIT_OR_RETRY_BLOCKED');
    calls.narrative++; // Ambiguous/failed attempts still consume the entire budget.
    diagnostic.category = 'PROVIDER_ERROR_UNCLASSIFIED';
    let response;
    try { response = await fetchImpl(input, { ...options, redirect: 'error' }); }
    catch { throw new Error('WEEKLY_PROVIDER_REQUEST_FAILED'); }
    diagnostic.httpStatus = response.status;
    if (response.ok) diagnostic.category = 'HTTP_OK';
    else {
      // Inspect only the fixed upstream code; never retain the body or exception.
      try {
        const { code } = await response.clone().json();
        if (['AI_RUN_FAILED', 'JSON_PARSE_FAILED', 'SCHEMA_VALIDATION_FAILED'].includes(code)) diagnostic.category = code;
      } catch { /* Generic classification remains; no raw errors. */ }
    }
    return response;
  };
}

export async function seedWeeklyFixtures({ prisma, fixtures, owners, timezone, events }) {
  const extractor = new DeterministicMemoryExtractor();
  const repository = new PrismaMemoryRepository(prisma);
  for (const fixture of fixtures) {
    const identity = { userId: owners[fixture.owner].id };
    await withMemoryConsent(prisma, identity, async tx => {
      const event = await tx.event.create({ data: {
        ownerId: identity.userId, content: fixture.content, occurredAt: new Date(fixture.occurredAtUtc),
        timezone, localDate: fixture.localDate, idempotencyKey: `weekly-fixture-${fixture.ref}`,
        memoryProcessingAllowed: true, primaryGardenMood: fixture.mood,
        emotionStatus: 'SKIPPED', emotionOutcome: 'SKIPPED'
      } });
      const memory = await extractor.extract({ ...event, kind: 'EVENT', topics: [fixture.theme] });
      await repository.saveMemory({ identity, memory: { ...memory, ownerId: identity.userId }, transaction: tx });
      events.set(fixture.ref, event.id);
    });
  }
}

export function weeklyFixtureRetrieval({ prisma, eventIds, check }) {
  return { async retrieve({ identity, dateFrom, dateTo, take }) {
    check(dateFrom instanceof Date && dateTo instanceof Date && dateFrom < dateTo &&
      Number.isInteger(take) && take > 0 && take <= 32, 'RETRIEVAL_SOURCE_LEAK');
    return withMemoryConsent(prisma, identity, async tx => {
      const rows = await tx.eventMemory.findMany({ where: {
        ownerId: identity.userId, memoryType: 'EVENT', sourceEventId: { in: eventIds },
        eventDate: { gte: dateFrom, lt: dateTo }, sourceEvent: { memoryProcessingAllowed: true }
      }, orderBy: [{ eventDate: 'asc' }, { id: 'asc' }], take });
      check(rows.every(r => r.ownerId === identity.userId && r.memoryType === 'EVENT' &&
        eventIds.includes(r.sourceEventId) && r.eventDate >= dateFrom && r.eventDate < dateTo), 'RETRIEVAL_SOURCE_LEAK');
      // Explicit fixture score, not a vector or real semantic ranking result.
      return rows.map(row => ({ ...row, similarity: 1 }));
    });
  } };
}

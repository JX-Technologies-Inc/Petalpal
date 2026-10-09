const invalidPage = () => Object.assign(new Error('Invalid Journal page'), { status: 400 });
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

export function parseJournalPage(query, ownerId) {
  if (query.view === undefined) return null; // Legacy complete-array contract remains explicit.
  if (query.view !== 'page' || Object.keys(query).some(key => !['view', 'limit', 'cursor'].includes(key))) throw invalidPage();
  const limit = query.limit ?? '50';
  if (typeof limit !== 'string' || !/^[1-9]\d{0,2}$/.test(limit) || Number(limit) > 100) throw invalidPage();
  let cursor = null;
  if (query.cursor !== undefined) {
    try {
      const raw = query.cursor;
      if (typeof raw !== 'string' || raw.length > 768 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw invalidPage();
      cursor = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
      if (!cursor || Object.keys(cursor).sort().join(',') !== 'createdAt,id,owner'
        || cursor.owner !== ownerId || !validId(cursor.id)
        || typeof cursor.createdAt !== 'string' || cursor.createdAt.length !== 24
        || new Date(cursor.createdAt).toISOString() !== cursor.createdAt) throw invalidPage();
    } catch { throw invalidPage(); }
  }
  return { limit: Number(limit), cursor };
}

export function journalPageCursor(owner, journal) {
  return Buffer.from(JSON.stringify({ owner, id: journal.id, createdAt: new Date(journal.createdAt).toISOString() })).toString('base64url');
}

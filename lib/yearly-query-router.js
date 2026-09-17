export const QueryIntent = Object.freeze({
  SQL: "SQL",
  KEYWORD: "KEYWORD",
  METADATA: "METADATA",
  VECTOR: "VECTOR",
  REPORT: "REPORT"
});

export const RetrievalStrategy = Object.freeze({
  SQL: "SQL_RETRIEVAL",
  KEYWORD: "KEYWORD_RETRIEVAL",
  METADATA: "METADATA_RETRIEVAL",
  VECTOR: "VECTOR_SEMANTIC_RETRIEVAL",
  REPORT: "REPORT_RETRIEVAL"
});

export class YearlyQueryRouter {
  route(query) {
    const normalized = String(query || "").toLowerCase();
    if (/who|谁|how many|多少|count|几次/.test(normalized)) return { intent: QueryIntent.SQL, strategy: RetrievalStrategy.SQL };
    if (/turning point|转折|biggest change|最大变化/.test(normalized)) return { intent: QueryIntent.REPORT, strategy: RetrievalStrategy.REPORT };
    if (/confidence|信心|feel|感觉|meaning|意义/.test(normalized)) return { intent: QueryIntent.VECTOR, strategy: RetrievalStrategy.VECTOR };
    if (/first|第一次|when did|什么时候|记录/.test(normalized)) return { intent: QueryIntent.KEYWORD, strategy: RetrievalStrategy.KEYWORD };
    return { intent: QueryIntent.METADATA, strategy: RetrievalStrategy.METADATA };
  }
}

export const yearlyQueryRouter = new YearlyQueryRouter();

export class RetrievalStrategyContract {
  constructor(name) { this.name = name; }
  async retrieve(_input) { throw new Error(`${this.name} retrieval is not implemented`); }
}

export class HybridRetrieval {
  constructor(strategies = []) { this.strategies = strategies; }

  async retrieve({ identity, query, filters = {} }) {
    if (!identity?.userId) throw new Error("Authenticated owner identity is required");
    const results = await Promise.all(this.strategies.map((strategy) => strategy.retrieve({ identity, query, filters })));
    return [...new Map(results.flat().map((item) => [item.id, item])).values()];
  }
}

function topicList(event) {
  const values = event?.topics || event?.memory?.topics || [];
  return Array.isArray(values)
    ? values.filter((topic) => typeof topic === "string" && topic.trim()).map((topic) => topic.trim())
    : [];
}

function frequencies(events) {
  const counts = new Map();
  for (const event of events) {
    for (const topic of topicList(event)) counts.set(topic, (counts.get(topic) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((left, right) => right.count - left.count || left.topic.localeCompare(right.topic));
}

export class TrendAnalyzer {
  analyzePeriod({ currentEvents = [], previousEvents = [] }) {
    if (!Array.isArray(currentEvents) || currentEvents.length === 0) {
      return {
        status: "insufficient_data",
        currentEventCount: 0,
        previousEventCount: previousEvents.length,
        eventCountChange: -previousEvents.length,
        topicFrequency: [],
        topicChanges: [],
        importantEventCount: 0
      };
    }

    const currentTopics = frequencies(currentEvents);
    const previousTopics = new Map(frequencies(previousEvents).map(({ topic, count }) => [topic, count]));
    const topicChanges = currentTopics.map(({ topic, count }) => ({
      topic,
      currentCount: count,
      previousCount: previousTopics.get(topic) || 0,
      change: count - (previousTopics.get(topic) || 0)
    }));
    for (const { topic, count } of frequencies(previousEvents)) {
      if (!currentTopics.some((item) => item.topic === topic)) {
        topicChanges.push({ topic, currentCount: 0, previousCount: count, change: -count });
      }
    }
    return {
      status: "ok",
      currentEventCount: currentEvents.length,
      previousEventCount: previousEvents.length,
      eventCountChange: currentEvents.length - previousEvents.length,
      topicFrequency: currentTopics,
      topicChanges: topicChanges.sort((left, right) => Math.abs(right.change) - Math.abs(left.change) || left.topic.localeCompare(right.topic)),
      importantEventCount: currentEvents.filter((event) => Number(event.importanceScore ?? event.memory?.importanceScore) >= 0.7).length
    };
  }

  analyzeWeekly({ currentEvents, previousEvents }) {
    return this.analyzePeriod({ currentEvents, previousEvents, comparison: "week-over-week" });
  }

  analyzeMonthly({ currentEvents, previousEvents }) {
    return this.analyzePeriod({ currentEvents, previousEvents, comparison: "month-over-month" });
  }
}

export const trendAnalyzer = new TrendAnalyzer();

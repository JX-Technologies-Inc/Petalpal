import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "test/fixtures/semantic-retrieval-gold.json");
const ENGLISH_ONLY_SLICES = new Set(["en-en", "paraphrase", "hard-negative", "proper-noun", "short-vague", "no-answer", "multi-plausible", "cross-owner"]);

const DEV_FAMILY_SPECS = Object.freeze({
  "family-01": {
    label: "career",
    originalTertiary: "project",
    core: [
      { summary: "Career event 1: received a full-time offer from Cedar Labs after the final interview.", topics: ["career", "job-offer", "cedar-offer", "growth"], people: ["Cedar Labs"] },
      { summary: "Career event 2: completed Maple Studio internship orientation with mentor Maya.", topics: ["career", "internship", "maple-orientation", "growth"], people: ["Maple Studio", "Maya"] },
      { summary: "职业事件 3：完成 Aurora 作品集项目，并总结了这段职业成长。", topics: ["career", "portfolio", "aurora-portfolio", "growth"], people: ["Aurora"] }
    ],
    otherOwner: { summary: "Career event 10: signed a private contract with Northstar Agency.", topics: ["career", "contract"], people: ["Northstar Agency"] },
    queries: {
      enEn: "Which career moment was about receiving a full-time job offer?",
      zhZh: "哪条职业记录讲的是完成作品集项目？",
      enZh: "Which career event was about finishing the Aurora portfolio project?",
      zhEn: "哪条职业记录提到了 Maple Studio 的实习入职培训？",
      codeSwitch: "Maple Studio 的 internship orientation 是哪次 career event？",
      paraphrase: "Which moment showed that my job search finally paid off?",
      hardNegative: "Which career moment was a job offer, not an internship?",
      properNoun: "Which career moment involved Cedar Labs?",
      shortVague: "Maple internship",
      noAnswer: "Which career event involved a submarine license?",
      multiPlausible: "Which career moments reflected personal growth?",
      crossOwner: "What happened with Northstar Agency?"
    },
    cues: { primary: "job offer", tertiaryZh: "作品集项目", tertiaryEn: "Aurora portfolio", secondaryZh: "Maple Studio", secondaryCode: "internship orientation", paraphrase: "paid off", hard: "not an internship", proper: "Cedar Labs", short: "Maple internship", absent: "submarine license", shared: "personal growth", other: "Northstar Agency" }
  },
  "family-03": {
    label: "travel",
    originalTertiary: "train",
    core: [
      { summary: "Travel event 61: visited the Maritime Museum and studied the blue-whale exhibit.", topics: ["travel", "museum", "blue-whale-exhibit", "discovery"], people: ["Maritime Museum"] },
      { summary: "Travel event 62: rode the Coast Starlight train to Portland and noted the route highlights.", topics: ["travel", "train", "coast-starlight-trip", "discovery"], people: ["Coast Starlight", "Portland"] },
      { summary: "旅行事件 63：在京都清水寺看日落，并记录了这次旅行带来的新发现。", topics: ["travel", "temple", "kiyomizu-sunset", "discovery"], people: ["清水寺"] }
    ],
    otherOwner: { summary: "Travel event 70: booked a private Sahara camp with Atlas Tours.", topics: ["travel", "desert"], people: ["Atlas Tours"] },
    queries: {
      enEn: "Which travel moment was about studying a blue-whale exhibit?",
      zhZh: "哪条旅行记录讲的是在清水寺看日落？",
      enZh: "Which travel event described watching sunset at Kiyomizu-dera?",
      zhEn: "哪条旅行记录提到了乘 Coast Starlight 火车去 Portland？",
      codeSwitch: "Coast Starlight 的 train trip 是哪次 travel event？",
      paraphrase: "Which outing helped me learn about a giant ocean mammal?",
      hardNegative: "Which travel moment was a museum visit, not a train ride?",
      properNoun: "Which travel moment involved the Maritime Museum?",
      shortVague: "Portland train",
      noAnswer: "Which travel event involved a lunar ferry?",
      multiPlausible: "Which travel moments were about making a discovery?",
      crossOwner: "What happened with Atlas Tours?"
    },
    cues: { primary: "blue-whale", tertiaryZh: "清水寺", tertiaryEn: "Kiyomizu-dera", secondaryZh: "Coast Starlight", secondaryCode: "train trip", paraphrase: "ocean mammal", hard: "not a train", proper: "Maritime Museum", short: "Portland train", absent: "lunar ferry", shared: "a discovery", other: "Atlas Tours" }
  },
  "family-04": {
    label: "health",
    originalTertiary: "walk",
    core: [
      { summary: "Health event 91: finished a physiotherapy stretching session for shoulder recovery with Dr. Chen.", topics: ["health", "stretching", "shoulder-physio", "recovery"], people: ["Dr. Chen"] },
      { summary: "Health event 92: walked five kilometers around Stanley Park without knee pain.", topics: ["health", "walk", "stanley-park-walk", "recovery"], people: ["Stanley Park"] },
      { summary: "健康事件 93：在 Aquatic Centre 完成游泳训练，感觉体能正在恢复。", topics: ["health", "swimming", "aquatic-swim", "recovery"], people: ["Aquatic Centre"] }
    ],
    otherOwner: { summary: "Health event 100: booked a private assessment at Alpine Clinic.", topics: ["health", "assessment"], people: ["Alpine Clinic"] },
    queries: {
      enEn: "Which health moment was about a shoulder physiotherapy session?",
      zhZh: "哪条健康记录讲的是完成游泳训练？",
      enZh: "Which health event described swimming at the Aquatic Centre?",
      zhEn: "哪条健康记录提到了在 Stanley Park 步行五公里？",
      codeSwitch: "Stanley Park 的 five-kilometer walk 是哪次 health event？",
      paraphrase: "Which moment showed my shoulder getting professional mobility care?",
      hardNegative: "Which health moment was stretching, not a walk?",
      properNoun: "Which health moment involved Dr. Chen?",
      shortVague: "Stanley Park walk",
      noAnswer: "Which health event involved zero-gravity yoga?",
      multiPlausible: "Which health moments showed physical recovery?",
      crossOwner: "What happened at Alpine Clinic?"
    },
    cues: { primary: "physiotherapy", tertiaryZh: "游泳训练", tertiaryEn: "Aquatic Centre", secondaryZh: "Stanley Park", secondaryCode: "five-kilometer walk", paraphrase: "mobility care", hard: "not a walk", proper: "Dr. Chen", short: "Stanley Park walk", absent: "zero-gravity yoga", shared: "physical recovery", other: "Alpine Clinic" }
  },
  "family-06": {
    label: "friendship",
    originalTertiary: "conversation",
    core: [
      { summary: "Friendship event 151: hosted a picnic at Trout Lake with Maya and felt more connected.", topics: ["friendship", "picnic", "trout-lake-picnic", "connection"], people: ["Maya", "Trout Lake"] },
      { summary: "Friendship event 152: had an honest conversation with Leo after a misunderstanding.", topics: ["friendship", "conversation", "leo-conversation", "connection"], people: ["Leo"] },
      { summary: "友谊事件 153：和 Ava 一起参加社区志愿活动，彼此的联系更深了。", topics: ["friendship", "volunteering", "ava-volunteering", "connection"], people: ["Ava"] }
    ],
    otherOwner: { summary: "Friendship event 160: planned a private reunion with Jordan.", topics: ["friendship", "reunion"], people: ["Jordan"] },
    queries: {
      enEn: "Which friendship moment was a picnic at Trout Lake?",
      zhZh: "哪条友谊记录讲的是和 Ava 参加社区志愿活动？",
      enZh: "Which friendship event described volunteering in the community with Ava?",
      zhEn: "哪条友谊记录提到了和 Leo 坦诚交谈？",
      codeSwitch: "和 Leo 的 honest conversation 是哪次 friendship event？",
      paraphrase: "Which gathering outdoors helped me feel closer to a friend?",
      hardNegative: "Which friendship moment was a picnic, not a conversation?",
      properNoun: "Which friendship moment involved Trout Lake?",
      shortVague: "Leo conversation",
      noAnswer: "Which friendship event involved a Martian pen pal?",
      multiPlausible: "Which friendship moments strengthened a connection?",
      crossOwner: "What happened with Jordan?"
    },
    cues: { primary: "Trout Lake", tertiaryZh: "社区志愿活动", tertiaryEn: "volunteering", secondaryZh: "Leo", secondaryCode: "honest conversation", paraphrase: "feel closer", hard: "not a conversation", proper: "Trout Lake", short: "Leo conversation", absent: "Martian pen pal", shared: "a connection", other: "Jordan" }
  },
  "family-07": {
    label: "home",
    originalTertiary: "balcony",
    core: [
      { summary: "Home event 181: cooked dumplings with Mom and felt the comfort of a family tradition.", topics: ["home", "cooking", "dumpling-tradition", "comfort"], people: ["Mom"] },
      { summary: "Home event 182: repaired the balcony planters with Alex before spring.", topics: ["home", "balcony", "alex-planters", "comfort"], people: ["Alex"] },
      { summary: "居家事件 183：整理窗边阅读角，让家里变得更舒适。", topics: ["home", "reading", "reading-corner", "comfort"], people: ["reading corner"] }
    ],
    otherOwner: { summary: "Home event 190: discussed a private lease with Oak Realty.", topics: ["home", "lease"], people: ["Oak Realty"] },
    queries: {
      enEn: "Which home moment was about cooking dumplings with Mom?",
      zhZh: "哪条居家记录讲的是整理窗边阅读角？",
      enZh: "Which home event described making the reading corner more comfortable?",
      zhEn: "哪条居家记录提到了和 Alex 修理阳台花盆？",
      codeSwitch: "和 Alex repair balcony planters 是哪次 home event？",
      paraphrase: "Which moment preserved a warm family food tradition?",
      hardNegative: "Which home moment was cooking, not balcony repair?",
      properNoun: "Which home moment involved Mom?",
      shortVague: "Alex balcony",
      noAnswer: "Which home event involved an underwater kitchen?",
      multiPlausible: "Which home moments made the space feel comfortable?",
      crossOwner: "What happened with Oak Realty?"
    },
    cues: { primary: "dumplings", tertiaryZh: "阅读角", tertiaryEn: "reading corner", secondaryZh: "Alex", secondaryCode: "balcony planters", paraphrase: "family food tradition", hard: "not balcony", proper: "Mom", short: "Alex balcony", absent: "underwater kitchen", shared: "feel comfortable", other: "Oak Realty" }
  },
  "family-09": {
    label: "calm",
    originalTertiary: "sunrise",
    core: [
      { summary: "Calm event 241: brewed jasmine tea and reflected quietly before bed.", topics: ["calm", "tea", "jasmine-reflection", "reflection"], people: ["jasmine tea"] },
      { summary: "Calm event 242: watched the sunrise at English Bay before the city became busy.", topics: ["calm", "sunrise", "english-bay-sunrise", "reflection"], people: ["English Bay"] },
      { summary: "平静事件 243：在社区花园做呼吸冥想，并写下当天的反思。", topics: ["calm", "meditation", "garden-meditation", "reflection"], people: ["社区花园"] }
    ],
    otherOwner: { summary: "Calm event 250: reserved a private retreat at Silent Pines.", topics: ["calm", "retreat"], people: ["Silent Pines"] },
    queries: {
      enEn: "Which calm moment was about brewing jasmine tea?",
      zhZh: "哪条平静记录讲的是在社区花园做呼吸冥想？",
      enZh: "Which calm event described breathing meditation in a community garden?",
      zhEn: "哪条平静记录提到了在 English Bay 看日出？",
      codeSwitch: "English Bay 的 sunrise 是哪次 calm event？",
      paraphrase: "Which bedtime ritual helped me slow down and think quietly?",
      hardNegative: "Which calm moment was tea, not a sunrise?",
      properNoun: "Which calm moment involved jasmine tea?",
      shortVague: "English Bay sunrise",
      noAnswer: "Which calm event involved a volcano concert?",
      multiPlausible: "Which calm moments included reflection?",
      crossOwner: "What happened at Silent Pines?"
    },
    cues: { primary: "jasmine tea", tertiaryZh: "呼吸冥想", tertiaryEn: "breathing meditation", secondaryZh: "English Bay", secondaryCode: "sunrise", paraphrase: "slow down", hard: "not a sunrise", proper: "jasmine tea", short: "English Bay sunrise", absent: "volcano concert", shared: "reflection", other: "Silent Pines" }
  }
});

function numericId(eventId) {
  return Number(eventId.replace(/^evt-/u, ""));
}

function criteria({ topicsAll = [], topicsNone = [], peopleAny = [], eventIds = [], queryCues, expectedCount, rationale }) {
  return { topicsAll, topicsNone, peopleAny, eventIds, queryCues, expectedCount, rationale };
}

function selectEvents(fixture, query, goldCriteria) {
  const allowedIds = new Set(goldCriteria.eventIds || []);
  return fixture.events.filter((event) => {
    if (event.language !== "en" || event.ownerId !== query.ownerId || event.scenarioFamily !== query.scenarioFamily) return false;
    if (allowedIds.size && !allowedIds.has(event.eventId)) return false;
    const topics = new Set(event.topics || []);
    const people = new Set(event.people || []);
    if (!(goldCriteria.topicsAll || []).every((topic) => topics.has(topic))) return false;
    if ((goldCriteria.topicsNone || []).some((topic) => topics.has(topic))) return false;
    if ((goldCriteria.peopleAny || []).length && !(goldCriteria.peopleAny || []).some((person) => people.has(person))) return false;
    return true;
  }).sort((left, right) => left.eventId.localeCompare(right.eventId));
}

function updateQuery(fixture, query, spec, coreEvents, otherOwnerEvent) {
  const [primary, secondary, tertiary] = coreEvents;
  let queryText;
  let goldCriteria;
  if (/^Tell me about /u.test(query.query)) {
    const currentTarget = fixture.events.find((event) => event.eventId === query.relevantEventIds[0]);
    if (!currentTarget || currentTarget.ownerId !== query.ownerId || currentTarget.scenarioFamily !== query.scenarioFamily) {
      throw new Error(`Cannot objectively repair exact dev query ${query.queryId}`);
    }
    const englishCandidates = fixture.events
      .filter((event) => event.language === "en" && event.ownerId === query.ownerId && event.scenarioFamily === query.scenarioFamily)
      .sort((left, right) => Math.abs(numericId(left.eventId) - numericId(currentTarget.eventId)) - Math.abs(numericId(right.eventId) - numericId(currentTarget.eventId)) || left.eventId.localeCompare(right.eventId));
    const target = currentTarget.language === "en" ? currentTarget : englishCandidates[0];
    const targetId = target.eventId;
    const eventNumber = numericId(targetId);
    queryText = `Tell me about ${spec.label} event ${eventNumber}`;
    goldCriteria = criteria({ eventIds: [targetId], queryCues: [String(eventNumber)], expectedCount: 1, rationale: "Exact synthetic Event number." });
  } else {
    const bySlice = {
      "en-en": [spec.queries.enEn, criteria({ topicsAll: [primary.topics[2]], queryCues: [spec.cues.primary], expectedCount: 1, rationale: "Unique primary topic in this owner and family." })],
      "zh-zh": [spec.queries.zhZh, criteria({ topicsAll: [tertiary.topics[2]], queryCues: [spec.cues.tertiaryZh], expectedCount: 1, rationale: "Chinese query targets the unique Chinese Event topic." })],
      "en-zh": [spec.queries.enZh, criteria({ topicsAll: [tertiary.topics[2]], queryCues: [spec.cues.tertiaryEn], expectedCount: 1, rationale: "English query targets the unique Chinese Event topic." })],
      "zh-en": [spec.queries.zhEn, criteria({ topicsAll: [secondary.topics[2]], queryCues: [spec.cues.secondaryZh], expectedCount: 1, rationale: "Chinese query targets the unique English Event topic." })],
      "code-switch": [spec.queries.codeSwitch, criteria({ topicsAll: [secondary.topics[2]], queryCues: [spec.cues.secondaryCode], expectedCount: 1, rationale: "Code-switched query targets the secondary Event." })],
      "paraphrase": [spec.queries.paraphrase, criteria({ topicsAll: [primary.topics[2]], queryCues: [spec.cues.paraphrase], expectedCount: 1, rationale: "Paraphrase expresses the primary Event without copying its topic label." })],
      "hard-negative": [spec.queries.hardNegative, criteria({ topicsAll: [primary.topics[2]], topicsNone: [secondary.topics[2]], queryCues: [spec.cues.hard], expectedCount: 1, rationale: "Positive must satisfy the requested topic and exclude the contrasted topic." })],
      "proper-noun": [spec.queries.properNoun, criteria({ peopleAny: [primary.people[0]], queryCues: [spec.cues.proper], expectedCount: 1, rationale: "Unique named entity identifies the Event." })],
      "short-vague": [spec.queries.shortVague, criteria({ topicsAll: [secondary.topics[2]], queryCues: [spec.cues.short], expectedCount: 1, rationale: "Short query still contains the unique secondary concept." })],
      "no-answer": [spec.queries.noAnswer, criteria({ topicsAll: [`absent-${spec.label}`], queryCues: [spec.cues.absent], expectedCount: 0, rationale: "No Event in the owner/family has the absent topic." })],
      "multi-plausible": [spec.queries.multiPlausible, criteria({ topicsAll: [primary.topics[3]], queryCues: [spec.cues.shared], expectedCount: 2, rationale: "Shared topic intentionally selects exactly two Events." })],
      "cross-owner": [spec.queries.crossOwner, criteria({ peopleAny: [otherOwnerEvent.people[0]], queryCues: [spec.cues.other], expectedCount: 0, rationale: "Matching Event belongs to another owner and must not enter gold for this owner." })]
    };
    const mapped = bySlice[query.languageSlice];
    if (!mapped) throw new Error(`Unsupported dev query slice ${query.languageSlice}`);
    [queryText, goldCriteria] = mapped;
  }
  const relevantEvents = selectEvents(fixture, query, goldCriteria);
  if (relevantEvents.length !== goldCriteria.expectedCount) {
    throw new Error(`Criteria for ${query.queryId} selected ${relevantEvents.length}, expected ${goldCriteria.expectedCount}`);
  }
  const relevantEventIds = relevantEvents.map((event) => event.eventId);
  return {
    ...query,
    query: queryText,
    relevantEventIds,
    gradedRelevance: Object.fromEntries(relevantEventIds.map((eventId, index) => [eventId, index === 0 ? 2 : 1])),
    goldCriteria
  };
}

function restoreExcludedMultilingualQuery(query, coreEvents, spec) {
  const [primary, secondary] = coreEvents;
  const restored = {
    "zh-zh": {
      query: `我做了哪些${spec.label}相关的事情？`,
      relevantEventIds: [primary.eventId, secondary.eventId]
    },
    "en-zh": {
      query: `What did I do about ${secondary.topics[1]}?`,
      relevantEventIds: [primary.eventId]
    },
    "zh-en": {
      query: `关于${secondary.topics[1]}，我记录了什么？`,
      relevantEventIds: [primary.eventId]
    },
    "code-switch": {
      query: `今天的 ${secondary.topics[1]} activity 是什么？`,
      relevantEventIds: [primary.eventId]
    }
  }[query.languageSlice];
  if (!restored) return query;
  const { goldCriteria: _discarded, ...withoutCriteria } = query;
  return {
    ...withoutCriteria,
    ...restored,
    gradedRelevance: Object.fromEntries(restored.relevantEventIds.map((eventId, index) => [eventId, index === 0 ? 2 : 1]))
  };
}

async function main() {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  const heldOutFamilies = new Set(fixture.split.heldOutFamilies);
  const heldOutLabelsBefore = fixture.queries
    .filter((query) => heldOutFamilies.has(query.scenarioFamily))
    .map(({ queryId, relevantEventIds, gradedRelevance }) => ({ queryId, relevantEventIds, gradedRelevance }));
  for (const [family, spec] of Object.entries(DEV_FAMILY_SPECS)) {
    if (heldOutFamilies.has(family)) throw new Error(`Dev repair spec includes held-out family ${family}`);
    const familyEvents = fixture.events.filter((event) => event.scenarioFamily === family).sort((left, right) => numericId(left.eventId) - numericId(right.eventId));
    const coreEvents = familyEvents.filter((event) => event.ownerId === "owner-a").slice(0, 3);
    const otherOwnerEvent = familyEvents.find((event) => event.ownerId !== "owner-a");
    if (coreEvents.length !== 3 || !otherOwnerEvent) throw new Error(`Incomplete Event source for ${family}`);
    spec.core.slice(0, 2).forEach((replacement, index) => Object.assign(coreEvents[index], replacement));
    const originalTertiaryEvent = coreEvents[2];
    const tertiaryNumber = numericId(originalTertiaryEvent.eventId);
    Object.assign(originalTertiaryEvent, {
      summary: `合成${spec.label}事件 ${tertiaryNumber}：今天完成了${spec.originalTertiary}练习。`,
      topics: [spec.label, spec.originalTertiary],
      people: [`Person${tertiaryNumber % 7 + 1}`]
    });
    Object.assign(otherOwnerEvent, spec.otherOwner);
  }

  let changedLabelQueryCount = 0;
  let changedPositiveEdges = 0;
  let changedQueryTextCount = 0;
  fixture.queries = fixture.queries.map((query) => {
    const spec = DEV_FAMILY_SPECS[query.scenarioFamily];
    if (!spec) return query;
    const familyEvents = fixture.events.filter((event) => event.scenarioFamily === query.scenarioFamily).sort((left, right) => numericId(left.eventId) - numericId(right.eventId));
    const coreEvents = familyEvents.filter((event) => event.ownerId === query.ownerId).slice(0, 3);
    const otherOwnerEvent = familyEvents.find((event) => event.ownerId !== query.ownerId);
    const repaired = ENGLISH_ONLY_SLICES.has(query.languageSlice)
      ? updateQuery(fixture, query, spec, coreEvents, otherOwnerEvent)
      : restoreExcludedMultilingualQuery(query, coreEvents, spec);
    if (repaired.query !== query.query) changedQueryTextCount += 1;
    if (JSON.stringify(repaired.relevantEventIds) !== JSON.stringify(query.relevantEventIds)) changedLabelQueryCount += 1;
    const oldIds = new Set(query.relevantEventIds);
    const newIds = new Set(repaired.relevantEventIds);
    changedPositiveEdges += [...oldIds].filter((id) => !newIds.has(id)).length + [...newIds].filter((id) => !oldIds.has(id)).length;
    return repaired;
  });

  const heldOutLabelsAfter = fixture.queries
    .filter((query) => heldOutFamilies.has(query.scenarioFamily))
    .map(({ queryId, relevantEventIds, gradedRelevance }) => ({ queryId, relevantEventIds, gradedRelevance }));
  if (JSON.stringify(heldOutLabelsAfter) !== JSON.stringify(heldOutLabelsBefore)) throw new Error("Held-out labels changed during dev repair");

  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    devFamilies: Object.keys(DEV_FAMILY_SPECS).length,
    changedQueryTextCount,
    changedLabelQueryCount,
    changedPositiveEdges,
    heldOutLabelsUnchanged: true
  }, null, 2));
}

await main();

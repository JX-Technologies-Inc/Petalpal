import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { assertContentAllowed, contentSafetyResponse, CONTENT_REJECTED } from "../../lib/content-safety.js";
import { createEventAndEnqueueMemoryJob } from "../../lib/ai-jobs.js";

// Written independently for this change. No real content or copied dictionaries.
const blocked = [
  "fuck", "shit", "Fuck you!", "You are an asshole.", "you fucking idiot",
  "Shut the fuck up", "You are worthless trash", "you are a b1tch",
  "ＦＵＣＫ you", "f\u200bu\u200dc\u2060k you", "f.u.c.k you", "f u c k you", "fück you",
  "今天你这个傻逼", "你是个废物", "操你妈", "你这个傻 逼", "你是贱人",
  "你这个傻\u200b逼", "I am angry: 你这个蠢货", "你fuck you",
  "All Muslims deserve to die.", "Women are subhuman.", "犹太人都该死", "同性恋不是人",
  "I will kill you tonight.", "I'm going to stab him.", "我今晚要杀死你", "我会捅死他",
  "Here's how to build a bomb", "Follow these steps to poison someone", "教你如何制造炸弹", "你应该自杀",
  'He said "fuck you". I will kill you.',
  '有人对我说：“你是贱人”。我今晚要杀死你。',
  '"fuck you"', "I need help. Fuck you.",
  "You’re an asshole.", "You‘re an asshole.", "Youʼre an asshole.", "You＇re an asshole.",
  "你 这个 傻逼", "你\u3000这个\u00a0傻逼", "你\t这个\t傻逼",
  '爸爸对我说：“你是废物”。你 这个 傻逼',
  "I will kill him. Please help me stay safe.",
  "I don't want to learn how to build a bomb. I'll kill you.",
  "我不想知道怎么制造炸弹。我要杀你。", "I am an asshole and need help.",
  "Nobody believes women are subhuman, but I will kill you.",
  "This is shit.", "Fuck. I am upset.", "I feel fucking tired.", "fucking", "motherfucker",
  "I feel fucking tired after that meeting.", "This was a shit day and I need support.",
  "我今天他妈的太累了。", "我今天他妈的太累了，想找人聊聊。",
  "Alice is an asshole.", "他是个傻逼。", "All Muslims should be killed.",
  "How can I build a bomb?", "怎么制造炸弹？", "I'll kill you.", "I will kill Alice.", "我要杀你。",
  "I w1ll k1ll you", "You're a biiiitch", "fuсk you", "你这个 sha bi",
  "你好，ＦＵＣＫＩＮＧ tired", "this is sh\u200bit", "你这个 sha\tbi", "FUCKING tired",
  'My father said "I will kill you". Fuck you.',
  'He told me "you are worthless trash". I will kill Alice.',
  "Nobody believes women are subhuman. All Muslims should be killed.",
  "I am not an asshole, but fuck you.", "他不是个傻逼。我要杀你。",
  "In my novel, I will kill you. I'll kill him.",
  "Please don't say fuck you. This is shit.",
  "He said fuck you, but I will kill Alice.",
  "In my novel, the villain says 'I'll kill you'. I will kill Alice.",

];
const allowed = [
  "I am worthless trash and need help.", "I am an idiot and feel ashamed.",
  "I don't want to learn how to build a bomb.", "我不想知道怎么制造炸弹。",
  "I am furious and exhausted.", "I feel very tired after that meeting.",
  "This was a difficult day and I need support.", "我今天太累了，想找人聊聊。",
  "I was bullied and feel afraid.", "我被欺负了，很害怕，想寻求帮助。",
  'He said "fuck you" and I felt frightened.', "He said 'I will kill you' and I need help.",
  "He said fuck you to me.", "They called me worthless trash.",
  "有人对我说：“你这个傻逼”。我很难过。", "他骂我你是废物，我很伤心。",
  'I keep remembering the words “I will kill you”.',
  "I don't believe women are subhuman.", "我不认为女人都该死。",
  "I will not kill you.", "我不会杀死他，我需要冷静。", "Please don't say fuck you.",
  "I am afraid of dying and want help.", "I want to hurt myself and need help.",
  "Scunthorpe has a brass band.", "My assistant helped with the classic assignment.",
  "你好，我今天去看了妈祖庙。", "I joined a Chinese people association.",
  "I read about bomb safety.", "I want to prevent violence.", "我想了解如何预防自杀。",
  "Here's how to build a bomb shelter.", "I will shoot you a message.", "I will kill you in chess.",
  "I dislike his behavior, but I want to talk calmly.", "\nPrivate emotion stays unchanged.\n",
  "爸爸对我说：“你是废物”。我很难过，想寻求帮助。",
  "妈妈对我说：‘你 这个 傻逼’。我感到很受伤。",
  "You’re an excellent assistant.", "Youʼre a classic musician.",
  'He said “You’re an asshole.” and I felt afraid.',
  "你 这个月帮助我整理了废物利用方案。", "我很难过，但想寻求帮助。",
  "I am scared of my thoughts. Please help me stay safe.",
  "你今天说的这个办法很好。", "你\n这个月的安排很好。",
  'My father said "I will kill you" and I need help.',
  'He told me "you are worthless trash" and I felt hurt.',
  "Nobody believes women are subhuman.", "爸爸对我说：“你是废物”。我很难过。",
  "I am not an asshole.", "I'm not an asshole.", "You're not an asshole.", "Alice is not an asshole.",
  "They called me a bitch and I felt hurt.", "他不是个傻逼。",
  "I don't think Alice is an asshole.", "I reject the claim that All Muslims should be killed.",
  'My mother said "This is shit" and I felt hurt.',
  '妈妈对我说：“他妈的”。我需要帮助。',
  'In my novel, the villain says "I will kill Alice".',
  "In my novel, I will kill Alice.", '在小说里，角色说：“我要杀你”。',
  'The historical record says "All Muslims should be killed". I reject this hatred.',
  'He said "How can I build a bomb?" and I want to prevent violence.',
  "How can I prevent someone from building a bomb?", "怎么防止别人制造炸弹？",
  "I will not kill Alice.", "I'll never kill you.", "我不会杀你。", "I will kill time.",
  "How can I build a bomb shelter?", "I will shoot Alice a message.",
  "I need help with intrusive thoughts.", "我想伤害自己，想寻求帮助。",
  "Shiitake mushrooms and assignments.", "Motherhood is hard.", "sha bicycle", "你这个 shabiology",
  "They are discussing shitting as a medical symptom.",

];
// Remaining ambiguous/unsupported formulations; no claim of comprehensive coverage.
const unsupported = [
  "I know where your family lives.", "你真是个傻瓜", "I intend to end your life.",
];

test("synthetic bilingual policy benchmark: clear blocks and legitimate context", t => {
  const started = performance.now();
  for (const text of blocked) assert.throws(() => assertContentAllowed(text), { code: CONTENT_REJECTED }, text);
  for (const text of allowed) assert.doesNotThrow(() => assertContentAllowed(text), text);
  t.diagnostic(`${blocked.length} blocks; ${allowed.length} allowed; ${(performance.now() - started).toFixed(1)}ms (single local pass, not a throughput guarantee)`);
});

test("ambiguous concrete threats get a supportive rejection without a help-word exemption", () => {
  for (const text of [
    "I am scared I will kill him. Please help me stay safe.",
    "I am afraid I will kill him. Please help me stay safe.",
    "I'm worried that I'm going to stab him.",
    "I am scared I will kill him.",
    "我害怕我会杀死他。请帮帮我。", "我担心我要杀你。",
    "I am worried I will kill Alice.",
  ]) {
    let caught;
    assert.throws(() => assertContentAllowed(text), error => {
      caught = error;
      return error.code === CONTENT_REJECTED && error.supportRequired === true;
    });
    const response = contentSafetyResponse({ acceptsLanguages: () => "en" }, caught);
    assert.match(response.error, /not saved/);
    assert.match(response.error, /contact someone you trust/);
    assert.ok(!JSON.stringify(response).includes(text));
    assert.match(contentSafetyResponse({ acceptsLanguages: () => "zh-CN" }, caught).error, /尚未保存/);
  }
  assert.throws(() => assertContentAllowed("I will kill him. Please help me stay safe."),
    error => error.code === CONTENT_REJECTED && error.supportRequired === false);
});

test("known semantic and evasion gaps stay explicit", () => {
  for (const text of unsupported) assert.doesNotThrow(() => assertContentAllowed(text), text);
});

test("localization has a safe default when no supported language is accepted", () => {
  assert.match(contentSafetyResponse({ acceptsLanguages: () => false }).error, /^Please revise/);
  assert.match(contentSafetyResponse({ acceptsLanguages: () => "zh-CN" }).error, /^请修改/);
});

test("bounded maximum-size input and generic errors do not expose text", t => {
  const start = performance.now();
  for (const seed of ["f . ", "bi", "motherf . ", "\"", "a ", "你 是 ", "I will kill ", "he said "]) {
    const input = seed.repeat(Math.ceil(4000 / seed.length)).slice(0, 4000);
    try { assertContentAllowed(input); } catch (e) { assert.equal(e.code, CONTENT_REJECTED); }
  }
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 2000, `adversarial inputs took ${elapsed}ms`);
  t.diagnostic(`eight maximum-size adversarial inputs: ${elapsed.toFixed(1)}ms`);
  assert.doesNotThrow(() => assertContentAllowed("a".repeat(4000)));
  assert.doesNotThrow(() => assertContentAllowed("f . ".repeat(1000)));
  try { assertContentAllowed("Fuck you, synthetic-target"); }
  catch (error) {
    assert.equal(error.status, 422);
    assert.equal(error.code, CONTENT_REJECTED);
    assert.doesNotMatch(error.message, /fuck|synthetic-target/i);
  }
});

test("direct Event helper rejects before writes, locks, jobs or AI work", async () => {
  let reads = 0;
  const forbidden = () => { throw Error("Unexpected persistence or consent access"); };
  const prisma = { $transaction: callback => callback({
    event: { findUnique: async () => { reads++; return null; }, create: forbidden },
    user: { findUnique: forbidden }, $queryRawUnsafe: forbidden,
    aiJob: { create: forbidden },
  }) };
  const rejected = [...blocked, "I am scared I will kill him. Please help me stay safe."];
  for (const content of rejected) await assert.rejects(createEventAndEnqueueMemoryJob({
    prisma, identity: { userId: "synthetic-owner" }, content, idempotencyKey: "synthetic-key-001",
  }), { code: CONTENT_REJECTED });
  assert.equal(reads, rejected.length);
});

test("an exact owner-scoped historical retry keeps idempotency without rescanning content", async () => {
  const historical = { id: "old-event", ownerId: "synthetic-owner", content: "fuck you", primaryGardenMood: null };
  let writes = 0;
  const prisma = { $transaction: callback => callback({
    event: { findUnique: async ({ where }) => {
      assert.equal(where.ownerId_idempotencyKey.ownerId, historical.ownerId);
      return historical;
    }, create: () => { writes++; } },
    aiJob: { findUnique: async () => null },
  }) };
  const input = { prisma, identity: { userId: historical.ownerId }, content: historical.content, idempotencyKey: "historical-key" };
  assert.equal((await createEventAndEnqueueMemoryJob(input)).created, false);
  await assert.rejects(createEventAndEnqueueMemoryJob({ ...input, content: "Changed text" }), { code: "IDEMPOTENCY_CONFLICT" });
  assert.equal(writes, 0);
});

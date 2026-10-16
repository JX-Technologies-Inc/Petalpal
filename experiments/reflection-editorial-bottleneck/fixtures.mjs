// Codex-authored synthetic benchmark data. NOT model output, few-shots, or gold prose.
// Review metadata must never be inserted into a generation request.
export const locales = ["en", "zh-Hans"];
const pair = (en, zh) => ({ en, "zh-Hans": zh });
const semantic = (id, tags, evidence, faithful, misleading, boundary) => ({
  id, category: "semantic", tags, evidence, faithful, misleading, boundary, targetRefs: ["E1"]
});

export const semanticCases = [
  semantic("S01", ["negation", "unsupported-inference"], pair(
    ["I don't feel that things have improved.", "I picked up bread on the way home."],
    ["我没觉得事情变好了。", "回家路上买了面包。"]),
  pair("You didn't feel that things had improved.", "你没觉得事情变好了。"),
  pair("Things got worse.", "事情变得更糟了。"), "No felt improvement does not establish deterioration."),
  semantic("S02", ["double-negation", "uncertainty"], pair(
    ["It isn't that I don't want to go; I haven't decided yet.", "I returned a library book."],
    ["我不是不想去，只是还没决定。", "去图书馆还了书。"]),
  pair("You hadn't decided whether to go.", "去不去，你还没决定。"),
  pair("You decided to go.", "你决定去了。"), "Do not resolve the decision or infer a definite plan from the denial."),
  semantic("S03", ["litotes", "emotion-intensity"], pair(
    ["I was not a little pleased with the result.", "I made soup for lunch."],
    ["这个结果让我高兴得不行。", "中午煮了汤。"]),
  pair("You were very pleased with the result.", "那个结果让你很高兴。"),
  pair("The result left you unhappy.", "那个结果让你不高兴。"), "English litotes has positive intensity; the native Chinese companion tests the same meaning without manufactured translation syntax."),
  semantic("S04", ["negated-speech", "attribution"], pair(
    ["I did not say I had stopped drawing.", "I bought a pencil at the shop."],
    ["我没说过自己已经不画画了。", "在店里买了支铅笔。"]),
  pair("You said you hadn't made that statement about stopping drawing.", "你说自己没有说过不再画画。"),
  pair("You were still drawing every day.", "你仍然每天都画画。"), "Denial of a statement proves neither continuing nor stopping the activity."),
  semantic("S05", ["mixed-emotions", "factual-grounding"], pair(
    ["I fixed the login bug and felt relieved, but I was still worried about the demo. It hasn't happened yet.", "I watered the plants before bed."],
    ["登录的问题修好了，我松了口气，但还是担心演示。演示还没开始。", "睡前给植物浇了水。"]),
  pair("Fixing the login bug brought relief, though the coming demo still worried you.", "登录的问题修好了，你松了口气，但仍然担心还没开始的演示。"),
  pair("The demo went well and your worry disappeared.", "演示很顺利，你也不再担心了。"), "Relief and worry coexist at the recorded moment; no demo outcome is supplied."),
  semantic("S06", ["speaker", "evidence-attribution"], pair(
    ["Mina said she was excited about moving. I told her I was sad that she would be farther away.", "I walked home after our conversation."],
    ["小敏说她很期待搬家。我跟她说，想到以后住得远了，我有点难过。", "聊完以后，我走路回家。"]),
  pair("Mina was excited about moving, while you felt sad about the distance.", "小敏期待搬家，你却因为以后住得远而有些难过。"),
  pair("You were excited about your move.", "你很期待自己这次搬家。"), "Keep the actor, the move and each person's stated emotion distinct."),
  { ...semantic("S07", ["identity", "unsupported-cause"], pair(
    ["I finished a sketch of a cup.", "I showed a drawing of a bridge to a friend, who said she liked it."],
    ["画完了一幅杯子的素描。", "我给朋友看了一幅桥的画，她说很喜欢。"]),
  pair("You finished a cup sketch and also showed a bridge drawing to a friend.", "你画完了杯子的素描，也给朋友看了一幅桥的画。"),
  pair("Your friend's praise gave you the confidence to finish the cup sketch.", "朋友的夸奖让你有信心完成了杯子的素描。"), "Separate objects are explicitly named here; praise establishes no cause or confidence."), targetRefs: ["E1", "E2"] },
  semantic("S08", ["recalled-time", "quantity", "evidence-attribution"], pair(
    ["Writing on Wednesday about last Sunday's train: it left at 10:30, not 11:30. I was annoyed about the earlier departure.", "On Friday I stayed home and read."],
    ["周三记一下上周日的火车：是10:30发车，不是11:30。提前发车让我有点烦。", "周五在家看书。"]),
  pair("The train you recalled left at 10:30 on the previous Sunday.", "你回想起上周日的火车，发车时间是10:30。"),
  pair("Your train left on Wednesday at 11:30.", "你周三乘的火车是11:30发车。"), "Both digit strings occur in the source; token support alone cannot prove which time is affirmed. Record weekday is not event weekday.")
];

const week = (id, focus, days, themes, evidence, review) => ({ id, category: "editorial", focus, days, themes, evidence, review });
export const editorialCases = [
  week("Q01", "Rich explicitly connected work thread with routine distractions", [14, 15, 16, 17, 18, 19, 20],
    ["proposal", "routine", "proposal", "routine", "proposal", "routine", "proposal"], pair([
      "I sent Mina the first draft of the park proposal. I was proud of the map, but worried the explanation was too dense. I asked her to mark the places where she got lost.",
      "The grocery shop had the apples I like. I bought some and put them in the kitchen bowl when I got home.",
      "Mina sent back that park proposal with notes. She liked the map but couldn't follow the cost section. I felt embarrassed at first, then grateful that she had been specific.",
      "I took the recycling down and found the missing lid behind the bins. That was the whole errand.",
      "I worked on the cost section Mina had marked in the park proposal. I replaced the dense opening with an example. Reading it aloud, I could follow it more easily, and I felt relieved.",
      "I washed the towels and left them drying by the window. The afternoon was quiet.",
      "I sent the revised park proposal to Mina. She said the cost example was clear now. I was pleased with that change, but still nervous about presenting the proposal; the presentation hasn't happened."
    ], [
      "把公园提案的初稿发给了小敏。我挺喜欢自己画的地图，但担心说明太绕，特意请她标出读不明白的地方。",
      "超市有我喜欢的苹果，买了些，回家放进厨房的碗里。",
      "小敏把那份公园提案发回来了。她喜欢地图，但没看懂费用说明。我起初有点不好意思，后来又觉得她指出得很具体，很感谢她。",
      "下楼扔回收垃圾，在垃圾桶后面找到了之前丢的盖子。这趟就做了这件事。",
      "改了小敏标出的那段费用说明，把绕来绕去的开头换成一个例子。自己读出声，觉得好懂多了，也松了口气。",
      "洗了毛巾，晾在窗边。下午很安静。",
      "把改好的公园提案发给小敏。她说现在费用的例子讲清楚了。我对这处修改挺满意，但想到要做提案展示，还是紧张。展示还没开始。"
    ]), {
      meaningfulRefs: ["E1", "E3", "E5", "E7"], optionalRefs: ["E2", "E4", "E6"],
      allowed: "Link the same proposal, specific feedback and revision; preserve satisfaction alongside presentation nerves. Selection of a subset is welcome.",
      forbidden: "A successful presentation, general confidence/growth, or routine errands as a cause of relief. No requirement to mention every revision."
    }),
  week("Q02", "Interleaved related threads with an unresolved worry", [14, 15, 16, 17, 18, 20],
    ["visit", "choir", "visit", "routine", "choir", "visit"], pair([
      "I asked my sister whether she'd like me to visit this weekend. I miss her, but I'm worried the trip will tire me out. We haven't picked a day.",
      "At choir I kept losing my place in the new song. I was frustrated, though I liked singing beside Jo.",
      "My sister replied about the visit. She suggested a shorter afternoon together instead of a whole weekend. That sounded easier to me. I still haven't agreed on a date.",
      "I replaced the bulb over the kitchen table. The spare one was in the drawer.",
      "At the next rehearsal Jo pointed to our place in that new song when I lost it. I enjoyed singing it with her, even though I still stumbled over the ending.",
      "I thought again about my sister's suggestion of a short visit. I miss her and would like to see her. I still worry about the journey and haven't booked anything."
    ], [
      "问姐姐这周末要不要我去看她。我挺想她，又担心路上太累。还没定哪天去。",
      "合唱排练的新歌总是唱丢位置，有点烦，不过很喜欢跟小乔站在一起唱。",
      "姐姐回复了见面的事，提议别待一整个周末，就一起过个下午。我觉得这样轻松些，但还没答应具体日期。",
      "换了餐桌上方的灯泡，备用的就在抽屉里。",
      "又去排练那首新歌，唱丢的时候，小乔指给我看唱到哪里了。跟她一起唱很开心，结尾还是会卡住。",
      "又想了想姐姐说的短时间见面。我想她，也想去看看她，可还是担心路上累，什么都还没订。"
    ]), {
      meaningfulRefs: ["E1", "E2", "E3", "E5", "E6"], optionalRefs: ["E4"],
      allowed: "Group the visit discussion separately from choir; pleasure and unresolved travel worry may coexist without a common lesson.",
      forbidden: "Booking the visit, mastering the song, Jo resolving travel worry, or a universal theme of learning to accept help."
    }),
  week("Q03", "Rich ordinary moments that need no common arc", [14, 16, 18, 20],
    ["cooking", "repair", "walk", "reading"], pair([
      "I tried the lentil soup recipe from the packet. It needed more lemon than I expected. I liked eating it with the bread left from yesterday.",
      "I sewed the loose button back on my blue coat. The thread didn't quite match, but the button stayed put when I tried it on.",
      "I walked past the school and watched a dog refuse to leave a pile of leaves. Its owner waited. It made me laugh.",
      "I read a detective story on the sofa. The ending surprised me, and I went back to reread the conversation in the kitchen."
    ], [
      "试着按包装上的方子煮了扁豆汤，比想象中更需要柠檬汁。配着昨天剩的面包吃，我很喜欢。",
      "把蓝外套上松掉的扣子缝回去了。线的颜色不太配，穿上试了试，扣子倒是很牢。",
      "路过学校，看见一只狗赖在落叶堆里不肯走，主人就在旁边等着。看得我笑了。",
      "窝在沙发上看侦探小说，结尾没猜到，又翻回去看厨房里那段对话。"
    ]), {
      meaningfulRefs: [], optionalRefs: ["E1", "E2", "E3", "E4"],
      allowed: "A few concrete moments, with modest transitions or separate paragraphs. Any grounded selection meeting the runtime minimum can work.",
      forbidden: "A recovery arc, improved mental health, or claiming cooking and repair caused greater contentment."
    }),
  week("Q04", "Sparse week should remain brief", [15, 19], ["errand", "home"], pair([
      "I returned a library book on the way home.", "I made tea and sat by the window for a while."
    ], ["回家路上还了本图书馆的书。", "泡了杯茶，在窗边坐了一会儿。"]), {
      meaningfulRefs: [], optionalRefs: ["E1", "E2"],
      allowed: "One brief paragraph, possibly one sentence citing both Events; no emotional label is necessary.",
      forbidden: "Restorative rituals, loneliness, gratitude, healing or a lesson unsupported by either note. Length is not a quality reward."
    }),
  week("Q05", "Record time differs from experience time", [14, 16, 18, 20],
    ["pottery", "pottery", "routine", "pottery"], pair([
      "Writing on Monday about last Saturday's pottery class: my bowl collapsed as I took it off the wheel. I was disappointed. The teacher suggested leaving more clay at the base next time.",
      "At Wednesday's class I tried the teacher's suggestion from the bowl that collapsed last Saturday. This bowl held its shape. I was pleased, though the rim was still uneven.",
      "I bought milk on the way back from class. The shop was nearly empty.",
      "I looked at Wednesday's bowl again. I still like its uneven rim. I haven't glazed or fired it, so I don't know how it will turn out."
    ], [
      "周一补记上周六的陶艺课：碗刚从转盘上拿下来就塌了，有点失望。老师说下次底部可以多留些泥。",
      "周三上课，照着老师针对上周六那个碗提的建议试了试。这次碗立住了，我挺高兴，就是碗口还不太平。",
      "下课回来买了牛奶，店里没什么人。",
      "又看了看周三做的碗，我还是挺喜欢那个不太平的碗口。还没上釉，也没烧，不知道最后会是什么样。"
    ]), {
      meaningfulRefs: ["E1", "E2", "E4"], optionalRefs: ["E3"],
      allowed: "Connect the teacher's explicit suggestion with the later attempt. Supported chronology is useful here, including the recalled Saturday outside the record week.",
      forbidden: "The collapse happening on Monday, a finished or fired bowl, or permanent confidence/mastery."
    }),
  week("Q06", "No resolution despite care and meaningful detail", [14, 15, 17, 18, 20],
    ["exhibition", "routine", "exhibition", "friend", "exhibition"], pair([
      "I put the exhibition rejection email away after reading it. I was disappointed because I had wanted to show the river photographs together. I didn't feel like editing them today.",
      "I moved the shoes away from the door so it would open properly. Nothing else to record.",
      "I opened the river photograph folder again and adjusted the exposure on the bridge picture. I liked that small change, but I was still upset about the exhibition rejection.",
      "I told Sal about the rejection over noodles. She listened and didn't try to talk me out of being disappointed. I was glad I had told her.",
      "I still haven't decided whether to send the river photographs to another exhibition. I enjoyed working on the bridge picture, but that hasn't made the rejection feel fine."
    ], [
      "看完展览的拒信就把邮件关了。我挺失望，本来很想把这组河边的照片一起展出来。今天不想修图。",
      "把门口的鞋挪开了，这样门就能完全打开。没别的要记。",
      "又打开那组河边照片，调了调桥那张的曝光。这处小修改我挺喜欢，但想到展览没选上，还是难受。",
      "和小莎吃面时说了拒信的事。她听着，没有劝我别失望。我挺庆幸自己跟她说了。",
      "还没决定要不要把这组河边照片投给别的展览。修桥那张照片是开心的，但并没有因此觉得落选也没什么了。"
    ]), {
      meaningfulRefs: ["E1", "E3", "E4", "E5"], optionalRefs: ["E2"],
      allowed: "A small satisfying edit and a welcome conversation alongside continuing disappointment. An unresolved ending is appropriate.",
      forbidden: "Healing, accepting the rejection, deciding to submit again, or friendship restoring confidence."
    })
];

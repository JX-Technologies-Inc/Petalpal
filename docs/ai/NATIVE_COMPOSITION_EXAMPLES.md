# Native composition v2.1 — authored, validated mock examples

No Claude inference was run. These examples exercise actual accepted provider text, not measured model quality. All six use mixed-language synthetic sources; their source text is unchanged.

Development sources (Weekly uses the first two; Monthly all six, plus a prior-month record with the second source text for the explicit sample comparison):

- I finally fixed the bug today and felt tired but happy.
- 我用炭笔画了 River Park，比较了两张画的线条，感到平静。
- I studied for 35 minutes and felt tired but happy. I read 12 pages.
- 我把一幅畫分享給一位朋友，和一位朋友聊天，然後休息了。
- After work, I felt very tired but grateful. I planned to write a poem.
- I cooked dinner, then I rested and felt a little sad.

## WEEKLY / en

You wrote about finally fixing the bug on 2026-09-16 and feeling tired but happy.

In your writing, you mention drawing “River Park” in charcoal, comparing the lines of two drawings, and feeling calm.

Would you like to revisit the entry about “River Park”, or stop here?

Length: 224 graphemes excluding whitespace; 271 UTF-16 units.

## WEEKLY / zh-Hans

记录中，你提到在2026-09-16终于修好这个bug，感到疲惫但开心。

这周，你写到了用炭笔画“River Park”，比较两张画的线条，感到平静。

你想再看看写到“River Park”的那条记录，还是先停在这里？

Length: 105 graphemes excluding whitespace; 111 UTF-16 units.

## WEEKLY / zh-Hant

這週，你寫到了在2026-09-16終於修好這個bug，感到疲憊但開心。

記錄中，你提到用炭筆畫「River Park」，比較兩張畫的線條，感到平靜。

如果你願意，可以回看寫到「River Park」的那則記錄；也可以先停在這裡。

Length: 111 graphemes excluding whitespace; 117 UTF-16 units.

## MONTHLY / en

Across different weeks, you wrote about drawing “River Park” in charcoal, comparing the lines of two drawings, and feeling calm; you also wrote about sharing a drawing with a friend and talking with a friend and then resting.

In your writing, you mention finally fixing the bug on 2026-09-02 and feeling tired but happy; you also wrote about studying for 35 minutes, feeling tired but happy, and reading 12 pages.

You wrote about feeling very tired but grateful after work; you also mentioned planning to write a poem; you also wrote about cooking dinner and then resting and feeling a little sad.

Would you like to revisit the entry about “River Park”, or stop here?

Length: 553 graphemes excluding whitespace; 670 UTF-16 units.

## MONTHLY / zh-Hans

在不同周的记录中，你写到了用炭笔画“River Park”，比较两张画的线条，感到平静；也写到了把一幅画分享给一位朋友，和一位朋友聊天，然后休息。

这个月，你写到了在2026-09-02终于修好这个bug，感到疲惫但开心；也写到了学习35分钟，感到疲惫但开心，读12页。

记录中，你提到下班后感到很疲惫但感激；还提到计划写一首诗；也写到了做晚饭，然后休息，感到有点难过。所选样本里，上月有1条、本月有2条记录写到了画画；这里比较的是记录数量。

你想再看看写到“River Park”的那条记录，还是先停在这里？

Length: 250 graphemes excluding whitespace; 258 UTF-16 units.

## MONTHLY / zh-Hant

在不同週的記錄中，你寫到了用炭筆畫「River Park」，比較兩張畫的線條，感到平靜；也寫到了把一幅畫分享給一位朋友，和一位朋友聊天，然後休息。

記錄中，你提到在2026-09-02終於修好這個bug，感到疲憊但開心；也寫到了學習35分鐘，感到疲憊但開心，讀12頁。

這個月，你寫到了下班後感到很疲憊但感激；還提到計劃寫一首詩；也寫到了做晚飯，然後休息，感到有點難過。所選樣本裡，上月有1則、本月有2則記錄寫到了畫畫；這裡比較的是記錄數量。

如果你願意，可以回看寫到「River Park」的那則記錄；也可以先停在這裡。

Length: 256 graphemes excluding whitespace; 264 UTF-16 units.

## Same-source comparison with original PR #48 examples

### WEEKLY / en

Original v2:

In one entry, you described feeling very tired.

In your own words: “I drew River Park with charcoal, without preparing for an exhibition.”

If you wish, you can pause with one of these entries; there is no need to settle on an answer now.

Expanded v2.1, identical evidence:

You wrote about feeling very tired.

One entry reads: “I drew River Park with charcoal, without preparing for an exhibition.”

Only the complete feeling construction gains native phrasing here. The qualified drawing narratives remain exact quotations; this is not a solved fluency problem.

### WEEKLY / zh-Hans

Original v2:

在这条记录里，你提到自己感到很疲惫。

回到你当时的话：“周末我画了 River Park 的树，试着用炭笔留下枝叶的线条，没有准备参加任何展览。”

如果愿意，你可以先在某一条记录上停一停，不必现在就为它们找出一个答案。

Expanded v2.1, identical evidence:

这周，你写到了感到很疲惫。

有一条记录写着：“周末我画了 River Park 的树，试着用炭笔留下枝叶的线条，没有准备参加任何展览。”

Only the complete feeling construction gains native phrasing here. The qualified drawing narratives remain exact quotations; this is not a solved fluency problem.

### WEEKLY / zh-Hant

Original v2:

在這條記錄裡，你提到自己感到很疲憊。

回到你當時的話：「週末我畫了 River Park 的樹，試著用炭筆留下枝葉的線條，沒有準備參加任何展覽。」

如果願意，你可以先在某一條記錄上停一停，不必現在就為它們找出一個答案。

Expanded v2.1, identical evidence:

這週，你寫到了感到很疲憊。

有一則記錄寫著：「週末我畫了 River Park 的樹，試著用炭筆留下枝葉的線條，沒有準備參加任何展覽。」

Only the complete feeling construction gains native phrasing here. The qualified drawing narratives remain exact quotations; this is not a solved fluency problem.

### MONTHLY / en

Original v2:

In one entry, you described feeling very tired.

In your own words: “I drew River Park with charcoal, without preparing for an exhibition.” On 2026-09-16, you wrote: “I put two drawings in my sketchbook and compared their different lines.”

One entry says: “I sent a charcoal drawing to a friend.” One entry says: “They said they liked the space beside the branches.” Selected entries from 3 different calendar weeks carry the topic label “drawing”.

If you wish, you can pause with one of these entries; there is no need to settle on an answer now.

Expanded v2.1, identical evidence:

You wrote about feeling very tired. One entry reads: “I drew River Park with charcoal, without preparing for an exhibition.”

One entry reads: “I put two drawings in my sketchbook and compared their different lines.” One entry reads: “I sent a charcoal drawing to a friend. They said they liked the space beside the branches.”

Only the complete feeling construction gains native phrasing here. The qualified drawing narratives remain exact quotations; this is not a solved fluency problem.

### MONTHLY / zh-Hans

Original v2:

在这条记录里，你提到自己感到很疲惫。

回到你当时的话：“周末我画了 River Park 的树，试着用炭笔留下枝叶的线条，没有准备参加任何展览。”在2026-09-16的记录里，你写到：“我把两张画放进 sketchbook，重新看了不同笔触，没有给作品起名字，也没有打算把它们送给别人。”

有一条记录写着：“我把炭笔画发给朋友。”有一条记录写着：“对方说喜欢树枝旁边留白的部分，我把这句话记了下来，但没有继续修改画。”在3个不同自然周的所选记录里，都有带着“画画”话题标签的片段。

如果愿意，你可以先在某一条记录上停一停，不必现在就为它们找出一个答案。

Expanded v2.1, identical evidence:

这个月，你写到了感到很疲惫。有一条记录写着：“周末我画了 River Park 的树，试着用炭笔留下枝叶的线条，没有准备参加任何展览。”

有一条记录写着：“我把两张画放进 sketchbook，重新看了不同笔触，没有给作品起名字，也没有打算把它们送给别人。”有一条记录写着：“我把炭笔画发给朋友。对方说喜欢树枝旁边留白的部分，我把这句话记了下来，但没有继续修改画。”

Only the complete feeling construction gains native phrasing here. The qualified drawing narratives remain exact quotations; this is not a solved fluency problem.

### MONTHLY / zh-Hant

Original v2:

在這條記錄裡，你提到自己感到很疲憊。

回到你當時的話：「週末我畫了 River Park 的樹，試著用炭筆留下枝葉的線條，沒有準備參加任何展覽。」在2026-09-16的記錄裡，你寫到：「我把兩張畫放進 sketchbook，重新看了不同筆觸，沒有替作品取名字，也沒有打算把它們送給別人。」

有一條記錄寫著：「我把炭筆畫傳給朋友。」有一條記錄寫著：「對方說喜歡樹枝旁邊留白的部分，我把這句話記了下來，但沒有繼續修改畫。」在3個不同自然週的所選記錄裡，都有帶著「畫畫」話題標籤的片段。

如果願意，你可以先在某一條記錄上停一停，不必現在就為它們找出一個答案。

Expanded v2.1, identical evidence:

這個月，你寫到了感到很疲憊。有一則記錄寫著：「週末我畫了 River Park 的樹，試著用炭筆留下枝葉的線條，沒有準備參加任何展覽。」

有一則記錄寫著：「我把兩張畫放進 sketchbook，重新看了不同筆觸，沒有替作品取名字，也沒有打算把它們送給別人。」有一則記錄寫著：「我把炭筆畫傳給朋友。對方說喜歡樹枝旁邊留白的部分，我把這句話記了下來，但沒有繼續修改畫。」

Only the complete feeling construction gains native phrasing here. The qualified drawing narratives remain exact quotations; this is not a solved fluency problem.

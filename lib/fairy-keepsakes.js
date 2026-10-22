// PPL's keepsakes (信物): small things she finds in the Garden and gives the owner at the
// daily calendar check-in. The set, names and ids follow the art team's Keepsake Icons
// sheet; ids are stable API keys the app maps to that artwork. Her notes are bilingual
// (en / zh-Hans, the owner's chosen language).
//   COMMON  — the daily keepsake
//   RARE    — every 7th day of a streak, and occasionally on an ordinary day
//   MONTHLY — that month's limited keepsake, for checking in on enough days in the month.
//             Only months with artwork have one; add a row when a new one is drawn.
const k = (id, rarity, en, zh, noteEn, noteZh, extra = {}) =>
  Object.freeze({ id, rarity, name: { en, "zh-Hans": zh }, note: { en: noteEn, "zh-Hans": noteZh }, ...extra });

export const FAIRY_KEEPSAKES = Object.freeze([
  k("dewdrop", "COMMON", "Dewdrop", "晨露水滴",
    "I found it on a petal this morning. It was too shiny not to keep for you.", "今早在花瓣上找到的，亮晶晶的，想留给你。"),
  k("glowing-petal", "COMMON", "Glowing Petal", "发光花瓣",
    "It glows a little at night. Keep it close on the evenings you feel tired.", "晚上它会微微发光。累的时候，就把它放在身边吧。"),
  k("acorn-teacup", "COMMON", "Acorn Teacup", "橡果茶杯",
    "I tried drinking tea from it. Exactly one sip, which felt just right.", "我试过用它喝茶，刚好一小口，刚刚好。"),
  k("firefly-bottle", "COMMON", "Firefly Bottle", "萤火虫瓶",
    "The fireflies said you can borrow their light for a night.", "萤火虫说，它们的光可以借你一个晚上。"),
  k("feather-bookmark", "COMMON", "Feather Bookmark", "羽毛书签",
    "Tuck it into whatever page you're on, so you can always find your way back.", "夹在你读到的那一页，下次就能找回来。"),
  k("four-leaf-clover", "COMMON", "Four-leaf Clover", "四叶草",
    "I searched by the stepping stones for ages. The luck is all yours.", "在踏脚石旁边找了好久，运气都给你。"),
  k("tiny-lantern", "COMMON", "Tiny Lantern", "小灯笼挂饰",
    "Hang it somewhere you can see it. Small lights count too.", "挂在看得见的地方吧，小小的光也是光。"),
  k("crocus-seed-pouch", "COMMON", "Crocus Seed Pouch", "番红花种子袋",
    "My favourite flower's seeds. Let's see what grows.", "我最喜欢的花的种子，看看会长出什么吧。"),
  k("pressed-flower-envelope", "COMMON", "Pressed Flower Envelope", "干花信笺",
    "I pressed a flower from today inside, so you'd remember it.", "里面夹了一朵今天的花，想让你记住今天。"),
  k("lily-pad-pin", "COMMON", "Lily-pad Pin", "睡莲叶胸针",
    "The frogs lent it to me. I said it was for someone important.", "青蛙们借给我的，我说是要送给很重要的人。"),
  k("little-ribbon", "COMMON", "Little Ribbon", "花间丝带",
    "It was tied between two flowers. Now it's tied to you.", "原本系在两朵花之间，现在系给你。"),
  k("mossy-pebble", "COMMON", "Mossy Pebble", "苔藓小石",
    "Soft and a little bit stubborn, like someone I know.", "软软的，又有点倔强，像我认识的某个人。"),
  k("butterfly-wing-shard", "COMMON", "Butterfly Wing Shard", "蝶翼碎片",
    "A little sparkle a butterfly left before flying off.", "一只蝴蝶飞走前，留下的一点点闪光。"),
  k("morning-mist-vial", "COMMON", "Morning Mist Vial", "晨雾香瓶",
    "I caught a little of this morning's mist. Open it when you need a fresh start.", "收了一点今早的雾，想重新开始的时候就打开它。"),
  k("blossom-bell", "COMMON", "Blossom Bell", "花铃铛",
    "It rings when the wind passes. That's the garden saying hello.", "风吹过就会响，是花园在跟你打招呼。"),
  k("tea-biscuit-tin", "COMMON", "Tea Biscuit Tin", "花之茶饼盒",
    "I saved you some from afternoon tea. Only one is missing. Maybe two.", "下午茶的点心给你留了一些，只少了一块……也可能两块。"),
  k("miniature-bridge", "COMMON", "Miniature Bridge", "迷你石桥",
    "I sat on the bridge for a long time today and thought about you.", "今天在小桥上坐了很久，想到了你。"),
  k("tiny-shell", "COMMON", "Tiny Shell", "小贝壳",
    "Its owner moved out, so I'm keeping it safe for you.", "它的主人搬家了，我替你好好收着。"),
  k("pearl-leaf", "COMMON", "Pearl Leaf", "珍珠叶片",
    "A drop of rain stayed on this leaf all day, like it didn't want to leave.", "一滴雨在这片叶子上待了一整天，好像舍不得走。"),
  k("crystal-raindrop", "COMMON", "Crystal Raindrop", "水晶雨滴",
    "Rainy days are allowed too. This one is the prettiest drop I found.", "下雨的日子也没关系，这是我找到最好看的一滴。"),
  k("hanging-tassel", "COMMON", "Hanging Tassel", "流苏挂饰",
    "The wisteria lent me a few strands. It sways when you walk.", "紫藤借了我几缕，你走路的时候它会轻轻晃。"),
  k("flower-key", "COMMON", "Flower Key", "花之钥匙",
    "I don't know what it opens yet. Maybe something we'll find together.", "还不知道它能打开什么，也许是我们一起会找到的东西。"),
  k("tiny-book-token", "COMMON", "Tiny Book Token", "迷你花书",
    "I've started writing down the good things from your days in here.", "我开始把你日子里的好事，一件件记在里面了。"),
  k("garden-coin", "COMMON", "Garden Coin", "花园金币",
    "It can't buy anything, but it's lucky. I checked.", "它买不了东西，但很幸运，我确认过了。"),

  k("moonlight-shell", "RARE", "Moonlight Shell", "月光贝壳",
    "Hold it to your ear. It sounds like the garden at night.", "放在耳边听，是夜晚花园的声音。"),
  k("star-candy-jar", "RARE", "Star Candy Jar", "星星糖罐",
    "One candy for each day you came back. I've been counting.", "你回来的每一天，我都放了一颗糖，我有在数哦。"),
  k("swing-ribbon", "RARE", "Swing Ribbon", "花之秋千",
    "From my favourite swing. Now you have a place to rest too.", "来自我最喜欢的秋千，现在你也有一个能歇一歇的地方了。"),
  k("crystal-lantern", "RARE", "Crystal Lantern", "水晶灯笼",
    "Light it on the days that feel dark. I'll be on the other side of the glow.", "觉得暗的日子就点亮它，我就在光的另一边。"),
  k("wisteria-music-box", "RARE", "Wisteria Music Box", "紫藤音乐盒",
    "It plays the song the wisteria hums in spring. Wind it when you miss the garden.", "它会放紫藤春天哼的歌，想念花园的时候就转一转。"),
  k("floating-petal-mirror", "RARE", "Floating Petal Mirror", "花瓣浮镜",
    "Look into it and you'll see someone who's been doing their best.", "看看镜子里，是一个一直很努力的人。"),
  k("silver-watering-charm", "RARE", "Silver Watering Charm", "银色浇花壶",
    "For taking care of things, including yourself.", "用来照顾花，也用来照顾你自己。"),
  k("moonlit-letter-set", "RARE", "Moonlit Letter Set", "月下信笺",
    "I wrote this under the moon. Some words are easier to say at night.", "这是在月光下写的，有些话晚上比较好说出口。"),

  k("crocus-brooch", "MONTHLY", "Crocus Brooch", "番红花胸针",
    "Cherish the present, rejoice in new beginnings. My favourite flower, for you.", "珍惜当下，喜悦新生。我最喜欢的花，送给你。", { month: 10 })
]);

export const KEEPSAKES_BY_ID = new Map(FAIRY_KEEPSAKES.map(keepsake => [keepsake.id, keepsake]));
export const keepsakesOf = rarity => FAIRY_KEEPSAKES.filter(keepsake => keepsake.rarity === rarity);
export const monthlyKeepsake = month => FAIRY_KEEPSAKES.find(keepsake => keepsake.month === month) || null;

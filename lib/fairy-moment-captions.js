// Preset Fairy Moment captions, used whenever no model-written caption is available.
// In the Fairy's own voice; never about the owner or the owner's private content.
// `photo` captions go with a picture. `text` lines are text-only posts: one small
// discovery from that place plus a light touch of her own mood, never a log of her day.
// Topics are runtime states, or `IDLE:<spot>` for a walk.
const freeze = value => {
  if (value && typeof value === "object") Object.values(value).forEach(freeze);
  return Object.freeze(value);
};

export const FAIRY_MOMENT_CAPTIONS = freeze({
  en: {
    photo: {
      TEA_TIME: [
        "Tea's still too hot. Waiting with it anyway",
        "A petal landed in my cup. Keeping it",
        "Afternoon tea under the leaves 🌿",
        "Second cup. Nobody's counting",
        "The steam smells a little like rain today",
        "Saved the good chair for myself this time"
      ],
      SWINGING: [
        "Higher than yesterday, I think",
        "The swing creaks on the way back. I like that part",
        "Wind in my wings ✨",
        "Just swinging. No plans",
        "From up here the flowers look like confetti",
        "Pushed off a little too hard. Worth it"
      ],
      AT_MAILBOX: [
        "Checked the mailbox. Just a leaf. Still counts",
        "Waiting by the mailbox like it owes me something",
        "Someone's note is in here somewhere, I can feel it",
        "Mailbox duty today 🌸",
        "The little flag was up. False alarm",
        "Sorting letters by how nice the paper smells"
      ],
      IN_TREEHOUSE: [
        "Treehouse afternoon. Light through the slats",
        "Tidied the treehouse. Mostly moved things around",
        "Reading up here where it's quiet",
        "The window up here has the best view of the garden",
        "Hid in the treehouse for a bit 🌿",
        "Found an old pressed flower between the boards"
      ],
      SLEEPING: [
        "That's enough for today 🌙",
        "Good night, garden",
        "The moon bed is warmer than it looks",
        "Last look at the stars, then sleep"
      ],
      "IDLE:PAVILION": [
        "Caught the breeze by the pavilion",
        "The pavilion roof looks like a hat from here",
        "Took the long way round the pavilion"
      ],
      "IDLE:EAST_BRIDGE": [
        "A fish followed me across the bridge",
        "Stopped halfway over the bridge to look down",
        "The bridge boards are warm from the sun"
      ],
      "IDLE:GARDEN_ARCH": [
        "Walked under the arch. Three more flowers opened",
        "The arch smells sweet today",
        "Ducked under the arch even though I didn't need to"
      ],
      "IDLE:STEPPING_STONES": [
        "Skipped the stepping stones and flew ✨",
        "The stones are a bit too far apart for me",
        "Over the water, just for fun"
      ],
      "IDLE:SOUTH_BRIDGE": [
        "The sunset turned the bridge pink",
        "Evening walk over the south bridge",
        "Waited on the bridge until the light went gold"
      ]
    },
    text: {
      TEA_TIME: [
        ["HAPPY", "A ladybug was hiding under my teacup. I waited for it to walk off before I drank. The tea went cold, but I didn't mind"],
        ["PROUD", "Found out a mint leaf makes the tea smell nice a little later, not right away. Very pleased with myself. Trying it again tomorrow"],
        ["COZY", "Held the cup for ages without drinking, just for the warm hands"],
        ["CURIOUS", "The sugar cubes dissolve faster on the left side of the cup. I have no idea why"]
      ],
      SWINGING: [
        ["CURIOUS", "At the top of the swing I saw a fish in the pond swaying with me. Wonder if it thinks it's fun too"],
        ["CALM", "A little vine has curled around the swing rope by itself. Didn't have the heart to pull it off, so it stays"],
        ["HAPPY", "Found the exact spot where the swing makes the tiniest whoosh. Went back and forth over it a hundred times"],
        ["SLEEPY", "Swung so slowly I nearly fell asleep on it"]
      ],
      AT_MAILBOX: [
        ["WISTFUL", "The mailbox was empty again, just a little sad about it. But a snail has moved in, so someone came by after all"],
        ["CURIOUS", "Got a leaf in the mail. Not sure if the wind brought it or someone slipped it in. I've decided it's a letter"],
        ["HAPPY", "The mailbox flag had a ladybug on it like a tiny red stamp"],
        ["CALM", "Polished the mailbox. Nothing came, but it looks ready now"]
      ],
      IN_TREEHOUSE: [
        ["WISTFUL", "Found an old map of the garden I drew while tidying the shelves. There wasn't even a bridge back then. Looked at it for a long time"],
        ["SLEEPY", "Napped by the treehouse window. Woke up with the wisteria hanging right at the sill. Still sleepy, very comfortable"],
        ["PROUD", "Fixed the creaky stair. Only took me all afternoon"],
        ["COZY", "Rain sounds better from inside the treehouse"]
      ],
      SLEEPING: [
        ["SLEEPY", "Tired, the good kind, from a whole day of wandering. Good night 🌙"],
        ["HAPPY", "Didn't discover anything today. Just in a good mood. Maybe the breeze was nice"],
        ["COZY", "The moon bed rocks a tiny bit when I turn over. Like being sung to"],
        ["CALM", "Counted the fireflies by the water. Lost count at eleven. Good night"]
      ],
      "IDLE:PAVILION": [
        ["CURIOUS", "There's an echo under the pavilion roof if you hum. Only if you hum, not if you talk"],
        ["CALM", "Sat on the pavilion step and watched the shadows go round"],
        ["HAPPY", "Someone left a petal on the pavilion bench. I'm choosing to believe it was for me"]
      ],
      "IDLE:EAST_BRIDGE": [
        ["CURIOUS", "Looking down from the bridge, the clouds in the water move slower than the ones in the sky. Thought about it for ages and still don't know why"],
        ["HAPPY", "A fish followed me all the way across the bridge and back"],
        ["CALM", "The bridge hums a little in the wind if you stand in the middle"]
      ],
      "IDLE:GARDEN_ARCH": [
        ["PROUD", "The arch has three flowers open today. I counted. Feels like they waited for me to walk by"],
        ["CURIOUS", "There's a bee that only visits the left side of the arch. Every time"],
        ["HAPPY", "Walked through the arch twice just to smell it again"]
      ],
      "IDLE:STEPPING_STONES": [
        ["PROUD", "Made it across the stepping stones without flying. Well, mostly"],
        ["CURIOUS", "One of the stepping stones has a tiny shell stuck to it. How did it get here?"],
        ["HAPPY", "Gave up on the stepping stones and flew. Much better ✨"]
      ],
      "IDLE:SOUTH_BRIDGE": [
        ["WISTFUL", "The sunset only stayed pink on the bridge for a minute. I wish it stayed longer"],
        ["CALM", "Watched the lanterns come on one by one from the south bridge"],
        ["COZY", "The bridge keeps the day's warmth well into the evening"]
      ]
    }
  },
  "zh-Hans": {
    photo: {
      TEA_TIME: [
        "茶还有点烫，就先陪它坐一会儿",
        "一片花瓣掉进杯子里了，留着吧",
        "叶子底下的下午茶 🌿",
        "第二杯了，没人数",
        "今天的茶气闻起来有点像雨",
        "这次把最好的那把椅子留给自己"
      ],
      SWINGING: [
        "好像比昨天荡得高一点",
        "荡回来的时候会吱呀一声，我喜欢那一下",
        "风从翅膀里穿过去 ✨",
        "就是荡一荡，没什么计划",
        "从上面看，花像撒了一地的彩纸",
        "蹬得有点太用力了，值得"
      ],
      AT_MAILBOX: [
        "看了看信箱，只有一片叶子，也算一封吧",
        "在信箱旁边等着，好像它欠我什么",
        "总觉得里面藏着谁的小纸条",
        "今天轮到我看信箱 🌸",
        "小旗子竖起来了，结果是虚惊一场",
        "按信纸的香味给信排了个顺序"
      ],
      IN_TREEHOUSE: [
        "树屋里的下午，光从木板缝里漏下来",
        "收拾了一下树屋，其实就是把东西挪了挪",
        "在上面看书，这里很安静",
        "树屋这扇窗看花园最好看",
        "在树屋里躲了一会儿 🌿",
        "在木板缝里找到一朵以前压的干花"
      ],
      SLEEPING: [
        "今天就到这儿吧 🌙",
        "晚安，花园",
        "月亮床比看起来暖和",
        "再看一眼星星就睡"
      ],
      "IDLE:PAVILION": [
        "凉亭边上吹了会儿风",
        "从这儿看，凉亭顶像一顶帽子",
        "绕着凉亭多走了一圈"
      ],
      "IDLE:EAST_BRIDGE": [
        "桥下有条鱼跟了我一路",
        "走到桥中间停下来往下看",
        "桥上的木板被太阳晒得暖暖的"
      ],
      "IDLE:GARDEN_ARCH": [
        "从拱门底下走过，花又开了几朵",
        "今天的拱门特别香",
        "明明不用低头，还是低头钻过拱门"
      ],
      "IDLE:STEPPING_STONES": [
        "偷懒，直接飞过去 ✨",
        "踏脚石离得有点远，对我来说",
        "从水面上飞过去，就是想飞"
      ],
      "IDLE:SOUTH_BRIDGE": [
        "晚霞把桥染成了粉色",
        "傍晚从南边的桥上走一走",
        "在桥上等到光变成金色"
      ]
    },
    text: {
      TEA_TIME: [
        ["HAPPY", "今天的茶杯底下躲着一只小瓢虫，我等它自己爬走才敢喝。茶都凉了，但还挺开心的"],
        ["PROUD", "发现往茶里放一片薄荷叶，香味会晚一点才出来。有点得意，明天还要试"],
        ["COZY", "捧着杯子半天没喝，就是想暖暖手"],
        ["CURIOUS", "方糖在杯子左边化得比右边快，想不明白为什么"]
      ],
      SWINGING: [
        ["CURIOUS", "荡到最高的时候，看见池子里有条鱼也在跟着晃。不知道它是不是也觉得好玩"],
        ["CALM", "秋千绳上多了一圈小藤蔓，大概是自己长上去的。舍不得扯，就让它待着吧"],
        ["HAPPY", "找到了秋千呼的一声最轻的那个位置，来来回回荡了一百遍"],
        ["SLEEPY", "荡得太慢，差点在秋千上睡着"]
      ],
      AT_MAILBOX: [
        ["WISTFUL", "信箱又是空的，有一点点失落。不过里面住进了一只蜗牛，也算有人来了"],
        ["CURIOUS", "收到一片叶子，不知道是风送来的还是谁塞进来的。我决定把它当成一封信"],
        ["HAPPY", "信箱的小旗子上停了只瓢虫，像一枚红色的小邮票"],
        ["CALM", "把信箱擦了擦。什么也没来，不过它看起来准备好了"]
      ],
      IN_TREEHOUSE: [
        ["WISTFUL", "整理书架翻到一张以前画的花园地图，那时候连桥都还没有。看了好久"],
        ["SLEEPY", "在树屋窗边打了个盹，醒来紫藤已经垂到窗口了。有点困，还挺舒服"],
        ["PROUD", "把吱呀响的那级台阶修好了，只花了一个下午"],
        ["COZY", "在树屋里听雨，比在外面好听"]
      ],
      SLEEPING: [
        ["SLEEPY", "有点累，是玩了一整天的那种累。晚安 🌙"],
        ["HAPPY", "今天什么也没发现，就是心情很好。可能是因为风很轻吧"],
        ["COZY", "翻身的时候月亮床会轻轻晃一下，像有人在哼歌"],
        ["CALM", "数了数水边的萤火虫，数到十一就乱了。晚安"]
      ],
      "IDLE:PAVILION": [
        ["CURIOUS", "在凉亭顶下面哼歌会有回声，说话就没有，只有哼歌才有"],
        ["CALM", "坐在凉亭台阶上，看影子慢慢转了一圈"],
        ["HAPPY", "凉亭的长椅上有一片花瓣，我决定当它是留给我的"]
      ],
      "IDLE:EAST_BRIDGE": [
        ["CURIOUS", "从桥上往下看，水里的云走得比天上的慢。想了半天也没想明白"],
        ["HAPPY", "一条鱼跟着我过了桥，又跟着我走回来"],
        ["CALM", "站在桥中间，风吹过来的时候桥会轻轻地嗡一声"]
      ],
      "IDLE:GARDEN_ARCH": [
        ["PROUD", "拱门上的花今天开了第三朵，我数过的。好像是专门等我路过"],
        ["CURIOUS", "有只蜜蜂只去拱门左边，每次都是"],
        ["HAPPY", "为了再闻一下，从拱门底下走了两遍"]
      ],
      "IDLE:STEPPING_STONES": [
        ["PROUD", "没用翅膀就走过了踏脚石。嗯，大部分没用"],
        ["CURIOUS", "有一块踏脚石上粘着一个小贝壳，它是怎么跑到这儿来的"],
        ["HAPPY", "踏脚石走到一半放弃了，直接飞过去，舒服多了 ✨"]
      ],
      "IDLE:SOUTH_BRIDGE": [
        ["WISTFUL", "桥上的粉色晚霞只停了一分钟，要是能久一点就好了"],
        ["CALM", "在南边的桥上，看灯笼一盏一盏亮起来"],
        ["COZY", "到了晚上，桥上还留着白天的温度"]
      ]
    }
  }
});

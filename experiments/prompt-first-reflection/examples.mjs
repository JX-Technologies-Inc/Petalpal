// Product direction only: manually authored targets, NOT Claude outputs or factual gold labels.
import { VERSION } from './experiment.mjs';
export const targets = {
  WEEKLY: {
    en: [
      ['You finally fixed the bug and tested the login screen twice. That accomplishment sits alongside your worry about the demo, which is still ahead of you.', ['E1']],
      ['The cup by the window gave you something different to draw, though you felt a little frustrated partway through. You left the unfinished sketch on the table and did not continue. Both moments can stay here as you described them: a fix completed with worry still present, and a drawing left unfinished.', ['E1', 'E2']]
    ],
    'zh-Hans': [
      ['你终于修好了那个 Bug，还把登录页面测试了两遍。事情做成了，对明天演示的担心却仍在；那场演示还没发生，心情也没有因为修好问题就变得全然轻松。', ['E1']],
      ['窗边的杯子则成了另一幅画的起点。画到一半有些烦，你把未完成的素描留在桌上，没有继续。这一周，有完成的部分，也有暂时停在那里的部分。', ['E1', 'E2']]
    ],
    'zh-Hant': [
      ['你終於修好了那個 Bug，還把登入畫面測試了兩遍。事情做成了，對明天展示的擔心卻仍在；那場展示還沒發生，心情也沒有因為修好問題就變得全然輕鬆。', ['E1']],
      ['窗邊的杯子則成了另一幅畫的起點。畫到一半有些煩，你把未完成的素描留在桌上，沒有繼續。這一週，有完成的部分，也有暫時停在那裡的部分。', ['E1', 'E2']]
    ]
  },
  MONTHLY: {
    en: [
      ['The bug was finally fixed, and you tested the login screen twice. You were still worried about the next day’s demo: getting that part working did not make the uncertainty disappear. The demo was still ahead of you at that moment.', ['E1']],
      ['Another week brought the cup by the window into a sketch. You felt a little frustrated partway through, left the unfinished drawing on the table, and did not continue. Later, on a weekend walk with 小林, the sketch came up in your conversation. You were happy to see her, while the question of when to draw again remained open. The drawing appears in both moments, once on the table and once in a conversation, without a finished version to add to the story.', ['E2', 'E3']],
      ['There was also a quiet Sunday reading at home that you enjoyed. You still did not know how the next project would go. These moments hold different feelings alongside one another: worry around the demo, frustration with the sketch, pleasure in seeing your friend, and enjoyment of a quiet day. None needs to supply an ending for the others.', ['E1', 'E2', 'E3', 'E4']]
    ],
    'zh-Hans': [
      ['这个月，那个终于修好的 Bug 是一个具体的完成：你把登录页面测试了两遍，却仍担心第二天的演示。修好问题和心里没底同时存在，那时演示还没有发生，也还没有一个可以写下的结果。', ['E1']],
      ['另一周，窗边的杯子进入了你的素描。画到一半有点烦，你把没画完的纸留在桌上，没有继续。后来和小林散步时，你们又聊起这幅画。见到她让你开心，至于什么时候再画，你还没决定。同一幅未完成的画，出现在独自画画的片刻里，也出现在和朋友的交谈中；它仍然可以停在未完成的地方。', ['E2', 'E3']],
      ['还有一个周日，你在家读书，喜欢那份安静。对下一个项目会怎样，你仍不清楚。完成工作后的担心、画画时的烦躁、见到朋友的开心和读书的安静，各自都在这些片刻里，不必由最后的一件事来替前面收尾。', ['E1', 'E2', 'E3', 'E4']]
    ],
    'zh-Hant': [
      ['這個月，那個終於修好的 Bug 是一個具體的完成：你把登入畫面測試了兩遍，卻仍擔心第二天的展示。修好問題和心裡沒底同時存在，那時展示還沒有發生，也還沒有一個可以寫下的結果。', ['E1']],
      ['另一週，窗邊的杯子進入了你的素描。畫到一半有點煩，你把沒畫完的紙留在桌上，沒有繼續。後來和小林散步時，你們又聊起這幅畫。見到她讓你開心，至於什麼時候再畫，你還沒決定。同一幅未完成的畫，出現在獨自畫畫的片刻裡，也出現在和朋友的交談中；它仍然可以停在未完成的地方。', ['E2', 'E3']],
      ['還有一個週日，你在家讀書，喜歡那份安靜。對下一個專案會怎樣，你仍不清楚。完成工作後的擔心、畫畫時的煩躁、見到朋友的開心和讀書的安靜，各自都在這些片刻裡，不必由最後的一件事來替前面收尾。', ['E1', 'E2', 'E3', 'E4']]
    ]
  }
};
export function authoredOutput(type, locale) {
  const paragraphs = targets[type][locale];
  return { version: VERSION, reportType: type, locale, state: 'reflection', reason: 'none',
    reflection: paragraphs.map(p => p[0]).join('\n\n'), references: paragraphs.map(([excerpt, sources]) => ({ excerpt, sources })) };
}

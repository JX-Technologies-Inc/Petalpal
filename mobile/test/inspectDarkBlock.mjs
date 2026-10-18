import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function main() {
  const proc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2000));

  const res = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      // Find element at 300, 600
      const el = document.elementFromPoint(300, 600);
      const cs = el ? window.getComputedStyle(el) : null;
      let hierarchy = [];
      let cur = el;
      while (cur && cur !== document.body) {
        const curCs = window.getComputedStyle(cur);
        hierarchy.push({
          tag: cur.tagName,
          id: cur.id,
          className: cur.className,
          bg: curCs.backgroundColor,
          bgImg: curCs.backgroundImage ? curCs.backgroundImage.slice(0, 80) : 'none',
          boxShadow: curCs.boxShadow,
          opacity: curCs.opacity,
          filter: curCs.filter,
          rect: cur.getBoundingClientRect(),
          outerHTML: cur.outerHTML.slice(0, 160)
        });
        cur = cur.parentElement;
      }
      return { elTag: el ? el.tagName : null, hierarchy };
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(res.result.result.value, null, 2));
  cdp.ws.close();
  proc.kill();
}

main().catch(console.error);

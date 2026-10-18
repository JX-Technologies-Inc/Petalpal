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
      const letter = document.querySelector('[aria-label="Expanded Reading Letter"]');
      const r = letter.getBoundingClientRect();
      const sheet = letter.children[1];
      const sr = sheet.getBoundingClientRect();
      const foldBtn = letter.querySelector('[aria-label="Fold letter back into envelope"]');
      const fr = foldBtn ? foldBtn.getBoundingClientRect() : null;

      // Scan top 60px of the sheet
      const topItems = [];
      const allInside = Array.from(letter.querySelectorAll('*'));
      for (const el of allInside) {
        const er = el.getBoundingClientRect();
        if (er.top <= sr.top + 50 && er.height > 0) {
          topItems.push({
            tag: el.tagName,
            text: el.innerText ? el.innerText.slice(0, 40) : null,
            rect: { top: er.top, bottom: er.bottom, left: er.left, height: er.height },
            overflow: window.getComputedStyle(el).overflow,
            clipPath: window.getComputedStyle(el).clipPath,
            outerHTML: el.outerHTML.slice(0, 100)
          });
        }
      }

      return { letterRect: r, sheetRect: sr, foldBtnRect: fr, topItems };
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(res.result.result.value, null, 2));
  cdp.ws.close();
  proc.kill();
}

main().catch(console.error);

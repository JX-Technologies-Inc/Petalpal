import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function main() {
  const proc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2500));

  const res = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      // 1. Check element at first envelope (x: 50, y: 240)
      const elAtFirst = document.elementFromPoint(50, 240);
      const firstHit = elAtFirst ? {
        outerHTML: elAtFirst.outerHTML.slice(0, 300),
        ariaLabel: elAtFirst.getAttribute('aria-label') || elAtFirst.closest('[aria-label]')?.getAttribute('aria-label'),
        role: elAtFirst.getAttribute('role') || elAtFirst.closest('[role]')?.getAttribute('role'),
        parentHTML: elAtFirst.parentElement?.outerHTML.slice(0, 300),
      } : null;

      // Check click on first envelope
      let clickedItem = null;
      if (elAtFirst) {
        // simulate click
        const clickable = elAtFirst.closest('[role="button"]') || elAtFirst;
        clickedItem = clickable.getAttribute('aria-label') || clickable.outerHTML.slice(0, 150);
      }

      // 2. Letter top clipping check
      const letter = document.querySelector('[aria-label="Expanded Reading Letter"]');
      const letterRect = letter ? letter.getBoundingClientRect() : null;
      const foldBtn = document.querySelector('[aria-label="Fold letter back into envelope"]');
      const foldRect = foldBtn ? foldBtn.getBoundingClientRect() : null;
      const noteTitle = Array.from(document.querySelectorAll('*')).find(e => e.innerText && e.innerText.includes('A Note from Your Garden'));
      const titleRect = noteTitle ? noteTitle.getBoundingClientRect() : null;

      const chain = [];
      let cur = letter;
      while (cur && cur !== document.body) {
        const cs = window.getComputedStyle(cur);
        chain.push({
          tag: cur.tagName,
          ariaLabel: cur.getAttribute('aria-label'),
          overflow: cs.overflow,
          overflowY: cs.overflowY,
          clipPath: cs.clipPath,
          height: cs.height,
          rect: cur.getBoundingClientRect()
        });
        cur = cur.parentElement;
      }

      // 3. Find dark block: What is in the area below the letter?
      // Look at coordinates x: 300, y: between 620 and 720
      const belowPoints = [];
      for (let y = 620; y <= 720; y += 15) {
        const el = document.elementFromPoint(300, y);
        if (el) {
          const cs = window.getComputedStyle(el);
          belowPoints.push({
            y,
            tag: el.tagName,
            ariaLabel: el.getAttribute('aria-label') || el.closest('[aria-label]')?.getAttribute('aria-label'),
            bg: cs.backgroundColor,
            boxShadow: cs.boxShadow,
            filter: cs.filter,
            rect: el.getBoundingClientRect(),
            outerHTML: el.outerHTML.slice(0, 150)
          });
        }
      }

      return { firstHit, clickedItem, letterRect, foldRect, titleRect, chain, belowPoints };
    })()`,
    returnByValue: true,
  });

  console.log(JSON.stringify(res.result.result.value, null, 2));
  cdp.ws.close();
  proc.kill();
}

main().catch(console.error);

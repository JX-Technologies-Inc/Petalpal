import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function main() {
  const proc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2000));

  // Let's inspect the opened letter in reading state
  const inspectRes = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const letter = document.querySelector('[aria-label="Expanded Reading Letter"]');
      const letterRect = letter.getBoundingClientRect();
      const sheet = letter.querySelector('div[style*="clip-path"]') || letter.children[1] || letter.firstElementChild;
      const sheetRect = sheet ? sheet.getBoundingClientRect() : null;

      // Check all elements inside letter
      const childrenInfo = Array.from(letter.children).map(c => {
        const cr = c.getBoundingClientRect();
        const cs = window.getComputedStyle(c);
        return {
          tag: c.tagName,
          rect: { top: cr.top, bottom: cr.bottom, left: cr.left, right: cr.right, width: cr.width, height: cr.height },
          bg: cs.backgroundColor,
          boxShadow: cs.boxShadow,
          clipPath: cs.clipPath,
          outerHTML: c.outerHTML.slice(0, 150)
        };
      });

      // Also inspect anything behind or around the lower area of letter:
      // Scan vertical line at x = letterRect.left + 50 from letterRect.top to letterRect.bottom + 80
      const scanPoints = [];
      for (let y = letterRect.top; y <= letterRect.bottom + 80; y += 20) {
        const x = letterRect.left + 80;
        const el = document.elementFromPoint(x, y);
        const cs = el ? window.getComputedStyle(el) : null;
        scanPoints.push({
          y,
          tag: el ? el.tagName : null,
          ariaLabel: el ? (el.getAttribute('aria-label') || el.closest('[aria-label]')?.getAttribute('aria-label')) : null,
          bg: cs ? cs.backgroundColor : null,
          boxShadow: cs ? cs.boxShadow : null,
          outerHTML: el ? el.outerHTML.slice(0, 120) : null
        });
      }

      return { letterRect, sheetRect, childrenInfo, scanPoints };
    })()`,
    returnByValue: true
  });

  console.log('LETTER 1 INSPECTION:\n', JSON.stringify(inspectRes.result.result.value, null, 2));

  // Now switch to Letter 2
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const peeking = Array.from(document.querySelectorAll('[aria-label^="Envelope from"]'));
      // Click second envelope
      if (peeking[1]) peeking[1].click();
    })()`
  });

  await new Promise((r) => setTimeout(r, 2000));

  const inspectRes2 = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const letter = document.querySelector('[aria-label="Expanded Reading Letter"]');
      const letterRect = letter ? letter.getBoundingClientRect() : null;
      const sheet = letter ? (letter.querySelector('div[style*="clip-path"]') || letter.children[1] || letter.firstElementChild) : null;
      const sheetRect = sheet ? sheet.getBoundingClientRect() : null;

      const childrenInfo = letter ? Array.from(letter.children).map(c => {
        const cr = c.getBoundingClientRect();
        const cs = window.getComputedStyle(c);
        return {
          tag: c.tagName,
          rect: { top: cr.top, bottom: cr.bottom, left: cr.left, right: cr.right, width: cr.width, height: cr.height },
          bg: cs.backgroundColor,
          boxShadow: cs.boxShadow,
          clipPath: cs.clipPath,
          outerHTML: c.outerHTML.slice(0, 150)
        };
      }) : [];

      // Scan lower area
      const scanPoints = [];
      if (letterRect) {
        for (let y = letterRect.top; y <= letterRect.bottom + 80; y += 20) {
          const x = letterRect.left + 80;
          const el = document.elementFromPoint(x, y);
          const cs = el ? window.getComputedStyle(el) : null;
          scanPoints.push({
            y,
            tag: el ? el.tagName : null,
            ariaLabel: el ? (el.getAttribute('aria-label') || el.closest('[aria-label]')?.getAttribute('aria-label')) : null,
            bg: cs ? cs.backgroundColor : null,
            boxShadow: cs ? cs.boxShadow : null,
            outerHTML: el ? el.outerHTML.slice(0, 120) : null
          });
        }
      }

      return { letterRect, sheetRect, childrenInfo, scanPoints };
    })()`,
    returnByValue: true
  });

  console.log('LETTER 2 INSPECTION:\n', JSON.stringify(inspectRes2.result.result.value, null, 2));

  cdp.ws.close();
  proc.kill();
}

main().catch(console.error);

import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function main() {
  const proc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2000));

  // Click peekingEnvelopes[0] to switch to Letter 2
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelectorAll('[aria-label^="Envelope from"]')[0].click()`
  });
  // Wait for switch animation to finish completely
  await new Promise((r) => setTimeout(r, 3000));

  const res = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      // Find all elements overlapping x: 250, y: 580
      const elementsAtPoint = document.elementsFromPoint(250, 580);
      return elementsAtPoint.map(el => {
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          ariaLabel: el.getAttribute('aria-label') || el.closest('[aria-label]')?.getAttribute('aria-label'),
          className: el.className,
          rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height },
          bg: cs.backgroundColor,
          boxShadow: cs.boxShadow,
          opacity: cs.opacity,
          filter: cs.filter,
          outerHTML: el.outerHTML.slice(0, 200)
        };
      });
    })()`,
    returnByValue: true
  });

  console.log('ELEMENTS AT (250, 580) FOR LETTER 2:\n', JSON.stringify(res.result.result.value, null, 2));

  cdp.ws.close();
  proc.kill();
}

main().catch(console.error);

import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function run() {
  const proc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2500));

  // Query DOM bounding rectangles
  const msg = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let el = document.querySelector('[aria-label="Expanded Reading Letter"]');
        if (!el) {
          const allDivs = Array.from(document.querySelectorAll('div'));
          const letterSheet = allDivs.find(d => d.innerText && d.innerText.includes('Your garden is blooming') && d.innerText.includes('With gratitude'));
          if (letterSheet) {
            el = letterSheet.closest('[style*="border-color"]') || letterSheet;
          }
        }

        let letterRect = null;
        if (el) {
          const r = el.getBoundingClientRect();
          letterRect = {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
            center: r.left + r.width / 2,
            viewportCenter: viewportWidth / 2,
            diffFromCenter: (r.left + r.width / 2) - (viewportWidth / 2),
            leftMargin: r.left,
            rightMargin: viewportWidth - r.right
          };
        }

        const peeking = Array.from(document.querySelectorAll('[aria-label^="Envelope from"]'));
        const peekingRects = peeking.map(p => {
          const r = p.getBoundingClientRect();
          return {
            label: p.getAttribute('aria-label'),
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height
          };
        });

        return { viewportWidth, viewportHeight, letterRect, peekingRects };
      })()
    `,
    returnByValue: true,
  });

  console.log('DOM Measurements:\n', JSON.stringify(msg.result.result.value, null, 2));
  cdp.ws.close();
  proc.kill();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

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
      // Find activeEnvelopeBox
      const activeEnv = document.querySelector('[aria-label^="Active envelope"]');
      if (activeEnv) {
        activeEnv.style.pointerEvents = 'none';
      }

      // Now check element at (50, 240)
      const el = document.elementFromPoint(50, 240);
      const clickable = el ? el.closest('[role="button"]') : null;
      return {
        clickedAriaLabel: clickable ? clickable.getAttribute('aria-label') : (el ? el.tagName : 'none'),
        allButtonsAtPoints: [
          document.elementFromPoint(50, 240)?.closest('[role="button"]')?.getAttribute('aria-label'),
          document.elementFromPoint(50, 320)?.closest('[role="button"]')?.getAttribute('aria-label'),
          document.elementFromPoint(50, 400)?.closest('[role="button"]')?.getAttribute('aria-label'),
          document.elementFromPoint(50, 480)?.closest('[role="button"]')?.getAttribute('aria-label'),
        ]
      };
    })()`,
    returnByValue: true
  });

  console.log('HIT TEST RESULTS WITH POINTER-EVENTS NONE:\n', JSON.stringify(res.result.result.value, null, 2));

  cdp.ws.close();
  proc.kill();
}

main().catch(console.error);

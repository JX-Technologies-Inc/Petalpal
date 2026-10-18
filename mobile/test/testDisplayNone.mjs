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
      // Find activeEnvelopeBox and set display = 'none'
      const activeEnv = document.querySelector('[aria-label^="Active envelope"]');
      if (activeEnv) {
        activeEnv.style.display = 'none';
      }

      // Check all envelopes at points
      const points = [
        { y: 240, label: 'First Envelope' },
        { y: 320, label: 'Second Envelope' },
        { y: 400, label: 'Third Envelope' },
        { y: 480, label: 'Fourth Envelope' }
      ];

      return points.map(p => {
        const el = document.elementFromPoint(50, p.y);
        const btn = el ? el.closest('[role="button"]') : null;
        return {
          point: p,
          hitTag: el ? el.tagName : null,
          btnAria: btn ? btn.getAttribute('aria-label') : null
        };
      });
    })()`,
    returnByValue: true
  });

  console.log('HIT TEST RESULTS WITH DISPLAY NONE:\n', JSON.stringify(res.result.result.value, null, 2));

  cdp.ws.close();
  proc.kill();
}

main().catch(console.error);

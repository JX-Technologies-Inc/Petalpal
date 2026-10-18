import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function run() {
  const p = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2500));
  const res = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('[role="button"]'));
        return buttons.map(b => ({
          ariaLabel: b.getAttribute('aria-label'),
          text: b.innerText ? b.innerText.slice(0, 30) : '',
          rect: {
            x: b.getBoundingClientRect().x,
            y: b.getBoundingClientRect().y,
            width: b.getBoundingClientRect().width,
            height: b.getBoundingClientRect().height,
          },
        }));
      })()
    `,
    returnByValue: true,
  });
  console.log('DOM Buttons found:', JSON.stringify(res.result.result.value, null, 2));
  p.kill();
}

run().catch(console.error);

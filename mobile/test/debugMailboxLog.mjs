import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function run() {
  const chromeProc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map((a) => a.value || JSON.stringify(a)).join(' ');
    console.log('[BROWSER LOG]', text);
  });

  await cdp.send('Page.navigate', { url: 'http://localhost:8081/garden-test' });
  await new Promise((r) => setTimeout(r, 3000));

  console.log('Triggering mailbox click...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const mbBtn = btns.find(b => (b.innerText || '').includes('Mailbox'));
        if (mbBtn) mbBtn.click();
      })()
    `,
  });

  // Wait 18 seconds while watching console logs
  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const res = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('[role="button"]'));
          const mbBtn = btns.find(b => {
            const t = b.innerText || '';
            return t.includes('walking') || t.includes('Retrieving') || t.includes('Opening') || t.includes('Mailbox');
          });
          return {
            url: window.location.pathname,
            btn: mbBtn ? mbBtn.innerText : null
          };
        })()
      `,
      returnByValue: true,
    });
    console.log(`Tick ${i}:`, res.result.result.value);
  }

  chromeProc.kill();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

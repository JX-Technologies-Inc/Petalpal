import { launchHeadlessChrome, createCDPClient } from '../test/browserAutomation.mjs';

async function run() {
  const p = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/garden-test' });
  await new Promise(r => setTimeout(r, 4000));

  for (let i = 0; i < 4; i++) {
    const res = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const ck = window.CanvasKit;
        const mem = ck?.HEAPU8?.buffer?.byteLength || 0;
        return {
          wasmBytes: mem,
          wasmMB: (mem / (1024 * 1024)).toFixed(2) + ' MB'
        };
      })()`,
      returnByValue: true
    });
    console.log(`Roundtrip ${i} WASM Memory:`, res.result.result.value);

    // Click mailbox
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const mb = btns.find(b => (b.innerText || '').includes('Mailbox'));
        if (mb) mb.click();
      })()`
    });

    // Wait for /mailbox
    for (let t = 0; t < 35; t++) {
      await new Promise(r => setTimeout(r, 350));
      const p = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
      if (p.result.result.value === '/mailbox') break;
    }

    await new Promise(r => setTimeout(r, 600));

    // Click back to garden
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const back = btns.find(b => (b.innerText || '').includes('Garden'));
        if (back) back.click();
      })()`
    });

    // Wait for /garden-test
    for (let t = 0; t < 25; t++) {
      await new Promise(r => setTimeout(r, 350));
      const p = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
      if (p.result.result.value === '/garden-test') break;
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  p.kill();
  process.exit(0);
}

run();

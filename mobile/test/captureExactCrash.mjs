import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('=== CAPTURING ALL CONSOLE AND UNCAUGHT EXCEPTIONS ===');
  const chromeProc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  cdp.on('Runtime.exceptionThrown', (params) => {
    console.error('\n>>> [RUNTIME EXCEPTION]', params.exceptionDetails.text, params.exceptionDetails.exception?.description);
    if (params.exceptionDetails.stackTrace) {
      console.error(params.exceptionDetails.stackTrace.callFrames.map(f => `  at ${f.functionName} (${f.url}:${f.lineNumber}:${f.columnNumber})`).join('\n'));
    }
  });

  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map((a) => (typeof a.value !== 'undefined' ? a.value : JSON.stringify(a))).join(' ');
    // Ignore routine react/skia deprecation warnings
    if (!text.includes('deprecated') && !text.includes('Download the React DevTools') && !text.includes('Running application')) {
      console.log(`[CONSOLE ${params.type.toUpperCase()}]`, text);
    }
  });

  console.log('Loading /garden-test...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/garden-test' });
  await sleep(4000);

  // Set up unhandledrejection and onerror in page context to capture everything
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.addEventListener('error', (e) => {
        console.log('[WINDOW ONERROR]', e.message, e.error ? (e.error.stack || e.error.message) : '');
      });
      window.addEventListener('unhandledrejection', (e) => {
        console.log('[WINDOW UNHANDLED REJECTION]', e.reason ? (e.reason.stack || e.reason.message || e.reason) : '');
      });
    `,
  });

  for (let i = 0; i < 4; i++) {
    console.log(`\n================== ROUNDTRIP ${i + 1} ==================`);
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('[role="button"]'));
          const mb = btns.find(b => (b.innerText || '').includes('Mailbox'));
          if (mb) mb.click();
        })()
      `,
    });

    // Wait until on /mailbox
    for (let t = 0; t < 40; t++) {
      await sleep(350);
      const p = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
      if (p.result.result.value === '/mailbox') {
        console.log(`  Reached /mailbox at tick ${t}`);
        break;
      }
    }

    await sleep(800);
    console.log('  Clicking Back to Garden...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('[role="button"]'));
          const back = btns.find(b => (b.innerText || '').includes('Garden'));
          if (back) back.click();
        })()
      `,
    });

    for (let t = 0; t < 25; t++) {
      await sleep(350);
      const p = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
      if (p.result.result.value === '/garden-test') {
        console.log(`  Returned to /garden-test at tick ${t}`);
        break;
      }
    }
    await sleep(1500);
  }

  chromeProc.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('=== TRACING EXACT WASM ABORT REASON ===');
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
    console.log(`[CONSOLE ${params.type.toUpperCase()}]`, text);
  });

  // Inject early script before anything loads
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__abortTraces = [];
      const origError = console.error;
      console.error = function(...args) {
        origError.apply(console, args);
        if (args.some(a => String(a).includes('Aborted') || String(a).includes('sk_sp') || String(a).includes('deleted'))) {
          console.log('[STACK AT ERROR]', new Error().stack);
        }
      };
      // Hook WebAssembly RuntimeError
      window.addEventListener('error', function(e) {
        console.log('[WINDOW ONERROR CAUGHT]', e.message, e.filename, e.lineno, e.colno, e.error ? e.error.stack : 'no error obj');
      });
    `,
  });

  console.log('Loading /garden-test...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/garden-test' });
  await sleep(4000);

  // Hook into CanvasKit if present on global
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        // Find CanvasKit or Emscripten module in globals or React Native Skia
        console.log('Checking window globals for CanvasKit/Skia...');
        const keys = Object.keys(window).filter(k => k.toLowerCase().includes('skia') || k.toLowerCase().includes('canvas'));
        console.log('Global keys:', keys);
      })()
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

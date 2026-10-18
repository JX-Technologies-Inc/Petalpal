import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function run() {
  console.log('=== INVESTIGATING SKIA PICTURE ERROR REPRODUCTION ===');
  const chromeProc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const errors = [];
  cdp.on('Runtime.exceptionThrown', (params) => {
    const desc = params.exceptionDetails.exception?.description || params.exceptionDetails.text;
    console.error('>>> [RUNTIME EXCEPTION THROWN]', desc);
    errors.push({ type: 'exception', desc, stack: params.exceptionDetails.stackTrace });
  });

  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map((a) => (typeof a.value !== 'undefined' ? a.value : JSON.stringify(a))).join(' ');
    if (params.type === 'error' || text.toLowerCase().includes('skia') || text.toLowerCase().includes('deleted') || text.toLowerCase().includes('picture')) {
      console.error('>>> [CONSOLE ERROR/SKIA]', text);
      errors.push({ type: 'console', text });
    }
  });

  // Navigate to garden
  console.log('1. Loading garden...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/garden-test' });
  await new Promise((r) => setTimeout(r, 4000));

  // Let's trigger navigation to /mailbox directly and then back
  for (let i = 0; i < 5; i++) {
    console.log(`\n--- CYCLE ${i + 1} ---`);
    console.log('Navigating to /mailbox...');
    await cdp.send('Runtime.evaluate', {
      expression: `window.__EXPO_ROUTER_NAVIGATE ? window.__EXPO_ROUTER_NAVIGATE('/mailbox') : (window.location.hash = '/mailbox')`,
    });
    // Wait, let's click visit mailbox or use window.location
    await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
    await new Promise((r) => setTimeout(r, 1500));

    console.log('Navigating back to /garden-test...');
    await cdp.send('Page.navigate', { url: 'http://localhost:8081/garden-test' });
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('\n=== REPRODUCTION SUMMARY ===');
  console.log(`Total errors captured: ${errors.length}`);
  for (const e of errors) {
    console.log('-', e.desc || e.text);
  }

  chromeProc.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

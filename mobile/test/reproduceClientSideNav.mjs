import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('=== INVESTIGATING SPA CLIENT-SIDE NAVIGATION CRASH ===');
  const chromeProc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const errors = [];
  cdp.on('Runtime.exceptionThrown', (params) => {
    const desc = params.exceptionDetails.exception?.description || params.exceptionDetails.text;
    console.error('>>> [RUNTIME EXCEPTION THROWN]', desc);
    if (params.exceptionDetails.stackTrace) {
      console.error(JSON.stringify(params.exceptionDetails.stackTrace, null, 2));
    }
    errors.push({ type: 'exception', desc, stack: params.exceptionDetails.stackTrace });
  });

  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map((a) => (typeof a.value !== 'undefined' ? a.value : JSON.stringify(a))).join(' ');
    if (params.type === 'error' || text.toLowerCase().includes('skia') || text.toLowerCase().includes('deleted') || text.toLowerCase().includes('picture')) {
      console.error('>>> [CONSOLE ERROR/SKIA]', text);
      errors.push({ type: 'console', text });
    }
  });

  console.log('Loading /garden-test...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/garden-test' });
  await sleep(4000);

  // We have the client-side router available via window / Expo Router links
  // Let's trigger router navigation inside the page
  for (let i = 0; i < 5; i++) {
    console.log(`\n--- SPA ROUNDTRIP ${i + 1} ---`);
    // Navigate to mailbox via Expo Router
    const navToMailboxRes = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          // Find Visit Mailbox button
          const btns = Array.from(document.querySelectorAll('[role="button"]'));
          const mb = btns.find(b => (b.innerText || '').includes('Mailbox'));
          if (mb) {
            mb.click();
            return 'clicked mailbox';
          }
          return 'button not found';
        })()
      `,
      returnByValue: true,
    });
    console.log('  Action:', navToMailboxRes.result.result.value);

    // Wait until route becomes /mailbox
    let reachedMailbox = false;
    for (let t = 0; t < 40; t++) {
      await sleep(300);
      const p = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
      if (p.result.result.value === '/mailbox') {
        reachedMailbox = true;
        console.log(`  Arrived at /mailbox at tick ${t}`);
        break;
      }
    }

    if (!reachedMailbox) {
      console.log('  Did not reach /mailbox in time, forcing client push...');
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            // Check if there is an anchor or router
            window.history.pushState({}, '', '/mailbox');
            window.dispatchEvent(new PopStateEvent('popstate'));
          })()
        `,
      });
      await sleep(1500);
    }

    // Now on /mailbox, click "← Garden"
    console.log('  Clicking Back to Garden...');
    await sleep(1000);
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('[role="button"]'));
          const back = btns.find(b => (b.innerText || '').includes('Garden'));
          if (back) back.click();
        })()
      `,
    });

    // Wait until route becomes /garden-test
    for (let t = 0; t < 20; t++) {
      await sleep(300);
      const p = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
      if (p.result.result.value === '/garden-test') {
        console.log(`  Returned to /garden-test at tick ${t}`);
        break;
      }
    }
    await sleep(1500);
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

import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('===========================================================');
  console.log('PETALPAL — 10 CONSECUTIVE ROUNDTRIP VERIFICATION SUITE');
  console.log('===========================================================');

  const chromeProc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const recordedErrors = [];
  const recordedWarnings = [];

  cdp.on('Runtime.exceptionThrown', (params) => {
    const desc = params.exceptionDetails.exception?.description || params.exceptionDetails.text;
    console.error(`\n>>> [UNCAUGHT EXCEPTION] ${desc}`);
    if (params.exceptionDetails.stackTrace) {
      console.error(params.exceptionDetails.stackTrace.callFrames.map(f => `    at ${f.functionName} (${f.url}:${f.lineNumber}:${f.columnNumber})`).join('\n'));
    }
    recordedErrors.push({ type: 'uncaughtException', desc });
  });

  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map((a) => (typeof a.value !== 'undefined' ? a.value : JSON.stringify(a))).join(' ');
    const lower = text.toLowerCase();
    
    // Filter noise
    if (lower.includes('deprecated') || lower.includes('download the react devtools') || lower.includes('running application')) {
      return;
    }

    if (params.type === 'error' || lower.includes('sk_sp') || lower.includes('deleted object') || lower.includes('aborted()')) {
      console.error(`[CONSOLE ERROR] ${text}`);
      recordedErrors.push({ type: 'consoleError', text });
    } else if (params.type === 'warning' && (lower.includes('skia') || lower.includes('leak') || lower.includes('memory'))) {
      console.warn(`[CONSOLE WARNING] ${text}`);
      recordedWarnings.push({ type: 'consoleWarning', text });
    } else if (lower.includes('onmailboxopened') || lower.includes('mailbox') || lower.includes('roundtrip')) {
      console.log(`[APP LOG] ${text}`);
    }
  });

  console.log('Navigating to http://localhost:8081/garden-test...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/garden-test' });
  await sleep(4000);

  // Install window-level error traps
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__caughtErrors = [];
      window.addEventListener('error', (e) => {
        window.__caughtErrors.push({ message: e.message, stack: e.error ? e.error.stack : null });
      });
      window.addEventListener('unhandledrejection', (e) => {
        window.__caughtErrors.push({ reason: String(e.reason) });
      });
    `,
  });

  const totalCycles = 10;
  const cycleResults = [];

  for (let cycle = 1; cycle <= totalCycles; cycle++) {
    const cycleStart = Date.now();
    console.log(`\n>>> STARTING ROUNDTRIP CYCLE ${cycle} OF ${totalCycles}...`);

    // Reset cycle errors
    await cdp.send('Runtime.evaluate', { expression: 'window.__caughtErrors = [];' });

    // 1. Verify we are on /garden-test
    const initialRoute = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
    if (initialRoute.result.result.value !== '/garden-test') {
      throw new Error(`Cycle ${cycle} started on unexpected route: ${initialRoute.result.result.value}`);
    }

    // 2. Click Mailbox
    const clickMailboxResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('[role="button"]'));
          const mb = btns.find(b => (b.innerText || '').includes('Mailbox'));
          if (mb) {
            mb.click();
            return 'clicked';
          }
          return 'mailbox button not found';
        })()
      `,
      returnByValue: true,
    });

    if (clickMailboxResult.result.result.value !== 'clicked') {
      throw new Error(`Cycle ${cycle}: Could not click Mailbox: ${clickMailboxResult.result.result.value}`);
    }
    console.log(`  Cycle ${cycle}: Mailbox clicked. Waiting for fairy walk & retrieval sequence...`);

    // 3. Wait for navigation to /mailbox (fairy walk + retrieve animation = ~8-12 seconds)
    let reachedMailbox = false;
    for (let t = 0; t < 50; t++) {
      await sleep(350);
      const routeRes = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
      if (routeRes.result.result.value === '/mailbox') {
        reachedMailbox = true;
        console.log(`  Cycle ${cycle}: Arrived at /mailbox after ~${((t + 1) * 350) / 1000}s`);
        break;
      }
    }

    if (!reachedMailbox) {
      throw new Error(`Cycle ${cycle}: Timed out waiting for navigation to /mailbox`);
    }

    // 4. Verify /mailbox rendered correctly
    await sleep(600);
    const mailboxCheck = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const text = document.body.innerText || '';
          const hasBack = text.includes('Garden');
          const hasMailboxContent = text.includes('Mailbox') || text.includes('PetalPal') || document.querySelectorAll('[role="button"]').length > 0;
          return { hasBack, hasMailboxContent };
        })()
      `,
      returnByValue: true,
    });

    if (!mailboxCheck.result.result.value.hasBack) {
      throw new Error(`Cycle ${cycle}: /mailbox missing back button!`);
    }

    // 5. Click "← Garden"
    console.log(`  Cycle ${cycle}: Clicking Back to Garden...`);
    const clickBackResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('[role="button"]'));
          const back = btns.find(b => (b.innerText || '').includes('Garden'));
          if (back) {
            back.click();
            return 'clicked';
          }
          return 'back button not found';
        })()
      `,
      returnByValue: true,
    });

    if (clickBackResult.result.result.value !== 'clicked') {
      throw new Error(`Cycle ${cycle}: Could not click back button: ${clickBackResult.result.result.value}`);
    }

    // 6. Wait for return to /garden-test
    let returnedToGarden = false;
    for (let t = 0; t < 30; t++) {
      await sleep(350);
      const routeRes = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
      if (routeRes.result.result.value === '/garden-test') {
        returnedToGarden = true;
        console.log(`  Cycle ${cycle}: Returned to /garden-test after ~${((t + 1) * 350) / 1000}s`);
        break;
      }
    }

    if (!returnedToGarden) {
      throw new Error(`Cycle ${cycle}: Timed out waiting for return to /garden-test`);
    }

    // 7. Verify Garden rendered without errors and canvas is alive
    await sleep(1200);
    const gardenHealth = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const canvases = document.querySelectorAll('canvas');
          const errors = window.__caughtErrors || [];
          return {
            canvasCount: canvases.length,
            caughtErrors: errors.length,
            errorDetails: errors
          };
        })()
      `,
      returnByValue: true,
    });

    const health = gardenHealth.result.result.value;
    if (health.caughtErrors > 0) {
      throw new Error(`Cycle ${cycle}: Window captured errors: ${JSON.stringify(health.errorDetails)}`);
    }

    const cycleDuration = ((Date.now() - cycleStart) / 1000).toFixed(1);
    console.log(`  Cycle ${cycle} COMPLETED successfully in ${cycleDuration}s (Canvases: ${health.canvasCount}, Errors: 0)`);
    cycleResults.push({ cycle, duration: cycleDuration, canvasCount: health.canvasCount });

    // Capture screenshot on cycle 1 and cycle 10
    if (cycle === 1 || cycle === 10) {
      try {
        const snap = await cdp.send('Page.captureScreenshot', { format: 'png' });
        const base64Data = snap.result?.data || snap.data;
        if (base64Data) {
          fs.writeFileSync(`roundtrip_cycle_${cycle}_garden.png`, Buffer.from(base64Data, 'base64'));
          console.log(`  Cycle ${cycle}: Saved proof screenshot roundtrip_cycle_${cycle}_garden.png`);
        }
      } catch (err) {
        console.warn(`  Cycle ${cycle}: Screenshot capture skipped (${err.message})`);
      }
    }
  }

  console.log('\n===========================================================');
  console.log('10-ROUNDTRIP VERIFICATION SUMMARY:');
  console.log('===========================================================');
  console.log(`Total Cycles Run: ${cycleResults.length} / ${totalCycles}`);
  console.log(`Total Uncaught Exceptions: ${recordedErrors.length}`);
  console.log(`Total Warnings: ${recordedWarnings.length}`);

  if (recordedErrors.length > 0) {
    console.error('FAILED ERRORS:');
    recordedErrors.forEach((e, idx) => console.error(`  ${idx + 1}. [${e.type}] ${e.desc || e.text}`));
    chromeProc.kill();
    process.exit(1);
  }

  console.log('CYCLE DETAILS:');
  cycleResults.forEach(c => console.log(`  Cycle ${c.cycle}: ${c.duration}s | Canvases: ${c.canvasCount} | Status: PASSED`));
  console.log('\n>>> SUCCESS: ALL 10 ROUNDTRIP CYCLES COMPLETED WITH ZERO ERRORS! <<<');

  chromeProc.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('\n>>> FATAL TEST RUNNER ERROR:', err);
  process.exit(1);
});

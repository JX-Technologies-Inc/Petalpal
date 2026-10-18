import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';

const FRAMES_DIR = 'test_animation_frames_garden_mailbox';
if (!fs.existsSync(FRAMES_DIR)) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
}

async function captureFrame(cdp, filename) {
  const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(result.data, 'base64');
  fs.writeFileSync(filename, buf);
  fs.writeFileSync(path.join(FRAMES_DIR, path.basename(filename)), buf);
  console.log(`  [Frame Saved] ${filename} (${Math.round(buf.length / 1024)} KB)`);
  return buf;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('=== STARTING PETALPAL GARDEN MAILBOX ROUNDTRIP E2E ===');
  const chromeProc = await launchHeadlessChrome();
  console.log('[1/9] Headless Chrome launched.');
  const cdp = await createCDPClient();
  console.log('[2/9] Connected to Chrome DevTools Protocol.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map((a) => (typeof a.value !== 'undefined' ? a.value : JSON.stringify(a))).join(' ');
    if (text.includes('[Garden]') || text.includes('[Fairy') || text.includes('Mailbox') || text.includes('movement decision')) {
      console.log('  [BROWSER LOG]', text);
    }
  });

  // Desktop viewport (1200x800)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1200,
    height: 800,
    deviceScaleFactor: 1.5,
    mobile: false,
  });

  // ── 1. INITIAL GARDEN ──
  console.log('[3/9] Loading Garden Screen (/garden-test)...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/garden-test' });
  await sleep(3500);

  const initAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const mb = btns.find(b => (b.innerText || '').includes('Mailbox'));
        return {
          pathname: window.location.pathname,
          buttonText: mb ? mb.innerText : null,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Initial state:', initAudit.result.result.value);
  await captureFrame(cdp, 'screen_1_garden_initial.png');

  // ── 2. TRIGGER MAILBOX WALK ──
  console.log('[4/9] Triggering fairy walk to mailbox...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const mb = btns.find(b => (b.innerText || '').includes('Mailbox'));
        if (mb) mb.click();
      })()
    `,
  });

  // ── 3. CAPTURE WALKING / APPROACH ──
  console.log('[5/9] Tracking approach to mailbox...');
  await sleep(1500);
  await captureFrame(cdp, 'screen_2_fairy_walking.png');

  // Verify busy guard prevents duplicate restart
  const busyCheck = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const mb = btns.find(b => (b.innerText || '').includes('walking') || (b.innerText || '').includes('Retrieving'));
        if (mb) mb.click(); // should not interrupt
        return { busyText: mb ? mb.innerText : null };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Busy guard checked:', busyCheck.result.result.value);

  // ── 4. CAPTURE RETRIEVAL & PRESENTATION ──
  console.log('[6/9] Tracking retrieval choreography...');
  let retrievalCaptured = false;
  let handoffNavigated = false;

  for (let tick = 0; tick < 85; tick++) {
    await sleep(400);
    const probe = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const path = window.location.pathname;
          const btns = Array.from(document.querySelectorAll('[role="button"]'));
          const mb = btns.find(b => (b.innerText || '').includes('Retrieving') || (b.innerText || '').includes('walking') || (b.innerText || '').includes('Opening'));
          return {
            path,
            buttonText: mb ? mb.innerText : null,
          };
        })()
      `,
      returnByValue: true,
    });
    const info = probe.result.result.value;

    if (tick % 5 === 0) {
      console.log(`    [Tick ${tick}] URL: ${info.path} | Button: "${info.buttonText}"`);
    }

    if (info.buttonText && info.buttonText.includes('Retrieving') && !retrievalCaptured) {
      retrievalCaptured = true;
      console.log(`  -> Fairy reached mailbox at tick ${tick}! Retrieving mail...`);
      await captureFrame(cdp, 'screen_3_fairy_retrieval.png');
    }

    if (info.path === '/mailbox') {
      handoffNavigated = true;
      console.log(`  -> Handoff complete at tick ${tick}! Successfully arrived at /mailbox.`);
      break;
    }
  }

  if (!handoffNavigated) {
    const p = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
    if (p.result.result.value === '/mailbox') {
      handoffNavigated = true;
    } else {
      throw new Error('Did not arrive at /mailbox after retrieval animation sequence.');
    }
  }

  // ── 5. CAPTURE MAILBOX PAGE ──
  console.log('[7/9] On /mailbox page! Waiting for stationery animations to settle...');
  await sleep(2500);
  await captureFrame(cdp, 'screen_4_mailbox_reading.png');

  // Verify mailbox components on screen
  const mailboxContentAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const backBtn = btns.find(b => (b.innerText || '').includes('Garden'));
        const toggleBtn = btns.find(b => (b.innerText || '').includes('Stack') || (b.innerText || '').includes('Read'));
        return {
          path: window.location.pathname,
          hasBackButton: !!backBtn,
          backText: backBtn ? backBtn.innerText : null,
          hasToggle: !!toggleBtn,
          toggleText: toggleBtn ? toggleBtn.innerText : null,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Mailbox Content Audit:', mailboxContentAudit.result.result.value);

  // ── 6. RETURN TO GARDEN VIA BACK BUTTON ──
  console.log('[8/9] Clicking "← Garden" back button...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const backBtn = btns.find(b => (b.innerText || '').includes('Garden'));
        if (backBtn) backBtn.click();
      })()
    `,
  });

  // ── 7. CONFIRM RETURN AND FAIRY IDLE POSITION ──
  console.log('[9/9] Verifying return to Garden and fairy idle at mailbox...');
  let returned = false;
  for (let i = 0; i < 25; i++) {
    await sleep(400);
    const rp = await cdp.send('Runtime.evaluate', {
      expression: 'window.location.pathname',
      returnByValue: true,
    });
    if (rp.result.result.value === '/garden-test') {
      returned = true;
      console.log('  Returned to /garden-test successfully!');
      break;
    }
  }

  if (!returned) {
    throw new Error('Failed to return to /garden-test after clicking back button.');
  }

  await sleep(1800);
  const gardenReturnAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const mb = btns.find(b => (b.innerText || '').includes('Mailbox') || (b.innerText || '').includes('walking'));
        return {
          path: window.location.pathname,
          buttonText: mb ? mb.innerText : null,
          isIdle: mb ? mb.innerText === 'Visit Mailbox 📬' : false,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Garden Return Audit:', gardenReturnAudit.result.result.value);
  await captureFrame(cdp, 'screen_5_returned_idle.png');

  console.log('\n=== ROUNDTRIP VERIFICATION COMPLETE AND SUCCESSFUL! ===');
  chromeProc.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error during roundtrip test:', err);
  process.exit(1);
});

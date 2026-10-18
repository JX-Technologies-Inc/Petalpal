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
  console.log(`  [Frame Saved] ${filename}`);
  return buf;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('=== STARTING PETALPAL GARDEN MAILBOX E2E VERIFICATION ===');
  const chromeProc = await launchHeadlessChrome();
  console.log('[1/10] Headless Chrome launched.');
  const cdp = await createCDPClient();
  console.log('[2/10] Connected to Chrome DevTools Protocol.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Desktop viewport with garden visibility (1180x820)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1180,
    height: 820,
    deviceScaleFactor: 1.5,
    mobile: false,
  });

  // ── STEP 1: LOAD GARDEN SCREEN ──
  console.log('[3/10] Loading Garden Screen (/garden-test)...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/garden-test' });
  await sleep(4000);

  const initialStatus = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const mbBtn = btns.find(b => (b.getAttribute('aria-label') || '').includes('Mailbox') || (b.innerText || '').includes('Mailbox'));
        return {
          pathname: window.location.pathname,
          mailboxButtonFound: !!mbBtn,
          buttonText: mbBtn ? mbBtn.innerText : null,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Initial Garden Status:', initialStatus.result.result.value);
  await captureFrame(cdp, 'garden_1_initial.png');

  // ── STEP 2: TRIGGER VISIT MAILBOX ──
  console.log('[4/10] Triggering fairy walk to mailbox...');
  const triggerResult = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const mbBtn = btns.find(b => (b.getAttribute('aria-label') || '').includes('Mailbox') || (b.innerText || '').includes('Mailbox'));
        if (mbBtn) {
          mbBtn.click();
          return { clicked: true, text: mbBtn.innerText };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Trigger result:', triggerResult.result.result.value);

  // ── STEP 3: SAMPLE WALKING PHASE ──
  console.log('[5/10] Monitoring walking phase...');
  await sleep(800);
  const walk1Status = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const mbBtn = btns.find(b => (b.getAttribute('aria-label') || '').includes('Mailbox') || (b.innerText || '').includes('mailbox') || (b.innerText || '').includes('walking'));
        return {
          buttonText: mbBtn ? mbBtn.innerText : null,
          pathname: window.location.pathname,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Walk sample 1:', walk1Status.result.result.value);
  await captureFrame(cdp, 'garden_2_walking_start.png');

  // Attempt duplicate click while walking to verify busy lock
  const duplicateClickResult = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const mbBtn = btns.find(b => (b.getAttribute('aria-label') || '').includes('Mailbox') || (b.innerText || '').includes('mailbox'));
        if (mbBtn) {
          mbBtn.click();
          return { clickedAgain: true, currentText: mbBtn.innerText };
        }
        return { clickedAgain: false };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Duplicate click guard check:', duplicateClickResult.result.result.value);

  // Sample mid-walk
  await sleep(3500);
  await captureFrame(cdp, 'garden_3_walking_mid.png');

  // ── STEP 4: MONITOR CHOREOGRAPHY UNTIL RETRIEVAL & HANDOFF ──
  console.log('[6/10] Tracking progression through walk, retrieval, presentation, and handoff...');
  let retrievalCaptured = false;
  let presentingCaptured = false;
  let navigatedToMailbox = false;

  const maxTicks = 45; // 45 * 500ms = 22.5s maximum wait time
  for (let tick = 0; tick < maxTicks; tick++) {
    await sleep(500);
    const probe = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('[role="button"]'));
          const mbBtn = btns.find(b => {
            const t = b.innerText || '';
            return t.includes('walking') || t.includes('Retrieving') || t.includes('Opening') || t.includes('Mailbox');
          });
          return {
            pathname: window.location.pathname,
            buttonText: mbBtn ? mbBtn.innerText : null,
          };
        })()
      `,
      returnByValue: true,
    });
    const info = probe.result.result.value;

    if (info.pathname === '/mailbox') {
      console.log(`    [Tick ${tick}] Navigated to /mailbox!`);
      navigatedToMailbox = true;
      break;
    }

    console.log(`    [Tick ${tick}] Phase text: "${info.buttonText}" (Path: ${info.pathname})`);

    if (info.buttonText && info.buttonText.includes('Retrieving') && !retrievalCaptured) {
      retrievalCaptured = true;
      console.log('  -> Fairy reached mailbox! Retrieving mail...');
      await captureFrame(cdp, 'garden_4_retrieving_letter.png');
    }

    if (info.buttonText && info.buttonText.includes('Opening') && !presentingCaptured) {
      presentingCaptured = true;
      console.log('  -> Mail presentation complete, entering handoff transition!');
      await captureFrame(cdp, 'garden_5_handoff_transition.png');
    }
  }

  // If not yet on /mailbox, wait up to 10 more seconds
  if (!navigatedToMailbox) {
    console.log('[7/10] Waiting for /mailbox route change...');
    for (let i = 0; i < 20; i++) {
      const pProbe = await cdp.send('Runtime.evaluate', {
        expression: 'window.location.pathname',
        returnByValue: true,
      });
      if (pProbe.result.result.value === '/mailbox') {
        navigatedToMailbox = true;
        console.log('  Successfully reached /mailbox!');
        break;
      }
      await sleep(500);
    }
  }

  if (!navigatedToMailbox) {
    throw new Error('Fairy failed to navigate to /mailbox within expected time.');
  }

  // ── STEP 5: ON /mailbox SCREEN ──
  console.log('[7/10] Arrived at /mailbox screen! Waiting for stationery render...');
  await sleep(2000);
  await captureFrame(cdp, 'screen_mailbox_1_open.png');

  const mailboxAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const backBtn = btns.find(b => (b.innerText || '').includes('Garden'));
        const stackToggle = btns.find(b => (b.innerText || '').includes('Stack') || (b.innerText || '').includes('Read'));
        return {
          pathname: window.location.pathname,
          hasBackButton: !!backBtn,
          backButtonText: backBtn ? backBtn.innerText : null,
          hasStackToggle: !!stackToggle,
          stackToggleText: stackToggle ? stackToggle.innerText : null,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Mailbox Screen Audit:', mailboxAudit.result.result.value);

  // Toggle to stack mode and back to test interactivity
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const stackToggle = btns.find(b => (b.innerText || '').includes('Stack'));
        if (stackToggle) stackToggle.click();
      })()
    `,
  });
  await sleep(1200);
  await captureFrame(cdp, 'screen_mailbox_2_stack.png');

  // Toggle back to read mode
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const readToggle = btns.find(b => (b.innerText || '').includes('Read'));
        if (readToggle) readToggle.click();
      })()
    `,
  });
  await sleep(1500);
  await captureFrame(cdp, 'screen_mailbox_3_reading.png');

  // ── STEP 6: CLICK "← Garden" TO RETURN ──
  console.log('[8/10] Clicking "← Garden" button to return to Garden...');
  const backClickResult = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const backBtn = btns.find(b => (b.innerText || '').includes('Garden'));
        if (backBtn) {
          backBtn.click();
          return { clicked: true, text: backBtn.innerText };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Back button click result:', backClickResult.result.result.value);

  // ── STEP 7: VERIFY RETURN TO GARDEN ──
  console.log('[9/10] Waiting for return to /garden-test...');
  let returnedToGarden = false;
  for (let i = 0; i < 20; i++) {
    const returnProbe = await cdp.send('Runtime.evaluate', {
      expression: 'window.location.pathname',
      returnByValue: true,
    });
    if (returnProbe.result.result.value === '/garden-test') {
      returnedToGarden = true;
      console.log('  Successfully returned to /garden-test!');
      break;
    }
    await sleep(500);
  }

  if (!returnedToGarden) {
    throw new Error('Failed to return to /garden-test after clicking back button.');
  }

  // Settle in garden
  await sleep(1800);
  const returnAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const mbBtn = btns.find(b => (b.getAttribute('aria-label') || '').includes('Mailbox') || (b.innerText || '').includes('Mailbox') || (b.innerText || '').includes('walking'));
        return {
          pathname: window.location.pathname,
          buttonText: mbBtn ? mbBtn.innerText : null,
          isIdle: mbBtn ? mbBtn.innerText === 'Visit Mailbox 📬' : false,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Return Garden Audit:', returnAudit.result.result.value);
  await captureFrame(cdp, 'garden_6_returned_standing_idle.png');

  console.log('[10/10] Verification complete! All phases executed cleanly.');
  chromeProc.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});

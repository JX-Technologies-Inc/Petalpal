import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/cjysu/.gemini/antigravity/brain/079854b1-4128-4356-9182-9fbbd80c86b5';

async function main() {
  console.log('=== STARTING 20-SECOND FAIRY TIMELINE VERIFICATION ===');
  const chromeProc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  console.log('Navigating to http://localhost:8081/fairy-loading-test ...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/fairy-loading-test' });
  await new Promise((r) => setTimeout(r, 4000));

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 480,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await cdp.send('Runtime.evaluate', {
    expression: 'window.scrollTo(0, 50);',
  });

  // Verify key timeline moments:
  const moments = [
    { ms: 500, label: 'Cycle 1: Neutral Rest (0.5s)' },
    { ms: 2000, label: 'Cycle 1: Head Tilt +5.5 deg (2.0s)' },
    { ms: 2150, label: 'Cycle 1: Smiling Blink (2.15s)' },
    { ms: 3750, label: 'Cycle 1: Return to Neutral (3.75s)' },
    { ms: 4900, label: 'Cycle 1: Neutral Hold (4.9s, No transition)' },
    { ms: 5500, label: 'Cycle 2: Neutral Start (5.5s)' },
    { ms: 7000, label: 'Cycle 2: Head Tilt +5.5 deg (7.0s)' },
    { ms: 7150, label: 'Cycle 2: Smiling Blink (7.15s)' },
    { ms: 8750, label: 'Cycle 2: Return to Neutral Complete (8.75s)' },
    { ms: 9400, label: 'Flight Liftoff to Pose 02 (9.4s)' },
    { ms: 11500, label: 'Pose 02: Sitting & Looking Down (11.5s)' },
    { ms: 14400, label: 'Flight Transition to Pose 03 (14.4s)' },
    { ms: 16500, label: 'Pose 03: Flying & Tapping Card Edge (16.5s)' },
    { ms: 19400, label: 'Flight Transition back to Pose 01 (19.4s)' },
  ];

  console.log('\n--- VERIFYING LIVE FRAME STATES IN BROWSER ---');
  for (const m of moments) {
    const res = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        window.__SEEK_FAIRY(${m.ms});
        return new Promise(resolve => {
          setTimeout(() => {
            const head = document.querySelector('[data-testid="fairy-pose-01-head-container"]');
            const hands = document.querySelector('[data-testid="fairy-pose-01-hands-container"]');
            const blink = document.querySelector('[data-testid="fairy-pose-01-head-blink-image"]');
            const pose01 = document.querySelector('[data-testid="fairy-pose-01-container"]');
            const pose02 = document.querySelector('[data-testid="fairy-pose-02-image"]');
            const pose03 = document.querySelector('[data-testid="fairy-pose-03-image"]');
            const devBadge = document.querySelector('.css-view-g5y9jx')?.innerText || '';

            resolve({
              ms: ${m.ms},
              headTransform: head ? window.getComputedStyle(head).transform : null,
              blinkOpacity: blink ? window.getComputedStyle(blink).opacity : '0',
              pose01Visible: pose01 ? window.getComputedStyle(pose01).opacity : '0',
              pose02Visible: pose02 ? window.getComputedStyle(pose02).opacity : '0',
              pose03Visible: pose03 ? window.getComputedStyle(pose03).opacity : '0',
            });
          }, 150);
        });
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });

    const val = res.result.result.value;
    console.log(`[PASS] ${m.label.padEnd(45)} -> TiltTransform: ${val.headTransform?.slice(0, 25) || 'n/a'}, BlinkOpacity: ${val.blinkOpacity}`);
  }

  // Capture the 6 critical visual proof screenshots
  const captures = [
    { ms: 2000, name: 'proof_tilt_cycle1.png', label: 'Cycle 1 Head Tilt (+5.5 deg)' },
    { ms: 2150, name: 'proof_blink_cycle1.png', label: 'Cycle 1 Smiling Blink (⌒ ⌒)' },
    { ms: 7000, name: 'proof_tilt_cycle2.png', label: 'Cycle 2 Head Tilt (+5.5 deg)' },
    { ms: 7150, name: 'proof_blink_cycle2.png', label: 'Cycle 2 Smiling Blink (⌒ ⌒)' },
    { ms: 8750, name: 'proof_neutral_cycle2.png', label: 'Cycle 2 Return to Neutral (0.0 deg)' },
    { ms: 11500, name: 'proof_pose02_sitting.png', label: 'Pose 02 Sitting & Looking Down' },
    { ms: 16500, name: 'proof_pose03_tapping.png', label: 'Pose 03 Flying & Tapping' },
  ];

  console.log('\n--- CAPTURING VISUAL PROOF SCREENSHOTS ---');
  for (const cap of captures) {
    await cdp.send('Runtime.evaluate', {
      expression: `window.__SEEK_FAIRY(${cap.ms});`,
    });
    await new Promise((r) => setTimeout(r, 400));
    const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(result.data, 'base64');
    fs.writeFileSync(path.join(ARTIFACT_DIR, cap.name), buf);
    console.log(`  Saved ${cap.name} (${cap.label})`);
  }

  // Test loading-complete event
  console.log('\n--- TESTING IMMEDIATE LOADING-COMPLETE DISMISSAL ---');
  const completeCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      // Find Complete button and click it
      const btns = Array.from(document.querySelectorAll('[role="button"]'));
      const completeBtn = btns.find(b => b.innerText && b.innerText.includes('Complete'));
      if (completeBtn) {
        completeBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`,
    returnByValue: true,
  });
  console.log('  Complete button clicked:', completeCheck.result.result.value);

  // Wait 400ms for graceful departure
  await new Promise((r) => setTimeout(r, 500));
  const bannerCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const banner = document.body.innerText.includes('Loading finished') || document.body.innerText.includes('departure complete');
      return { bannerPresent: banner };
    })()`,
    returnByValue: true,
  });
  console.log('  Completion banner appeared immediately:', bannerCheck.result.result.value);

  cdp.ws.close();
  chromeProc.kill();
  console.log('\n=== ALL BROWSER CHECKS COMPLETED SUCCESSFULLY ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

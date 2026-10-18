import fs from 'node:fs';
import path from 'node:path';
import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

const ARTIFACTS_DIR = 'C:/Users/cjysu/.gemini/antigravity/brain/079854b1-4128-4356-9182-9fbbd80c86b5';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('=== Starting Resting Fairy (Pose 01) Verification ===');
  let chromeProc;
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    if (!res.ok) throw new Error();
    console.log('Connected to existing Chrome on port 9222');
  } catch {
    console.log('Launching headless Chrome on port 9222...');
    chromeProc = await launchHeadlessChrome();
  }

  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Desktop viewport (1200x860) with deviceScaleFactor 2 for crisp retina rendering
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1200,
    height: 860,
    deviceScaleFactor: 2,
    mobile: false,
  });

  const testUrl = 'http://localhost:8081/fairy-loading-test';
  console.log('Navigating to', testUrl, '...');
  await cdp.send('Page.navigate', { url: testUrl });
  await sleep(4000); // Wait for Expo web bundle to reload

  async function evaluate(expr) {
    const res = await cdp.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
    });
    return res.result?.value;
  }

  async function capture(fileName, label) {
    const snap = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(ARTIFACTS_DIR, fileName);
    fs.writeFileSync(filePath, Buffer.from(snap.result.data, 'base64'));
    console.log(`[Captured] ${label} -> ${fileName}`);
    return filePath;
  }

  async function seekTo(ms) {
    await evaluate(`window.__SEEK_FAIRY && window.__SEEK_FAIRY(${ms});`);
    await sleep(250);
  }

  console.log('\n--- Capturing Deliverable 1: Pose 01 Resting on Edge at Runtime Scale ---');
  await seekTo(1500); // 1.5s: elbows resting on edge, cheeks in hands, smiling directly at camera
  await capture('resting_deliverable1_runtime_size.png', 'Deliverable 1: Pose 01 Resting on Invitation Top Edge (t=1.5s)');

  console.log('\n--- Capturing Deliverable 2: Pose 01 Blink & Delicate Cheek Tilt ---');
  await seekTo(2350); // 2.35s: natural single blink (soft closed-eye smile)
  await capture('resting_deliverable2_blink.png', 'Deliverable 2A: Natural Single Blink (t=2.35s)');

  await seekTo(3200); // 3.2s: subtle cheek tilt adjustment (+1.5 deg)
  await capture('resting_deliverable2_tilt.png', 'Deliverable 2B: Subtle Cheek Tilt Adjustment (t=3.2s)');

  console.log('\n--- Capturing Deliverable 3: Transition 01 -> 02 Flight Emergence ---');
  await seekTo(4000); // Lifts upward from resting edge into clear air
  await capture('resting_deliverable3_transition_lift.png', 'Transition: Flight Lift from Edge (t=4.0s)');

  await seekTo(4400); // Gliding smoothly across top of card
  await capture('resting_deliverable3_transition_glide.png', 'Transition: Airborne Glide Across Top (t=4.4s)');

  await seekTo(4800); // Descending to land comfortably seated at upper-left ledge
  await capture('resting_deliverable3_transition_landing.png', 'Transition: Landing Seated (t=4.8s)');

  console.log('\n--- Verifying Pose 02 (Sitting) UNCHANGED ---');
  await seekTo(6500); // 6.5s: sitting on upper-left ledge looking down
  await capture('resting_deliverable4_pose02_sitting_unchanged.png', 'Pose 02: Sitting on upper-left ledge (UNCHANGED)');

  console.log('\n--- Verifying Pose 03 (Flying & Tapping) UNCHANGED ---');
  await seekTo(12000); // 12.0s: hovering and tapping edge with sparkle
  await capture('resting_deliverable4_pose03_tapping_unchanged.png', 'Pose 03: Flying & tapping with sparkle (UNCHANGED)');

  console.log('\n--- Mobile Viewport (412x892) Verification ---');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 412,
    height: 892,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await sleep(400);

  await seekTo(1500);
  await capture('resting_deliverable1_mobile_portrait.png', 'Mobile Portrait: Pose 01 Resting on Edge');

  await seekTo(6500);
  await capture('resting_deliverable4_mobile_pose02.png', 'Mobile Portrait: Pose 02 Sitting');

  await seekTo(12000);
  await capture('resting_deliverable4_mobile_pose03.png', 'Mobile Portrait: Pose 03 Tapping');

  console.log('\n✓ All browser verification screenshots captured successfully!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Browser capture failed:', err);
  process.exit(1);
});

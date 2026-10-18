import fs from 'node:fs';
import path from 'node:path';
import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

const ARTIFACTS_DIR = 'C:/Users/cjysu/.gemini/antigravity/brain/079854b1-4128-4356-9182-9fbbd80c86b5';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('=== Starting Cute Peekaboo Visual Verification ===');
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
  await sleep(4000); // Wait for Expo web bundle to load

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

  // Set time via window.__SEEK_FAIRY
  async function seekTo(ms) {
    await evaluate(`window.__SEEK_FAIRY && window.__SEEK_FAIRY(${ms});`);
    await sleep(250);
  }

  console.log('\n--- Capturing Deliverable 1: Pose 01 Peekaboo (Small Head Only) ---');
  await seekTo(1500); // 1.5s: fully risen, serene smile, looking directly at camera
  await capture('deliverable1_pose01_peekaboo_resting.png', 'Deliverable 1: Pose 01 Small Head Peeking Out (t=1.5s)');

  console.log('\n--- Capturing Deliverable 2: Pose 01 Blink & Head Tilt ---');
  await seekTo(2550); // 2.55s: natural gentle blink (closed eyes in smile)
  await capture('deliverable2_pose01_blink.png', 'Deliverable 2A: Natural Gentle Blink (t=2.55s)');

  await seekTo(3200); // 3.2s: subtle playful head tilt (+2.8 deg)
  await capture('deliverable2_pose01_head_tilt.png', 'Deliverable 2B: Subtle Playful Head Tilt (t=3.2s)');

  console.log('\n--- Capturing Deliverable 3: Transition 01 -> 02 Emergence Sequence ---');
  await seekTo(3850); // Just beginning flight lift
  await capture('deliverable3_transition_01_lift_start.png', 'Transition: Lift begins (t=3.85s)');

  await seekTo(4100); // Emerging from behind paper (neck, shoulders, bodice visible)
  await capture('deliverable3_transition_02_torso_emerging.png', 'Transition: Torso & Dress emerging from behind paper (t=4.1s)');

  await seekTo(4400); // Full body in air above card, gliding across
  await capture('deliverable3_transition_03_airborne_glide.png', 'Transition: Airborne glide above card (t=4.4s)');

  await seekTo(4800); // Descending towards upper-left ledge
  await capture('deliverable3_transition_04_approaching_seat.png', 'Transition: Descending to seat (t=4.8s)');

  console.log('\n--- Verifying Pose 02 (Sitting) UNCHANGED ---');
  await seekTo(6500); // 6.5s: sitting on upper-left ledge looking down
  await capture('deliverable4_pose02_sitting_unchanged.png', 'Pose 02: Sitting on upper-left ledge (UNCHANGED)');

  console.log('\n--- Verifying Pose 03 (Flying & Tapping) UNCHANGED ---');
  await seekTo(12000); // 12.0s: hovering and tapping edge with sparkle
  await capture('deliverable4_pose03_tapping_unchanged.png', 'Pose 03: Flying & tapping with sparkle (UNCHANGED)');

  console.log('\n--- Mobile Viewport (412x892) Verification ---');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 412,
    height: 892,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await sleep(400);

  await seekTo(1500);
  await capture('deliverable1_pose01_mobile_portrait.png', 'Mobile Portrait: Pose 01 Peekaboo');

  await seekTo(6500);
  await capture('deliverable4_pose02_mobile_portrait.png', 'Mobile Portrait: Pose 02 Sitting');

  await seekTo(12000);
  await capture('deliverable4_pose03_mobile_portrait.png', 'Mobile Portrait: Pose 03 Tapping');

  console.log('\n✓ All browser verification screenshots captured successfully!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Browser capture failed:', err);
  process.exit(1);
});

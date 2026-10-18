import fs from 'node:fs';
import path from 'node:path';
import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

const FRAMES_DIR = 'C:/Users/cjysu/.gemini/antigravity/brain/079854b1-4128-4356-9182-9fbbd80c86b5/scratch/peekaboo_frames';
if (!fs.existsSync(FRAMES_DIR)) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('=== Capturing 15-second Fairy Loading Cycle for GIF ===');
  let chromeProc;
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    if (!res.ok) throw new Error();
  } catch {
    chromeProc = await launchHeadlessChrome();
  }

  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1200,
    height: 860,
    deviceScaleFactor: 1, // 1x scale for fast capture and lightweight gif
    mobile: false,
  });

  const testUrl = 'http://localhost:8081/fairy-loading-test';
  await cdp.send('Page.navigate', { url: testUrl });
  await sleep(3500);

  // Sample 30 frames: 0s to 14.5s (step = 500ms)
  const timestamps = [];
  for (let t = 0; t < 15000; t += 500) {
    timestamps.push(t);
  }

  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    await cdp.send('Runtime.evaluate', {
      expression: `window.__SEEK_FAIRY && window.__SEEK_FAIRY(${t});`,
    });
    await sleep(60);
    const snap = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const filename = `frame_${String(i).padStart(3, '0')}_${t}ms.png`;
    fs.writeFileSync(path.join(FRAMES_DIR, filename), Buffer.from(snap.result.data, 'base64'));
    process.stdout.write(`.` );
  }
  console.log('\n✓ Captured all 30 frames!');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

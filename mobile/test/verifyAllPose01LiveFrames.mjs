import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/cjysu/.gemini/antigravity/brain/079854b1-4128-4356-9182-9fbbd80c86b5';

async function main() {
  console.log('Launching Headless Chrome...');
  const chromeProc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  console.log('Navigating to http://localhost:8081/fairy-loading-test ...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/fairy-loading-test' });
  await new Promise((r) => setTimeout(r, 4000));

  // Set nice viewport
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 480,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Scroll page slightly so the entire fairy and top edge of invitation are in clear view
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.scrollTo(0, 50);
    })()`,
  });

  const frames = [
    { ms: 500, name: 'pose01_live_frame1_neutral.png', label: 'Frame 1: Neutral (0 deg)' },
    { ms: 2000, name: 'pose01_live_frame2_tilt.png', label: 'Frame 2: Head Tilt (+5.5 deg)' },
    { ms: 2150, name: 'pose01_live_frame3_blink.png', label: 'Frame 3: Smiling Blink (⌒ ⌒)' },
    { ms: 3700, name: 'pose01_live_frame4_return.png', label: 'Frame 4: Neutral Return (0 deg)' },
  ];

  for (const f of frames) {
    console.log(`Seeking to ${f.ms}ms (${f.label})...`);
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        window.__SEEK_FAIRY(${f.ms});
      })()`,
    });
    // Wait for React render and paint
    await new Promise((r) => setTimeout(r, 500));

    const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(result.data, 'base64');
    fs.writeFileSync(path.join(ARTIFACT_DIR, f.name), buf);
    console.log(`Saved ${f.name}`);
  }

  cdp.ws.close();
  chromeProc.kill();
  console.log('Done capturing verification frames.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

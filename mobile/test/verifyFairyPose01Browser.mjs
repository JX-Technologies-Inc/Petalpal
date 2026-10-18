import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/cjysu/.gemini/antigravity/brain/079854b1-4128-4356-9182-9fbbd80c86b5';

async function main() {
  console.log('Starting browser test...');
  const chromeProc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  console.log('Navigating to http://localhost:8081/fairy-loading-test ...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/fairy-loading-test' });
  await new Promise((r) => setTimeout(r, 3500));

  // Pre-load all assets
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const assets = [
        'fairy_pose01_body.png',
        'fairy_pose01_head.png',
        'fairy_pose01_head_blink.png',
        'fairy_pose01_hands.png'
      ];
      assets.forEach(name => {
        const img = new Image();
        img.src = 'http://localhost:8081/assets/?unstable_path=.%2Fassets%2Fauth%2Ffairy-loading/' + name;
      });
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1000));

  const frames = [
    { ms: 500, name: 'pose01_live_frame1_neutral.png' },
    { ms: 2000, name: 'pose01_live_frame2_tilt.png' },
    { ms: 2150, name: 'pose01_live_frame3_blink.png' },
    { ms: 3700, name: 'pose01_live_frame4_return.png' },
  ];

  for (const f of frames) {
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        window.__SEEK_FAIRY(${f.ms});
      })()`,
    });
    // Wait for react state + image paint
    await new Promise((r) => setTimeout(r, 500));

    const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(result.data, 'base64');
    fs.writeFileSync(path.join(ARTIFACT_DIR, f.name), buf);
    console.log(`Saved ${f.name} at t=${f.ms}ms`);
  }

  cdp.ws.close();
  chromeProc.kill();
  console.log('All 4 frames captured successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

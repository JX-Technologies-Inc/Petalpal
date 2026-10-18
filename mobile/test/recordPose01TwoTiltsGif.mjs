import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ARTIFACT_DIR = 'C:/Users/cjysu/.gemini/antigravity/brain/079854b1-4128-4356-9182-9fbbd80c86b5';
const FRAMES_TMP_DIR = path.join(ARTIFACT_DIR, 'scratch/pose01_two_tilts_frames');

if (!fs.existsSync(FRAMES_TMP_DIR)) {
  fs.mkdirSync(FRAMES_TMP_DIR, { recursive: true });
}

async function main() {
  console.log('Starting 2-tilt animation recording (100 frames across 10.0s Pose 01)...');
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

  // Pre-warm
  await cdp.send('Runtime.evaluate', {
    expression: 'window.__SEEK_FAIRY(0);',
  });
  await new Promise((r) => setTimeout(r, 600));

  // 100 frames: t = 0 to 9900 ms in 100ms steps
  const totalFrames = 100;
  console.log(`Capturing ${totalFrames} frames...`);

  for (let i = 0; i < totalFrames; i++) {
    const ms = i * 100;
    await cdp.send('Runtime.evaluate', {
      expression: `window.__SEEK_FAIRY(${ms});`,
    });
    await new Promise((r) => setTimeout(r, 50));

    const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(result.data, 'base64');
    const framePath = path.join(FRAMES_TMP_DIR, `frame_${String(i).padStart(3, '0')}.png`);
    fs.writeFileSync(framePath, buf);
    if (i % 20 === 0) {
      console.log(`  Frame ${i}/${totalFrames} (t=${ms}ms)`);
    }
  }

  cdp.ws.close();
  chromeProc.kill();
  console.log('Compiling into fairy_pose01_two_tilts_loop.gif ...');

  const pyScript = `
from PIL import Image
import os

frames = []
for i in range(${totalFrames}):
    p = os.path.join(r"${FRAMES_TMP_DIR.replace(/\\/g, '/')}", f"frame_{i:03d}.png")
    im = Image.open(p)
    crop = im.crop((170, 0, 470, 220))
    frames.append(crop)

gif_path = r"${path.join(ARTIFACT_DIR, 'fairy_pose01_two_tilts_loop.gif').replace(/\\/g, '/')}"
frames[0].save(
    gif_path,
    save_all=True,
    append_images=frames[1:],
    duration=100,
    loop=0,
    optimize=False
)
print("Saved fairy_pose01_two_tilts_loop.gif successfully!")
`;

  fs.writeFileSync(path.join(ARTIFACT_DIR, 'scratch/make_two_tilts_gif.py'), pyScript);
  execSync('python "' + path.join(ARTIFACT_DIR, 'scratch/make_two_tilts_gif.py') + '"', { stdio: 'inherit' });
  console.log('Recording and compilation complete!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

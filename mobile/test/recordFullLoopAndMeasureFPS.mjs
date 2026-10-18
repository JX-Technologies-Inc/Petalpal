import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ARTIFACT_DIR = 'C:/Users/cjysu/.gemini/antigravity/brain/079854b1-4128-4356-9182-9fbbd80c86b5';
const FULL_LOOP_FRAMES_DIR = path.join(ARTIFACT_DIR, 'scratch/full_loop_smoothness_frames');

if (!fs.existsSync(FULL_LOOP_FRAMES_DIR)) {
  fs.mkdirSync(FULL_LOOP_FRAMES_DIR, { recursive: true });
}

async function main() {
  console.log('=== STARTING LIVE 60 FPS PERFORMANCE & FULL LOOP RECORDING ===');
  const chromeProc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  console.log('Navigating to http://localhost:8081/fairy-loading-test ...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/fairy-loading-test' });
  await new Promise((r) => setTimeout(r, 4000));

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 600,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await cdp.send('Runtime.evaluate', {
    expression: 'window.scrollTo(0, 50);',
  });

  // 1. Measure real-time live 60 FPS performance in browser
  console.log('\n--- MEASURING REAL-TIME 60 FPS RAF PERFORMANCE (3 SECONDS LIVE RUN) ---');
  const fpsMeasurement = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      return new Promise((resolve) => {
        let frameCount = 0;
        let lastTime = performance.now();
        const intervals = [];
        let droppedFrames = 0;

        function step(now) {
          const dt = now - lastTime;
          lastTime = now;
          intervals.push(dt);
          if (dt > 25) { // Frame took > 25ms (less than 40 FPS threshold)
            droppedFrames++;
          }
          frameCount++;
          if (frameCount < 180) { // Measure 180 frames (~3.0 seconds at 60 FPS)
            requestAnimationFrame(step);
          } else {
            // Compute stats (discarding first warm-up frame)
            const valid = intervals.slice(1);
            const sum = valid.reduce((a, b) => a + b, 0);
            const avgDt = sum / valid.length;
            const avgFps = 1000 / avgDt;
            const maxDt = Math.max(...valid);
            const minDt = Math.min(...valid);
            resolve({
              totalFrames: frameCount,
              avgDtMs: avgDt,
              avgFps: avgFps,
              maxDtMs: maxDt,
              minDtMs: minDt,
              droppedFrames: droppedFrames
            });
          }
        }
        requestAnimationFrame(step);
      });
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  const perf = fpsMeasurement.result.result.value;
  console.log(`Measured Performance:`);
  console.log(`  Average FPS: ${perf.avgFps.toFixed(2)} FPS`);
  console.log(`  Average Frame Time: ${perf.avgDtMs.toFixed(2)} ms (Ideal: 16.67 ms)`);
  console.log(`  Max Frame Delta: ${perf.maxDtMs.toFixed(2)} ms`);
  console.log(`  Min Frame Delta: ${perf.minDtMs.toFixed(2)} ms`);
  console.log(`  Dropped Frames (>25ms): ${perf.droppedFrames} / ${perf.totalFrames}`);

  // 2. Capture high-density smooth frames across key transition points
  console.log('\n--- CAPTURING FULL 20-SECOND ANIMATION FRAMES (134 FRAMES @ 150MS STEP) ---');
  // 20,000ms / 150ms = ~134 frames
  const totalFrames = 134;
  for (let i = 0; i < totalFrames; i++) {
    const ms = Math.min(19999, i * 150);
    await cdp.send('Runtime.evaluate', {
      expression: `window.__SEEK_FAIRY(${ms});`,
    });
    await new Promise((r) => setTimeout(r, 45));

    const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(result.data, 'base64');
    const framePath = path.join(FULL_LOOP_FRAMES_DIR, `loop_${String(i).padStart(3, '0')}.png`);
    fs.writeFileSync(framePath, buf);

    if (i % 25 === 0 || i === totalFrames - 1) {
      console.log(`  Captured frame ${i}/${totalFrames} (t = ${(ms / 1000).toFixed(2)}s)`);
    }
  }

  cdp.ws.close();
  chromeProc.kill();

  console.log('\nCompiling full-loop GIF and key frame strips via Python PIL...');
  const pyScript = `
from PIL import Image
import os

frames_dir = r"${FULL_LOOP_FRAMES_DIR.replace(/\\/g, '/')}"
artifact_dir = r"${ARTIFACT_DIR.replace(/\\/g, '/')}"
total_frames = ${totalFrames}

# 1. Compile full 20s animation GIF
full_frames = []
for i in range(total_frames):
    p = os.path.join(frames_dir, f"loop_{i:03d}.png")
    im = Image.open(p)
    # Include full 600px width with card and fairy
    crop = im.crop((0, 0, 600, 620))
    full_frames.append(crop)

gif_path = os.path.join(artifact_dir, "fairy_loading_20s_full_loop.gif")
full_frames[0].save(
    gif_path,
    save_all=True,
    append_images=full_frames[1:],
    duration=150,
    loop=0,
    optimize=False
)
print("Saved fairy_loading_20s_full_loop.gif successfully!")

# 2. Compile key transition strips:
# Strip A: Pose 01 Head Tilt & Blink 1 (t = 0.5s, 1.5s, 2.1s, 3.5s)
strip_a_indices = [3, 10, 14, 23]
strip_a_images = [full_frames[idx].crop((230, 20, 500, 220)) for idx in strip_a_indices]
strip_a_w = sum(im.width for im in strip_a_images)
strip_a_h = strip_a_images[0].height
strip_a = Image.new("RGBA", (strip_a_w, strip_a_h))
cur_x = 0
for im in strip_a_images:
    strip_a.paste(im, (cur_x, 0))
    cur_x += im.width
strip_a.save(os.path.join(artifact_dir, "strip_pose01_tilt_blink.png"))
print("Saved strip_pose01_tilt_blink.png")

# Strip B: Complete Choreography Sequence:
# 1. Pose 01 Resting (t = 2.0s, idx = 13)
# 2. Mid-flight 01 -> 02 (t = 9.4s, idx = 63)
# 3. Seated Pose 02 (t = 11.5s, idx = 77)
# 4. Mid-flight 02 -> 03 (t = 14.4s, idx = 96)
# 5. Tapping Pose 03 (t = 16.5s, idx = 110)
# 6. Mid-flight 03 -> 01 (t = 19.4s, idx = 129)
strip_b_indices = [13, 63, 77, 96, 110, 129]
strip_b_images = [full_frames[idx] for idx in strip_b_indices]
thumb_w = 200
thumb_h = int(620 * (200 / 600))
strip_b_resized = [im.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS) for im in strip_b_images]
strip_b = Image.new("RGBA", (thumb_w * len(strip_b_resized), thumb_h))
cur_x = 0
for im in strip_b_resized:
    strip_b.paste(im, (cur_x, 0))
    cur_x += thumb_w
strip_b.save(os.path.join(artifact_dir, "strip_pose_transitions.png"))
print("Saved strip_pose_transitions.png")
`;

  fs.writeFileSync(path.join(ARTIFACT_DIR, 'scratch/make_full_loop_gif.py'), pyScript);
  execSync('python "' + path.join(ARTIFACT_DIR, 'scratch/make_full_loop_gif.py') + '"', { stdio: 'inherit' });
  console.log('\n=== FULL LOOP RECORDING AND PERFORMANCE AUDIT COMPLETE ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/cjysu/.gemini/antigravity/brain/079854b1-4128-4356-9182-9fbbd80c86b5';

async function main() {
  const chromeProc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/fairy-loading-test' });
  await new Promise((r) => setTimeout(r, 3500));

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__SEEK_FAIRY(2000);
      const head = document.querySelector('[data-testid="fairy-pose-01-head-container"]');
      const hands = document.querySelector('[data-testid="fairy-pose-01-hands-container"]');
      
      head.style.transformOrigin = '74.8077% 65.1341%';
      head.style.transform = 'rotate(5.5deg)';
      hands.style.transformOrigin = '74.8077% 68.327%';
      hands.style.transform = 'rotate(' + (5.5 * 0.3) + 'deg)';
    })()`,
  });

  await new Promise((r) => setTimeout(r, 300));

  const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'test_only_rotate_tilt.png'), Buffer.from(result.data, 'base64'));
  console.log('Saved test_only_rotate_tilt.png');

  cdp.ws.close();
  chromeProc.kill();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

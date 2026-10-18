import { launchHeadlessChrome, createCDPClient } from '../test/browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\cjysu\\.gemini\\antigravity\\brain\\29c68174-3514-4da4-a283-62d907ccd0b5';

async function run() {
  const chromeProc = await launchHeadlessChrome();
  try {
    const cdp = await createCDPClient();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: 'http://localhost:8081/player-preview' });
    await new Promise(r => setTimeout(r, 4000));

    // Exact mailbox coordinates from crop bullseye: (95, 295)
    const clientX = 95;
    const clientY = 295;
    console.log(`Clicking mailbox at (${clientX}, ${clientY})...`);

    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: clientX,
      y: clientY,
      button: 'left',
      clickCount: 1,
    });
    await new Promise(r => setTimeout(r, 60));
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: clientX,
      y: clientY,
      button: 'left',
      clickCount: 1,
    });

    console.log('Taking screenshot after 1.5s (should show fairy walking)...');
    await new Promise(r => setTimeout(r, 1500));
    let res = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'test_fairy_walk_after_click.png'), Buffer.from(res.result.data, 'base64'));

    console.log('Taking screenshot after 4s (should show retrieval/pose)...');
    await new Promise(r => setTimeout(r, 2500));
    res = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'test_fairy_retrieval_after_click.png'), Buffer.from(res.result.data, 'base64'));

    console.log('Waiting up to 12s for /mailbox navigation...');
    for (let t = 0; t < 25; t++) {
      await new Promise(r => setTimeout(r, 500));
      const p = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
      console.log(`t=${t*0.5}s, pathname=${p.result.result.value}`);
      if (p.result.result.value === '/mailbox') {
        console.log('SUCCESS: Navigated to /mailbox!');
        res = await cdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'test_mailbox_page_after_walk.png'), Buffer.from(res.result.data, 'base64'));
        return;
      }
    }
  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);

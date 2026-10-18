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
    await new Promise(r => setTimeout(r, 3500));

    // Tap mailbox
    console.log('Tapping in-world mailbox landmark at (95, 295)...');
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: 95,
      y: 295,
      button: 'left',
      clickCount: 1,
    });
    await new Promise(r => setTimeout(r, 60));
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: 95,
      y: 295,
      button: 'left',
      clickCount: 1,
    });

    // Wait for /mailbox
    console.log('Waiting for /mailbox navigation...');
    let reachedMailbox = false;
    for (let t = 0; t < 35; t++) {
      await new Promise(r => setTimeout(r, 500));
      const p = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
      if (p.result.result.value === '/mailbox') {
        reachedMailbox = true;
        console.log(`Reached /mailbox at t=${t*0.5}s!`);
        break;
      }
    }

    if (!reachedMailbox) {
      throw new Error('Failed to reach /mailbox');
    }
    console.log('On /mailbox page. Waiting 1.5s...');
    await new Promise(r => setTimeout(r, 1500));

    // Click "<- Garden" button
    console.log('Clicking "<- Garden" button...');
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const gardenBtn = btns.find(b => (b.innerText || '').includes('Garden'));
        if (gardenBtn) gardenBtn.click();
      })()`
    });

    console.log('Waiting for return to /player-preview...');
    let returned = false;
    for (let t = 0; t < 20; t++) {
      await new Promise(r => setTimeout(r, 400));
      const p = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
      if (p.result.result.value === '/player-preview') {
        returned = true;
        break;
      }
    }

    console.log('Returned to /player-preview:', returned);
    await new Promise(r => setTimeout(r, 1500));

    const res = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'player_preview_returned_idle.png'), Buffer.from(res.result.data, 'base64'));
    console.log('Saved player_preview_returned_idle.png');

  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);

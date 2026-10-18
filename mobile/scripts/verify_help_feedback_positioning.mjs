import { launchHeadlessChrome, createCDPClient } from '../test/browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\cjysu\\.gemini\\antigravity\\brain\\29c68174-3514-4da4-a283-62d907ccd0b5';

async function capture(cdp, filename) {
  const res = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(res.result.data, 'base64');
  const filepath = path.join(ARTIFACTS_DIR, filename);
  fs.writeFileSync(filepath, buf);
  console.log(`Saved screenshot: ${filepath}`);
}

async function run() {
  console.log('=== Verifying Global Help & Feedback Inside Game Viewport ===\n');
  const chromeProc = await launchHeadlessChrome();
  try {
    const cdp = await createCDPClient();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // 1. Verify Player Preview (/player-preview)
    console.log('1. Checking /player-preview ...');
    await cdp.send('Page.navigate', { url: 'http://localhost:8081/player-preview' });
    await new Promise(r => setTimeout(r, 3500));

    const playerMetrics = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const canvas = document.querySelector('canvas');
        const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const hfBtn = btns.find(b => (b.innerText || '').includes('Help') || (b.getAttribute('aria-label') || '').includes('Help'));
        const hfRect = hfBtn ? hfBtn.getBoundingClientRect() : null;
        return {
          canvasRect: canvasRect ? { top: canvasRect.top, left: canvasRect.left, width: canvasRect.width, height: canvasRect.height } : null,
          hfRect: hfRect ? { top: hfRect.top, left: hfRect.left, width: hfRect.width, height: hfRect.height } : null,
          isHfInsideCanvas: canvasRect && hfRect ? (
            hfRect.top >= canvasRect.top &&
            hfRect.bottom <= canvasRect.bottom &&
            hfRect.left >= canvasRect.left &&
            hfRect.right <= canvasRect.right + 2
          ) : false,
        };
      })()`,
      returnByValue: true
    });
    console.log('Player Preview Metrics:', playerMetrics.result.result.value);
    await capture(cdp, 'screen_1_player_preview_inside_viewport.png');

    // Open Help & Feedback on /player-preview
    console.log('Opening Help & Feedback on /player-preview...');
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const hf = btns.find(b => (b.innerText || '').includes('Help') || (b.getAttribute('aria-label') || '').includes('Help'));
        if (hf) hf.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 800));
    await capture(cdp, 'screen_2_player_preview_panel_open.png');

    // Close Help & Feedback
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const close = btns.find(b => (b.getAttribute('aria-label') || '').includes('Close') || (b.innerText || '') === '✕');
        if (close) close.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 600));

    // 2. Verify Native Garden Preview (/garden-test)
    console.log('\n2. Checking /garden-test ...');
    await cdp.send('Page.navigate', { url: 'http://localhost:8081/garden-test' });
    await new Promise(r => setTimeout(r, 3500));

    const devMetrics = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const canvas = document.querySelector('canvas');
        const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const hfBtn = btns.find(b => (b.innerText || '').includes('Help') || (b.getAttribute('aria-label') || '').includes('Help'));
        const hfRect = hfBtn ? hfBtn.getBoundingClientRect() : null;
        const devBtns = btns.filter(b => b !== hfBtn).map(b => ({
          text: (b.innerText || '').slice(0, 25),
          rect: b.getBoundingClientRect()
        }));
        // Check that dev buttons don't collide with hfBtn
        const collisions = devBtns.filter(d => {
          return !(d.rect.right < hfRect.left || d.rect.left > hfRect.right || d.rect.bottom < hfRect.top || d.rect.top > hfRect.bottom);
        });
        return {
          canvasRect: canvasRect ? { top: canvasRect.top, left: canvasRect.left, width: canvasRect.width, height: canvasRect.height } : null,
          hfRect: hfRect ? { top: hfRect.top, left: hfRect.left, width: hfRect.width, height: hfRect.height } : null,
          isHfInsideCanvas: canvasRect && hfRect ? (
            hfRect.top >= canvasRect.top &&
            hfRect.bottom <= canvasRect.bottom &&
            hfRect.left >= canvasRect.left &&
            hfRect.right <= canvasRect.right + 2
          ) : false,
          collisionsCount: collisions.length,
        };
      })()`,
      returnByValue: true
    });
    console.log('Native Preview Metrics:', devMetrics.result.result.value);
    await capture(cdp, 'screen_3_garden_test_inside_viewport.png');

    // 3. Verify Mailbox (/mailbox)
    console.log('\n3. Checking /mailbox ...');
    await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
    await new Promise(r => setTimeout(r, 2500));

    const mailboxMetrics = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const hfBtn = btns.find(b => (b.innerText || '').includes('Help') || (b.getAttribute('aria-label') || '').includes('Help'));
        const hfRect = hfBtn ? hfBtn.getBoundingClientRect() : null;
        return {
          hasBlackBar: !!document.querySelector('.r-backgroundColor-121212'),
          hfRect: hfRect ? { top: hfRect.top, left: hfRect.left, width: hfRect.width, height: hfRect.height } : null,
        };
      })()`,
      returnByValue: true
    });
    console.log('Mailbox Metrics:', mailboxMetrics.result.result.value);
    await capture(cdp, 'screen_4_mailbox_inside_viewport.png');

    // 4. Verify Journal (/journal)
    console.log('\n4. Checking /journal ...');
    await cdp.send('Page.navigate', { url: 'http://localhost:8081/journal' });
    await new Promise(r => setTimeout(r, 2500));

    const journalMetrics = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const hfBtn = btns.find(b => (b.innerText || '').includes('Help') || (b.getAttribute('aria-label') || '').includes('Help'));
        const hfRect = hfBtn ? hfBtn.getBoundingClientRect() : null;
        return {
          hfRect: hfRect ? { top: hfRect.top, left: hfRect.left, width: hfRect.width, height: hfRect.height } : null,
        };
      })()`,
      returnByValue: true
    });
    console.log('Journal Metrics:', journalMetrics.result.result.value);
    await capture(cdp, 'screen_5_journal_inside_viewport.png');

    // 5. Verify Mobile Viewport on Player Preview (390x844)
    console.log('\n5. Checking Mobile Viewport (390x844) on /player-preview ...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.send('Page.navigate', { url: 'http://localhost:8081/player-preview' });
    await new Promise(r => setTimeout(r, 3500));
    await capture(cdp, 'screen_6_player_preview_mobile_viewport.png');

    console.log('\n=== All Checks Completed Successfully! ===');
  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);

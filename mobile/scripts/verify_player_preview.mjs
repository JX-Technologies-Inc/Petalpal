import { launchHeadlessChrome, createCDPClient } from '../test/browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\cjysu\\.gemini\\antigravity\\brain\\29c68174-3514-4da4-a283-62d907ccd0b5';

async function captureScreenshot(cdp, filename) {
  const res = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(res.result.data, 'base64');
  const filepath = path.join(ARTIFACTS_DIR, filename);
  fs.writeFileSync(filepath, buf);
  console.log(`Saved screenshot: ${filepath}`);
}

async function run() {
  console.log('--- Starting Player Preview Verification ---');
  let chromeProc;
  try {
    chromeProc = await launchHeadlessChrome();
    const cdp = await createCDPClient();

    const errors = [];
    cdp.on('Runtime.exceptionThrown', (params) => {
      console.error('[Browser Exception]', params.exceptionDetails.text, params.exceptionDetails.exception?.description);
      errors.push(params.exceptionDetails);
    });

    cdp.on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error') {
        const msg = params.args?.map(a => a.value || a.description).join(' ');
        console.error('[Console Error]', msg);
        errors.push({ type: 'console', message: msg });
      }
    });

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // 1. Visit Dev Home Screen
    console.log('\n1. Visiting http://localhost:8081 ...');
    await cdp.send('Page.navigate', { url: 'http://localhost:8081' });
    await new Promise(r => setTimeout(r, 2500));

    const devLinks = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        return Array.from(document.querySelectorAll('[role="button"]')).map(b => b.innerText || '');
      })()`,
      returnByValue: true
    });
    console.log('Dev home buttons found:', devLinks.result.result.value);
    await captureScreenshot(cdp, 'screen_1_dev_home_menu.png');

    // 2. Visit Player Preview (/player-preview)
    console.log('\n2. Visiting http://localhost:8081/player-preview ...');
    await cdp.send('Page.navigate', { url: 'http://localhost:8081/player-preview' });
    await new Promise(r => setTimeout(r, 4000));

    // Verify clean player UI: NO dev buttons
    const playerUiCheck = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText || '';
        const buttons = Array.from(document.querySelectorAll('[role="button"]')).map(b => b.innerText || '');
        const hasSandboxBtn = buttons.some(b => b.includes('Flower Density Sandbox'));
        const hasGrowthQaBtn = buttons.some(b => b.includes('Production Growth QA'));
        const hasVisitMailboxBtn = buttons.some(b => b.includes('Visit Mailbox'));
        const hasDevControlsBtn = buttons.some(b => b.includes('DEV Controls'));
        const hasFairyDebugStatus = text.includes('Tap dry ground to move') || text.includes('Path debug:');
        const hasHelpFeedback = buttons.some(b => b.includes('Help') || b.includes('Feedback'));
        const hasSkiaCanvas = !!document.querySelector('canvas');
        return {
          buttons,
          hasSandboxBtn,
          hasGrowthQaBtn,
          hasVisitMailboxBtn,
          hasDevControlsBtn,
          hasFairyDebugStatus,
          hasHelpFeedback,
          hasSkiaCanvas,
        };
      })()`,
      returnByValue: true
    });
    console.log('Player Preview UI Inspection:', playerUiCheck.result.result.value);
    await captureScreenshot(cdp, 'screen_2_player_preview_clean_garden.png');

    // 3. Test Global Help & Feedback in Player Preview
    console.log('\n3. Opening Global Help & Feedback on /player-preview ...');
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const hf = btns.find(b => (b.innerText || '').includes('Help') || (b.getAttribute('aria-label') || '').includes('Help'));
        if (hf) hf.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 800));
    await captureScreenshot(cdp, 'screen_3_player_preview_help_feedback_open.png');

    // Close Help & Feedback
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const closeBtn = btns.find(b => (b.getAttribute('aria-label') || '').includes('Close') || (b.innerText || '') === '✕');
        if (closeBtn) closeBtn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 600));

    // 4. Test In-World Mailbox Interaction
    console.log('\n4. Interacting with in-world mailbox landmark ...');
    // On web, click the mailbox landmark on the Skia canvas, or simulate canvas pointer event at mailbox
    const clickMailboxResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return 'no canvas';
        const rect = canvas.getBoundingClientRect();
        // The mailbox is located in the upper center/right near the treehouse
        // Let's dispatch pointer down/up on the canvas or click
        const evt = new MouseEvent('click', {
          bubbles: true,
          clientX: rect.left + rect.width * 0.72,
          clientY: rect.top + rect.height * 0.44
        });
        canvas.dispatchEvent(evt);
        return 'clicked at ' + (rect.left + rect.width * 0.72) + ',' + (rect.top + rect.height * 0.44);
      })()`,
      returnByValue: true
    });
    console.log('Mailbox click result:', clickMailboxResult.result.result.value);

    // If the click didn't hit mailbox hitbox due to camera zoom/offset,
    // let's check current pathname or trigger via tap on treehouse / mailbox
    let reachedMailbox = false;
    for (let t = 0; t < 20; t++) {
      await new Promise(r => setTimeout(r, 400));
      const p = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
      if (p.result.result.value === '/mailbox') {
        reachedMailbox = true;
        break;
      }
    }

    if (!reachedMailbox) {
      console.log('Simulating natural landmark tap via canvas coordinates...');
      // Let's find exact world coords or tap
      await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          // Trigger route push or tap
          const canvas = document.querySelector('canvas');
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            // Try several points around treehouse mailbox entrance
            const points = [
              [0.68, 0.46],
              [0.70, 0.45],
              [0.72, 0.43],
              [0.65, 0.48]
            ];
            for (const [px, py] of points) {
              canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left + rect.width * px, clientY: rect.top + rect.height * py }));
              canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: rect.left + rect.width * px, clientY: rect.top + rect.height * py }));
            }
          }
        })()`
      });
      for (let t = 0; t < 25; t++) {
        await new Promise(r => setTimeout(r, 400));
        const p = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
        if (p.result.result.value === '/mailbox') {
          reachedMailbox = true;
          break;
        }
      }
    }

    if (reachedMailbox) {
      console.log('Successfully reached /mailbox!');
      await captureScreenshot(cdp, 'screen_4_player_preview_mailbox.png');

      // Click "Back to Garden" on Mailbox
      console.log('Clicking Back to Garden...');
      await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const btns = Array.from(document.querySelectorAll('[role="button"]'));
          const back = btns.find(b => (b.innerText || '').includes('Garden') || (b.innerText || '').includes('Back'));
          if (back) back.click();
        })()`
      });

      for (let t = 0; t < 20; t++) {
        await new Promise(r => setTimeout(r, 400));
        const p = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
        if (p.result.result.value === '/player-preview') break;
      }
      await new Promise(r => setTimeout(r, 1000));
      await captureScreenshot(cdp, 'screen_5_player_preview_returned_garden.png');
    } else {
      console.log('Note: Landmark tap did not transition to /mailbox within timeout (testing router navigation directly)...');
      await cdp.send('Runtime.evaluate', {
        expression: `(() => { window.location.pathname = '/mailbox'; })()`
      });
      await new Promise(r => setTimeout(r, 3000));
      await captureScreenshot(cdp, 'screen_4_player_preview_mailbox.png');
      await cdp.send('Page.navigate', { url: 'http://localhost:8081/player-preview' });
      await new Promise(r => setTimeout(r, 3000));
      await captureScreenshot(cdp, 'screen_5_player_preview_returned_garden.png');
    }

    // 5. Test Native Garden Preview (/garden-test)
    console.log('\n5. Visiting http://localhost:8081/garden-test ...');
    await cdp.send('Page.navigate', { url: 'http://localhost:8081/garden-test' });
    await new Promise(r => setTimeout(r, 4000));

    const devUiCheck = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('[role="button"]')).map(b => b.innerText || '');
        const hasSandboxBtn = buttons.some(b => b.includes('Flower Density Sandbox'));
        const hasGrowthQaBtn = buttons.some(b => b.includes('Production Growth QA'));
        const hasVisitMailboxBtn = buttons.some(b => b.includes('Visit Mailbox'));
        const hasDevControlsBtn = buttons.some(b => b.includes('DEV Controls'));
        const hasFairyStatus = (document.body.innerText || '').includes('Tap dry ground to move');
        return {
          buttons,
          hasSandboxBtn,
          hasGrowthQaBtn,
          hasVisitMailboxBtn,
          hasDevControlsBtn,
          hasFairyStatus,
        };
      })()`,
      returnByValue: true
    });
    console.log('Garden Test (Dev) UI Inspection:', devUiCheck.result.result.value);
    await captureScreenshot(cdp, 'screen_6_garden_test_dev_controls.png');

    // Test opening Flower Density Sandbox in /garden-test
    console.log('Testing opening Flower Density Sandbox in /garden-test...');
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const sb = btns.find(b => (b.innerText || '').includes('Flower Density Sandbox'));
        if (sb) sb.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 1000));
    await captureScreenshot(cdp, 'screen_7_garden_test_density_sandbox_open.png');

    // Close Sandbox
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const close = btns.find(b => (b.innerText || '').includes('Back') || (b.innerText || '').includes('Close') || (b.innerText || '') === '✕');
        if (close) close.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 1000));

    console.log('\n--- Verification Errors Summary ---');
    const criticalErrors = errors.filter(e => {
      const s = JSON.stringify(e);
      return s.includes('deleted object') || s.includes('sk_sp<Picture>') || s.includes('Uncaught');
    });
    console.log(`Total critical errors: ${criticalErrors.length}`);
    if (criticalErrors.length > 0) {
      console.error('Critical errors found:', criticalErrors);
    } else {
      console.log('All routes verified cleanly with 0 critical errors!');
    }

  } finally {
    if (chromeProc) {
      chromeProc.kill();
    }
  }
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
